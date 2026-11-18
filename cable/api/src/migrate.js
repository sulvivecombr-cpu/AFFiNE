import { migrate, waitForDatabase, pool } from './db.js';

await waitForDatabase();
await migrate();
console.log('[migrate] schema atualizado');
await pool.end();
