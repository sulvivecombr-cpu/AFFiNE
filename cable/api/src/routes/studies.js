import {
  badRequest,
  notFound,
  optionalString,
  readJson,
  requireString,
  toInt,
} from '../http.js';
import { assertUser, loadOwnedExam } from '../auth.js';
import { query, transaction } from '../db.js';
import { EVENT_TYPES, audit, emitEvent } from '../events.js';
import { ratingFromActivity, schedule } from '../services/scheduler.js';
import { subjectTree } from '../services/exam-data.js';

const ACTIVITY_KINDS = ['leitura', 'resumo', 'questoes', 'revisao', 'simulado', 'videoaula', 'mapa_mental'];
const TARGET_MINUTES_FOR_COVERAGE = 120;

function deriveStatusAndMastery({ minutesStudied, questionsTotal, questionsCorrect }) {
  const coverage = Math.min(1, minutesStudied / TARGET_MINUTES_FOR_COVERAGE);
  const accuracy = questionsTotal >= 5 ? questionsCorrect / questionsTotal : null;
  const mastery =
    accuracy === null ? coverage * 0.6 : accuracy * 0.6 + coverage * 0.4;

  let status = 'nao_iniciado';
  if (minutesStudied > 0) status = 'em_andamento';
  if (mastery >= 0.55 && questionsTotal >= 5) status = 'revisao';
  if (mastery >= 0.8 && questionsTotal >= 10) status = 'dominado';

  return { mastery: Math.round(mastery * 1000) / 1000, status, accuracy };
}

