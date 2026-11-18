import { badRequest, readJson, requireString } from '../http.js';
import { loadOwnedExam } from '../auth.js';
import { query, transaction } from '../db.js';
import { audit } from '../events.js';
import { dueReviewsFrom, loadPriorities, loadReviews, loadTopicsWithSubject } from '../services/exam-data.js';
import { RULES_VERSION } from '../services/priority-engine.js';
import { aiStatus, askAgent } from '../services/llm.js';

export const intelligenceRoutes = [
  {
    method: 'GET',
    path: '/api/v1/ai/status',
    auth: true,
    handler: async () => ({ body: aiStatus() }),
  },
  {
    method: 'GET',
    path: '/api/v1/exams/:id/recommendations',
    auth: true,
    handler: async ({ user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const [priorities, reviews] = await Promise.all([
        loadPriorities(exam.id),
        loadReviews(exam.id),
      ]);
      const due = dueReviewsFrom(priorities, reviews);

      if (priorities.items.length > 0) {
        await transaction(async client => {
          await client.query('DELETE FROM recommendations WHERE exam_id = $1', [exam.id]);
          for (const item of priorities.items.slice(0, 10)) {
            await client.query(
              `INSERT INTO recommendations (workspace_id, exam_id, topic_id, kind, score, reason, factors)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [
                user.workspaceId,
                exam.id,
                item.topicId,
                item.status === 'nao_iniciado' ? 'iniciar' : 'revisar',
                item.score,
                item.reasons.map(reason => reason.label).join(' · '),
                { ...item.factors, confidence: item.confidence },
              ]
            );
          }
        });
      }

      return {
        body: {
          engine: {
            version: RULES_VERSION,
            kind: 'deterministic',
            description:
              'Prioridade calculada a partir de cobertura, aproveitamento em questões, tempo desde o último estudo e peso no edital.',
          },
          ai: aiStatus(),
          items: priorities.items.slice(0, 10),
          dueReviews: due,
          totals: { topics: priorities.items.length, reviews: reviews.size },
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/v1/exams/:id/ai/ask',
    auth: true,
    handler: async ({ req, user, params }) => {
      const exam = await loadOwnedExam(user, params.id);
      const body = await readJson(req);
      const question = requireString(body.question, 'question', { min: 5, max: 1200 });
      const status = aiStatus();
      if (!status.configured) {
        return {
          status: 503,
          body: {
            error: {
              code: 'ai_not_configured',
              message:
                'O Cable AI em linguagem natural precisa de uma chave de provedor LLM (CABLE_AI_API_KEY). O motor determinístico continua ativo.',
            },
            ai: status,
          },
        };
      }

      const [topics, priorities, reviews] = await Promise.all([
        loadTopicsWithSubject(exam.id),
        loadPriorities(exam.id),
        loadReviews(exam.id),
      ]);
      const context = {
        concurso: {
          titulo: exam.title,
          cargo: exam.position_title,
          orgao: exam.organization_name,
          banca: exam.board_name,
          situacao: exam.status,
          dataProva: exam.exam_date,
        },
        disponibilidade: {
          horasSemanais: exam.weekly_hours,
          diasDeEstudo: exam.study_days,
          minutosPorDia: exam.daily_minutes,
        },
        resumoAssuntos: {
          total: topics.length,
          iniciados: topics.filter(t => t.status !== 'nao_iniciado').length,
          dominados: topics.filter(t => t.status === 'dominado').length,
          minutosTotais: topics.reduce((sum, t) => sum + t.minutes_studied, 0),
        },
        prioridades: priorities.items.slice(0, 8).map(item => ({
          assunto: item.topicTitle,
          disciplina: item.subjectName,
          pontuacao: item.score,
          confianca: item.confidence,
          justificativas: item.reasons.map(reason => reason.label),
        })),
        revisoesVencidas: dueReviewsFrom(priorities, reviews).slice(0, 8),
      };

      try {
        const result = await askAgent({ question, context });
        await transaction(async client => {
          await audit(client, {
            workspaceId: user.workspaceId,
            actorId: user.id,
            action: 'ai.ask',
            entity: 'exam',
            entityId: exam.id,
            meta: { model: result.model, questionLength: question.length },
          });
        });
        return { body: { ...result, ai: status } };
      } catch (error) {
        if (error.code === 'ai_not_configured') throw badRequest(error.message);
        return {
          status: 502,
          body: {
            error: {
              code: error.code ?? 'ai_provider_error',
              message: 'Não foi possível obter resposta do provedor de IA.',
              detail: error.message,
            },
          },
        };
      }
    },
  },
  {
    method: 'GET',
    path: '/api/v1/exams/:id/events',
    auth: true,
    handler: async ({ user, params, url }) => {
      const exam = await loadOwnedExam(user, params.id);
      const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50);
      const { rows } = await query(
        `SELECT id, type, payload, occurred_at, status, attempts, last_error, processed_at
           FROM events WHERE exam_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
        [exam.id, limit]
      );
      return { body: { events: rows } };
    },
  },
];
