# Cable — plataforma de preparação para concursos

Cable é a camada de produto construída sobre o monorepositório do AFFiNE. O
objetivo é operacional: o candidato cadastra o concurso, importa o edital, o
sistema monta a trilha de disciplinas e assuntos, registra o estudo e recalcula
plano, revisões e prioridades a partir de dados reais.

> **Princípio:** nada aqui é demonstrativo. Todo indicador exibido vem de um
> registro persistido, e quando não há dados a interface diz "sem dados" em vez
> de inventar números.

---

## 1. O que está funcional hoje

| Área | Estado | Evidência |
| --- | --- | --- |
| Cadastro, login, sessão, troca de senha, sessões por dispositivo | funcional | `src/routes/auth.js`, fluxo E2E |
| Isolamento multi-tenant por workspace | funcional | toda consulta é filtrada por `workspace_id`; `loadOwnedExam`/`loadOwnedNotice` |
| Concurso: criar, editar, arquivar, histórico de situação | funcional | `src/routes/exams.js` |
| Disponibilidade de estudo (horas, dias, minutos, nível) | funcional | `POST /exams/:id/availability` |
| Importação de edital (PDF/TXT/MD) com extração página a página | funcional | `services/document-extract.js` + worker |
| Leitura do conteúdo programático (disciplinas, assuntos, página de origem, confiança) | funcional | `services/notice-parser.js` + 9 testes |
| Revisão humana antes de criar a trilha | funcional | tela de revisão + `POST /notices/:id/confirm` |
| Trilha de estudos (disciplinas, assuntos, status, domínio estimado) | funcional | `src/routes/studies.js` |
| Registro de atividades e histórico | funcional | `POST /exams/:id/activities` |
| Revisão espaçada com FSRS | funcional | `services/scheduler.js` (ts-fsrs 6) |
| Motor de prioridade com justificativa | funcional (determinístico) | `services/priority-engine.js` |
| Planejador semanal | funcional (v1) | `services/planner.js` |
| Painel com indicadores e regra de cálculo visível | funcional | `src/routes/dashboard.js` |
| Barramento de eventos com outbox, retentativa e dead-letter | funcional | `src/events.js`, `src/worker.js` |
| Auditoria, exportação de dados, exclusão de conta | funcional | `src/routes/settings.js` |
| Interface pt-BR, responsiva, identidade própria | funcional | `cable/web` |

### Ainda não implementado (declarado, não simulado)

- **Cable AI em linguagem natural.** A ponte LLM existe (`services/llm.js`,
  OpenAI-compatible) e responde 503 com mensagem clara enquanto
  `CABLE_AI_API_KEY` não estiver configurada. O motor determinístico continua
  ativo. Não há agente fingindo funcionar.
- **Banco de questões, simulados, flashcards e caderno de erros** (fase 3).
- **Conectores de fontes públicas** (DOU, Querido Diário, PNCP, bancas) — fase 5.
- **Integrações de produtividade** (Notion, Google Calendar, Outlook) — fase 5.
- **Planos, cobrança e painel administrativo** — fase 6. Nenhuma cobrança é
  habilitada.
- **Busca semântica com pgvector.** A extensão está habilitada no Postgres e há
  coluna reservada no modelo, mas nenhum embedding é gerado ainda.
- **Integração com o editor/documentos do AFFiNE.** O AFFiNE permanece intacto e
  executável; a integração de documentos é um contrato futuro, não uma promessa.

---

## 2. Arquitetura de execução

O monorepositório AFFiNE é a fundação e **não foi alterado**. O runtime do
ambiente de desenvolvimento não consegue executar o stack completo do AFFiNE
(o `@affine/server` exige build nativo em Rust de `@affine/server-native`), então
o Cable Core roda como uma camada de serviços própria, no mesmo repositório, com
contratos versionados:

```
cable/
├── api/        Cable Core — HTTP API (node:http) + worker de eventos
│   ├── migrations/   001_core.sql (schema completo, pgvector habilitado)
│   ├── src/
│   │   ├── auth.js           sessões, scrypt, guardas de workspace
│   │   ├── db.js             pool pg, migrações, transações
│   │   ├── events.js         outbox transacional + auditoria
│   │   ├── index.js          servidor HTTP e roteamento
│   │   ├── worker.js         consumidor de eventos (retry/dead-letter)
│   │   ├── routes/           auth, exams, notices, studies, plans,
│   │   │                     dashboard, intelligence, settings
│   │   └── services/         notice-parser, document-extract, scheduler,
│   │                         priority-engine, planner, llm, exam-data
│   └── test/                 testes de unidade (node:test)
└── web/        Cliente React + Vite (identidade Cable, pt-BR, responsivo)
    └── src/{components,pages,router.ts,api.ts,theme.css,app.css}
```

