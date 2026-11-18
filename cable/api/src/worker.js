/**
 * Cable worker — consumes the transactional outbox in `events`.
 *
 * Delivery is at-least-once: an event is claimed with FOR UPDATE SKIP LOCKED,
 * marked `processing`, and only flips to `done` after its handler returns. A
 * failure increments `attempts`, keeps the error and requeues; after
 * MAX_ATTEMPTS the event becomes `dead` (dead letter) and stays queryable.
 */
import { query, transaction, waitForDatabase, migrate } from './db.js';
import { EVENT_TYPES, emitEvent } from './events.js';
import { extractPages } from './services/document-extract.js';
import { extractMetadata, parseNotice } from './services/notice-parser.js';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 5 * 60 * 1000;

let stopping = false;

async function processNoticeVersion(versionId) {
  const { rows } = await query(
    `SELECT v.*, n.exam_id, n.id AS notice_id
       FROM notice_versions v JOIN notices n ON n.id = v.notice_id
      WHERE v.id = $1`,
    [versionId]
  );
  if (rows.length === 0) return;
  const version = rows[0];
  if (!version.content) throw new Error('Arquivo do edital ausente no armazenamento.');

  await query(
    `UPDATE notice_versions SET extraction_status = 'processing', extraction_error = NULL WHERE id = $1`,
    [versionId]
  );

  try {
    const pages = await extractPages({ buffer: version.content, mime: version.mime });
    if (pages.length === 0) throw new Error('Nenhuma página legível encontrada no arquivo.');

    const parsed = parseNotice(pages);
    const metadata = extractMetadata(pages);

    await transaction(async client => {
      await client.query('DELETE FROM document_pages WHERE notice_version_id = $1', [versionId]);
      for (const page of pages) {
        await client.query(
          `INSERT INTO document_pages (notice_version_id, page_no, text) VALUES ($1,$2,$3)`,
          [versionId, page.pageNo, page.text]
        );
      }

      // Parsed proposals are replaced; the confirmed study tree (subjects/topics)
      // is never touched here, so re-uploading a retificação cannot erase work.
      await client.query('DELETE FROM notice_subjects WHERE notice_id = $1', [version.notice_id]);
      for (const subject of parsed.subjects) {
        const inserted = await client.query(
          `INSERT INTO notice_subjects (notice_id, name, source_page, confidence)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [version.notice_id, subject.name, subject.page, subject.confidence]
        );
        for (const topic of subject.topics) {
          await client.query(
            `INSERT INTO notice_topics (notice_subject_id, code, title, source_page, confidence)
             VALUES ($1,$2,$3,$4,$5)`,
            [inserted.rows[0].id, topic.code, topic.title, topic.page, topic.confidence]
          );
        }
      }

      await client.query(
        `UPDATE notice_versions
            SET extraction_status = 'done', page_count = $1, parsed_at = now(),
                extracted_meta = $2, extraction_error = NULL
          WHERE id = $3`,
        [pages.length, metadata, versionId]
      );

      await emitEvent(client, {
        workspaceId: null,
        examId: version.exam_id,
        type: EVENT_TYPES.noticeProcessed,
        payload: {
          noticeId: version.notice_id,
          versionId,
          pages: pages.length,
          subjects: parsed.stats.subjectsFound,
          topics: parsed.stats.topicsFound,
          sectionDetected: Boolean(parsed.section),
        },
      });
    });

    console.log(
      `[worker] edital ${version.notice_id} processado: ${parsed.stats.subjectsFound} disciplinas, ${parsed.stats.topicsFound} assuntos`
    );
  } catch (error) {
    await query(
      `UPDATE notice_versions SET extraction_status = 'failed', extraction_error = $1 WHERE id = $2`,
      [String(error.message).slice(0, 500), versionId]
    );
    throw error;
  }
}

const handlers = {
  async [EVENT_TYPES.noticeVersionUploaded](event) {
    await processNoticeVersion(event.payload.versionId);
  },
};

async function claimEvent() {
  return transaction(async client => {
    const { rows } = await client.query(
      `SELECT * FROM events
        WHERE status = 'pending'
           OR (status = 'processing' AND occurred_at < now() - ($1::int * interval '1 millisecond'))
        ORDER BY occurred_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [STALE_PROCESSING_MS]
    );
    if (rows.length === 0) return null;
    const event = rows[0];
    await client.query(
      `UPDATE events SET status = 'processing', attempts = attempts + 1 WHERE id = $1`,
      [event.id]
    );
    return { ...event, attempts: event.attempts + 1 };
  });
}

async function completeEvent(event) {
  await query(`UPDATE events SET status = 'done', processed_at = now(), last_error = NULL WHERE id = $1`, [
    event.id,
  ]);
}

async function failEvent(event, error) {
  const dead = event.attempts >= MAX_ATTEMPTS;
  await query(
    `UPDATE events SET status = $1, last_error = $2, processed_at = $3 WHERE id = $4`,
    [dead ? 'dead' : 'pending', String(error?.message ?? error).slice(0, 500), dead ? new Date() : null, event.id]
  );
  console.error(
    `[worker] evento ${event.type} (${event.id}) falhou na tentativa ${event.attempts}: ${error?.message}`
  );
}

async function tick() {
  const event = await claimEvent();
  if (!event) return false;
  const handler = handlers[event.type];
  try {
    if (handler) await handler(event);
    await completeEvent(event);
  } catch (error) {
    await failEvent(event, error);
  }
  return true;
}

async function main() {
  await waitForDatabase();
  await migrate();
  console.log('[worker] Cable worker iniciado');

  while (!stopping) {
    let processed = false;
    try {
      processed = await tick();
    } catch (error) {
      console.error('[worker] erro no ciclo', error?.message);
    }
    if (!processed) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  process.exit(0);
}

process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

main().catch(error => {
  console.error('[worker] falha ao iniciar', error);
  process.exit(1);
});
