import { createHash } from 'node:crypto';
import {
  badRequest,
  notFound,
  optionalDate,
  optionalString,
  optionalUrl,
  readBody,
  readJson,
  requireString,
} from '../http.js';
import { assertUser, loadOwnedNotice } from '../auth.js';
import { query, transaction } from '../db.js';
import { EVENT_TYPES, audit, emitEvent } from '../events.js';

const ALLOWED = new Map([
  ['application/pdf', 'pdf'],
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
]);

function detectKind(fileName, declaredMime, buffer) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf') || buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  if (lower.endsWith('.txt')) return { mime: 'text/plain', ext: 'txt' };
  if (lower.endsWith('.md')) return { mime: 'text/markdown', ext: 'md' };
  if (ALLOWED.has(declaredMime)) return { mime: declaredMime, ext: ALLOWED.get(declaredMime) };
  return null;
}

export const noticeRoutes = [
  {
    method: 'POST',
    path: '/api/v1/exams/:id/notices',
    auth: true,
    handler: async ({ req, user, params }) => {
      assertUser(user);
      const examId = params.id;
      const owned = await query('SELECT id FROM exams WHERE id = $1 AND workspace_id = $2', [
        examId,
        user.workspaceId,
      ]);
      if (owned.rowCount === 0) throw notFound('Concurso não encontrado.');
      const body = await readJson(req);
      const title = requireString(body.title, 'title', { min: 3, max: 200 });
      const kind = optionalString(body.kind, 'kind', 20) ?? 'edital';
      if (!['edital', 'retificacao', 'prova', 'gabarito', 'outro'].includes(kind)) {
        throw badRequest('Tipo de documento inválido.');
      }
      const officialUrl = optionalUrl(body.officialUrl, 'officialUrl');
      const publishedAt = optionalDate(body.publishedAt, 'publishedAt');

      const notice = await transaction(async client => {
        const { rows } = await client.query(
          `INSERT INTO notices (exam_id, title, kind, official_url, published_at)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [examId, title, kind, officialUrl, publishedAt]
        );
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId,
          type: EVENT_TYPES.noticeCreated,
          actorId: user.id,
          payload: { noticeId: rows[0].id, kind },
        });
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'notice.create',
          entity: 'notice',
          entityId: rows[0].id,
        });
        return rows[0];
      });
      return { status: 201, body: { notice } };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/notices/:id/versions',
    auth: true,
    handler: async ({ req, user, params, url }) => {
      const notice = await loadOwnedNotice(user, params.id);
      const fileName = optionalString(url.searchParams.get('filename'), 'filename', 240);
      if (!fileName) throw badRequest('Informe o nome do arquivo (?filename=...).');
      const buffer = await readBody(req, 32 * 1024 * 1024);
      if (buffer.length === 0) throw badRequest('Arquivo vazio.');
      const kind = detectKind(fileName, req.headers['content-type']?.split(';')[0], buffer);
      if (!kind) {
        throw badRequest('Formato não suportado. Envie PDF, TXT ou Markdown.');
      }
      if (kind.ext === 'pdf' && buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw badRequest('O arquivo não é um PDF válido.');
      }
      const checksum = createHash('sha256').update(buffer).digest('hex');

      const version = await transaction(async client => {
        const next = await client.query(
          'SELECT coalesce(max(version_no), 0) + 1 AS next FROM notice_versions WHERE notice_id = $1',
          [notice.id]
        );
        const { rows } = await client.query(
          `INSERT INTO notice_versions (notice_id, version_no, file_name, mime, byte_size, checksum, content)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, version_no, file_name, mime, byte_size, extraction_status, created_at`,
          [notice.id, next.rows[0].next, fileName, kind.mime, buffer.length, checksum, buffer]
        );
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: notice.exam_id,
          type: EVENT_TYPES.noticeVersionUploaded,
          actorId: user.id,
          payload: { noticeId: notice.id, versionId: rows[0].id, fileName, bytes: buffer.length },
        });
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'notice.version_upload',
          entity: 'notice_version',
          entityId: rows[0].id,
          meta: { checksum },
        });
        return rows[0];
      });

      return { status: 202, body: { version } };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/notices/:id',
    auth: true,
    handler: async ({ user, params }) => {
      const notice = await loadOwnedNotice(user, params.id);
      const [versions, subjects] = await Promise.all([
        query(
          `SELECT id, version_no, file_name, mime, byte_size, page_count, extraction_status,
                  extraction_error, parsed_at, created_at
             FROM notice_versions WHERE notice_id = $1 ORDER BY version_no DESC`,
          [notice.id]
        ),
        query(
          `SELECT id, name, source_page, confidence, confirmed, discarded
             FROM notice_subjects WHERE notice_id = $1 ORDER BY name`,
          [notice.id]
        ),
      ]);
      const subjectIds = subjects.rows.map(s => s.id);
      const topics = subjectIds.length
        ? await query(
            `SELECT id, notice_subject_id, code, title, source_page, confidence, confirmed, discarded
               FROM notice_topics WHERE notice_subject_id = ANY($1::uuid[])
              ORDER BY code NULLS LAST, title`,
            [subjectIds]
          )
        : { rows: [] };

      return {
        body: {
          notice,
          versions: versions.rows,
          subjects: subjects.rows.map(subject => ({
            ...subject,
            topics: topics.rows.filter(topic => topic.notice_subject_id === subject.id),
          })),
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/v1/notices/:id/versions/:versionId/file',
    auth: true,
    handler: async ({ user, params, res }) => {
      const notice = await loadOwnedNotice(user, params.id);
      const { rows } = await query(
        'SELECT file_name, mime, content FROM notice_versions WHERE id = $1 AND notice_id = $2',
        [params.versionId, notice.id]
      );
      if (rows.length === 0 || !rows[0].content) throw notFound('Arquivo não encontrado.');
      res.writeHead(200, {
        'content-type': rows[0].mime,
        'content-length': rows[0].content.length,
        'content-disposition': `attachment; filename="${encodeURIComponent(rows[0].file_name)}"`,
        'cache-control': 'private, max-age=60',
      });
      res.end(rows[0].content);
      return { handled: true };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/notices/:id/confirm',
    auth: true,
    handler: async ({ req, user, params }) => {
      const notice = await loadOwnedNotice(user, params.id);
      const body = await readJson(req);
      if (!Array.isArray(body.subjects)) throw badRequest('Envie a lista de disciplinas revisadas.');

      const result = await transaction(async client => {
        let subjectsCreated = 0;
        let topicsCreated = 0;

        await client.query('UPDATE notice_subjects SET confirmed = false WHERE notice_id = $1', [
          notice.id,
        ]);

        for (const subject of body.subjects) {
          const name = requireString(subject.name, 'subjects[].name', { min: 2, max: 160 });
          const discarded = Boolean(subject.discarded);
          if (discarded) {
            if (subject.id) {
              await client.query(
                'UPDATE notice_subjects SET discarded = true, confirmed = true WHERE id = $1 AND notice_id = $2',
                [subject.id, notice.id]
              );
            }
            continue;
          }
          if (subject.id) {
            await client.query(
              'UPDATE notice_subjects SET name = $1, discarded = false, confirmed = true WHERE id = $2 AND notice_id = $3',
              [name, subject.id, notice.id]
            );
          }

          const subjectRow = await client.query(
            `INSERT INTO subjects (exam_id, name, notice_subject_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (exam_id, name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id, (xmax = 0) AS inserted`,
            [notice.exam_id, name, subject.id ?? null]
          );
          if (subjectRow.rows[0].inserted) subjectsCreated += 1;
          const subjectId = subjectRow.rows[0].id;

          for (const topic of Array.isArray(subject.topics) ? subject.topics : []) {
            if (topic.discarded) {
              if (topic.id) {
                await client.query(
                  'UPDATE notice_topics SET discarded = true, confirmed = true WHERE id = $1',
                  [topic.id]
                );
              }
              continue;
            }
            const title = requireString(topic.title, 'subjects[].topics[].title', { min: 2, max: 240 });
            if (topic.id) {
              await client.query(
                'UPDATE notice_topics SET title = $1, discarded = false, confirmed = true WHERE id = $2',
                [title, topic.id]
              );
            }
            const existing = await client.query(
              'SELECT id FROM topics WHERE subject_id = $1 AND lower(title) = lower($2)',
              [subjectId, title]
            );
            if (existing.rowCount === 0) {
              await client.query(
                `INSERT INTO topics (exam_id, subject_id, code, title, source_page)
                 VALUES ($1,$2,$3,$4,$5)`,
                [notice.exam_id, subjectId, topic.code ?? null, title, topic.sourcePage ?? null]
              );
              topicsCreated += 1;
            }
          }
        }

        await client.query('UPDATE notices SET confirmed = true WHERE id = $1', [notice.id]);
        await emitEvent(client, {
          workspaceId: user.workspaceId,
          examId: notice.exam_id,
          type: EVENT_TYPES.noticeConfirmed,
          actorId: user.id,
          payload: { noticeId: notice.id, subjectsCreated, topicsCreated },
        });
        await audit(client, {
          workspaceId: user.workspaceId,
          actorId: user.id,
          action: 'notice.confirm',
          entity: 'notice',
          entityId: notice.id,
          meta: { subjectsCreated, topicsCreated },
        });
        return { subjectsCreated, topicsCreated };
      });

      return { body: { ok: true, ...result } };
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/notices/:id',
    auth: true,
    handler: async ({ user, params }) => {
      const notice = await loadOwnedNotice(user, params.id);
      await query('DELETE FROM notices WHERE id = $1', [notice.id]);
      return { body: { ok: true } };
    },
  },
];