Serviços em desenvolvimento (`docker-compose.base44.yml`, mantido no repositório
de ambiente do Base44 — não versionado junto ao código):

| Serviço | Papel | Porta |
| --- | --- | --- |
| `postgres` | PostgreSQL 16 + pgvector | interna |
| `api` | Cable Core (HTTP, migrações na subida, `node --watch`) | 4000 |
| `worker` | consumidor do outbox de eventos | — |
| `web` | Vite dev server (proxy `/api` → `api:4000`) | **3000** |

Origem única: o navegador fala apenas com a porta 3000 e o Vite encaminha
`/api`. Isso mantém o cookie de sessão `HttpOnly`/`SameSite=Lax` sem CORS e sem
duplicar autenticação.

O AFFiNE continua executável pelo caminho documentado dele
(`yarn affine bundle -p @affine/web --dev`), independente do Cable.

---

## 3. Contratos da API (v1)

Autenticação por cookie de sessão (`cable_session`, 30 dias, `HttpOnly`).

```
POST   /api/v1/auth/register            POST /api/v1/auth/login
POST   /api/v1/auth/logout              GET  /api/v1/auth/me
POST   /api/v1/auth/password            GET  /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:id

GET    /api/v1/exams                    POST   /api/v1/exams
GET    /api/v1/exams/:id                PATCH  /api/v1/exams/:id
DELETE /api/v1/exams/:id                POST   /api/v1/exams/:id/availability

POST   /api/v1/exams/:id/notices        GET    /api/v1/notices/:id
POST   /api/v1/notices/:id/versions     POST   /api/v1/notices/:id/confirm
GET    /api/v1/notices/:id/versions/:versionId/file
DELETE /api/v1/notices/:id

GET    /api/v1/exams/:id/subjects       POST   /api/v1/exams/:id/subjects
POST   /api/v1/subjects/:id/topics      PATCH  /api/v1/topics/:id
DELETE /api/v1/topics/:id               POST   /api/v1/exams/:id/activities
GET    /api/v1/exams/:id/activities     GET    /api/v1/exams/:id/reviews

GET    /api/v1/exams/:id/plan           POST   /api/v1/exams/:id/plan/generate
PATCH  /api/v1/plan-items/:id

GET    /api/v1/dashboard?examId=        GET    /api/v1/exams/:id/recommendations
GET    /api/v1/exams/:id/events         POST   /api/v1/exams/:id/ai/ask
GET    /api/v1/ai/status

GET    /api/v1/settings                 PATCH  /api/v1/settings
GET    /api/v1/export                   DELETE /api/v1/account
GET    /health
```

Erros seguem `{ "error": { "code", "message", "details?" } }` com códigos
estáveis (`invalid_request`, `unauthorized`, `forbidden`, `not_found`,
`conflict`, `rate_limited`, `ai_not_configured`).

---

## 4. Regras de negócio (documentadas e versionadas)

### 4.1 Leitura do edital — `services/notice-parser.js`

- Localiza a seção de conteúdo programático (`CONTEÚDO PROGRAMÁTICO`, `ANEXO …
  CONTEÚDO PROGRAMÁTICO`, `DAS DISCIPLINAS`, `PROGRAMA DE PROVAS`) e para no
  próximo anexo, para não capturar disposições finais.
- Disciplinas: dicionário de concursos + heurística de linha em caixa alta.
  Cada disciplina recebe `confidence` (0,95 dicionário / 0,7 heurística).
- Assuntos: numeração (`1.`, `1.1`), letras (`a)`) e marcadores. Cada assunto
  guarda o **código**, o **título** e a **página de origem**.
- Se o documento não tem conteúdo programático, retorna vazio. **Nunca inventa**
  disciplinas a partir de texto genérico.
- `extractMetadata` só devolve campos cujo padrão realmente apareceu (banca,
  órgão, cargo, data).

### 4.2 Prioridade — `services/priority-engine.js` (`prioridade-v1`)

