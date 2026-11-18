'use strict';

const { esc, formatDate } = require('./html');
const { logoMark } = require('./layout');

const NAV = [
  ['dashboard', '/admin', 'Visão geral'],
  ['identidade', '/admin/identidade', 'Identidade e aplicativo'],
  ['comercial', '/admin/comercial', 'Comercial e planos'],
  ['juridico', '/admin/juridico', 'Jurídico'],
  ['conteudo', '/admin/conteudo', 'Conteúdo'],
  ['atendimento', '/admin/atendimento', 'Atendimento'],
  ['leads', '/admin/leads', 'Leads'],
  ['operacao', '/admin/operacao', 'Operação'],
  ['usuarios', '/admin/usuarios', 'Usuários e RBAC'],
];

const ROLES = ['admin', 'editor', 'leitor'];

function can(user, action) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'editor') return action !== 'manage-users' && action !== 'export-leads';
  return action === 'read';
}

function shell({ user, view, body, flash, csrf, title }) {
  const nav = NAV.map(
    ([key, href, label]) =>
      `<li><a href="${href}"${key === view ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`
  ).join('');

  return `<div class="container admin-shell">
    <aside class="admin-nav">
      <h2>Painel Cable</h2>
      <ul>${nav}</ul>
      <p class="small muted" style="margin-bottom:6px">${esc(user.name || user.email)}</p>
      <span class="role-tag">${esc(user.role)}</span>
      <form method="post" action="/admin/logout" style="margin-top:14px">
        <input type="hidden" name="csrf" value="${esc(csrf)}">
        <button class="btn btn-ghost btn-sm" type="submit">Sair</button>
      </form>
      <p class="small muted" style="margin-top:14px"><a href="/" target="_blank" rel="noopener">Ver site</a></p>
    </aside>
    <div class="admin-main">
      <h1>${esc(title)}</h1>
      ${flash ? flashBox(flash) : ''}
      ${body}
    </div>
  </div>`;
}

function flashBox(flash) {
  const cls = flash.type === 'error' ? 'is-error' : 'is-ok';
  return `<div class="form-status ${cls}" role="status" style="margin-bottom:22px">${esc(flash.message)}</div>`;
}

function authPage({ mode, error }) {
  const isSetup = mode === 'setup';
  return `<div class="container login-wrap">
    <div class="card">
      <div class="brand" style="margin-bottom:18px">${logoMark()}<span class="brand-name">Cable</span></div>
      <h1 style="font-size:1.5rem">${isSetup ? 'Criar administrador' : 'Painel administrativo'}</h1>
      <p class="muted small">${isSetup ? 'Nenhum usuário cadastrado. Crie a primeira conta de administrador para gerenciar o site.' : 'Acesso restrito a usuários autorizados. Todas as ações são registradas em auditoria.'}</p>
      ${error ? `<div class="form-status is-error" role="alert" style="margin-bottom:16px">${esc(error)}</div>` : ''}
      <form class="form" method="post" action="${isSetup ? '/admin/setup' : '/admin/login'}">
        ${isSetup
          ? `<div class="field"><label for="a-name">Nome</label><input id="a-name" name="name" type="text" required maxlength="120" autocomplete="name"></div>`
          : ''}
        <div class="field">
          <label for="a-email">E-mail</label>
          <input id="a-email" name="email" type="email" required autocomplete="username" maxlength="180">
        </div>
        <div class="field">
          <label for="a-pass">Senha</label>
          <input id="a-pass" name="password" type="password" required minlength="10" autocomplete="${isSetup ? 'new-password' : 'current-password'}">
          <span class="hint">Mínimo de 10 caracteres.</span>
        </div>
        <button class="btn btn-primary" type="submit">${isSetup ? 'Criar administrador' : 'Entrar'}</button>
      </form>
      <p class="hint" style="margin-top:16px"><a href="/">Voltar ao site</a></p>
    </div>
  </div>`;
}

