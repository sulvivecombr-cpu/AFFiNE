-- Cable Core — foundational schema.
-- Every tenant-owned row carries workspace_id (isolation unit) and, where it
-- belongs to a preparation context, exam_id. Access rules live in the API
-- layer (see src/auth.js + routes) and are always scoped by workspace.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── identity ──────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  password_hash   text NOT NULL,
  name            text NOT NULL,
  role            text NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'moderator', 'support', 'admin', 'superadmin')),
  locale          text NOT NULL DEFAULT 'pt-BR',
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  email_verified  boolean NOT NULL DEFAULT false,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  user_agent    text,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'owner'
                  CHECK (role IN ('owner', 'editor', 'viewer', 'support')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE user_preferences (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── exams (concursos) ─────────────────────────────────────────────────────
CREATE TABLE exam_boards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  acronym    text,
  website    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX exam_boards_name_unique ON exam_boards (lower(name));

CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  sphere     text CHECK (sphere IN ('federal', 'estadual', 'municipal', 'outro')),
  uf         char(2),
  website    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_name_uf_unique ON organizations (lower(name), coalesce(uf, ''));

CREATE TABLE exams (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  organization_id       uuid REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name     text,
  board_id              uuid REFERENCES exam_boards(id) ON DELETE SET NULL,
  board_name            text,
  position_title        text,
  city                  text,
  uf                    char(2),
  status                text NOT NULL DEFAULT 'planejado'
                          CHECK (status IN ('planejado', 'autorizado', 'comissao_formada',
                            'banca_contratada', 'edital_publicado', 'inscricoes_abertas',
                            'inscricoes_encerradas', 'provas_realizadas', 'resultado_preliminar',
                            'resultado_final', 'homologado', 'nomeacoes', 'encerrado')),
  exam_date             date,
  official_source_url   text,
  weekly_hours          numeric(4,1),
  study_days            smallint[],
  experience_level      text CHECK (experience_level IN ('iniciante', 'intermediario', 'avancado')),
  daily_minutes         integer,
  onboarding_done       boolean NOT NULL DEFAULT false,
  created_by            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  archived_at           timestamptz
);
CREATE INDEX exams_workspace_idx ON exams (workspace_id) WHERE archived_at IS NULL;

CREATE TABLE exam_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  reason      text,
  changed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── notices (editais) & document processing ───────────────────────────────
CREATE TABLE notices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  title         text NOT NULL,
  kind          text NOT NULL DEFAULT 'edital'
                  CHECK (kind IN ('edital', 'retificacao', 'prova', 'gabarito', 'outro')),
  official_url  text,
  published_at  date,
  confirmed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notices_exam_idx ON notices (exam_id);

CREATE TABLE notice_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id         uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  version_no        integer NOT NULL,
  file_name         text NOT NULL,
  mime              text NOT NULL,
  byte_size         integer NOT NULL,
  checksum          text NOT NULL,
  content           bytea,
  page_count        integer,
  extracted_meta    jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_status text NOT NULL DEFAULT 'pending'
                      CHECK (extraction_status IN ('pending', 'processing', 'done', 'failed')),
  extraction_error  text,
  parsed_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, version_no)
);

CREATE TABLE document_pages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_version_id  uuid NOT NULL REFERENCES notice_versions(id) ON DELETE CASCADE,
  page_no            integer NOT NULL,
  text               text NOT NULL,
  UNIQUE (notice_version_id, page_no)
);

CREATE TABLE notice_subjects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id         uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  name              text NOT NULL,
  source_page       integer,
  confidence        numeric(3,2) NOT NULL DEFAULT 0.5,
  confirmed         boolean NOT NULL DEFAULT false,
  discarded         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notice_topics (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_subject_id  uuid NOT NULL REFERENCES notice_subjects(id) ON DELETE CASCADE,
  parent_topic_id    uuid REFERENCES notice_topics(id) ON DELETE CASCADE,
  code               text,
  title              text NOT NULL,
  source_page        integer,
  confidence         numeric(3,2) NOT NULL DEFAULT 0.5,
  confirmed          boolean NOT NULL DEFAULT false,
  discarded          boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── study tree ────────────────────────────────────────────────────────────
CREATE TABLE subjects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id            uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name               text NOT NULL,
  weight             numeric(5,2),
  notice_subject_id  uuid REFERENCES notice_subjects(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, name)
);

