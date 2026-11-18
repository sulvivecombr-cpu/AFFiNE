'use strict';

/**
 * Cable — site institucional oficial.
 * Servidor HTTP sem dependências externas.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, save, nextId, audit } = require('./src/store');
const { layout } = require('./src/layout');
const { esc } = require('./src/html');
const pages = require('./src/pages');
const admin = require('./src/admin');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ------------------------------------------------------------------ */
/* Sessões, senhas e limites                                          */
/* ------------------------------------------------------------------ */

const sessions = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 8;

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { salt: useSalt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, csrf: crypto.randomBytes(24).toString('hex'), createdAt: Date.now() });
  return token;
}

function sessionUser(req) {
  const token = req.cookies.cable_admin;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  const user = db().adminUsers.find((u) => u.id === session.userId);
  if (!user) return null;
  return { user, session, token };
}

const hits = new Map();
function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                       */
/* ------------------------------------------------------------------ */

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': payload.length,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    ...headers,
  });
  res.end(payload);
}

function sendJson(res, status, data) {
  const payload = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, { Location: location, 'Cache-Control': 'no-store', ...headers });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function readForm(req) {
  const raw = await readBody(req);
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try {
      return { json: JSON.parse(raw || '{}'), form: {} };
    } catch {
      return { json: {}, form: {} };
    }
  }
  const params = new URLSearchParams(raw);
  const form = {};
  for (const [key, value] of params.entries()) form[key] = value;
  return { json: null, form };
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || 'desconhecido';
}

