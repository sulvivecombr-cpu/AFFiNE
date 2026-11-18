import { badRequest, notFound, readJson } from '../http.js';
import { assertUser, loadOwnedExam } from '../auth.js';
import { query, transaction } from '../db.js';
import { EVENT_TYPES, audit, emitEvent } from '../events.js';
import { dueReviewsFrom, loadPriorities, loadReviews } from '../services/exam-data.js';
import { generatePlan } from '../services/planner.js';

async function loadPlan(examId) {
  const { rows } = await query(
    `SELECT * FROM plans WHERE exam_id = $1 AND superseded_by IS NULL
      ORDER BY version DESC LIMIT 1`,
    [examId]
  );
  if (rows.length === 0) return null;
  const plan = rows[0];
  const items = await query(
    `SELECT pi.*, t.title AS topic_title, s.name AS subject_name
       FROM plan_items pi
       LEFT JOIN topics t ON t.id = pi.topic_id
       LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE pi.plan_id = $1
      ORDER BY pi.day, pi.kind`,
    [plan.id]
  );
  return { ...plan, items: items.rows };
}

export const planRoutes = [
  {
    method: 'GET',
    path: '/api/v1/exams/:id/plan',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const plan = await loadPlan(exam.id);
      const versions = await query(
        'SELECT version, generated_at, horizon_start, horizon_end FROM plans WHERE exam_id = $1 ORDER BY version DESC LIMIT 10',
        [exam.id]
      );
      return { body: { plan, versions: versions.rows } };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/exams/:id/plan/generate',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const priorities = await loadPriorities(exam.id);
      if (priorities.items.length === 0) {
        throw badRequest(
          'Não há assuntos cadastrados neste concurso. Importe o edital ou crie disciplinas e assuntos antes de gerar o plano.'
        );
      }
      const reviews = await loadReviews(exam.id);
      const due = dueReviewsFrom(priorities, reviews);
      const generated = generatePlan({ exam, priorities: priorities.items, dueReviews: due });

      const plan = await transaction(async client => {
        const next = await client.query(
          'SELECT coalesce(max(version), 0) + 1 AS next FROM plans WHERE exam_id = $1',
          [exam.id]
        );
        const previous = await client.query(
          'SELECT id FROM plans WHERE exam_id = $1 AND superseded_by IS NULL',
          [exam.id]
        );
        const inserted = await client.query(
          `INSERT INTO plans (workspace_id, exam_id, version, horizon_start, horizon_end, rationale)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            user.workspaceId,
            exam.id,
            next.rows[0].next,
            generated.horizonStart,
            generated.horizonEnd,
            generated.rationale,
          ]
        );
        const planId = inserted.rows[0].id;
        if (previous.rowCount > 0) {
          await client.query('UPDATE plans SET superseded_by = $1 WHERE id = $2', [
            planId,
            previous.rows[0].id,
          ]);
        }
        for (const item of generated.items) {
          await client.query(
            `INSERT INTO plan_items (plan_id, day, topic_id, kind, target_minutes, reason)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [planId, item.day, item.topicId, item.kind, item.targetMinutes, item.reason]
          );
        }
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: exam.id,
          type: EVENT_TYPES.planGenerated,
          actorId: user.id,
          payload: { planId, version: next.rows[0].next, items: generated.items.length },
        });
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'plan.generate',
          entity: 'plan',
          entityId: planId,
          meta: { version: next.rows[0].next },
        });
        return inserted.rows[0];
      });

      return { status: 201, body: { plan: await loadPlan(exam.id), version: plan.version } };
    },
  },
  {
    method: 'PATCH',
    path: '/api/v1/plan-items/:id',
    auth: true,
    handler: async ({ req, user, params }) => {
      assertUser(user);
      const body = await readJson(req);
      if (!['pendente', 'concluido', 'pulado'].includes(body.status)) {
        throw badRequest('Status do item inválido.');
      }
      const { rows } = await query(
        `UPDATE plan_items pi SET status = $1
           FROM plans p, exams e
          WHERE pi.id = $2 AND p.id = pi.plan_id AND e.id = p.exam_id AND e.workspace_id = $3
          RETURNING pi.*`,
        [body.status, params.id, user.workspaceId]
      );
      if (rows.length === 0) throw notFound('Item do plano não encontrado.');
      return { body: { item: rows[0] } };
    },
  },
];