CREATE TABLE topics (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id     uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id      uuid REFERENCES topics(id) ON DELETE CASCADE,
  code           text,
  title          text NOT NULL,
  source_page    integer,
  status         text NOT NULL DEFAULT 'nao_iniciado'
                   CHECK (status IN ('nao_iniciado', 'em_andamento', 'revisao', 'dominado')),
  mastery        numeric(4,3),
  minutes_studied integer NOT NULL DEFAULT 0,
  questions_total integer NOT NULL DEFAULT 0,
  questions_correct integer NOT NULL DEFAULT 0,
  last_studied_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX topics_exam_idx ON topics (exam_id);
CREATE INDEX topics_subject_idx ON topics (subject_id);

-- ─── study activity & reviews ──────────────────────────────────────────────
CREATE TABLE study_activities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  exam_id           uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  topic_id          uuid REFERENCES topics(id) ON DELETE SET NULL,
  kind              text NOT NULL
                      CHECK (kind IN ('leitura', 'resumo', 'questoes', 'revisao', 'simulado', 'videoaula', 'mapa_mental')),
  minutes           integer NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  questions_total   integer CHECK (questions_total >= 0),
  questions_correct integer CHECK (questions_correct >= 0),
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (questions_correct IS NULL OR questions_total IS NULL OR questions_correct <= questions_total)
);
CREATE INDEX study_activities_exam_idx ON study_activities (exam_id, occurred_at DESC);

CREATE TABLE reviews (
  topic_id       uuid PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  due_at         timestamptz NOT NULL,
  -- full FSRS card (ts-fsrs) so the scheduler keeps its own state
  card           jsonb NOT NULL DEFAULT '{}'::jsonb,
  stability      numeric(8,3) NOT NULL DEFAULT 0,
  difficulty     numeric(4,3) NOT NULL DEFAULT 0.3,
  reps           integer NOT NULL DEFAULT 0,
  lapses         integer NOT NULL DEFAULT 0,
  last_rating    smallint,
  last_review_at timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_due_idx ON reviews (due_at);

-- ─── planning ──────────────────────────────────────────────────────────────
CREATE TABLE plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  exam_id        uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  horizon_start  date NOT NULL,
  horizon_end    date NOT NULL,
  rationale      jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  superseded_by  uuid REFERENCES plans(id) ON DELETE SET NULL,
  UNIQUE (exam_id, version)
);

CREATE TABLE plan_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  day             date NOT NULL,
  topic_id        uuid REFERENCES topics(id) ON DELETE SET NULL,
  kind            text NOT NULL
                    CHECK (kind IN ('estudo', 'questoes', 'revisao', 'simulado', 'descanso')),
  target_minutes  integer NOT NULL,
  status          text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'concluido', 'pulado')),
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_items_plan_day_idx ON plan_items (plan_id, day);

CREATE TABLE recommendations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  exam_id      uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  topic_id     uuid REFERENCES topics(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  score        numeric(6,3) NOT NULL,
  reason       text NOT NULL,
  factors      jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recommendations_exam_idx ON recommendations (exam_id, score DESC);

-- ─── event bus (transactional outbox) ──────────────────────────────────────
CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  exam_id       uuid REFERENCES exams(id) ON DELETE CASCADE,
  type          text NOT NULL,
  actor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'dead')),
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  processed_at  timestamptz
);
CREATE INDEX events_pending_idx ON events (status, occurred_at) WHERE status IN ('pending', 'processing');

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity       text NOT NULL,
  entity_id    uuid,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_workspace_idx ON audit_log (workspace_id, created_at DESC);