function isHttps(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function siteOrigin(req) {
  const configured = db().settings.domains.site;
  if (configured) return configured.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const proto = isHttps(req) ? 'https' : 'http';
  return `${proto}://${host}`;
}

function baseCsp(nonce) {
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}'`,
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

/* ------------------------------------------------------------------ */
/* Contexto de renderização                                           */
/* ------------------------------------------------------------------ */

function context(req, extra = {}) {
  const data = db();
  return {
    settings: data.settings,
    features: data.features,
    faqs: data.faqs,
    helpArticles: data.helpArticles,
    legalDocs: data.legalDocs,
    plans: data.plans,
    origin: siteOrigin(req),
    query: req.query,
    flash: null,
    cookieStats: data.cookieConsents.length,
    data,
    ...extra,
  };
}

function render(req, res, view, status = 200) {
  const data = db();
  const nonce = crypto.randomBytes(16).toString('base64');
  const html = layout({
    settings: data.settings,
    path: req.path,
    title: view.title,
    description: view.description,
    body: view.body,
    origin: siteOrigin(req),
    jsonLd: view.jsonLd,
    noindex: view.noindex,
    activeKey: view.activeKey,
    nonce,
  });
  send(res, status, html, {
    'Content-Security-Policy': baseCsp(nonce),
    'Cache-Control': 'no-store',
  });
}

function flashFromQuery(query, message) {
  if (!query || !query.ok) return null;
  return {
    type: 'ok',
    title: message,
    message: '',
    protocol: query.protocolo || '',
  };
}

/* ------------------------------------------------------------------ */
/* Rotas públicas                                                     */
/* ------------------------------------------------------------------ */

const publicRoutes = [
  ['GET', /^\/$/, (req, res) => render(req, res, pages.home(context(req)))],
  ['GET', /^\/plataforma$/, (req, res) => render(req, res, pages.plataforma(context(req)))],
  ['GET', /^\/recursos$/, (req, res) => render(req, res, pages.recursos(context(req)))],
  ['GET', /^\/como-funciona$/, (req, res) => render(req, res, pages.comoFunciona(context(req)))],
  [
    'GET',
    /^\/planos$/,
    (req, res) =>
      render(
        req,
        res,
        pages.planos(
          context(req, { flash: flashFromQuery(req.query, 'Inscrição registrada na lista de interesse.') })
        )
      ),
  ],
  ['GET', /^\/baixar$/, (req, res) => render(req, res, pages.baixar(context(req)))],
  ['GET', /^\/ajuda$/, (req, res) => render(req, res, pages.ajuda(context(req)))],
  [
    'GET',
    /^\/ajuda\/([a-z0-9-]+)$/,
    (req, res, params) => {
      const data = db();
      const article = data.helpArticles.find((a) => a.slug === params[0]);
      const view = pages.ajudaArtigo(context(req), article);
      if (!view) return render(req, res, pages.notFound(context(req)), 404);
      return render(req, res, view);
    },
  ],
  ['GET', /^\/faq$/, (req, res) => render(req, res, pages.faqPage(context(req)))],
  [
    'GET',
    /^\/contato$/,
    (req, res) =>
      render(
        req,
        res,
        pages.contato(context(req, { flash: flashFromQuery(req.query, 'Solicitação registrada com sucesso.') }))
      ),
  ],
  [
    'GET',
    /^\/privacidade\/solicitacoes$/,
    (req, res) =>
      render(
        req,
        res,
        pages.titulares(context(req, { flash: flashFromQuery(req.query, 'Solicitação de titular registrada.') }))
      ),
  ],
  ['GET', /^\/cookies$/, (req, res) => render(req, res, pages.cookiesPage(context(req)))],
  [
    'GET',
    /^\/legal\/([a-z0-9-]+)$/,
    (req, res, params) => {
      const view = pages.legal(context(req), params[0]);
      if (!view) return render(req, res, pages.notFound(context(req)), 404);
      return render(req, res, view);
    },
  ],
];

/* ------------------------------------------------------------------ */
/* Formulários públicos                                               */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function newProtocol(prefix) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

async function handleContact(req, res) {
  const { form } = await readForm(req);
  const ip = clientIp(req);
  if (rateLimited(`contact:${ip}`, 6, 10 * 60 * 1000)) {
    return render(req, res, pages.contato(context(req, { flash: { type: 'error', message: 'Muitas solicitações em pouco tempo. Tente novamente em alguns minutos.' } })), 429);
  }
  if (form.extra) {
    return redirect(res, '/contato?ok=1');
  }
  const errors = [];
  const name = (form.name || '').trim();
  const email = (form.email || '').trim();
  const category = (form.category || '').trim();
  const message = (form.message || '').trim();

  if (name.length < 2) errors.push('Informe seu nome.');
  if (!EMAIL_RE.test(email)) errors.push('Informe um e-mail válido.');
  if (!category) errors.push('Selecione o assunto.');
  if (message.length < 10) errors.push('Descreva sua mensagem com pelo menos 10 caracteres.');

  if (errors.length) {
    return render(
      req,
      res,
      pages.contato(
        context(req, {
          flash: { type: 'error', title: 'Revise os campos.', message: errors.join(' ') },
          query: { ...req.query, assunto: category },
        })
      ),
      400
    );
  }

  const data = db();
  const protocol = newProtocol('CBL');
  const record = {
    id: nextId('contact'),
    protocol,
    name,
    email,
    category,
    message,
    consent: form.consent === '1',
    ip,
    status: 'novo',
    createdAt: new Date().toISOString(),
  };
  data.contactRequests.unshift(record);
  if (category === 'Suporte') {
    data.supportTickets.unshift({ ...record, id: nextId('ticket') });
  }
  audit(`formulário público (${email})`, 'contato.criado', `${category} · ${protocol}`);
  save();
  return redirect(res, `/contato?ok=1&protocolo=${encodeURIComponent(protocol)}`);
}

async function handlePlanInterest(req, res) {
  const { form } = await readForm(req);
  const ip = clientIp(req);
  if (rateLimited(`lead:${ip}`, 8, 10 * 60 * 1000)) {
    return render(req, res, pages.planos(context(req, { flash: { type: 'error', message: 'Muitas solicitações em pouco tempo. Tente novamente em alguns minutos.' } })), 429);
  }
  if (form.extra) return redirect(res, '/planos?ok=1#interesse');

  const name = (form.name || '').trim();
  const email = (form.email || '').trim();
  if (!EMAIL_RE.test(email)) {
    return render(req, res, pages.planos(context(req, { flash: { type: 'error', message: 'Informe um e-mail válido.' } })), 400);
  }

  const data = db();
  const protocol = newProtocol('LST');
  data.newsletterSubscriptions.unshift({
    id: nextId('lead'),
    protocol,
    name,
    email,
    interest: (form.plan || 'Indiferente').trim(),
    consent: form.consent === '1',
    source: 'lista-de-interesse',
    status: 'ativo',
    createdAt: new Date().toISOString(),
  });
  data.planInterests.unshift({ id: nextId('interest'), email, plan: form.plan || '', createdAt: new Date().toISOString() });
  audit(`formulário público (${email})`, 'lead.criado', protocol);
  save();
  return redirect(res, `/planos?ok=1&protocolo=${encodeURIComponent(protocol)}#interesse`);
}

async function handlePrivacyRequest(req, res) {
  const { form } = await readForm(req);
  const ip = clientIp(req);
  if (rateLimited(`privacy:${ip}`, 6, 10 * 60 * 1000)) {
    return render(req, res, pages.titulares(context(req, { flash: { type: 'error', message: 'Muitas solicitações em pouco tempo. Tente novamente em alguns minutos.' } })), 429);
  }
  if (form.extra) return redirect(res, '/privacidade/solicitacoes?ok=1');

  const name = (form.name || '').trim();
  const email = (form.email || '').trim();
  const type = (form.type || '').trim();
  const errors = [];
  if (name.length < 2) errors.push('Informe seu nome.');
  if (!EMAIL_RE.test(email)) errors.push('Informe um e-mail válido.');
  if (!type) errors.push('Selecione o tipo de solicitação.');
  if (form.consent !== '1') errors.push('É necessário confirmar a veracidade das informações.');

  if (errors.length) {
    return render(
      req,
      res,
      pages.titulares(context(req, { flash: { type: 'error', title: 'Revise os campos.', message: errors.join(' ') } })),
      400
    );
  }

  const data = db();
  const protocol = newProtocol('DPO');
  data.privacyRequests.unshift({
    id: nextId('privacy'),
    protocol,
    name,
    email,
    type,
    details: (form.details || '').trim(),
    ip,
    status: 'novo',
    createdAt: new Date().toISOString(),
  });
  audit(`formulário público (${email})`, 'privacidade.solicitacao', `${type} · ${protocol}`);
  save();
  return redirect(res, `/privacidade/solicitacoes?ok=1&protocolo=${encodeURIComponent(protocol)}`);
}

async function handleConsent(req, res) {
  const { json } = await readForm(req);
  const action = String((json && json.action) || '').slice(0, 40);
  const categories = Array.isArray(json && json.categories) ? json.categories.slice(0, 8) : [];
  const version = String((json && json.policyVersion) || db().settings.cookiePolicyVersion).slice(0, 20);
  if (!['accept-all', 'reject-non-essential', 'customize', 'revoke'].includes(action)) {
    return sendJson(res, 400, { ok: false, error: 'ação inválida' });
  }
  const data = db();
  data.cookieConsents.unshift({
    id: nextId('consent'),
    action,
    categories: action === 'revoke' ? [] : categories,
    policyVersion: version,
    createdAt: new Date().toISOString(),
  });
  data.cookieConsents = data.cookieConsents.slice(0, 2000);
  save();
  return sendJson(res, 200, { ok: true, recordedAt: new Date().toISOString(), policyVersion: version });
}

/* ------------------------------------------------------------------ */
/* Painel administrativo                                              */
/* ------------------------------------------------------------------ */

function requireUser(req, res) {
  const auth = sessionUser(req);
  if (!auth) {
    redirect(res, '/admin/login');
    return null;
  }
  return auth;
}

function renderAdmin(req, res, view, auth, status = 200) {
  const data = db();
  const nonce = crypto.randomBytes(16).toString('base64');
  const html = layout({
    settings: data.settings,
    path: req.path,
    title: view.title,
    description: 'Painel administrativo do site institucional do Cable.',
    body: admin.shell({
      user: auth.user,
      view: view.view,
      body: view.body,
      flash: view.flash,
      csrf: auth.session.csrf,
      title: view.title,
    }),
    origin: siteOrigin(req),
    noindex: true,
    activeKey: null,
    nonce,
  });
  send(res, status, html, { 'Content-Security-Policy': baseCsp(nonce), 'Cache-Control': 'no-store' });
}

function renderAuth(req, res, mode, error, status = 200) {
  const data = db();
  const nonce = crypto.randomBytes(16).toString('base64');
  const html = layout({
    settings: data.settings,
    path: req.path,
    title: mode === 'setup' ? 'Criar administrador' : 'Painel administrativo',
    description: 'Acesso restrito ao painel administrativo do Cable.',
    body: admin.authPage({ mode, error }),
    origin: siteOrigin(req),
    noindex: true,
    nonce,
  });
  send(res, status, html, { 'Content-Security-Policy': baseCsp(nonce), 'Cache-Control': 'no-store' });
}

function setSessionCookie(req, res, token) {
  const secure = isHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cable_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${secure}`);
}

const adminRoutes = [
  [
    'GET',
    /^\/admin$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.dashboard({ data: db() }), view: 'dashboard' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/identidade$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.identidade({ data: db(), csrf: auth.session.csrf }), view: 'identidade' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/comercial$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.comercial({ data: db(), csrf: auth.session.csrf }), view: 'comercial' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/juridico$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.juridicoLista({ data: db() }), view: 'juridico' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/juridico\/([a-z0-9-]+)$/,
    (req, res, params) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      const doc = db().legalDocs.find((d) => d.slug === params[0]);
      if (!doc) return renderAdmin(req, res, { title: 'Documento não encontrado', body: '<p class="muted">Documento inexistente.</p>', view: 'juridico' }, auth, 404);
      renderAdmin(req, res, { ...admin.juridicoDoc({ data: db(), csrf: auth.session.csrf }, doc), view: 'juridico' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/conteudo$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.conteudo({ data: db(), csrf: auth.session.csrf }), view: 'conteudo' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/atendimento$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.atendimento({ data: db(), csrf: auth.session.csrf }), view: 'atendimento' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/leads$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.leads({ data: db() }), view: 'leads' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/leads\/export\.csv$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      if (!admin.can(auth.user, 'export-leads')) {
        return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite exportar leads.</p>', view: 'leads' }, auth, 403);
      }
      const rows = [['nome', 'email', 'interesse', 'consentimento', 'origem', 'criado_em']];
      for (const lead of db().newsletterSubscriptions) {
        rows.push([lead.name || '', lead.email, lead.interest || '', lead.consent ? 'sim' : 'nao', lead.source || '', lead.createdAt]);
      }
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      audit(auth.user.email, 'leads.exportados', `${rows.length - 1} registros`);
      save();
      send(res, 200, csv, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="leads-cable.csv"',
      });
    },
  ],
  [
    'GET',
    /^\/admin\/operacao$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.operacao({ data: db() }), view: 'operacao' }, auth);
    },
  ],
  [
    'GET',
    /^\/admin\/usuarios$/,
    (req, res) => {
      const auth = requireUser(req, res);
      if (!auth) return;
      renderAdmin(req, res, { ...admin.usuarios({ data: db(), csrf: auth.session.csrf }), view: 'usuarios' }, auth);
    },
  ],
];

async function handleAdminPost(req, res, pathname) {
  const auth = sessionUser(req);
  if (!auth) return redirect(res, '/admin/login');

  const { form } = await readForm(req);
  if (!form.csrf || form.csrf !== auth.session.csrf) {
    return renderAdmin(req, res, { title: 'Sessão inválida', body: '<p class="muted">Recarregue a página e tente novamente.</p>', view: 'dashboard', flash: { type: 'error', message: 'Token de segurança inválido.' } }, auth, 403);
  }

  const data = db();

  if (pathname === '/admin/identidade') {
    if (!admin.can(auth.user, 'edit-settings')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite alterar configurações.</p>', view: 'identidade' }, auth, 403);
    }
    const s = data.settings;
    s.brand.name = (form.brandName || s.brand.name).trim();
    s.brand.concept = (form.brandConcept || '').trim();
    s.brand.description = (form.brandDescription || '').trim();
    s.brand.primaryColor = (form.brandPrimary || s.brand.primaryColor).trim();
    s.brand.accentColor = (form.brandAccent || s.brand.accentColor).trim();
    s.app.url = (form.appUrl || '').trim();
    s.app.version = (form.appVersion || '').trim();
    s.app.status = (form.appStatus || '').trim();
    s.app.playStoreUrl = (form.appPlay || '').trim();
    s.app.appStoreUrl = (form.appStore || '').trim();
    s.app.microsoftStoreUrl = (form.appMs || '').trim();
    s.app.pwaEnabled = form.pwaEnabled === '1';
    s.legalEntity.legalName = (form.legalName || '').trim();
    s.legalEntity.tradeName = (form.tradeName || '').trim();
    s.legalEntity.cnpj = (form.cnpj || '').trim();
    s.legalEntity.address = (form.address || '').trim();
    s.legalEntity.email = (form.email || '').trim();
    s.legalEntity.supportChannel = (form.supportChannel || '').trim();
    s.legalEntity.dpo = (form.dpo || '').trim();
    s.legalEntity.billingInfo = (form.billingInfo || '').trim();
    s.domains.site = (form.domainSite || '').trim();
    s.domains.app = (form.domainApp || '').trim();
    s.domains.help = (form.domainHelp || '').trim();
    s.integrations.analytics = (form.integrationAnalytics || '').trim();
    s.integrations.searchConsole = (form.integrationSearchConsole || '').trim();
    s.integrations.emailProvider = (form.integrationEmail || '').trim();
    s.integrations.crm = (form.integrationCrm || '').trim();
    s.integrations.payments = (form.integrationPayments || '').trim();
    s.seo.title = (form.seoTitle || s.seo.title).trim();
    s.seo.description = (form.seoDescription || s.seo.description).trim();
    audit(auth.user.email, 'settings.atualizadas', 'identidade, aplicativo, jurídico e SEO');
    save();
    return renderAdmin(req, res, { ...admin.identidade({ data, csrf: auth.session.csrf }), view: 'identidade', flash: { type: 'ok', message: 'Configurações salvas.' } }, auth);
  }

  if (pathname === '/admin/comercial') {
    if (!admin.can(auth.user, 'edit-settings')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite alterar planos.</p>', view: 'comercial' }, auth, 403);
    }
    const plan = data.plans.find((p) => p.id === form.planId);
    if (plan) {
      plan.price = (form.price || '').trim() || null;
      plan.period = (form.period || plan.period).trim();
      plan.limits = (form.limits || '').trim();
      plan.benefits = String(form.benefits || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      plan.highlight = form.highlight === '1';
      audit(auth.user.email, 'plano.atualizado', plan.name);
      save();
    }
    return renderAdmin(req, res, { ...admin.comercial({ data, csrf: auth.session.csrf }), view: 'comercial', flash: { type: 'ok', message: 'Plano atualizado.' } }, auth);
  }

  const legalMatch = pathname.match(/^\/admin\/juridico\/([a-z0-9-]+)$/);
  if (legalMatch) {
    if (!admin.can(auth.user, 'edit-settings')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite alterar documentos legais.</p>', view: 'juridico' }, auth, 403);
    }
    const doc = data.legalDocs.find((d) => d.slug === legalMatch[1]);
    if (!doc) return redirect(res, '/admin/juridico');
    doc.version = (form.version || doc.version).trim();
    doc.updatedAt = (form.updatedAt || doc.updatedAt).trim();
    doc.summary = (form.summary || doc.summary).trim();
    doc.reviewStatus = form.reviewStatus === 'reviewed' ? 'reviewed' : 'pending';
    doc.blocks = parseBlocks(form.blocks || '');
    audit(auth.user.email, 'documento.atualizado', `${doc.title} v${doc.version}`);
    save();
    return renderAdmin(req, res, { ...admin.juridicoDoc({ data, csrf: auth.session.csrf }, doc), view: 'juridico', flash: { type: 'ok', message: 'Documento salvo.' } }, auth);
  }

  if (pathname === '/admin/conteudo/faq/adicionar') {
    if (!admin.can(auth.user, 'edit-settings')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite alterar conteúdo.</p>', view: 'conteudo' }, auth, 403);
    }
    const q = (form.q || '').trim();
    const a = (form.a || '').trim();
    if (q && a) {
      data.faqs.push({ q, a, category: (form.category || 'Geral').trim() });
      audit(auth.user.email, 'faq.adicionada', q);
      save();
    }
    return renderAdmin(req, res, { ...admin.conteudo({ data, csrf: auth.session.csrf }), view: 'conteudo', flash: { type: 'ok', message: 'Pergunta adicionada.' } }, auth);
  }

  if (pathname === '/admin/conteudo/faq/remover') {
    if (!admin.can(auth.user, 'edit-settings')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite alterar conteúdo.</p>', view: 'conteudo' }, auth, 403);
    }
    const index = Number(form.index);
    if (Number.isInteger(index) && data.faqs[index]) {
      const [removed] = data.faqs.splice(index, 1);
      audit(auth.user.email, 'faq.removida', removed.q);
      save();
    }
    return renderAdmin(req, res, { ...admin.conteudo({ data, csrf: auth.session.csrf }), view: 'conteudo', flash: { type: 'ok', message: 'Pergunta removida.' } }, auth);
  }

  const statusMatch = pathname.match(/^\/admin\/atendimento\/([a-z0-9_]+)\/status$/);
  if (statusMatch) {
    if (!admin.can(auth.user, 'edit-settings')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Sua função não permite alterar atendimento.</p>', view: 'atendimento' }, auth, 403);
    }
    const list = form.kind === 'contact' ? data.contactRequests : data.supportTickets;
    const item = list.find((entry) => entry.id === statusMatch[1]);
    if (item) {
      item.status = ['novo', 'em-atendimento', 'resolvido', 'arquivado'].includes(form.status) ? form.status : item.status;
      audit(auth.user.email, 'atendimento.status', `${item.protocol} → ${item.status}`);
      save();
    }
    return renderAdmin(req, res, { ...admin.atendimento({ data, csrf: auth.session.csrf }), view: 'atendimento', flash: { type: 'ok', message: 'Status atualizado.' } }, auth);
  }

  if (pathname === '/admin/usuarios') {
    if (!admin.can(auth.user, 'manage-users')) {
      return renderAdmin(req, res, { title: 'Acesso negado', body: '<p class="muted">Apenas administradores podem criar usuários.</p>', view: 'usuarios' }, auth, 403);
    }
    const email = (form.email || '').trim().toLowerCase();
    const password = form.password || '';
    const role = admin.ROLES.includes(form.role) ? form.role : 'leitor';
    if (!EMAIL_RE.test(email) || password.length < 10) {
      return renderAdmin(req, res, { ...admin.usuarios({ data, csrf: auth.session.csrf }), view: 'usuarios', flash: { type: 'error', message: 'E-mail válido e senha com 10+ caracteres são obrigatórios.' } }, auth, 400);
    }
    if (data.adminUsers.some((u) => u.email === email)) {
      return renderAdmin(req, res, { ...admin.usuarios({ data, csrf: auth.session.csrf }), view: 'usuarios', flash: { type: 'error', message: 'Já existe usuário com este e-mail.' } }, auth, 400);
    }
    const { salt, hash } = hashPassword(password);
    data.adminUsers.push({
      id: nextId('user'),
      name: (form.name || '').trim(),
      email,
      role,
      salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    });
    audit(auth.user.email, 'usuario.criado', `${email} (${role})`);
    save();
    return renderAdmin(req, res, { ...admin.usuarios({ data, csrf: auth.session.csrf }), view: 'usuarios', flash: { type: 'ok', message: 'Usuário criado.' } }, auth);
  }

  if (pathname === '/admin/logout') {
    const auth2 = sessionUser(req);
    if (auth2) sessions.delete(auth2.token);
    res.setHeader('Set-Cookie', 'cable_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    return redirect(res, '/admin/login');
  }

  return redirect(res, '/admin');
}

function parseBlocks(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      current = { h: line.slice(3).trim(), p: [] };
      blocks.push(current);
      continue;
    }
    if (!line) continue;
    if (!current) {
      current = { h: '', p: [] };
      blocks.push(current);
    }
    current.p.push(line);
  }
  return blocks.filter((b) => b.h || b.p.length);
}

/* ------------------------------------------------------------------ */
/* Login / setup                                                      */
/* ------------------------------------------------------------------ */

async function handleLogin(req, res) {
  const { form } = await readForm(req);
  const ip = clientIp(req);
  if (rateLimited(`login:${ip}`, 10, 10 * 60 * 1000)) {
    return renderAuth(req, res, 'login', 'Muitas tentativas. Aguarde alguns minutos.', 429);
  }
  const email = (form.email || '').trim().toLowerCase();
  const password = form.password || '';
  const user = db().adminUsers.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user)) {
    audit(email || 'desconhecido', 'login.falhou', `ip ${ip}`);
    save();
    return renderAuth(req, res, 'login', 'Credenciais inválidas.', 401);
  }
  const token = createSession(user.id);
  setSessionCookie(req, res, token);
  audit(user.email, 'login.ok', `ip ${ip}`);
  save();
  return redirect(res, '/admin');
}

async function handleSetup(req, res) {
  const data = db();
  if (data.adminUsers.length > 0) return redirect(res, '/admin/login');
  const { form } = await readForm(req);
  const email = (form.email || '').trim().toLowerCase();
  const password = form.password || '';
  if (!EMAIL_RE.test(email) || password.length < 10) {
    return renderAuth(req, res, 'setup', 'Informe e-mail válido e senha com pelo menos 10 caracteres.', 400);
  }
  const { salt, hash } = hashPassword(password);
  const user = {
    id: nextId('user'),
    name: (form.name || 'Administrador').trim(),
    email,
    role: 'admin',
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  data.adminUsers.push(user);
  audit(email, 'admin.criado', 'primeiro administrador');
  save();
  const token = createSession(user.id);
  setSessionCookie(req, res, token);
  return redirect(res, '/admin');
}

/* ------------------------------------------------------------------ */
/* SEO                                                                */
/* ------------------------------------------------------------------ */

function sitemap(req, res) {
  const data = db();
  const origin = siteOrigin(req);
  const urls = ['/', '/plataforma', '/recursos', '/como-funciona', '/planos', '/baixar', '/ajuda', '/faq', '/contato', '/cookies', '/privacidade/solicitacoes'];
  for (const doc of data.legalDocs) urls.push(`/legal/${doc.slug}`);
  for (const article of data.helpArticles) urls.push(`/ajuda/${article.slug}`);
  const today = new Date().toISOString().slice(0, 10);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url><loc>${origin}${url === '/' ? '/' : url}</loc><lastmod>${today}</lastmod><changefreq>${url === '/' ? 'weekly' : 'monthly'}</changefreq><priority>${url === '/' ? '1.0' : '0.7'}</priority></url>`
  )
  .join('\n')}