function statusBadge(status) {
  const map = {
    novo: 'badge-dev',
    'em-atendimento': 'badge-pending',
    resolvido: 'badge-ok',
    arquivado: 'badge-pending',
  };
  return `<span class="badge ${map[status] || 'badge-pending'}">${esc(status)}</span>`;
}

function dashboard(ctx) {
  const { data } = ctx;
  const pending = publicationChecklist(data);
  const missing = pending.filter((p) => !p.done);
  const stats = [
    ['Solicitações de contato', data.contactRequests.length],
    ['Chamados de suporte', data.supportTickets.length],
    ['Leads / newsletter', data.newsletterSubscriptions.length],
    ['Solicitações de titulares', data.privacyRequests.length],
  ]
    .map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${esc(label)}</span></div>`)
    .join('');

  const checklist = pending
    .map(
      (item) =>
        `<tr><td>${esc(item.label)}</td><td>${
          item.done ? '<span class="badge badge-ok">ok</span>' : '<span class="badge badge-dev">pendente</span>'
        }</td><td class="small muted">${esc(item.hint || '')}</td></tr>`
    )
    .join('');

  const body = `
    <div class="stat-grid">${stats}</div>
    ${missing.length
      ? `<div class="notice notice-warning"><p><strong>${missing.length} pendência(s) de publicação.</strong> O site não deve ser divulgado como oficial enquanto houver itens essenciais em aberto.</p></div>`
      : `<div class="notice"><p><strong>Checklist completo.</strong> Todos os itens verificáveis estão preenchidos.</p></div>`}
    <div class="admin-card">
      <h2>Checklist de publicação</h2>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Status</th><th>Observação</th></tr></thead><tbody>${checklist}</tbody></table></div>
    </div>
    <div class="admin-card">
      <h2>Atalhos</h2>
      <div class="btn-row">
        <a class="btn btn-ghost" href="/admin/identidade">Configurar identidade</a>
        <a class="btn btn-ghost" href="/admin/comercial">Planos</a>
        <a class="btn btn-ghost" href="/admin/juridico">Documentos legais</a>
        <a class="btn btn-ghost" href="/admin/atendimento">Atendimento</a>
      </div>
    </div>`;
  return { title: 'Visão geral', body };
}

function publicationChecklist(data) {
  const entity = data.settings.legalEntity;
  const reviewed = data.legalDocs.every((d) => d.reviewStatus === 'reviewed');
  return [
    { label: 'Identidade Cable aprovada', done: Boolean(data.settings.brand.name), hint: 'Nome, paleta e textos definidos.' },
    { label: 'Domínio oficial configurado', done: Boolean(data.settings.domains.site), hint: 'Cadastre o domínio em Identidade e aplicativo.' },
    { label: 'URL real do aplicativo cadastrada', done: Boolean(data.settings.app.url), hint: 'Sem URL, os botões de acesso permanecem em estado pendente.' },
    { label: 'Links de instalação verificados', done: Boolean(data.settings.app.playStoreUrl || data.settings.app.appStoreUrl || data.settings.app.microsoftStoreUrl || data.settings.app.pwaEnabled), hint: 'Lojas só aparecem com URL oficial.' },
    { label: 'Identidade empresarial cadastrada', done: Boolean(entity.legalName && entity.cnpj && entity.address && entity.email), hint: 'Razão social, CNPJ, endereço e e-mail.' },
    { label: 'Políticas revisadas juridicamente', done: reviewed, hint: 'Marque cada documento como revisado após parecer jurídico.' },
    { label: 'Privacidade configurada (DPO e canal)', done: Boolean(entity.dpo && entity.email), hint: 'Encarregado e canal de privacidade.' },
    { label: 'Consentimento de cookies ativo', done: Boolean(data.settings.cookiePolicyVersion), hint: 'Banner e registro de consentimento.' },
    { label: 'E-mail de suporte verificado', done: Boolean(entity.email && entity.supportChannel), hint: 'Canal oficial de atendimento.' },
    { label: 'Formulários testados', done: false, hint: 'Teste manual de contato, newsletter e titulares.' },
    { label: 'Segurança administrativa validada', done: data.adminUsers.length > 0, hint: 'Usuários com RBAC e auditoria.' },
    { label: 'SEO configurado', done: Boolean(data.settings.seo.title && data.settings.seo.description), hint: 'Title, description, sitemap e robots.' },
    { label: 'Responsividade validada', done: false, hint: 'Verificação manual em mobile, tablet e desktop.' },
    { label: 'Links de páginas legais funcionando', done: data.legalDocs.length >= 10, hint: 'Todos os documentos publicados.' },
    { label: 'Acessibilidade verificada', done: false, hint: 'Teclado, leitor de tela e contraste.' },
    { label: 'Recursos anunciados confirmados', done: false, hint: 'Confirmar com o time do produto o que está disponível.' },
  ];
}

function field(label, name, value, options = {}) {
  const type = options.type || 'text';
  const required = options.required ? ' required' : '';
  const hint = options.hint ? `<span class="hint">${esc(options.hint)}</span>` : '';
  const placeholder = options.placeholder ? ` placeholder="${esc(options.placeholder)}"` : '';
  const wide = options.wide ? ' field-full' : '';
  return `<div class="field${wide}">
    <label for="f-${esc(name)}">${esc(label)}</label>
    <input id="f-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value || '')}"${required}${placeholder}>
    ${hint}
  </div>`;
}

function identidade(ctx) {
  const { data, csrf } = ctx;
  const s = data.settings;
  const body = `
    <form method="post" action="/admin/identidade">
      <input type="hidden" name="csrf" value="${esc(csrf)}">
      <div class="admin-card">
        <h2>Identidade da marca</h2>
        <div class="form-grid">
          ${field('Nome da marca', 'brandName', s.brand.name)}
          ${field('Conceito', 'brandConcept', s.brand.concept)}
          ${field('Descrição', 'brandDescription', s.brand.description, { wide: true })}
          ${field('Cor primária', 'brandPrimary', s.brand.primaryColor)}
          ${field('Cor de destaque', 'brandAccent', s.brand.accentColor)}
        </div>
      </div>
      <div class="admin-card">
        <h2>Aplicativo Cable</h2>
        <div class="form-grid">
          ${field('URL oficial do aplicativo', 'appUrl', s.app.url, { hint: 'Enquanto vazio, os botões de acesso exibem estado pendente.', wide: true })}
          ${field('Versão publicada', 'appVersion', s.app.version)}
          ${field('Status', 'appStatus', s.app.status)}
          ${field('Google Play (URL)', 'appPlay', s.app.playStoreUrl, { wide: true })}
          ${field('Apple App Store (URL)', 'appStore', s.app.appStoreUrl, { wide: true })}
          ${field('Microsoft Store (URL)', 'appMs', s.app.microsoftStoreUrl, { wide: true })}
        </div>
        <label class="checkbox" style="margin-top:14px"><input type="checkbox" name="pwaEnabled" value="1"${s.app.pwaEnabled ? ' checked' : ''}> Instalação PWA verificada e disponível</label>
      </div>
      <div class="admin-card">
        <h2>Identidade empresarial</h2>
        <p class="small muted">Estes dados alimentam os documentos legais e o rodapé. Não preencha com dados fictícios.</p>
        <div class="form-grid">
          ${field('Razão social', 'legalName', s.legalEntity.legalName)}
          ${field('Nome comercial', 'tradeName', s.legalEntity.tradeName)}
          ${field('CNPJ', 'cnpj', s.legalEntity.cnpj)}
          ${field('Endereço empresarial', 'address', s.legalEntity.address, { wide: true })}
          ${field('E-mail oficial', 'email', s.legalEntity.email, { type: 'email' })}
          ${field('Canal de suporte', 'supportChannel', s.legalEntity.supportChannel)}
          ${field('Encarregado de dados (DPO)', 'dpo', s.legalEntity.dpo)}
          ${field('Informações de faturamento', 'billingInfo', s.legalEntity.billingInfo)}
        </div>
      </div>
      <div class="admin-card">
        <h2>Domínios e integrações</h2>
        <div class="form-grid">
          ${field('Domínio do site', 'domainSite', s.domains.site, { placeholder: 'https://www.seudominio.com.br' })}
          ${field('Domínio do aplicativo', 'domainApp', s.domains.app, { placeholder: 'https://app.seudominio.com.br' })}
          ${field('Domínio da ajuda', 'domainHelp', s.domains.help)}
          ${field('Analytics (ID)', 'integrationAnalytics', s.integrations.analytics, { hint: 'Só é carregado com consentimento.' })}
          ${field('Search Console (verificação)', 'integrationSearchConsole', s.integrations.searchConsole)}
          ${field('Provedor de e-mail', 'integrationEmail', s.integrations.emailProvider)}
          ${field('CRM', 'integrationCrm', s.integrations.crm)}
          ${field('Gateway de pagamentos', 'integrationPayments', s.integrations.payments)}
        </div>
        <p class="hint">Credenciais de integrações são armazenadas como secrets no ambiente do servidor. Este painel registra apenas a identificação pública de cada serviço.</p>
      </div>
      <div class="admin-card">
        <h2>SEO</h2>
        <div class="form-grid">
          ${field('Título padrão', 'seoTitle', s.seo.title, { wide: true })}
          <div class="field field-full">
            <label for="f-seoDescription">Meta description</label>
            <textarea id="f-seoDescription" name="seoDescription" maxlength="320">${esc(s.seo.description)}</textarea>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" type="submit">Salvar configurações</button>
    </form>`;
  return { title: 'Identidade e aplicativo', body };
}

function comercial(ctx) {
  const { data, csrf } = ctx;
  const rows = data.plans
    .map(
      (plan) => `<tr>
        <td>${esc(plan.name)}</td>
        <td>${plan.price ? esc(plan.price) : '<span class="badge badge-dev">em definição</span>'}</td>
        <td>${esc(plan.period || '')}</td>
        <td>${esc((plan.benefits || []).length + ' benefícios')}</td>
        <td>${plan.highlight ? 'sim' : 'não'}</td>
        <td>${esc(plan.status || '')}</td>
      </tr>`
    )
    .join('');

  const forms = data.plans
    .map(
      (plan) => `<form method="post" action="/admin/comercial" class="form" style="border-top:1px solid var(--line);padding-top:18px;margin-top:18px">
        <input type="hidden" name="csrf" value="${esc(csrf)}">
        <input type="hidden" name="planId" value="${esc(plan.id)}">
        <div class="form-grid">
          ${field(`${plan.name} — preço`, 'price', plan.price, { placeholder: 'Deixe vazio enquanto não aprovado' })}
          ${field('Periodicidade', 'period', plan.period)}
          ${field('Limites', 'limits', plan.limits, { wide: true })}
          <div class="field field-full">
            <label for="benefits-${esc(plan.id)}">Benefícios (um por linha)</label>
            <textarea id="benefits-${esc(plan.id)}" name="benefits">${esc((plan.benefits || []).join('\n'))}</textarea>
          </div>
        </div>
        <label class="checkbox"><input type="checkbox" name="highlight" value="1"${plan.highlight ? ' checked' : ''}> Destacar plano</label>
        <button class="btn btn-ghost btn-sm" type="submit">Salvar ${esc(plan.name)}</button>
      </form>`
    )
    .join('');

  const body = `
    <div class="notice notice-warning"><p><strong>Sem cobrança ativa.</strong> Cadastre preços apenas depois de aprovados. Enquanto o preço estiver vazio, a página pública exibe “Planos em breve”.</p></div>
    <div class="admin-card">
      <h2>Planos</h2>
      <div class="table-wrap"><table><thead><tr><th>Plano</th><th>Preço</th><th>Período</th><th>Benefícios</th><th>Destaque</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="admin-card">
      <h2>Editar planos</h2>
      ${forms}
    </div>`;
  return { title: 'Comercial e planos', body };
}

function juridicoLista(ctx) {
  const { data } = ctx;
  const rows = data.legalDocs
    .map(
      (doc) => `<tr>
        <td><a href="/admin/juridico/${esc(doc.slug)}">${esc(doc.title)}</a></td>
        <td>v${esc(doc.version)}</td>
        <td>${formatDate(doc.updatedAt)}</td>
        <td>${doc.reviewStatus === 'reviewed' ? '<span class="badge badge-ok">revisado</span>' : '<span class="badge badge-dev">revisão pendente</span>'}</td>
        <td><a href="/legal/${esc(doc.slug)}" target="_blank" rel="noopener">ver público</a></td>
      </tr>`
    )
    .join('');
  const body = `
    <div class="notice notice-warning"><p><strong>Revisão jurídica obrigatória.</strong> Marque um documento como revisado somente após parecer de profissional jurídico. Documentos em revisão são publicados com aviso e sem indexação em buscadores.</p></div>
    <div class="admin-card">
      <div class="table-wrap"><table><thead><tr><th>Documento</th><th>Versão</th><th>Atualização</th><th>Revisão</th><th>Público</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  return { title: 'Jurídico', body };
}

