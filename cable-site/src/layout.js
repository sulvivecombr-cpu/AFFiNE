'use strict';

const { esc } = require('./html');

const NAV = [
  { href: '/', label: 'Início', key: 'home' },
  { href: '/plataforma', label: 'Plataforma', key: 'plataforma' },
  { href: '/recursos', label: 'Recursos', key: 'recursos' },
  { href: '/como-funciona', label: 'Como funciona', key: 'como-funciona' },
  { href: '/planos', label: 'Planos', key: 'planos' },
  { href: '/baixar', label: 'Baixar aplicativo', key: 'baixar' },
  { href: '/ajuda', label: 'Central de ajuda', key: 'ajuda' },
];

function logoMark(className = 'logo-mark') {
  return `<svg class="${className}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" opacity=".12"/>
    <path d="M21.5 10.4a7.2 7.2 0 1 0 0 11.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="23.6" cy="16" r="2.4" fill="currentColor"/>
  </svg>`;
}

/**
 * Link para o aplicativo Cable.
 * Nunca inventa endereço: sem URL configurada, encaminha para /baixar,
 * que explica o estado real da disponibilidade.
 */
function appLink(settings, options = {}) {
  const url = (settings.app && settings.app.url) || '';
  const label = options.label || 'Acessar plataforma';
  const cls = options.className || 'btn btn-primary';
  if (url) {
    return `<a class="${cls}" href="${esc(url)}" rel="noopener">${esc(label)}</a>`;
  }
  return `<a class="${cls} is-pending" href="/baixar" aria-describedby="app-pending-note">${esc(label)}</a>
    <span id="app-pending-note" class="hint">Endereço do aplicativo ainda não configurado.</span>`;
}

function header(settings, activeKey) {
  const items = NAV.map(
    (item) =>
      `<li><a href="${item.href}"${item.key === activeKey ? ' aria-current="page"' : ''}>${esc(item.label)}</a></li>`
  ).join('');

  return `<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="Cable — página inicial">
        ${logoMark()}
        <span class="brand-name">Cable</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
        <span class="nav-toggle-bar" aria-hidden="true"></span>
        <span class="visually-hidden">Abrir menu</span>
      </button>
      <nav class="site-nav" id="site-nav" aria-label="Navegação principal">
        <ul>${items}</ul>
        <div class="nav-actions">
          ${appLink(settings, { label: 'Entrar', className: 'btn btn-ghost' })}
          <a class="btn btn-primary" href="/contato">Começar agora</a>
        </div>
      </nav>
    </div>
  </header>`;
}

