# Cable — site institucional oficial

Portal público do **Cable**, plataforma SaaS de preparação para concursos públicos.
Este projeto é **independente do aplicativo de estudos**: ele não substitui, não
reconstrói e não duplica o aplicativo, e não replica a autenticação nem o banco de
dados dele. Sua função é apresentar o produto, encaminhar o visitante ao aplicativo
oficial, publicar condições comerciais, central de ajuda, suporte e políticas.

## Execução

Sem dependências externas (Node.js 20+):

```bash
cd cable-site
node server.js            # http://localhost:3000
```

Em contêiner:

```bash
docker run -d --name cable-site -p 3000:3000 \
  -v "$PWD/cable-site:/app" -w /app \
  -e PORT=3000 -e CABLE_DATA_DIR=/app/data \
  node:22 node server.js
```

Variáveis: `PORT` (padrão 3000), `HOST` (padrão `0.0.0.0`), `CABLE_DATA_DIR`
(padrão `./data`, fora do versionamento).

> Observação de ambiente: a montagem durável deste projeto no preview do Base44
> depende da configuração de ambiente da aplicação (serviço próprio em
> `docker-compose.base44.yml`). Enquanto ela não for aplicada, o site é servido pelo
> comando acima.

## Estrutura

```
cable-site/
├── server.js              rotas, sessões, CSRF, formulários, sitemap/robots
├── src/content.js         conteúdo inicial (recursos, planos, FAQ, ajuda, políticas)
├── src/store.js           persistência em JSON com gravação atômica
├── src/layout.js          layout, navegação, rodapé, SEO, banner de cookies
├── src/pages.js           páginas públicas
├── src/admin.js           painel administrativo e RBAC
├── src/html.js            escape, tokens de dados pendentes, datas
└── public/                CSS, JS de consentimento/navegação, logotipos, favicon
```

Dados ficam em `data/db.json`, criado a partir do seed em `src/content.js`.
Para recomeçar do zero: apague `data/` e reinicie o processo.

## Páginas públicas

`/` · `/plataforma` · `/recursos` · `/como-funciona` · `/planos` · `/baixar` ·
`/ajuda` (+ artigos) · `/faq` · `/contato` · `/cookies` ·
`/privacidade/solicitacoes` · `/legal/{termos,privacidade,cookies,ia,assinatura,uso-aceitavel,seguranca,acessibilidade,aviso-educacional,titulares}`

SEO: título/descrição por página, canonical, Open Graph, Twitter Cards,
JSON-LD (`Organization`, `WebSite`, `FAQPage`), `sitemap.xml`, `robots.txt`.
Documentos com revisão jurídica pendente são publicados com `noindex`.

## Painel administrativo

`/admin` — na primeira execução, `/admin/setup` cria o administrador inicial.

Seções: visão geral (checklist de publicação), identidade e aplicativo, comercial
e planos, jurídico (edição de conteúdo e versionamento), conteúdo (FAQ),
atendimento (contato e titulares), leads (com exportação CSV), operação
(auditoria e consentimentos) e usuários.

RBAC: `admin` (total), `editor` (conteúdo, planos, jurídico), `leitor` (somente leitura).
Sessão em cookie `HttpOnly` + `SameSite=Lax`, token CSRF em todo POST,
senhas com `scrypt` e salt individual, limite de tentativas de login.

## Consentimento de cookies

Categorias: essenciais, preferências, estatística e marketing. Banner permite
aceitar todos, rejeitar não essenciais, personalizar, salvar e revogar. A escolha
é registrada no dispositivo e no servidor (data, categorias e versão da política)
e o histórico fica disponível em `/cookies`. Nenhum script não essencial é
carregado antes do consentimento — e nenhum está configurado hoje.

## Segurança

CSP com nonce por resposta, `X-Content-Type-Options`, `Referrer-Policy`,
validação de entrada no servidor, campo armadilha anti-spam, limite de requisições
por IP, isolamento dos registros privados (nenhum endpoint público expõe contato,
suporte, leads ou solicitações de titulares) e trilha de auditoria administrativa.

## Relatório de pendências (bloqueiam a publicação definitiva)

Dados reais ainda não cadastrados — o site exibe marcadores de pendência e o
painel lista cada bloqueio:

| Pendência | Onde cadastrar |
|---|---|
| Razão social, nome comercial, CNPJ, endereço, e-mail oficial, canal de suporte, DPO | Painel → Identidade e aplicativo |
| Domínio oficial do site, do aplicativo e da ajuda | Painel → Identidade e aplicativo |
| URL real do aplicativo Cable | Painel → Identidade e aplicativo |
| Links de lojas (Google Play, App Store, Microsoft Store) | Painel → Identidade e aplicativo |
| Preços e condições dos planos | Painel → Comercial e planos |
| Revisão jurídica dos 10 documentos | Painel → Jurídico |
| Provedor de e-mail transacional | Painel → Identidade (integração) |
| Gateway de pagamentos | Painel → Identidade (integração) |
| Analytics e Search Console | Painel → Identidade (integração) |
| Verificação manual: formulários, responsividade, acessibilidade, recursos anunciados | Checklist no painel |

Itens que **não** foram entregues e não devem ser simulados:

- **Integrações do Base44**: este repositório não possui SDK nem conectores do
  Base44. Não há como declarar integrações Base44 funcionando aqui; o painel
  registra apenas a identificação pública de cada serviço externo.
- Envio real de e-mail: os formulários registram a solicitação e geram protocolo;
  a notificação por e-mail depende de provedor configurado.
- Pagamentos: nenhum checkout é exibido enquanto não houver preço e gateway reais.
- Aplicativos nativos e arquivos APK/EXE/DMG: não publicados, e por isso ocultos.
