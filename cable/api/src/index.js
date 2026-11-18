import { createServer } from 'node:http';
import { HttpError, matchRoute, parseCookies, sendJson, unauthorized } from './http.js';
import { resolveUser } from './auth.js';
import { migrate, query, waitForDatabase } from './db.js';
import { authRoutes } from './routes/auth.js';
import { examRoutes } from './routes/exams.js';
import { noticeRoutes } from './routes/notices.js';
import { studyRoutes } from './routes/studies.js';
import { planRoutes } from './routes/plans.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { settingsRoutes } from './routes/settings.js';

const PORT = Number(process.env.PORT ?? 4000);

const routes = [
  ...authRoutes,
  ...examRoutes,
  ...noticeRoutes,
  ...studyRoutes,
  ...planRoutes,
  ...dashboardRoutes,
  ...intelligenceRoutes,
  ...settingsRoutes,
];

const PUBLIC_PATHS = new Set(['/health', '/api/v1/health']);

async function handle(req, res) {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': req.headers.origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '600',
    });
    res.end();
    return;
  }

  // CORS: only the configured web origin may call the API directly. In the
  // single-origin preview wiring the browser talks through the Vite proxy, so
  // this only matters for separate-origin deployments.
  const allowedOrigin = process.env.CABLE_WEB_ORIGIN;
  if (allowedOrigin && req.headers.origin === allowedOrigin) {
    res.setHeader('access-control-allow-origin', allowedOrigin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('vary', 'origin');
  }

  if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
    try {
      await query('SELECT 1');
      sendJson(res, 200, { status: 'ok', db: 'up', uptime: Math.round(process.uptime()) });
    } catch (error) {
      sendJson(res, 503, { status: 'degraded', db: 'down', error: error.message });
    }
    return;
  }

  let matched = null;
  let params = null;
  for (const route of routes) {
    const candidate = matchRoute(route, req.method, url.pathname);
    if (candidate) {
      matched = route;
      params = candidate;
      break;
    }
  }

  if (!matched) {
    sendJson(res, 404, { error: { code: 'not_found', message: 'Rota não encontrada.' } });
    return;
  }

  req.cookies = parseCookies(req.headers.cookie ?? '');

  try {
    let user = null;
    if (matched.auth !== false) {
      user = await resolveUser(req.cookies.cable_session);
      // Every authenticated route is guaranteed a principal: no handler has to
      // re-check for a missing session.
      if (!user) throw unauthorized();
    }
    const result = await matched.handler({
      req,
      res,
      url,
      params,
      user,
    });
    if (result?.handled) return;
    sendJson(res, result?.status ?? 200, result?.body ?? { ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, {
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }
    if (error?.code === '23505') {
      sendJson(res, 409, {
        error: { code: 'conflict', message: 'Registro duplicado.', details: error.detail },
      });
      return;
    }
    console.error('[api] unhandled error', { path: url.pathname, error: error?.stack ?? error });
    sendJson(res, 500, {
      error: { code: 'internal_error', message: 'Erro interno ao processar a requisição.' },
    });
  } finally {
    if (process.env.CABLE_LOG_REQUESTS === '1') {
      console.log(`[api] ${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    }
  }
}

async function main() {
  await waitForDatabase();
  await migrate();
  const server = createServer((req, res) => {
    handle(req, res).catch(error => {
      console.error('[api] fatal', error);
      if (!res.headersSent) sendJson(res, 500, { error: { code: 'internal_error' } });
    });
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] Cable Core listening on 0.0.0.0:${PORT}`);
  });

  const shutdown = signal => {
    console.log(`[api] ${signal} received, closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