function juridicoDoc(ctx, doc) {
  const { csrf } = ctx;
  const asText = doc.blocks
    .map((b) => `${b.h ? `## ${b.h}\n` : ''}${(b.p || []).join('\n\n')}`)
    .join('\n\n');
  const body = `
    <form method="post" action="/admin/juridico/${esc(doc.slug)}">
      <input type="hidden" name="csrf" value="${esc(csrf)}">
      <div class="admin-card">
        <h2>${esc(doc.title)}</h2>
        <div class="form-grid">
          ${field('Versão', 'version', doc.version)}
          ${field('Data de atualização', 'updatedAt', doc.updatedAt, { type: 'date' })}
          ${field('Resumo', 'summary', doc.summary, { wide: true })}
          <div class="field">
            <label for="f-reviewStatus">Revisão jurídica</label>
            <select id="f-reviewStatus" name="reviewStatus">
              <option value="pending"${doc.reviewStatus === 'pending' ? ' selected' : ''}>Pendente</option>
              <option value="reviewed"${doc.reviewStatus === 'reviewed' ? ' selected' : ''}>Revisado</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:16px">
          <label for="f-blocks">Conteúdo (## para títulos, linha em branco entre parágrafos)</label>
          <textarea id="f-blocks" name="blocks" style="min-height:420px;font-family:var(--mono);font-size:.85rem">${esc(asText)}</textarea>
          <span class="hint">Use {{legalName}}, {{cnpj}}, {{address}}, {{email}}, {{supportChannel}}, {{dpo}} para preencher automaticamente com os dados empresariais.</span>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Salvar documento</button>
        <a class="btn btn-ghost" href="/admin/juridico">Voltar</a>
        <a class="btn btn-ghost" href="/legal/${esc(doc.slug)}" target="_blank" rel="noopener">Ver público</a>
      </div>
    </form>`;
  return { title: `Documento: ${doc.title}`, body };
}

function conteudo(ctx) {
  const { data, csrf } = ctx;
  const faqRows = data.faqs
    .map(
      (item, index) => `<tr>
        <td>${esc(item.q)}</td>
        <td class="small muted">${esc(item.category || '')}</td>
        <td><form method="post" action="/admin/conteudo/faq/remover" style="margin:0"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="index" value="${index}"><button class="btn btn-ghost btn-sm" type="submit">Remover</button></form></td>
      </tr>`
    )
    .join('');

  const helpRows = data.helpArticles
    .map(
      (item) => `<tr><td><a href="/ajuda/${esc(item.slug)}" target="_blank" rel="noopener">${esc(item.title)}</a></td><td class="small muted">${esc(item.category)}</td><td class="small muted">${esc(item.summary)}</td></tr>`
    )
    .join('');

  const body = `
    <div class="admin-card">
      <h2>Perguntas frequentes</h2>
      <div class="table-wrap"><table><thead><tr><th>Pergunta</th><th>Categoria</th><th></th></tr></thead><tbody>${faqRows}</tbody></table></div>
      <form method="post" action="/admin/conteudo/faq/adicionar" class="form" style="margin-top:18px">
        <input type="hidden" name="csrf" value="${esc(csrf)}">
        <div class="form-grid">
          ${field('Pergunta', 'q', '')}
          ${field('Categoria', 'category', '')}
          <div class="field field-full">
            <label for="f-a">Resposta</label>
            <textarea id="f-a" name="a" required maxlength="2000"></textarea>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" type="submit">Adicionar pergunta</button>
      </form>
    </div>
    <div class="admin-card">
      <h2>Artigos da central de ajuda</h2>
      <div class="table-wrap"><table><thead><tr><th>Artigo</th><th>Categoria</th><th>Resumo</th></tr></thead><tbody>${helpRows}</tbody></table></div>
      <p class="hint">Artigos são versionados no código do site. Novos artigos exigem publicação de conteúdo.</p>
    </div>
    <div class="admin-card">
      <h2>Avisos e comunicados</h2>
      <p class="small muted">Espaço reservado para comunicados na home. Nenhum aviso publicado no momento.</p>
    </div>`;
  return { title: 'Conteúdo', body };
}

function atendimento(ctx) {
  const { data, csrf } = ctx;
  const contacts = data.contactRequests
    .map(
      (item) => `<tr>
        <td>${esc(item.protocol)}</td>
        <td>${esc(item.name)}<br><span class="small muted">${esc(item.email)}</span></td>
        <td>${esc(item.category)}</td>
        <td class="small">${esc(item.message).slice(0, 220)}</td>
        <td>${statusBadge(item.status)}</td>
        <td class="small muted">${formatDate(item.createdAt)}</td>
        <td><form method="post" action="/admin/atendimento/${esc(item.id)}/status" style="margin:0;display:flex;gap:6px">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <input type="hidden" name="kind" value="contact">
          <select name="status" aria-label="Novo status">
            <option value="novo">novo</option>
            <option value="em-atendimento">em atendimento</option>
            <option value="resolvido">resolvido</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="submit">Salvar</button>
        </form></td>
      </tr>`
    )
    .join('');

  const privacy = data.privacyRequests
    .map(
      (item) => `<tr>
        <td>${esc(item.protocol)}</td>
        <td>${esc(item.email)}</td>
        <td>${esc(item.type)}</td>
        <td>${statusBadge(item.status)}</td>
        <td class="small muted">${formatDate(item.createdAt)}</td>
      </tr>`
    )
    .join('');

  const body = `
    <div class="admin-card">
      <h2>Solicitações de contato</h2>
      <div class="table-wrap"><table><thead><tr><th>Protocolo</th><th>Contato</th><th>Categoria</th><th>Mensagem</th><th>Status</th><th>Data</th><th>Ação</th></tr></thead><tbody>${contacts || '<tr><td colspan="7" class="muted">Nenhuma solicitação registrada.</td></tr>'}</tbody></table></div>
    </div>
    <div class="admin-card">
      <h2>Solicitações de titulares (LGPD)</h2>
      <div class="table-wrap"><table><thead><tr><th>Protocolo</th><th>E-mail</th><th>Tipo</th><th>Status</th><th>Data</th></tr></thead><tbody>${privacy || '<tr><td colspan="5" class="muted">Nenhuma solicitação registrada.</td></tr>'}</tbody></table></div>
      <p class="hint">Dados de titulares são privados: nenhum endpoint público expõe esses registros.</p>
    </div>`;
  return { title: 'Atendimento', body };
}

function leads(ctx) {
  const { data } = ctx;
  const subs = data.newsletterSubscriptions
    .map(
      (item) => `<tr>
        <td>${esc(item.name || '—')}</td>
        <td>${esc(item.email)}</td>
        <td>${esc(item.interest || '—')}</td>
        <td>${item.consent ? '<span class="badge badge-ok">autorizado</span>' : '<span class="badge badge-pending">sem consentimento</span>'}</td>
        <td class="small muted">${esc(item.source || '')}</td>
        <td class="small muted">${formatDate(item.createdAt)}</td>
      </tr>`
    )
    .join('');
  const body = `
    <div class="admin-card">
      <h2>Lista de interesse e newsletter</h2>
      <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Interesse</th><th>Consentimento</th><th>Origem</th><th>Data</th></tr></thead><tbody>${subs || '<tr><td colspan="6" class="muted">Nenhum lead registrado.</td></tr>'}</tbody></table></div>
      <p style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="/admin/leads/export.csv">Exportar CSV</a></p>
      <p class="hint">Exportação apenas para finalidades autorizadas. Leads sem consentimento não devem receber comunicação comercial.</p>
    </div>`;
  return { title: 'Leads', body };
}

function operacao(ctx) {
  const { data } = ctx;
  const logs = data.auditLogs
    .slice(0, 60)
    .map(
      (log) => `<tr><td class="small muted">${formatDate(log.at)}</td><td>${esc(log.actor)}</td><td>${esc(log.action)}</td><td class="small muted">${esc(log.detail)}</td></tr>`
    )
    .join('');
  const consents = data.cookieConsents
    .slice(0, 40)
    .map(
      (c) => `<tr><td class="small muted">${formatDate(c.createdAt)}</td><td>${esc(c.action)}</td><td class="small muted">${esc((c.categories || []).join(', '))}</td><td class="small muted">v${esc(c.policyVersion)}</td></tr>`
    )
    .join('');

  const body = `
    <div class="admin-card">
      <h2>Trilha de auditoria</h2>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th>Ator</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${logs || '<tr><td colspan="4" class="muted">Nenhum evento registrado.</td></tr>'}</tbody></table></div>
    </div>
    <div class="admin-card">
      <h2>Registros de consentimento de cookies</h2>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th>Escolha</th><th>Categorias</th><th>Versão</th></tr></thead><tbody>${consents || '<tr><td colspan="4" class="muted">Nenhum consentimento registrado.</td></tr>'}</tbody></table></div>
    </div>
    <div class="admin-card">
      <h2>Integridade de formulários e links</h2>
      <ul class="checklist">
        <li>Validação de campos obrigatórios no servidor e no cliente</li>
        <li>Proteção anti-spam por campo armadilha e limite de requisições</li>
        <li>Links internos das páginas legais verificados</li>
        <li>Nenhum link de download fictício publicado</li>
      </ul>
    </div>`;
  return { title: 'Operação', body };
}

function usuarios(ctx) {
  const { data, csrf } = ctx;
  const rows = data.adminUsers
    .map(
      (user) => `<tr>
        <td>${esc(user.name || '—')}</td>
        <td>${esc(user.email)}</td>
        <td><span class="role-tag">${esc(user.role)}</span></td>
        <td class="small muted">${formatDate(user.createdAt)}</td>
      </tr>`
    )
    .join('');

  const roleOptions = ROLES.map((r) => `<option value="${r}">${r}</option>`).join('');

  const body = `
    <div class="admin-card">
      <h2>Usuários com acesso</h2>
      <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Criado em</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint">Funções: <strong>admin</strong> (acesso total), <strong>editor</strong> (conteúdo, planos e jurídico) e <strong>leitor</strong> (somente leitura).</p>
    </div>
    <div class="admin-card">
      <h2>Adicionar usuário</h2>
      <form method="post" action="/admin/usuarios" class="form">
        <input type="hidden" name="csrf" value="${esc(csrf)}">
        <div class="form-grid">
          ${field('Nome', 'name', '')}
          ${field('E-mail', 'email', '', { type: 'email', required: true })}
          ${field('Senha inicial', 'password', '', { type: 'password', required: true, hint: 'Mínimo de 10 caracteres.' })}
          <div class="field">
            <label for="f-role">Função</label>
            <select id="f-role" name="role">${roleOptions}</select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" type="submit">Criar usuário</button>
      </form>
    </div>`;
  return { title: 'Usuários e RBAC', body };
}

module.exports = {
  NAV,
  ROLES,
  can,
  shell,
  authPage,
  dashboard,
  identidade,
  comercial,
  juridicoLista,
  juridicoDoc,
  conteudo,
  atendimento,
  leads,
  operacao,
  usuarios,
  publicationChecklist,
};
