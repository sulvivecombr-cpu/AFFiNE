import { badRequest, optionalString, readJson, requireString, sendJson } from '../http.js';
import { assertUser } from '../auth.js';
import { query, transaction } from '../db.js';
import { audit } from '../events.js';

const LOCALES = ['pt-BR', 'en', 'es'];

export const settingsRoutes = [
  {
    method: 'GET',
    path: '/api/v1/settings',
    auth: true,
    handler: async ({ user }) => {
      const [prefs, counts, sessions] = await Promise.all([
        query('SELECT data FROM user_preferences WHERE user_id = $1', [user.id]),
        query(
          `SELECT (SELECT count(*)::int FROM exams WHERE workspace_id = $1 AND archived_at IS NULL) AS exams,
                  (SELECT count(*)::int FROM study_activities WHERE workspace_id = $1) AS activities`,
          [user.workspaceId]
        ),
        query(
          `SELECT count(*)::int AS active FROM sessions
            WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
          [user.id]
        ),
      ]);
      return {
        body: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            locale: user.locale,
            timezone: user.timezone,
            role: user.role,
            workspaceId: user.workspaceId,
            workspaceName: user.workspaceName,
          },
          preferences: prefs.rows[0]?.data ?? {},
          counts: { ...counts.rows[0], activeSessions: sessions.rows[0].active },
        },
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/v1/settings',
    auth: true,
    handler: async ({ req, user }) => {
      const body = await readJson(req);
      const updates = [];
      const values = [];
      const push = (column, value) => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };
      if (body.name !== undefined) push('name', requireString(body.name, 'name', { min: 2, max: 120 }));
      if (body.locale !== undefined) {
        if (!LOCALES.includes(body.locale)) throw badRequest('Idioma não suportado.');
        push('locale', body.locale);
      }
      if (body.timezone !== undefined) push('timezone', optionalString(body.timezone, 'timezone', 64) ?? 'America/Sao_Paulo');

      const result = await transaction(async client => {
        let updated = null;
        if (updates.length > 0) {
          values.push(user.id);
          const rows = await client.query(
            `UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${values.length}
             RETURNING id, name, email, locale, timezone, role`,
            values
          );
          updated = rows.rows[0];
        }
        if (body.preferences && typeof body.preferences === 'object') {
          await client.query(
            `INSERT INTO user_preferences (user_id, data) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET data = user_preferences.data || EXCLUDED.data, updated_at = now()`,
            [user.id, body.preferences]
          );
        }
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'settings.update',
          entity: 'user',
          entityId: user.id,
        });
        return updated;
      });

      return { body: { user: result ?? null } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/export',
    auth: true,
    handler: async ({ user, res }) => {
      assertUser(user);
      const [exams, subjects, topics, activities, plans, planItems, notices, noticeSubjects, events, recommendations, audits] =
        await Promise.all([
          query('SELECT * FROM exams WHERE workspace_id = $1', [user.workspaceId]),
          query('SELECT s.* FROM subjects s JOIN exams e ON e.id = s.exam_id WHERE e.workspace_id = $1', [user.workspaceId]),
          query('SELECT t.* FROM topics t JOIN exams e ON e.id = t.exam_id WHERE e.workspace_id = $1', [user.workspaceId]),
          query('SELECT * FROM study_activities WHERE workspace_id = $1', [user.workspaceId]),
          query('SELECT * FROM plans WHERE workspace_id = $1', [user.workspaceId]),
          query(
            'SELECT pi.* FROM plan_items pi JOIN plans p ON p.id = pi.plan_id WHERE p.workspace_id = $1',
            [user.workspaceId]
          ),
          query(
            `SELECT n.id, n.exam_id, n.title, n.kind, n.official_url, n.published_at, n.confirmed, n.created_at
               FROM notices n JOIN exams e ON e.id = n.exam_id WHERE e.workspace_id = $1`,
            [user.workspaceId]
          ),
          query(
            `SELECT ns.* FROM notice_subjects ns JOIN notices n ON n.id = ns.notice_id
               JOIN exams e ON e.id = n.exam_id WHERE e.workspace_id = $1`,
            [user.workspaceId]
          ),
          query('SELECT * FROM events WHERE workspace_id = $1', [user.workspaceId]),
          query('SELECT * FROM recommendations WHERE workspace_id = $1', [user.workspaceId]),
          query('SELECT * FROM audit_log WHERE workspace_id = $1', [user.workspaceId]),
        ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email, name: user.name, locale: user.locale, timezone: user.timezone },
        workspace: { id: user.workspaceId, name: user.workspaceName },
        exams: exams.rows,
        subjects: subjects.rows,
        topics: topics.rows,
        activities: activities.rows,
        plans: plans.rows,
        planItems: planItems.rows,
        notices: notices.rows,
        noticeSubjects: noticeSubjects.rows,
        events: events.rows,
        recommendations: recommendations.rows,
        auditLog: audits.rows,
      };
      const body = JSON.stringify(payload, null, 2);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="cable-export.json"',
        'content-length': Buffer.byteLength(body),
      });
      res.end(body);
      return { handled: true };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/account',
    auth: true,
    handler: async ({ req, user, res }) => {
      const body = await readJson(req);
      const email = requireString(body.confirmEmail, 'confirmEmail', { min: 5, max: 320 }).toLowerCase();
      if (email !== user.email.toLowerCase()) {
        throw badRequest('Confirmação inválida: informe o e-mail da conta exatamente como cadastrado.');
      }
      await query('DELETE FROM users WHERE id = $1', [user.id]);
      res.setHeader('set-cookie', 'cable_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      return { body: { ok: true, deleted: true } };
    },
  },
];
