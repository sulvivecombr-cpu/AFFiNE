import {
  badRequest,
  optionalDate,
  optionalString,
  optionalUrl,
  readJson,
  requireString,
  toInt,
} from '../http.js';
import { assertUser, loadOwnedExam } from '../auth.js';
import { query, transaction } from '../db.js';
import { EVENT_TYPES, audit, emitEvent } from '../events.js';
import { mapExam, subjectTree } from '../services/exam-data.js';

export const EXAM_STATUSES = [
  'planejado',
  'autorizado',
  'comissao_formada',
  'banca_contratada',
  'edital_publicado',
  'inscricoes_abertas',
  'inscricoes_encerradas',
  'provas_realizadas',
  'resultado_preliminar',
  'resultado_final',
  'homologado',
  'nomeacoes',
  'encerrado',
];

const EXPERIENCE_LEVELS = ['iniciante', 'intermediario', 'avancado'];

async function findOrCreateOrganization(client, name, uf) {
  if (!name) return null;
  const existing = await client.query(
    `SELECT id FROM organizations WHERE lower(name) = lower($1) AND coalesce(uf, '') = coalesce($2, '') LIMIT 1`,
    [name, uf ?? null]
  );
  if (existing.rowCount > 0) return existing.rows[0].id;
  const created = await client.query(
    `INSERT INTO organizations (name, uf) VALUES ($1, $2) RETURNING id`,
    [name, uf ?? null]
  );
  return created.rows[0].id;
}

async function findOrCreateBoard(client, name) {
  if (!name) return null;
  const existing = await client.query(
    'SELECT id FROM exam_boards WHERE lower(name) = lower($1) LIMIT 1',
    [name]
  );
  if (existing.rowCount > 0) return existing.rows[0].id;
  const created = await client.query('INSERT INTO exam_boards (name) VALUES ($1) RETURNING id', [
    name,
  ]);
  return created.rows[0].id;
}