</urlset>`;
  send(res, 200, body, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
}

function robots(req, res) {
  const origin = siteOrigin(req);
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /privacidade/solicitacoes

Sitemap: ${origin}/sitemap.xml
`;
  send(res, 200, body, { 'Content-Type': 'text/plain; charset=utf-8' });
}

/* ------------------------------------------------------------------ */
/* Estáticos                                                          */
/* ------------------------------------------------------------------ */

const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  const rel = pathname.replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file);
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
  return true;
}

/* ------------------------------------------------------------------ */
/* Servidor                                                           */
/* ------------------------------------------------------------------ */

async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.path = url.pathname.replace(/\/+$/, '') || '/';
  req.query = Object.fromEntries(url.searchParams.entries());
  req.cookies = parseCookies(req.headers.cookie);

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (serveStatic(req, res, req.path)) return;
  }

  if (req.path === '/robots.txt') return robots(req, res);
  if (req.path === '/sitemap.xml') return sitemap(req, res);

  if (req.method === 'POST' && req.path === '/api/consent') return handleConsent(req, res);
  if (req.method === 'POST' && req.path === '/contato') return handleContact(req, res);
  if (req.method === 'POST' && req.path === '/planos/interesse') return handlePlanInterest(req, res);
  if (req.method === 'POST' && req.path === '/privacidade/solicitacoes') return handlePrivacyRequest(req, res);

  if (req.path === '/admin/login') {
    if (req.method === 'POST') return handleLogin(req, res);
    if (db().adminUsers.length === 0) return redirect(res, '/admin/setup');
    if (sessionUser(req)) return redirect(res, '/admin');
    return renderAuth(req, res, 'login', null);
  }

  if (req.path === '/admin/setup') {
    if (db().adminUsers.length > 0) return redirect(res, '/admin/login');
    if (req.method === 'POST') return handleSetup(req, res);
    return renderAuth(req, res, 'setup', null);
  }

  if (req.path.startsWith('/admin/') || req.path === '/admin') {
    if (req.method === 'POST') return handleAdminPost(req, res, req.path);
    for (const [method, pattern, handler] of adminRoutes) {
      if (method === req.method && pattern.test(req.path)) {
        const params = pattern.exec(req.path).slice(1);
        return handler(req, res, params);
      }
    }
    const auth = requireUser(req, res);
    if (!auth) return;
    return renderAdmin(req, res, { title: 'Página não encontrada', body: '<p class="muted">Esta área não existe no painel.</p>', view: 'dashboard' }, auth, 404);
  }

  for (const [method, pattern, handler] of publicRoutes) {
    if (method === req.method && pattern.test(req.path)) {
      const params = pattern.exec(req.path).slice(1);
      return handler(req, res, params);
    }
  }

  return render(req, res, pages.notFound(context(req)), 404);
}

const server = http.createServer((req, res) => {
  Promise.resolve()
    .then(() => router(req, res))
    .catch((error) => {
      console.error('[cable-site] erro:', error);
      if (!res.headersSent) {
        send(res, 500, '<h1>Erro interno</h1><p>Tente novamente em instantes.</p>');
      } else {
        res.end();
      }
    });
});

db();
server.listen(PORT, HOST, () => {
  console.log(`[cable-site] site institucional ouvindo em http://${HOST}:${PORT}`);
});

module.exports = server;