```
score = 100 × Σ (peso_i × fator_i)          escala absoluta 0–100

cobertura  0.45  nunca estudado 1,0 · em andamento 0,6 · revisão 0,3 · dominado 0,05
erro       0.30  1 − aproveitamento, apenas com >= 5 questões respondidas
atraso     0.15  dias desde o último estudo, saturado em 30 dias
peso       0.10  peso da disciplina, apenas quando o edital informa
```

- Fator sem dados é **omitido**, não tratado como zero — por isso a confiança é
  exibida junto da pontuação (`alta`, `media`, `baixa`).
- Revisão vencida soma até 15 pontos de urgência.
- Cada recomendação carrega a lista de justificativas com os números que a
  geraram ("Aproveitamento de 30% em 10 questões").

### 4.3 Planejador — `services/planner.js` (`planejador-v1`)

- Horizonte de 7 dias, blocos de 50 min, revisões primeiro.
- Respeita `daily_minutes` e `study_days`; dias fora da disponibilidade recebem
  um item `descanso` explícito.
- Um assunto não é agendado duas vezes no mesmo plano (repetição só via revisão).
- Cada versão substitui a anterior (`superseded_by`), nunca apaga o histórico.

### 4.4 Domínio estimado e revisão

- `mastery = 0,6 × aproveitamento + 0,4 × cobertura` (aproveitamento exige >= 5
  questões; abaixo disso só a cobertura conta).
- Status derivado: `em_andamento` com qualquer minuto; `revisao` com domínio
  >= 0,55 e 5+ questões; `dominado` com >= 0,8 e 10+ questões.
- Agendamento FSRS (`ts-fsrs` 6): a nota vem do resultado real da atividade
  (>= 80% → Bom, >= 50% → Difícil, < 50% → Errei), ou da autoavaliação na revisão.

### 4.5 Indicadores do painel

Cada cartão do painel exibe a regra de cálculo embaixo do valor. Indicador sem
base de dados aparece como "sem dados" (`insufficient: true`), nunca como zero.

---

## 5. Eventos

Outbox transacional: o evento é gravado na mesma transação da mudança de estado
e consumido pelo `worker` com `FOR UPDATE SKIP LOCKED`, retentativa (5) e
dead-letter (`status = 'dead'`). Tipos emitidos:

```
usuario.cadastrado          concurso.criado             concurso.status_alterado
concurso.disponibilidade_definida                       edital.registrado
edital.versao_importada     edital.processado           edital.confirmado
disciplina.criada           assunto.criado              estudo.atividade_registrada
plano.gerado                plano.item_atualizado       recomendacoes.atualizadas
```

`edital.versao_importada` é consumido pelo worker (extração + parsing). Os demais
são fatos de domínio prontos para consumidores futuros (notificações, analytics,
conectores).

---

## 6. Segurança e LGPD

Implementado: senha com scrypt + salt por usuário; sessão opaca com hash no
banco; cookie `HttpOnly`/`SameSite=Lax`; rate limit em login/cadastro; validação
de entrada em todas as rotas; isolamento por workspace em toda consulta;
auditoria (`audit_log`); exportação completa em JSON; exclusão de conta com
confirmação por e-mail e cascade.

Pendente: verificação de e-mail, MFA/passkeys, CSRF token explícito (hoje
`SameSite=Lax` + origem única), criptografia em repouso gerenciada, políticas
legais publicadas, retenção programada. Nada disso é declarado como pronto.

---

## 7. Testes

```bash
# dentro do serviço api
node --test test/*.test.js
```

Cobrem: extração de disciplinas/assuntos com página de origem, limite de seção,
documento sem conteúdo programático (não inventa), metadados de cabeçalho,
ranking de prioridade, uso de aproveitamento só com amostra suficiente,
respeito à disponibilidade no plano e prioridade de revisões.

O fluxo completo (cadastro → concurso → upload de PDF → processamento →
confirmação → plano → atividade → indicadores → eventos → exclusão) é validado
por um script E2E executado contra a stack em execução.

---

## 8. Próximos passos técnicos

1. Banco de questões e simulados reutilizando o mesmo motor de prioridade.
2. Flashcards ligados às revisões FSRS já existentes.
3. Embeddings com pgvector para busca em materiais importados.
4. Conectores de fontes oficiais com registro de origem e estado de confirmação.
5. Chave de LLM para o Cable AI em linguagem natural (a ponte já está pronta).
