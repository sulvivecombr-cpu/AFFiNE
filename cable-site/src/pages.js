'use strict';

const { esc, pending, fillTokens, renderBlocks, formatDate } = require('./html');
const { appLink, organizationJsonLd } = require('./layout');

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5h9l-1.6 3.6L15 12H6"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 13h5M10 17h5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 9v5M12 16.5v.5"/>',
  repeat: '<path d="M4 10a8 8 0 0 1 13-5l3 3"/><path d="M20 14a8 8 0 0 1-13 5l-3-3"/><path d="M20 4v4h-4M4 20v-4h4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chart: '<path d="M4 20V6M4 20h16"/><path d="M8 20v-6M12 20V9M16 20v-9"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  plug: '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  download: '<path d="M12 3v11"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/>',
  device: '<rect x="3" y="4" width="12" height="16" rx="2"/><path d="M17 9h4v11h-4z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
};

function icon(name) {
  const path = ICONS[name] || ICONS.grid;
  return `<span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

function sectionHead(eyebrow, title, text) {
  return `<div class="section-head">
    ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
    <h2>${esc(title)}</h2>
    ${text ? `<p>${esc(text)}</p>` : ''}
  </div>`;
}

function pageHead(title, subtitle, meta) {
  return `<section class="page-head">
    <div class="container">
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      ${meta || ''}
    </div>
  </section>`;
}

function pendingIdentityFields(settings) {
  const entity = settings.legalEntity || {};
  const labels = {
    legalName: 'Razão social',
    tradeName: 'Nome comercial',
    cnpj: 'CNPJ',
    address: 'Endereço empresarial',
    email: 'E-mail oficial',
    supportChannel: 'Canal de suporte',
    dpo: 'Encarregado de dados (DPO)',
  };
  return Object.keys(labels)
    .filter((key) => !entity[key])
    .map((key) => labels[key]);
}

function legalTokenMap(settings) {
  const entity = settings.legalEntity || {};
  return {
    legalName: entity.legalName,
    tradeName: entity.tradeName,
    cnpj: entity.cnpj,
    address: entity.address,
    email: entity.email,
    supportChannel: entity.supportChannel,
    dpo: entity.dpo,
  };
}

function reviewNotice(doc) {
  if (doc.reviewStatus !== 'pending') return '';
  return `<div class="notice notice-warning">
    <p><strong>Minuta em revisão jurídica.</strong> Este documento foi redigido como base para revisão por profissional jurídico antes da publicação definitiva. Versão ${esc(doc.version)}.</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Home                                                               */
/* ------------------------------------------------------------------ */

const BENEFITS = [
  ['Organização de estudos', 'Reúna concursos, editais, disciplinas e materiais em um só lugar, sem planilhas paralelas.', 'grid'],
  ['Planejamento inteligente', 'Distribua o conteúdo do edital conforme o tempo real que você tem na semana.', 'calendar'],
  ['Gestão de disciplinas', 'Defina pesos e prioridades de acordo com o edital e a sua dificuldade.', 'book'],
  ['Questões e simulados', 'Resolva questões, registre simulados e acompanhe acertos por tópico.', 'check'],
  ['Revisões inteligentes', 'Programe revisões para não perder o que já estudou.', 'repeat'],
  ['Acompanhamento de desempenho', 'Veja evolução, produtividade e cobertura do edital ao longo do tempo.', 'chart'],
  ['Inteligência artificial', 'O Cable AI analisa seu progresso e sugere prioridades de estudo.', 'spark'],
  ['Monitoramento de concursos', 'Mantenha cada preparação organizada e separada por concurso.', 'flag'],
  ['Gestão de materiais', 'Guarde resumos, anotações e arquivos vinculados às disciplinas certas.', 'folder'],
];

const JOURNEY = [
  ['Escolhe seu concurso', 'Cadastre o certame que você acompanha.'],
  ['Organiza o edital', 'Transforme o conteúdo programático em tópicos estudáveis.'],
  ['Estrutura o planejamento', 'Distribua os tópicos conforme sua disponibilidade.'],
  ['Estuda e resolve questões', 'Registre sessões, acertos e erros.'],
  ['Acompanha o desempenho', 'Veja evolução e pontos que exigem atenção.'],
  ['Recebe recomendações', 'Use o Cable AI para priorizar as próximas revisões.'],
];

function home(ctx) {
  const { settings } = ctx;
  const benefits = BENEFITS.map(
    ([title, text, ico]) => `<article class="card">${icon(ico)}<h3>${esc(title)}</h3><p>${esc(text)}</p></article>`
  ).join('');

  const steps = JOURNEY.map(
    ([title, text]) => `<article class="step"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`
  ).join('');

  const body = `
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="eyebrow">Preparação para concursos públicos</span>
        <h1>Seu concurso merece uma preparação inteligente.</h1>
        <p class="lead">Organize seus estudos, acompanhe sua evolução e utilize inteligência artificial para transformar sua rotina de preparação.</p>
        <div class="btn-row">
          <a class="btn btn-primary" href="/plataforma">Conhecer o Cable</a>
          ${appLink(settings, { label: 'Acessar plataforma', className: 'btn btn-ghost' })}
        </div>
        <p class="hint">${esc(settings.brand.concept)}</p>
      </div>
      <div class="hero-panel" role="img" aria-label="Representação da interface do Cable com indicadores de estudo, disciplinas e evolução semanal">
        <div class="hero-panel-inner">
          <div class="mock-bar"><span></span><span></span><span></span></div>
          <p class="mock-title">Visão geral da preparação</p>
          <div class="mock-row">
            <div class="mock-card"><strong>Planejado</strong><span>semana</span></div>
            <div class="mock-card"><strong>Concluído</strong><span>sessões</span></div>
            <div class="mock-card"><strong>Revisões</strong><span>pendentes</span></div>
          </div>
          <div class="mock-bars" aria-hidden="true">
            <i style="height:42%"></i><i style="height:66%"></i><i style="height:54%"></i>
            <i style="height:82%"></i><i style="height:70%"></i><i style="height:94%"></i><i style="height:60%"></i>
          </div>
          <p class="mock-note">Representação ilustrativa da interface. Capturas reais serão publicadas quando a versão do aplicativo estiver disponível.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="beneficios">
    <div class="container">
      ${sectionHead('Benefícios', 'Tudo o que a preparação exige, em um só lugar', 'Recursos disponíveis na plataforma Cable para organizar a rotina de estudos e acompanhar a evolução.')}
      <div class="grid grid-3">${benefits}</div>
      <p class="hint">Recursos em desenvolvimento são identificados como tal na página de <a href="/plataforma">Plataforma</a>. Nenhuma funcionalidade é anunciada como disponível antes de estar implementada.</p>
    </div>
  </section>

  <section class="section section-soft" id="experiencia">
    <div class="container">
      ${sectionHead('Experiência', 'Como o candidato usa o Cable', 'Da escolha do concurso à recomendação de estudo, um fluxo contínuo de preparação.')}
      <div class="steps">${steps}</div>
    </div>
  </section>

  <section class="section" id="cable-ai">
    <div class="container">
      <div class="grid grid-2" style="align-items:start">
        <div>
          <span class="eyebrow">Cable AI</span>
          <h2>Assistência inteligente para decidir o que estudar agora</h2>
          <p class="muted">O Cable AI analisa o que você registra na plataforma e ajuda a organizar prioridades, revisões e rotina. Ele apoia a decisão — a decisão continua sendo sua.</p>
          <ul class="checklist">
            <li>Analisar o progresso registrado na sua preparação</li>
            <li>Identificar dificuldades por disciplina e por tópico</li>
            <li>Auxiliar na organização do planejamento</li>
            <li>Recomendar prioridades de estudo e revisão</li>
            <li>Apoiar revisões e facilitar a aprendizagem</li>
          </ul>
          <p class="hint">O Cable AI é uma ferramenta de assistência educacional. Pode conter erros e não garante aprovação, classificação ou resultado em concurso público.</p>
          <p><a href="/legal/ia">Ler a Política de Inteligência Artificial</a></p>
        </div>
        <div class="card">
          <h3>Compatibilidade</h3>
          <ul class="checklist">
            <li>Windows</li>
            <li>macOS</li>
            <li>Linux, quando compatível</li>
            <li>Android</li>
            <li>iPhone e iPad</li>
            <li>Navegadores modernos</li>
          </ul>
          <p class="hint">A disponibilidade de instalação depende da versão publicada e da compatibilidade de cada dispositivo. Veja <a href="/baixar">Baixar Cable</a>.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-soft">
    <div class="container">
      <div class="card" style="padding:40px;text-align:center">
        <h2>Comece sua preparação com o Cable.</h2>
        <p class="muted" style="max-width:56ch;margin:0 auto 22px">Organize seu concurso, estruture o edital e acompanhe sua evolução a partir do primeiro dia de estudo.</p>
        <div class="btn-row" style="justify-content:center">
          ${appLink(settings, { label: 'Acessar plataforma' })}
          <a class="btn btn-ghost" href="/contato">Solicitar acesso</a>
        </div>
      </div>
    </div>
  </section>`;

  return {
    activeKey: 'home',
    body,
    jsonLd: [
      organizationJsonLd(settings, ctx.origin),
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Cable',
        url: ctx.origin,
        inLanguage: 'pt-BR',
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Plataforma / Recursos                                              */
/* ------------------------------------------------------------------ */

function featureCards(features) {
  return features
    .map((feature) => {
      const status =
        feature.status === 'em-desenvolvimento'
          ? ' <span class="badge badge-dev">Em desenvolvimento</span>'
          : '';
      return `<article class="card" id="recurso-${esc(feature.key)}">
        ${icon(feature.icon)}
        <h3>${esc(feature.name)}${status}</h3>
        <p>${esc(feature.summary)}</p>
      </article>`;
    })
    .join('');
}

function plataforma(ctx) {
  const { settings, features } = ctx;
  const body = `
  ${pageHead(
    'A plataforma Cable',
    'Um ambiente de preparação que conecta concurso, edital, planejamento, estudo e desempenho.',
    '<div class="doc-meta"><span>13 áreas do produto</span><span>Uso em navegadores modernos</span><span>Dados da sua preparação em um só lugar</span></div>'
  )}
  <section class="section">
    <div class="container">
      ${sectionHead('Recursos', 'O que existe hoje na plataforma', 'Cada área abaixo descreve o que o Cable faz na preparação do candidato. Itens em desenvolvimento estão marcados.')}
      <div class="grid grid-3">${featureCards(features)}</div>
    </div>
  </section>
  <section class="section section-soft">
    <div class="container grid grid-2" style="align-items:start">
      <div>
        <h2>Para quem é</h2>
        <ul class="checklist">
          <li>Concurseiros em preparação inicial ou avançada</li>
          <li>Candidatos a carreiras policiais</li>
          <li>Candidatos a tribunais</li>
          <li>Estudantes de carreiras administrativas</li>
          <li>Candidatos a concursos federais, estaduais e municipais</li>
        </ul>
      </div>
      <div>
        <h2>Comece agora</h2>
        <p class="muted">O acesso é feito pelo aplicativo Cable. Se o endereço ainda não estiver disponível nesta página, use o formulário de contato para solicitar acesso.</p>
        <div class="btn-row">
          ${appLink(settings, { label: 'Acessar plataforma' })}
          <a class="btn btn-ghost" href="/contato">Solicitar acesso</a>
        </div>
      </div>
    </div>
  </section>`;

  return { activeKey: 'plataforma', title: 'Plataforma', description: 'Conheça as áreas do Cable: dashboard, concursos, editais, disciplinas, planejamento, questões, revisões, simulados, analytics e Cable AI.', body };
}

function recursos(ctx) {
  const { features } = ctx;
  const groups = [
    ['Organização', ['concursos', 'editais', 'disciplinas', 'materiais']],
    ['Rotina de estudos', ['planejamento', 'questoes', 'caderno-erros', 'revisoes', 'simulados']],
    ['Inteligência', ['dashboard', 'analytics', 'cable-ai', 'integracoes']],
  ];
  const blocks = groups
    .map(([title, keys]) => {
      const list = features.filter((f) => keys.includes(f.key));
      return `<section class="section" style="padding-top:0">
        <div class="container">
          ${sectionHead('', title, '')}
          <div class="grid grid-4">${featureCards(list)}</div>
        </div>
      </section>`;
    })
    .join('');

  const body = `${pageHead('Recursos', 'Cada recurso do Cable, explicado de forma objetiva.', '')}${blocks}`;
  return { activeKey: 'recursos', title: 'Recursos', description: 'Lista objetiva dos recursos do Cable, organizados por organização, rotina de estudos e inteligência.', body };
}

/* ------------------------------------------------------------------ */
/* Como funciona                                                      */
/* ------------------------------------------------------------------ */

function comoFunciona(ctx) {
  const { settings } = ctx;
  const steps = [
    ['Cadastro', 'Você cria sua conta no aplicativo Cable com nome, e-mail e senha.'],
    ['Escolha do concurso', 'Cadastra o concurso que vai acompanhar, com órgão, cargo e data prevista.'],
    ['Importação do edital', 'Estrutura o conteúdo programático em disciplinas e tópicos estudáveis.'],
    ['Organização dos conteúdos', 'Define pesos e prioridades de acordo com o edital e sua dificuldade.'],
    ['Planejamento', 'Distribui os tópicos conforme a disponibilidade real da semana.'],
    ['Sessões de estudo', 'Registra tempo, disciplina e tópico de cada sessão concluída.'],
    ['Resolução de questões', 'Resolve questões e registra acertos e erros por tópico.'],
    ['Revisões', 'Agenda e acompanha revisões dos conteúdos já estudados.'],
    ['Análise de desempenho', 'Acompanha evolução, cobertura do edital e pontos de atenção.'],
  ]
    .map(([title, text]) => `<article class="step"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`)
    .join('');

  const body = `
  ${pageHead('Como funciona', 'A jornada do candidato dentro do Cable, do cadastro à análise de desempenho.')}
  <section class="section">
    <div class="container">
      <div class="steps" style="grid-template-columns:repeat(3,minmax(0,1fr))">${steps}</div>
      <div class="notice" style="margin-top:32px">
        <p><strong>Sem resultados fictícios.</strong> Esta página descreve o fluxo de uso do produto. Não publicamos números de aprovação, depoimentos ou métricas que não possam ser comprovados.</p>
      </div>
      <div class="btn-row" style="margin-top:24px">
        ${appLink(settings, { label: 'Começar pelo aplicativo' })}
        <a class="btn btn-ghost" href="/plataforma">Ver recursos</a>
      </div>
    </div>
  </section>`;
  return { activeKey: 'como-funciona', title: 'Como funciona', description: 'A jornada do candidato no Cable: cadastro, concurso, edital, planejamento, estudo, questões, revisões e desempenho.', body };
}

/* ------------------------------------------------------------------ */
/* Planos                                                             */
/* ------------------------------------------------------------------ */

function planos(ctx) {
  const { plans, flash } = ctx;
  const hasPrice = plans.some((p) => p.price);

  const cards = plans
    .map((plan) => {
      const price = plan.price
        ? `<p class="plan-price">${esc(plan.price)} <span>/ ${esc(plan.period)}</span></p>`
        : `<p class="plan-price">Em breve <span>· preço em definição</span></p>`;
      const benefits = (plan.benefits || []).map((b) => `<li>${esc(b)}</li>`).join('');
      return `<article class="plan${plan.highlight ? ' is-highlight' : ''}">
        <h3>${esc(plan.name)}${plan.highlight ? ' <span class="badge badge-pending">Destaque</span>' : ''}</h3>
        ${price}
        ${plan.limits ? `<p class="small muted">${esc(plan.limits)}</p>` : ''}
        <ul class="checklist">${benefits}</ul>
        <a class="btn btn-ghost" href="#interesse" aria-describedby="plans-pending">${esc(plan.cta || 'Lista de interesse')}</a>
      </article>`;
    })
    .join('');

  const body = `
  ${pageHead('Planos e preços', 'A estrutura comercial do Cable está em definição. Nenhum valor é publicado antes de ser aprovado.', '<div class="doc-meta"><span>Sem cobrança ativa</span><span>Sem pagamento simulado</span></div>')}
  <section class="section">
    <div class="container">
      <div class="notice notice-warning" id="plans-pending">
        <p><strong>Planos em breve.</strong> Ainda não há preço publicado, checkout ativo ou cobrança em andamento. Entre na lista de interesse para ser avisado quando a contratação for liberada.</p>
      </div>
      <div class="plan-grid">${cards}</div>
      <p class="hint">${hasPrice ? 'Preços publicados pelo administrador do site.' : 'Valores, limites e condições serão cadastrados pelo administrador quando aprovados.'}</p>
    </div>
  </section>
  <section class="section section-soft" id="interesse">
    <div class="container grid grid-2" style="align-items:start">
      <div>
        <h2>Lista de interesse</h2>
        <p class="muted">Cadastre-se para receber aviso quando os planos forem publicados. O consentimento para comunicações é opcional e separado dos dados necessários para responder ao contato.</p>
        <p class="small muted">Consulte a <a href="/legal/assinatura">Política de Assinatura, Cancelamento e Reembolso</a> para as condições previstas de contratação.</p>
      </div>
      <div class="card">
        ${flash ? renderFlash(flash) : ''}
        <form class="form" method="post" action="/planos/interesse" data-validate>
          <input type="hidden" name="form" value="plan-interest">
          <div class="field">
            <label for="pi-name">Nome <span class="req" aria-hidden="true">*</span></label>
            <input id="pi-name" name="name" type="text" required autocomplete="name" maxlength="120">
          </div>
          <div class="field">
            <label for="pi-email">E-mail <span class="req" aria-hidden="true">*</span></label>
            <input id="pi-email" name="email" type="email" required autocomplete="email" maxlength="180">
          </div>
          <div class="field">
            <label for="pi-plan">Plano de interesse</label>
            <select id="pi-plan" name="plan">
              <option value="Gratuito">Gratuito</option>
              <option value="Individual">Individual</option>
              <option value="Premium">Premium</option>
              <option value="Indiferente">Ainda não sei</option>
            </select>
          </div>
          <label class="checkbox"><input type="checkbox" name="consent" value="1"> Autorizo o contato sobre planos e novidades do Cable. (opcional)</label>
          <div class="honeypot" aria-hidden="true"><label for="pi-extra">Não preencha</label><input id="pi-extra" name="extra" type="text" tabindex="-1" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Quero ser avisado</button>
        </form>
      </div>
    </div>
  </section>`;
  return { activeKey: 'planos', title: 'Planos e preços', description: 'Planos do Cable em definição: sem preço publicado e sem cobrança ativa. Entre na lista de interesse.', body };
}

/* ------------------------------------------------------------------ */
/* Baixar                                                             */
/* ------------------------------------------------------------------ */

function baixar(ctx) {
  const { settings } = ctx;
  const app = settings.app || {};
  const configured = Boolean(app.url);
  const storesConfigured = Boolean(app.playStoreUrl || app.appStoreUrl || app.microsoftStoreUrl);

  const status = configured
    ? `<div class="notice"><p><strong>Aplicativo disponível.</strong> Acesse em <a href="${esc(app.url)}" rel="noopener">${esc(app.url)}</a>.</p></div>`
    : `<div class="notice notice-warning"><p><strong>Endereço do aplicativo ainda não configurado.</strong> O Cable está em implantação e o endereço oficial de acesso será publicado aqui assim que definido. Não há link de download ativo neste momento.</p></div>`;

  const body = `
  <section class="hero" style="padding:64px 0 72px">
    <div class="container">
      <span class="eyebrow">Baixar Cable</span>
      <h1>Leve sua preparação com você.</h1>
      <p class="lead">Acesse o Cable pelo navegador ou instale a experiência compatível com seu dispositivo.</p>
      <div class="btn-row">
        ${appLink(settings, { label: 'Acessar Cable' })}
        <a class="btn btn-ghost" href="#instalacao">Como instalar</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${status}
      <div class="grid grid-3">
        <article class="card">
          ${icon('device')}
          <h3>Web</h3>
          <p>Funciona em navegadores modernos de celular, tablet e computador, sem instalação.</p>
          <p class="small">${configured ? `<a href="${esc(app.url)}" rel="noopener">Abrir aplicativo</a>` : '<span class="pending-data">endereço pendente</span>'}</p>
        </article>
        <article class="card">
          ${icon('download')}
          <h3>Android</h3>
          <p>Quando o navegador oferecer instalação, o Cable pode ser adicionado à tela inicial como aplicativo.</p>
          <p class="small"><button class="btn btn-ghost btn-sm" type="button" data-install hidden>Instalar agora</button><span class="hint" data-install-hint>Instalação indisponível neste navegador até a versão publicada do aplicativo ser configurada.</span></p>
        </article>
        <article class="card">
          ${icon('device')}
          <h3>iPhone e iPad</h3>
          <p>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>
          <p class="small muted">Disponível quando o aplicativo estiver publicado.</p>
        </article>
        <article class="card">
          ${icon('device')}
          <h3>Windows e macOS</h3>
          <p>Em navegadores compatíveis, use a opção de instalar aplicativo na barra de endereço para criar um acesso no sistema.</p>
          <p class="small muted">Requer navegador com suporte a aplicativos web.</p>
        </article>
        <article class="card">
          ${icon('grid')}
          <h3>Linux</h3>
          <p>Uso pelo navegador. A instalação como aplicativo depende do suporte do navegador e do ambiente desktop.</p>
        </article>
        <article class="card">
          ${icon('plug')}
          <h3>Lojas de aplicativos</h3>
          <p>Google Play, Apple App Store e Microsoft Store.</p>
          <p class="small">${
            storesConfigured
              ? 'Links oficiais publicados pelo administrador.'
              : '<span class="pending-data">sem aplicativos nativos publicados</span>'
          }</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-soft" id="instalacao">
    <div class="container grid grid-2" style="align-items:start">
      <div>
        <h2>Requisitos técnicos de instalação</h2>
        <p class="muted">A instalação como aplicativo exige que a versão publicada atenda a critérios técnicos. Este site não declara o aplicativo como instalável sem essa verificação.</p>
        <ul class="checklist">
          <li>Manifest de aplicativo publicado com nome, ícones e theme color</li>
          <li>Start URL apontando para o endereço oficial do aplicativo</li>
          <li>Service worker, quando suportado</li>
          <li>Conexão HTTPS no domínio oficial</li>
          <li>Layout responsivo em telas pequenas</li>
        </ul>
        <p class="hint">Status atual: endereço oficial do aplicativo ${configured ? 'configurado' : 'pendente'}; instaladores nativos ${storesConfigured ? 'publicados' : 'não publicados'}.</p>
      </div>
      <div>
        <h2>Instruções por navegador</h2>
        <div class="faq">
          <details><summary>Chrome no Android</summary><p>Abra o endereço oficial do Cable no Chrome, toque no menu de três pontos e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”, quando a opção aparecer.</p></details>
          <details><summary>Safari no iPhone e iPad</summary><p>Abra o endereço no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p></details>
          <details><summary>Chrome e Edge no computador</summary><p>Clique no ícone de instalação na barra de endereço ou acesse o menu do navegador e escolha “Instalar Cable”.</p></details>
        </div>
        <p class="hint">Este site institucional apenas encaminha para o aplicativo oficial. Nenhum arquivo APK, EXE ou DMG é distribuído aqui.</p>
      </div>
    </div>
  </section>`;
  return { activeKey: 'baixar', title: 'Baixar Cable', description: 'Acesse o Cable pelo navegador ou instale a experiência compatível com seu dispositivo. Instruções para Android, iPhone, iPad, Windows e macOS.', body };
}

/* ------------------------------------------------------------------ */
/* Ajuda / FAQ                                                        */
/* ------------------------------------------------------------------ */

function renderFlash(flash) {
  if (!flash) return '';
  const cls = flash.type === 'error' ? 'is-error' : 'is-ok';
  return `<div class="form-status ${cls}" role="status">
    <p style="margin:0"><strong>${esc(flash.title || '')}</strong> ${esc(flash.message || '')}</p>
    ${flash.protocol ? `<p style="margin:6px 0 0" class="small">Protocolo: <strong>${esc(flash.protocol)}</strong></p>` : ''}
  </div>`;
}

function ajuda(ctx) {
  const { helpArticles, query, flash } = ctx;
  const q = (query.q || '').trim().toLowerCase();
  const filtered = q
    ? helpArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          JSON.stringify(a.blocks).toLowerCase().includes(q)
      )
    : helpArticles;

  const categories = [...new Set(helpArticles.map((a) => a.category))];
  const list = filtered
    .map(
      (a) => `<article class="card">
        <span class="badge badge-pending">${esc(a.category)}</span>
        <h3 style="margin-top:10px"><a href="/ajuda/${esc(a.slug)}">${esc(a.title)}</a></h3>
        <p>${esc(a.summary)}</p>
      </article>`
    )
    .join('');

  const body = `
  ${pageHead('Central de ajuda', 'Artigos objetivos sobre a plataforma, o aplicativo, a preparação e a sua conta.')}
  <section class="section">
    <div class="container">
      <form class="form" method="get" action="/ajuda" role="search" style="max-width:560px;margin-bottom:32px">
        <div class="field">
          <label for="help-q">Buscar na central de ajuda</label>
          <input id="help-q" name="q" type="search" value="${esc(query.q || '')}" placeholder="Ex.: instalar, edital, revisões, privacidade">
        </div>
        <div class="btn-row"><button class="btn btn-primary" type="submit">Buscar</button><a class="btn btn-ghost" href="/ajuda">Limpar</a></div>
      </form>
      ${flash ? renderFlash(flash) : ''}
      <p class="small muted">${filtered.length} artigo(s)${q ? ` para “${esc(query.q)}”` : ''} · Categorias: ${esc(categories.join(' · '))}</p>
      <div class="grid grid-3" style="margin-top:18px">${list || '<p class="muted">Nenhum artigo encontrado. Tente outro termo ou fale com o suporte.</p>'}</div>
      <div class="card" style="margin-top:28px">
        <h3>Não encontrou o que procurava?</h3>
        <p>Abra uma solicitação de suporte. Cada pedido é registrado com protocolo.</p>
        <a class="btn btn-primary" href="/contato?assunto=Suporte">Falar com o suporte</a>
      </div>
    </div>
  </section>`;
  return { activeKey: 'ajuda', title: 'Central de ajuda', description: 'Artigos de ajuda do Cable: primeiros passos, conta, aplicativo, concursos, estudos, questões, Cable AI, planos, privacidade e segurança.', body };
}

function ajudaArtigo(ctx, article) {
  if (!article) return null;
  const map = legalTokenMap(ctx.settings);
  const body = `
  ${pageHead(article.title, article.summary, `<div class="doc-meta"><span>Categoria: ${esc(article.category)}</span><span><a href="/ajuda">Central de ajuda</a></span></div>`)}
  <section class="section">
    <div class="container" style="max-width:820px">
      <div class="doc-body">${renderBlocks(article.blocks, map)}</div>
      <div class="card" style="margin-top:28px">
        <h3>Precisa de mais ajuda?</h3>
        <p>Registre uma solicitação de suporte com protocolo de acompanhamento.</p>
        <a class="btn btn-primary" href="/contato?assunto=Suporte">Abrir solicitação</a>
      </div>
    </div>
  </section>`;
  return { activeKey: 'ajuda', title: article.title, description: article.summary, body };
}

function faqPage(ctx) {
  const { faqs } = ctx;
  const items = faqs
    .map(
      (item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`
    )
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const body = `
  ${pageHead('Perguntas frequentes', 'Respostas objetivas sobre o Cable, o aplicativo, os planos e a privacidade.')}
  <section class="section">
    <div class="container" style="max-width:880px">
      <div class="faq">${items}</div>
      <p class="hint" style="margin-top:20px">As respostas correspondem ao funcionamento atual do produto. Recursos em desenvolvimento não são apresentados como disponíveis.</p>
    </div>
  </section>`;
  return { activeKey: 'ajuda', title: 'Perguntas frequentes', description: 'Perguntas frequentes sobre o Cable: o que é, quem pode usar, aplicativo, planos, IA, privacidade e suporte.', body, jsonLd };
}

/* ------------------------------------------------------------------ */
/* Contato / titulares / cookies                                      */
/* ------------------------------------------------------------------ */

const CONTACT_CATEGORIES = ['Comercial', 'Suporte', 'Parcerias', 'Privacidade', 'Imprensa', 'Acessibilidade', 'Outros'];

function contato(ctx) {
  const { flash, query } = ctx;
  const selected = query.assunto || '';
  const options = CONTACT_CATEGORIES.map(
    (c) => `<option value="${esc(c)}"${c === selected ? ' selected' : ''}>${esc(c)}</option>`
  ).join('');

  const body = `
  ${pageHead('Contato', 'Fale com o Cable. Cada solicitação é registrada com protocolo de atendimento.')}
  <section class="section">
    <div class="container grid grid-2" style="align-items:start">
      <div>
        <h2>Como podemos ajudar?</h2>
        <p class="muted">Escolha a categoria adequada para direcionar seu atendimento. Pedidos de privacidade podem ser feitos também pelo <a href="/privacidade/solicitacoes">formulário de titulares</a>.</p>
        <ul class="checklist">
          <li>Comercial: planos, acesso e contratação</li>
          <li>Suporte: uso da plataforma e problemas técnicos</li>
          <li>Privacidade: dados pessoais e consentimentos</li>
          <li>Parcerias, imprensa e outros assuntos</li>
        </ul>
        <p class="small muted">Canal oficial de atendimento: ${
          ctx.settings.legalEntity.supportChannel
            ? esc(ctx.settings.legalEntity.supportChannel)
            : '<span class="pending-data">pendente de cadastro</span>'
        }</p>
      </div>
      <div class="card">
        ${flash ? renderFlash(flash) : ''}
        <form class="form" method="post" action="/contato" data-validate>
          <input type="hidden" name="form" value="contact">
          <div class="field">
            <label for="c-name">Nome <span class="req" aria-hidden="true">*</span></label>
            <input id="c-name" name="name" type="text" required autocomplete="name" maxlength="120">
          </div>
          <div class="field">
            <label for="c-email">E-mail <span class="req" aria-hidden="true">*</span></label>
            <input id="c-email" name="email" type="email" required autocomplete="email" maxlength="180">
          </div>
          <div class="field">
            <label for="c-subject">Assunto <span class="req" aria-hidden="true">*</span></label>
            <select id="c-subject" name="category" required>${options}</select>
          </div>
          <div class="field">
            <label for="c-message">Mensagem <span class="req" aria-hidden="true">*</span></label>
            <textarea id="c-message" name="message" required minlength="10" maxlength="4000"></textarea>
          </div>
          <label class="checkbox"><input type="checkbox" name="consent" value="1"> Aceito receber resposta por e-mail sobre esta solicitação. (necessário para o atendimento)</label>
          <div class="honeypot" aria-hidden="true"><label for="c-extra">Não preencha</label><input id="c-extra" name="extra" type="text" tabindex="-1" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Enviar solicitação</button>
          <p class="hint">A confirmação é exibida somente depois do registro efetivo da solicitação.</p>
        </form>
      </div>
    </div>
  </section>`;
  return { activeKey: 'ajuda', title: 'Contato', description: 'Fale com o suporte do Cable: comercial, suporte, parcerias, privacidade, imprensa e acessibilidade.', body };
}

function titulares(ctx) {
  const { flash } = ctx;
  const types = [
    'Confirmação de tratamento',
    'Acesso aos dados',
    'Correção de dados',
    'Eliminação de dados',
    'Exportação / portabilidade',
    'Revogação de consentimento',
    'Informações sobre compartilhamento',
    'Outras solicitações de privacidade',
  ]
    .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`)
    .join('');

  const body = `
  ${pageHead('Solicitações de titulares', 'Exerça seus direitos previstos na LGPD. Você recebe um protocolo para acompanhar o atendimento.')}
  <section class="section">
    <div class="container grid grid-2" style="align-items:start">
      <div>
        <h2>Seus direitos</h2>
        <ul class="checklist">
          <li>Confirmação de tratamento e acesso aos dados</li>
          <li>Correção de dados incompletos ou desatualizados</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
          <li>Portabilidade e informação sobre compartilhamento</li>
          <li>Revogação de consentimento e oposição a tratamentos</li>
        </ul>
        <p class="small muted">Não é necessário informar CPF. Pedimos apenas dados de contato para responder e evitar acesso indevido a dados de terceiros.</p>
        <p class="small muted">Encarregado (DPO): ${
          ctx.settings.legalEntity.dpo
            ? esc(ctx.settings.legalEntity.dpo)
            : '<span class="pending-data">pendente de cadastro</span>'
        }</p>
      </div>
      <div class="card">
        ${flash ? renderFlash(flash) : ''}
        <form class="form" method="post" action="/privacidade/solicitacoes" data-validate>
          <input type="hidden" name="form" value="privacy">
          <div class="field">
            <label for="p-name">Nome <span class="req" aria-hidden="true">*</span></label>
            <input id="p-name" name="name" type="text" required autocomplete="name" maxlength="120">
          </div>
          <div class="field">
            <label for="p-email">E-mail para contato <span class="req" aria-hidden="true">*</span></label>
            <input id="p-email" name="email" type="email" required autocomplete="email" maxlength="180">
          </div>
          <div class="field">
            <label for="p-type">Tipo de solicitação <span class="req" aria-hidden="true">*</span></label>
            <select id="p-type" name="type" required>${types}</select>
          </div>
          <div class="field">
            <label for="p-details">Detalhes</label>
            <textarea id="p-details" name="details" maxlength="4000" placeholder="Descreva sua solicitação, se necessário."></textarea>
          </div>
          <label class="checkbox"><input type="checkbox" name="consent" value="1" required> Declaro que as informações são verdadeiras e autorizo o contato para atender esta solicitação.</label>
          <div class="honeypot" aria-hidden="true"><label for="p-extra">Não preencha</label><input id="p-extra" name="extra" type="text" tabindex="-1" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">Registrar solicitação</button>
        </form>
      </div>
    </div>
  </section>`;
  return { activeKey: null, title: 'Solicitações de titulares', description: 'Formulário de solicitações de titulares de dados do Cable: acesso, correção, exclusão, exportação e revogação de consentimento.', body };
}

function cookiesPage(ctx) {
  const { settings, cookieStats } = ctx;
  const body = `
  ${pageHead('Preferências de cookies', 'Escolha quais categorias de cookies podem ser usadas neste site. A alteração vale imediatamente.', `<div class="doc-meta"><span>Versão da política: ${esc(settings.cookiePolicyVersion)}</span><span><a href="/legal/cookies">Ler a Política de Cookies</a></span></div>`)}
  <section class="section">
    <div class="container" style="max-width:860px">
      <div class="card" data-cookie-panel>
        <h2>Suas preferências</h2>
        <p class="muted">Cookies essenciais não podem ser desativados porque garantem segurança e o funcionamento do site.</p>
        <div class="form">
          <label class="checkbox"><input type="checkbox" checked disabled> <span><strong>Essenciais</strong> — segurança, sessão e registro do consentimento. Sempre ativos.</span></label>
          <label class="checkbox"><input type="checkbox" name="preferences" data-cookie-cat="preferences"> <span><strong>Preferências</strong> — memorizam escolhas de interface.</span></label>
          <label class="checkbox"><input type="checkbox" name="statistics" data-cookie-cat="statistics"> <span><strong>Estatística</strong> — medem audiência de forma agregada.</span></label>
          <label class="checkbox"><input type="checkbox" name="marketing" data-cookie-cat="marketing"> <span><strong>Marketing</strong> — mensuram campanhas e comunicações.</span></label>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-cookie-action="save">Salvar preferências</button>
            <button class="btn btn-ghost" type="button" data-cookie-action="revoke">Revogar consentimento</button>
            <button class="btn btn-ghost" type="button" data-cookie-action="accept">Aceitar todos</button>
          </div>
          <div class="form-status" data-cookie-status hidden></div>
        </div>
      </div>
      <div class="card" style="margin-top:22px">
        <h3>Histórico de consentimentos neste dispositivo</h3>
        <ul class="small muted" data-cookie-history><li>Nenhum registro neste dispositivo.</li></ul>
        <p class="hint">Registros de consentimento também são armazenados no servidor com data, hora, categorias autorizadas e versão da política. Total registrado: ${cookieStats}.</p>
      </div>
    </div>
  </section>`;
  return { title: 'Preferências de cookies', description: 'Gerencie o consentimento de cookies do site do Cable por categoria.', body };
}

/* ------------------------------------------------------------------ */
/* Legal                                                              */
/* ------------------------------------------------------------------ */

function legal(ctx, slug) {
  const { legalDocs, settings } = ctx;
  const doc = legalDocs.find((d) => d.slug === slug);
  if (!doc) return null;

  const nav = legalDocs
    .map(
      (d) =>
        `<li><a href="/legal/${esc(d.slug)}"${d.slug === slug ? ' aria-current="page"' : ''}>${esc(d.title)}</a></li>`
    )
    .join('');

  const missing = pendingIdentityFields(settings);
  const identityNotice = missing.length
    ? `<div class="notice notice-warning">
        <p><strong>Publicação bloqueada até o cadastro dos dados empresariais.</strong> Campos pendentes: ${missing
          .map((m) => esc(m))
          .join(', ')}. Os marcadores em destaque no texto serão substituídos automaticamente quando o administrador cadastrar essas informações.</p>
      </div>`
    : '';

  const body = `
  ${pageHead(doc.title, doc.summary, `<div class="doc-meta">
    <span>Versão ${esc(doc.version)}</span>
    <span>Atualizado em ${formatDate(doc.updatedAt)}</span>
    <span>${doc.reviewStatus === 'pending' ? 'Revisão jurídica pendente' : 'Revisado'}</span>
  </div>`)}
  <div class="container doc-layout">
    <nav class="doc-nav" aria-label="Documentos legais">
      <h2>Documentos</h2>
      <ul>${nav}</ul>
    </nav>
    <div class="doc-body">
      ${reviewNotice(doc)}
      ${identityNotice}
      ${renderBlocks(doc.blocks, legalTokenMap(settings))}
      <div class="notice">
        <p><strong>Versionamento.</strong> Cada alteração relevante gera nova versão com data de atualização. Consulte o histórico no painel administrativo ou solicite pelo canal de atendimento.</p>
      </div>
      <p class="small muted"><a href="/legal/aviso-educacional">Aviso educacional e informacional</a> · <a href="/privacidade/solicitacoes">Solicitações de titulares</a> · <a href="/cookies">Preferências de cookies</a></p>
    </div>
  </div>`;
  return {
    title: doc.title,
    description: doc.summary,
    body,
    noindex: doc.reviewStatus === 'pending',
  };
}

/* ------------------------------------------------------------------ */

function notFound(ctx) {
  const body = `<section class="section">
    <div class="container" style="max-width:640px;text-align:center;padding:64px 0">
      <h1>Página não encontrada</h1>
      <p class="muted">O endereço acessado não existe ou foi movido.</p>
      <div class="btn-row" style="justify-content:center">
        <a class="btn btn-primary" href="/">Voltar ao início</a>
        <a class="btn btn-ghost" href="/ajuda">Central de ajuda</a>
      </div>
    </div>
  </section>`;
  return { title: 'Página não encontrada', description: 'Página não encontrada.', body, noindex: true };
}

module.exports = {
  home,
  plataforma,
  recursos,
  comoFunciona,
  planos,
  baixar,
  ajuda,
  ajudaArtigo,
  faqPage,
  contato,
  titulares,
  cookiesPage,
  legal,
  notFound,
  renderFlash,
  pending,
};
