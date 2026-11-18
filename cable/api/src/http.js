export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new HttpError(400, 'invalid_request', message, details);
export const unauthorized = (message = 'Sessão inválida ou expirada.') =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'Acesso negado.') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Recurso não encontrado.') =>
  new HttpError(404, 'not_found', message);
export const conflict = (message, details) =>
  new HttpError(409, 'conflict', message, details);

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body ?? null);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

export async function readBody(req, limit = 32 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw new HttpError(413, 'payload_too_large', 'Arquivo maior que o limite de 32 MB.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  const raw = await readBody(req, 1024 * 1024);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw badRequest('Corpo da requisição não é um JSON válido.');
  }
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function setCookie(res, name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
  segments.push(`Path=${options.path ?? '/'}`);
  segments.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (options.httpOnly !== false) segments.push('HttpOnly');
  if (options.secure) segments.push('Secure');
  const existing = res.getHeader('set-cookie');
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  res.setHeader('set-cookie', [...list, segments.join('; ')]);
}

export function matchRoute(route, method, pathname) {
  if (route.method !== method) return null;
  const routeParts = route.path.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (routeParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i];
    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (routePart !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function requireString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== 'string') throw badRequest(`Campo "${field}" é obrigatório.`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`Campo "${field}" precisa ter ao menos ${min} caractere(s).`);
  if (trimmed.length > max) throw badRequest(`Campo "${field}" excede ${max} caracteres.`);
  return trimmed;
}

export function optionalString(value, field, max = 500) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`Campo "${field}" inválido.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`Campo "${field}" excede ${max} caracteres.`);
  return trimmed === '' ? null : trimmed;
}

export function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`Campo "${field}" deve estar no formato AAAA-MM-DD.`);
  }
  return value;
}

export function optionalUrl(value, field) {
  const str = optionalString(value, field, 1000);
  if (!str) return null;
  try {
    const url = new URL(str);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.toString();
  } catch {
    throw badRequest(`Campo "${field}" deve ser uma URL http(s) válida.`);
  }
}

export function toInt(value, field, { min, max, fallback } = {}) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw badRequest(`Campo "${field}" deve ser um número inteiro.`);
  if (min !== undefined && parsed < min) throw badRequest(`Campo "${field}" deve ser >= ${min}.`);
  if (max !== undefined && parsed > max) throw badRequest(`Campo "${field}" deve ser <= ${max}.`);
  return parsed;
}

/**
 * Very small in-memory fixed-window limiter. Enough to blunt credential
 * stuffing on a single node; documented as such in cable/README.md.
 */
export function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return key => {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    return { allowed: true, retryAfter: 0 };
  };
}