export const examRoutes = [
  {
    method: 'GET',
    path: '/api/v1/exams',
    auth: true,
    handler: async ({ user }) => {
      const { rows } = await query(
        `SELECT e.*,
                (SELECT count(*)::int FROM subjects s WHERE s.exam_id = e.id) AS subjects_count,
                (SELECT count(*)::int FROM topics t WHERE t.exam_id = e.id) AS topics_count,
                (SELECT count(*)::int FROM topics t WHERE t.exam_id = e.id AND t.status <> 'nao_iniciado') AS topics_started,
                (SELECT count(*)::int FROM notices n WHERE n.exam_id = e.id) AS notices_count
           FROM exams e
          WHERE e.workspace_id = $1 AND e.archived_at IS NULL
          ORDER BY e.created_at DESC`,
        [user.workspaceId]
      );
      return {
        body: {
          exams: rows.map(row => ({
            ...mapExam(row),
            subjectsCount: row.subjects_count,
            topicsCount: row.topics_count,
            topicsStarted: row.topics_started,
            noticesCount: row.notices_count,
          })),
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/exams',
    auth: true,
    handler: async ({ req, user }) => {
      assertUser(user);
      const body = await readJson(req);
      const title = requireString(body.title, 'title', { min: 3, max: 160 });
      const organizationName = optionalString(body.organizationName, 'organizationName', 160);
      const boardName = optionalString(body.boardName, 'boardName', 120);
      const positionTitle = optionalString(body.positionTitle, 'positionTitle', 160);
      const city = optionalString(body.city, 'city', 120);
      const uf = optionalString(body.uf, 'uf', 2);
      const status = optionalString(body.status, 'status', 40) ?? 'planejado';
      const examDate = optionalDate(body.examDate, 'examDate');
      const officialSourceUrl = optionalUrl(body.officialSourceUrl, 'officialSourceUrl');

      if (!EXAM_STATUSES.includes(status)) throw badRequest('Situação do concurso inválida.');
      if (uf && !/^[A-Za-z]{2}$/.test(uf)) throw badRequest('UF deve ter 2 letras.');

      const exam = await transaction(async client => {
        const organizationId = await findOrCreateOrganization(client, organizationName, uf?.toUpperCase());
        const boardId = await findOrCreateBoard(client, boardName);
        const { rows } = await client.query(
          `INSERT INTO exams (workspace_id, title, organization_id, organization_name, board_id, board_name,
                              position_title, city, uf, status, exam_date, official_source_url, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING *`,
          [
            user.workspaceId,
            title,
            organizationId,
            organizationName,
            boardId,
            boardName,
            positionTitle,
            city,
            uf ? uf.toUpperCase() : null,
            status,
            examDate,
            officialSourceUrl,
            user.id,
          ]
        );
        const created = rows[0];
        await client.query(
          `INSERT INTO exam_status_history (exam_id, from_status, to_status, reason, changed_by)
           VALUES ($1, NULL, $2, $3, $4)`,
          [created.id, status, 'Concurso criado pelo candidato.', user.id]
        );
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: created.id,
          type: EVENT_TYPES.examCreated,
          actorId: user.id,
          payload: { title, status },
        });
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'exam.create',
          entity: 'exam',
          entityId: created.id,
        });
        return created;
      });

      return { status: 201, body: { exam: mapExam(exam) } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/exams/:id',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const [subjects, notices, history] = await Promise.all([
        subjectTree(exam.id),
        query(
          `SELECT id, title, kind, official_url, published_at, confirmed, created_at,
                  (SELECT extraction_status FROM notice_versions v WHERE v.notice_id = n.id
                    ORDER BY version_no DESC LIMIT 1) AS extraction_status,
                  (SELECT page_count FROM notice_versions v WHERE v.notice_id = n.id
                    ORDER BY version_no DESC LIMIT 1) AS page_count
             FROM notices n WHERE exam_id = $1 ORDER BY created_at DESC`,
          [exam.id]
        ),
        query(
          `SELECT from_status, to_status, reason, changed_at FROM exam_status_history
            WHERE exam_id = $1 ORDER BY changed_at DESC LIMIT 20`,
          [exam.id]
        ),
      ]);
      return {
        body: {
          exam: mapExam(exam),
          subjects,
          notices: notices.rows,
          statusHistory: history.rows,
        },
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/v1/exams/:id',
    auth: true,
    handler: async ({ req, user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const body = await readJson(req);
      const updates = [];
      const values = [];
      const push = (column, value) => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };

      if (body.title !== undefined) push('title', requireString(body.title, 'title', { min: 3, max: 160 }));
      if (body.organizationName !== undefined) push('organization_name', optionalString(body.organizationName, 'organizationName', 160));
      if (body.boardName !== undefined) push('board_name', optionalString(body.boardName, 'boardName', 120));
      if (body.positionTitle !== undefined) push('position_title', optionalString(body.positionTitle, 'positionTitle', 160));
      if (body.city !== undefined) push('city', optionalString(body.city, 'city', 120));
      if (body.uf !== undefined) push('uf', optionalString(body.uf, 'uf', 2)?.toUpperCase() ?? null);
      if (body.examDate !== undefined) push('exam_date', optionalDate(body.examDate, 'examDate'));
      if (body.officialSourceUrl !== undefined) push('official_source_url', optionalUrl(body.officialSourceUrl, 'officialSourceUrl'));

      let statusChange = null;
      if (body.status !== undefined && body.status !== exam.status) {
        if (!EXAM_STATUSES.includes(body.status)) throw badRequest('Situação do concurso inválida.');
        push('status', body.status);
        statusChange = { from: exam.status, to: body.status, reason: optionalString(body.statusReason, 'statusReason', 500) };
      }

      if (updates.length === 0) return { body: { exam: mapExam(exam) } };

      const updated = await transaction(async client => {
        values.push(exam.id);
        const { rows } = await client.query(
          `UPDATE exams SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
          values
        );
        if (statusChange) {
          await client.query(
            `INSERT INTO exam_status_history (exam_id, from_status, to_status, reason, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [exam.id, statusChange.from, statusChange.to, statusChange.reason, user.id]
          );
          await emitEvent(client, {
            workspaceId: user.workspaceId,
            examId: exam.id,
            type: EVENT_TYPES.examStatusChanged,
            actorId: user.id,
            payload: statusChange,
          });
        }
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'exam.update',
          entity: 'exam',
          entityId: exam.id,
          meta: { fields: updates.map(u => u.split(' ')[0]) },
        });
        return rows[0];
      });

      return { body: { exam: mapExam(updated) } };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/exams/:id/availability',
    auth: true,
    handler: async ({ req, user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const body = await readJson(req);
      const weeklyHours = body.weeklyHours === undefined ? null : Number(body.weeklyHours);
      if (weeklyHours !== null && (!Number.isFinite(weeklyHours) || weeklyHours <= 0 || weeklyHours > 80)) {
        throw badRequest('Horas semanais devem estar entre 1 e 80.');
      }
      const studyDays = Array.isArray(body.studyDays)
        ? body.studyDays.map(day => toInt(day, 'studyDays', { min: 0, max: 6 }))
        : null;
      if (studyDays && studyDays.length === 0) throw badRequest('Selecione ao menos um dia de estudo.');
      const dailyMinutes = body.dailyMinutes === undefined ? null : toInt(body.dailyMinutes, 'dailyMinutes', { min: 15, max: 720 });
      const experienceLevel = optionalString(body.experienceLevel, 'experienceLevel', 20);
      if (experienceLevel && !EXPERIENCE_LEVELS.includes(experienceLevel)) {
        throw badRequest('Nível de experiência inválido.');
      }
      const examDate = body.examDate === undefined ? undefined : optionalDate(body.examDate, 'examDate');

      const updated = await transaction(async client => {
        const { rows } = await client.query(
          `UPDATE exams SET weekly_hours = $1, study_days = $2, daily_minutes = $3,
                            experience_level = $4,
                            exam_date = COALESCE($5, exam_date),
                            onboarding_done = true, updated_at = now()
            WHERE id = $6 RETURNING *`,
          [weeklyHours, studyDays, dailyMinutes, experienceLevel, examDate ?? null, exam.id]
        );
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: exam.id,
          type: EVENT_TYPES.examAvailabilitySet,
          actorId: user.id,
          payload: { weeklyHours, studyDays, dailyMinutes, experienceLevel },
        });
        return rows[0];
      });
      return { body: { exam: mapExam(updated) } };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/exams/:id',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      await transaction(async client => {
        await client.query('UPDATE exams SET archived_at = now(), updated_at = now() WHERE id = $1', [exam.id]);
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'exam.archive',
          entity: 'exam',
          entityId: exam.id,
        });
      });
      return { body: { ok: true } };
    },
  },
];