export const studyRoutes = [
  {
    method: 'GET',
    path: '/api/v1/exams/:id/subjects',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const [subjects, topics] = await Promise.all([
        subjectTree(exam.id),
        query(
          `SELECT t.id, t.subject_id, t.code, t.title, t.status, t.mastery, t.minutes_studied,
                  t.questions_total, t.questions_correct, t.last_studied_at, t.source_page,
                  r.due_at AS review_due_at
             FROM topics t
             LEFT JOIN reviews r ON r.topic_id = t.id
            WHERE t.exam_id = $1
            ORDER BY t.code NULLS LAST, t.title`,
          [exam.id]
        ),
      ]);
      return {
        body: {
          subjects: subjects.map(subject => ({
            ...subject,
            topics: topics.rows.filter(topic => topic.subject_id === subject.id),
          })),
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/exams/:id/subjects',
    auth: true,
    handler: async ({ req, user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const body = await readJson(req);
      const name = requireString(body.name, 'name', { min: 2, max: 160 });
      const weight = body.weight === undefined || body.weight === null || body.weight === ''
        ? null
        : Number(body.weight);
      if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100)) {
        throw badRequest('Peso deve estar entre 0 e 100.');
      }
      const subject = await transaction(async client => {
        const { rows } = await client.query(
          `INSERT INTO subjects (exam_id, name, weight) VALUES ($1,$2,$3)
           ON CONFLICT (exam_id, name) DO UPDATE SET weight = COALESCE(EXCLUDED.weight, subjects.weight)
           RETURNING *`,
          [exam.id, name, weight]
        );
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: exam.id,
          type: EVENT_TYPES.subjectCreated,
          actorId: user.id,
          payload: { subjectId: rows[0].id, name },
        });
        return rows[0];
      });
      return { status: 201, body: { subject } };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/subjects/:id/topics',
    auth: true,
    handler: async ({ req, user, params }) => {
      assertUser(user);
      const { rows: subjectRows } = await query(
        `SELECT s.*, e.workspace_id FROM subjects s JOIN exams e ON e.id = s.exam_id WHERE s.id = $1`,
        [params.id]
      );
      const subject = subjectRows[0];
      if (!subject || subject.workspace_id !== user.workspaceId) {
        throw notFound('Disciplina não encontrada.');
      }
      const body = await readJson(req);
      const title = requireString(body.title, 'title', { min: 2, max: 240 });
      const code = optionalString(body.code, 'code', 40);
      const { rows } = await query(
        `INSERT INTO topics (exam_id, subject_id, code, title) VALUES ($1,$2,$3,$4) RETURNING *`,
        [subject.exam_id, subject.id, code, title]
      );
      return { status: 201, body: { topic: rows[0] } };
    },
  },
  {
    method: 'PATCH',
    path: '/api/v1/topics/:id',
    auth: true,
    handler: async ({ req, user, params }) => {
      assertUser(user);
      const { rows: owned } = await query(
        `SELECT t.* FROM topics t JOIN exams e ON e.id = t.exam_id
          WHERE t.id = $1 AND e.workspace_id = $2`,
        [params.id, user.workspaceId]
      );
      if (owned.length === 0) throw notFound('Assunto não encontrado.');
      const body = await readJson(req);
      const updates = [];
      const values = [];
      const push = (column, value) => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };
      if (body.title !== undefined) push('title', requireString(body.title, 'title', { min: 2, max: 240 }));
      if (body.status !== undefined) {
        if (!['nao_iniciado', 'em_andamento', 'revisao', 'dominado'].includes(body.status)) {
          throw badRequest('Status inválido.');
        }
        push('status', body.status);
      }
      if (updates.length === 0) return { body: { topic: owned[0] } };
      values.push(params.id);
      const { rows } = await query(
        `UPDATE topics SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      return { body: { topic: rows[0] } };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/topics/:id',
    auth: true,
    handler: async ({ user, params }) => {
      assertUser(user);
      const { rowCount } = await query(
        `DELETE FROM topics t USING exams e
          WHERE t.id = $1 AND e.id = t.exam_id AND e.workspace_id = $2`,
        [params.id, user.workspaceId]
      );
      if (rowCount === 0) throw notFound('Assunto não encontrado.');
      return { body: { ok: true } };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/exams/:id/activities',
    auth: true,
    handler: async ({ req, user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const body = await readJson(req);
      const kind = requireString(body.kind, 'kind', { min: 3, max: 20 });
      if (!ACTIVITY_KINDS.includes(kind)) throw badRequest('Tipo de atividade inválido.');
      const minutes = toInt(body.minutes, 'minutes', { min: 1, max: 1440 });
      const questionsTotal = toInt(body.questionsTotal, 'questionsTotal', { min: 0, max: 1000, fallback: null });
      const questionsCorrect = toInt(body.questionsCorrect, 'questionsCorrect', { min: 0, max: 1000, fallback: null });
      if (questionsTotal !== null && questionsCorrect !== null && questionsCorrect > questionsTotal) {
        throw badRequest('Acertos não podem exceder o total de questões.');
      }
      const topicId = optionalString(body.topicId, 'topicId', 40);
      const notes = optionalString(body.notes, 'notes', 2000);
      const planItemId = optionalString(body.planItemId, 'planItemId', 40);
      const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
      if (Number.isNaN(occurredAt.getTime())) throw badRequest('Data da atividade inválida.');

      if (topicId) {
        const check = await query('SELECT 1 FROM topics WHERE id = $1 AND exam_id = $2', [topicId, exam.id]);
        if (check.rowCount === 0) throw badRequest('Assunto não pertence a este concurso.');
      }

      const outcome = await transaction(async client => {
        const activity = await client.query(
          `INSERT INTO study_activities (workspace_id, exam_id, topic_id, kind, minutes,
                                         questions_total, questions_correct, occurred_at, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            user.workspaceId,
            exam.id,
            topicId,
            kind,
            minutes,
            questionsTotal,
            questionsCorrect,
            occurredAt,
            notes,
          ]
        );

        let topic = null;
        let review = null;

        if (topicId) {
          const updated = await client.query(
            `UPDATE topics SET
               minutes_studied = minutes_studied + $1,
               questions_total = questions_total + coalesce($2, 0),
               questions_correct = questions_correct + coalesce($3, 0),
               last_studied_at = greatest(coalesce(last_studied_at, $4), $4)
             WHERE id = $5 RETURNING *`,
            [minutes, questionsTotal, questionsCorrect, occurredAt, topicId]
          );
          const current = updated.rows[0];
          const derived = deriveStatusAndMastery({
            minutesStudied: current.minutes_studied,
            questionsTotal: current.questions_total,
            questionsCorrect: current.questions_correct,
          });
          const statusUpdate = await client.query(
            `UPDATE topics SET status = $1, mastery = $2 WHERE id = $3 RETURNING *`,
            [derived.status, derived.mastery, topicId]
          );
          topic = statusUpdate.rows[0];

          const existingReview = await client.query('SELECT * FROM reviews WHERE topic_id = $1', [topicId]);
          const rating = ratingFromActivity({
            kind,
            questionsTotal,
            questionsCorrect,
            explicit: body.rating,
          });
          const next = schedule(existingReview.rows[0] ?? null, rating, occurredAt);
          const saved = await client.query(
            `INSERT INTO reviews (topic_id, due_at, card, stability, difficulty, reps, lapses, last_rating, last_review_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
             ON CONFLICT (topic_id) DO UPDATE SET
               due_at = EXCLUDED.due_at, card = EXCLUDED.card, stability = EXCLUDED.stability,
               difficulty = EXCLUDED.difficulty, reps = EXCLUDED.reps, lapses = EXCLUDED.lapses,
               last_rating = EXCLUDED.last_rating, last_review_at = EXCLUDED.last_review_at, updated_at = now()
             RETURNING *`,
            [
              topicId,
              next.dueAt,
              JSON.stringify(next.card),
              next.stability,
              next.difficulty,
              next.reps,
              next.lapses,
              rating,
              occurredAt,
            ]
          );
          review = saved.rows[0];
        }

        if (planItemId) {
          await client.query(
            `UPDATE plan_items pi SET status = 'concluido'
               FROM plans p
              WHERE pi.id = $1 AND p.id = pi.plan_id AND p.exam_id = $2`,
            [planItemId, exam.id]
          );
        }

        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: exam.id,
          type: EVENT_TYPES.activityRecorded,
          actorId: user.id,
          payload: {
            activityId: activity.rows[0].id,
            topicId,
            kind,
            minutes,
            questionsTotal,
            questionsCorrect,
          },
        });
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'study.activity_recorded',
          entity: 'study_activity',
          entityId: activity.rows[0].id,
        });

        return { activity: activity.rows[0], topic, review };
      });

      return { status: 201, body: outcome };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/exams/:id/activities',
    auth: true,
    handler: async ({ user, params, url }) => {
      const exam = await loadOwnedExam(user, params.id);
      const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50);
      const { rows } = await query(
        `SELECT a.*, t.title AS topic_title, s.name AS subject_name
           FROM study_activities a
           LEFT JOIN topics t ON t.id = a.topic_id
           LEFT JOIN subjects s ON s.id = t.subject_id
          WHERE a.exam_id = $1
          ORDER BY a.occurred_at DESC
          LIMIT $2`,
        [exam.id, limit]
      );
      return { body: { activities: rows } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/exams/:id/reviews',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const { rows } = await query(
        `SELECT r.*, t.title AS topic_title, s.name AS subject_name,
                floor(extract(epoch FROM (now() - r.due_at)) / 86400)::int AS overdue_days
           FROM reviews r
           JOIN topics t ON t.id = r.topic_id
           JOIN subjects s ON s.id = t.subject_id
          WHERE t.exam_id = $1
          ORDER BY r.due_at ASC`,
        [exam.id]
      );
      const now = Date.now();
      return {
        body: {
          reviews: rows,
          dueCount: rows.filter(row => new Date(row.due_at).getTime() <= now).length,
        },
      };
    },
  },
];