function footer(settings) {
  const entity = settings.legalEntity || {};
  const identityLine = entity.legalName
    ? `${esc(entity.legalName)}${entity.cnpj ? ` · CNPJ ${esc(entity.cnpj)}` : ''}`
    : `<span class="pending-data">Identificação empresarial pendente de cadastro</span>`;
  const email = entity.email
    ? `<a href="mailto:${esc(entity.email)}">${esc(entity.email)}</a>`
    : `<span class="pending-data">e-mail oficial pendente</span>`;
  const support = entity.supportChannel
    ? esc(entity.supportChannel)
    : `<span class="pending-data">canal de suporte pendente</span>`;

  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/" aria-label="Cable — página inicial">
          ${logoMark()}
          <span class="brand-name">Cable</span>
        </a>
        <p>${esc(settings.brand.concept)}</p>
        <p class="muted small">${identityLine}</p>
        <p class="muted small">Contato: ${email}<br>Atendimento: ${support}</p>
      </div>
      <nav class="footer-col" aria-label="Produto">
        <h2>Produto</h2>
        <ul>
          <li><a href="/plataforma">Plataforma</a></li>
          <li><a href="/recursos">Recursos</a></li>
          <li><a href="/como-funciona">Como funciona</a></li>
          <li><a href="/planos">Planos</a></li>
          <li><a href="/baixar">Baixar Cable</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="Suporte">
        <h2>Suporte</h2>
        <ul>
          <li><a href="/ajuda">Central de ajuda</a></li>
          <li><a href="/faq">Perguntas frequentes</a></li>
          <li><a href="/contato">Falar com o suporte</a></li>
          <li><a href="/privacidade/solicitacoes">Solicitações de titulares</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="Legal">
        <h2>Legal</h2>
        <ul>
          <li><a href="/legal/termos">Termos de Uso</a></li>
          <li><a href="/legal/privacidade">Política de Privacidade</a></li>
          <li><a href="/legal/cookies">Política de Cookies</a></li>
          <li><a href="/legal/ia">Política de IA</a></li>
          <li><a href="/legal/assinatura">Assinatura e Reembolso</a></li>
          <li><a href="/legal/uso-aceitavel">Uso Aceitável</a></li>
          <li><a href="/legal/seguranca">Segurança</a></li>
          <li><a href="/legal/acessibilidade">Acessibilidade</a></li>
          <li><a href="/legal/aviso-educacional">Aviso Educacional</a></li>
          <li><a href="/cookies">Preferências de cookies</a></li>
        </ul>
      </nav>
    </div>
    <div class="container footer-bottom">
      <p class="small muted">© ${new Date().getFullYear()} Cable. Todos os direitos reservados. O Cable é uma ferramenta de apoio à preparação e não possui vínculo oficial com órgãos públicos ou bancas organizadoras.</p>
      <ul class="footer-inline">
        <li><a href="/cookies">Cookies</a></li>
        <li><a href="/legal/acessibilidade">Acessibilidade</a></li>
        <li><a href="/admin">Painel administrativo</a></li>
      </ul>
    </div>
  </footer>`;
}

function cookieBanner(settings) {
  const version = esc(settings.cookiePolicyVersion || '1.0');
  return `<div class="cookie-banner" id="cookie-banner" hidden data-cookie-version="${version}">
    <div class="cookie-banner-inner">
      <p><strong>Usamos cookies.</strong> Cookies essenciais mantêm o site funcionando. Preferências, estatística e marketing só são ativados com o seu consentimento. Veja a <a href="/legal/cookies">Política de Cookies</a>.</p>
      <div class="cookie-banner-actions">
        <button type="button" class="btn btn-ghost" data-cookie-action="reject">Rejeitar não essenciais</button>
        <button type="button" class="btn btn-ghost" data-cookie-action="customize">Personalizar</button>
        <button type="button" class="btn btn-primary" data-cookie-action="accept">Aceitar todos</button>
      </div>
    </div>
  </div>`;
}

/**
 * Layout base com SEO por página, dados estruturados e acessibilidade.
 */
function layout({ settings, path, title, description, body, origin, jsonLd, noindex, activeKey, bodyClass, nonce }) {
  const pageTitle = title ? `${title} — Cable` : settings.seo.title;
  const pageDescription = description || settings.seo.description;
  const canonical = `${origin}${path === '/' ? '' : path}`;
  const structured = jsonLd
    ? `<script type="application/ld+json"${nonce ? ` nonce="${esc(nonce)}"` : ''}>${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(pageDescription)}">
  <link rel="canonical" href="${esc(canonical)}">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">'}
  <meta name="theme-color" content="${esc(settings.brand.primaryColor)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Cable">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(pageDescription)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(pageDescription)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/logo-icon.svg">
  <link rel="stylesheet" href="/styles.css">
  <script src="/app.js" defer></script>
  ${structured}
</head>
<body class="${esc(bodyClass || '')}">
  ${header(settings, activeKey)}
  <main id="conteudo">
    ${body}
  </main>
  ${footer(settings)}
  ${cookieBanner(settings)}
</body>
</html>`;
}

function organizationJsonLd(settings, origin) {
  const entity = settings.legalEntity || {};
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Cable',
    url: origin,
    description: settings.brand.description,
  };
  if (entity.legalName) data.legalName = entity.legalName;
  if (entity.email) data.email = entity.email;
  return data;
}

module.exports = { layout, appLink, logoMark, organizationJsonLd, NAV };
