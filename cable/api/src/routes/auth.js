import {
  badRequest,
  conflict,
  createRateLimiter,
  readJson,
  requireString,
  setCookie,
} from '../http.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  hashPassword,
  revokeSession,
  verifyPassword,
} from '../auth.js';
import { query, transaction } from '../db.js';
import { EVENT_TYPES, audit, emitEvent } from '../events.js';

const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const registerLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  const email = requireString(value, 'email', { min: 5, max: 320 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest('Informe um e-mail válido.');
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw badRequest('A senha precisa ter ao menos 8 caracteres.');
  }
  if (value.length > 200) throw badRequest('Senha muito longa.');
  return value;
}

function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export const authRoutes = [
  {
    method: 'POST',
    path: '/api/v1/auth/register',
    auth: false,
    handler: async ({ req, res }) => {
      const limit = registerLimiter(clientIp(req));
      if (!limit.allowed) {
        return { status: 429, body: { error: { code: 'rate_limited', message: 'Muitas tentativas. Tente novamente em instantes.' } } };
      }
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = validatePassword(body.password);
      const name = requireString(body.name, 'name', { min: 2, max: 120 });

      const passwordHash = await hashPassword(password);
      const result = await transaction(async client => {
        const existing = await client.query(
          'SELECT 1 FROM users WHERE lower(email) = $1 AND deleted_at IS NULL',
          [email]
        );
        if (existing.rowCount > 0) {
          throw conflict('Já existe uma conta com este e-mail.');
        }
        const user = await client.query(
          `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, locale, timezone`,
          [email, passwordHash, name]
        );
        const userId = user.rows[0].id;
        const workspace = await client.query(
          `INSERT INTO workspaces (owner_id, name) VALUES ($1, $2) RETURNING id`,
          [userId, `Preparação de ${name.split(' ')[0]}`]
        );
        await client.query(
          `INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [workspace.rows[0].id, userId]
        );
        await client.query(`INSERT INTO user_preferences (user_id) VALUES ($1)`, [userId]);
        await emitEvent(client, {
          workspaceId: workspace.rows[0].id,
          type: EVENT_TYPES.userRegistered,
          actorId: userId,
          payload: { email },
        });
        await audit(client, {
          workspaceId: workspace.rows[0].id,
          actorId: userId,
          action: 'user.register',
          entity: 'user',
          entityId: userId,
        });
        return { user: user.rows[0], workspaceId: workspace.rows[0].id };
      });

      const session = await createSession(result.user.id, {
        userAgent: req.headers['user-agent'],
        ip: clientIp(req),
      });
      setCookie(res, SESSION_COOKIE, session.token, {
        maxAge: SESSION_TTL_MS / 1000,
        secure: process.env.NODE_ENV === 'production',
      });
      return {
        status: 201,
        body: {
          user: { ...result.user, workspaceId: result.workspaceId },
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    auth: false,
    handler: async ({ req, res }) => {
      const limit = loginLimiter(clientIp(req));
      if (!limit.allowed) {
        return { status: 429, body: { error: { code: 'rate_limited', message: 'Muitas tentativas. Tente novamente em instantes.' } } };
      }
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      const { rows } = await query(
        `SELECT id, email, name, role, locale, timezone, password_hash
           FROM users WHERE lower(email) = $1 AND deleted_at IS NULL`,
        [email]
      );
      const user = rows[0];
      const ok = user ? await verifyPassword(password, user.password_hash) : false;
      if (!ok) {
        return {
          status: 401,
          body: { error: { code: 'invalid_credentials', message: 'E-mail ou senha incorretos.' } },
        };
      }
      const session = await createSession(user.id, {
        userAgent: req.headers['user-agent'],
        ip: clientIp(req),
      });
      setCookie(res, SESSION_COOKIE, session.token, {
        maxAge: SESSION_TTL_MS / 1000,
        secure: process.env.NODE_ENV === 'production',
      });
      const ws = await query(
        `SELECT w.id, w.name FROM workspaces w
           JOIN memberships m ON m.workspace_id = w.id
          WHERE m.user_id = $1 AND m.role = 'owner' LIMIT 1`,
        [user.id]
      );
      return {
        body: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            locale: user.locale,
            timezone: user.timezone,
            workspaceId: ws.rows[0]?.id,
            workspaceName: ws.rows[0]?.name,
          },
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/auth/logout',
    auth: false,
    handler: async ({ req, res }) => {
      const token = req.cookies?.[SESSION_COOKIE];
      await revokeSession(token);
      setCookie(res, SESSION_COOKIE, '', { maxAge: 0 });
      return { body: { ok: true } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/auth/me',
    auth: true,
    handler: async ({ user }) => ({
      body: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locale: user.locale,
          timezone: user.timezone,
          workspaceId: user.workspaceId,
          workspaceName: user.workspaceName,
        },
      },
    }),
  },
  {
    method: 'POST',
    path: '/api/v1/auth/password',
    auth: true,
    handler: async ({ req, user }) => {
      const body = await readJson(req);
      const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const next = validatePassword(body.newPassword);
      const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
      const ok = await verifyPassword(current, rows[0].password_hash);
      if (!ok) throw badRequest('Senha atual incorreta.');
      const hash = await hashPassword(next);
      await transaction(async client => {
        await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
          hash,
          user.id,
        ]);
        await client.query(
          'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2',
          [user.id, user.sessionId]
        );
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'user.password_changed',
          entity: 'user',
          entityId: user.id,
        });
      });
      return { body: { ok: true } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/auth/sessions',
    auth: true,
    handler: async ({ user }) => {
      const { rows } = await query(
        `SELECT id, user_agent, ip, created_at, last_seen_at, expires_at
           FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
          ORDER BY last_seen_at DESC`,
        [user.id]
      );
      return { body: { sessions: rows } };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/auth/sessions/:id',
    auth: true,
    handler: async ({ user, params }) => {
      await query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2', [
        params.id,
        user.id,
      ]);
      return { body: { ok: true } };
    },
  },
];
