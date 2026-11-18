import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Connection comes from the standard libpq environment variables (PGHOST,
// PGUSER, PGDATABASE, …) which Compose sets for the local Postgres service.
export const pool = new Pool({
  host: process.env.PGHOST ?? 'postgres',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'cable',
  database: process.env.PGDATABASE ?? 'cable',
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', error => {
  console.error('[db] idle client error', error.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Runs `fn` inside a transaction. Every write that emits an event uses this so
 * the event row commits atomically with the state change (transactional outbox).
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rowCount } = await query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (rowCount > 0) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await transaction(async client => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`[db] applied migration ${file}`);
  }
}

export async function waitForDatabase(attempts = 40) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await query('SELECT 1');
      return;
    } catch (error) {
      if (i === attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}
