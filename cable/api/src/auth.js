import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';
import { forbidden, unauthorized } from './http.js';

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE = 'cable_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCRYPT_KEYLEN = 64;

export { SESSION_COOKIE, SESSION_TTL_MS };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const derived = await scrypt(password.normalize('NFKC'), salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function createSession(userId, { userAgent, ip } = {}) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, sha256(token), userAgent ?? null, ip ?? null, expiresAt]
  );
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
  return { token, expiresAt };
}

export async function revokeSession(token) {
  if (!token) return;
  await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [sha256(token)]);
}

/**
 * Resolves the request principal. Every tenant-owned query downstream is scoped
 * by `user.workspaceId`, so a forged/absent session cannot reach other data.
 */
export async function resolveUser(token) {
  if (!token) return null;
  const { rows } = await query(
    `SELECT s.id AS session_id, u.id, u.email, u.name, u.role, u.locale, u.timezone,
            w.id AS workspace_id, w.name AS workspace_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN memberships m ON m.user_id = u.id AND m.role = 'owner'
       JOIN workspaces w ON w.id = m.workspace_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.deleted_at IS NULL
      LIMIT 1`,
    [sha256(token)]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]).catch(() => {});
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    locale: row.locale,
    timezone: row.timezone,
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
  };
}

export function assertUser(user) {
  if (!user) throw unauthorized();
  return user;
}

export function assertRole(user, roles) {
  assertUser(user);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

/**
 * Loads an exam and proves it belongs to the caller's workspace.
 * This is the single guard used by every exam-scoped route.
 */
export async function loadOwnedExam(user, examId) {
  assertUser(user);
  const { rows } = await query(
    `SELECT * FROM exams WHERE id = $1 AND workspace_id = $2 AND archived_at IS NULL`,
    [examId, user.workspaceId]
  );
  if (rows.length === 0) throw forbidden('Concurso não encontrado neste workspace.');
  return rows[0];
}

export async function loadOwnedNotice(user, noticeId) {
  assertUser(user);
  const { rows } = await query(
    `SELECT n.* FROM notices n
       JOIN exams e ON e.id = n.exam_id
      WHERE n.id = $1 AND e.workspace_id = $2`,
    [noticeId, user.workspaceId]
  );
  if (rows.length === 0) throw forbidden('Edital não encontrado neste workspace.');
  return rows[0];
}
