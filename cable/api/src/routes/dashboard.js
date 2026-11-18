import { loadOwnedExam } from '../auth.js';
import { query } from '../db.js';
import { dueReviewsFrom, loadPriorities, loadReviews } from '../services/exam-data.js';
import { RULES_VERSION } from '../services/priority-engine.js';

const dayKey = date => date.toISOString().slice(0, 10);

export const dashboardRoutes = [
  {
    method: 'GET',
    path: '/api/v1/dashboard',
    auth: true,
    handler: async ({ user, url }) => {
      const requested = url.searchParams.get('examId');
      const exams = await query(
        `SELECT id, title FROM exams WHERE workspace_id = $1 AND archived_at IS NULL ORDER BY created_at DESC`,
        [user.workspaceId]
      );
      const examId = requested ?? exams.rows[0]?.id;
      if (!examId) {
        return {
          body: {
            exam: null,
            exams: [],
            indicators: [],
            empty: { reason: 'no_exam', message: 'Crie seu primeiro concurso para começar.' },
          },
        };
      }
      const exam = await loadOwnedExam(user, examId);

      const [topicsAgg, weekAgg, statusAgg, reviews, priorities, todayItems, recent] = await Promise.all([
        query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status <> 'nao_iniciado')::int AS started,
                  count(*) FILTER (WHERE status = 'dominado')::int AS mastered,
                  coalesce(sum(minutes_studied), 0)::int AS minutes,
                  coalesce(sum(questions_total), 0)::int AS questions,
                  coalesce(sum(questions_correct), 0)::int AS correct
             FROM topics WHERE exam_id = $1`,
          [exam.id]
        ),
        query(
          `SELECT coalesce(sum(minutes), 0)::int AS minutes,
                  count(*)::int AS activities,
                  coalesce(sum(questions_total), 0)::int AS questions,
                  coalesce(sum(questions_correct), 0)::int AS correct,
                  count(DISTINCT occurred_at::date)::int AS days
             FROM study_activities
            WHERE exam_id = $1 AND occurred_at >= now() - interval '7 days'`,
          [exam.id]
        ),
        query(
          `SELECT status, count(*)::int AS count FROM topics WHERE exam_id = $1 GROUP BY status`,
          [exam.id]
        ),
        loadReviews(exam.id),
        loadPriorities(exam.id),
        query(
          `SELECT pi.*, t.title AS topic_title, s.name AS subject_name
             FROM plan_items pi
             JOIN plans p ON p.id = pi.plan_id AND p.superseded_by IS NULL
             LEFT JOIN topics t ON t.id = pi.topic_id
             LEFT JOIN subjects s ON s.id = t.subject_id
            WHERE p.exam_id = $1 AND pi.day = current_date
            ORDER BY pi.kind`,
          [exam.id]
        ),
        query(
          `SELECT a.id, a.kind, a.minutes, a.questions_total, a.questions_correct, a.occurred_at,
                  t.title AS topic_title
             FROM study_activities a
             LEFT JOIN topics t ON t.id = a.topic_id
            WHERE a.exam_id = $1
            ORDER BY a.occurred_at DESC LIMIT 5`,
          [exam.id]
        ),
      ]);

      const agg = topicsAgg.rows[0];
      const week = weekAgg.rows[0];
      const due = dueReviewsFrom(priorities, reviews);
      const accuracy = agg.questions > 0 ? agg.correct / agg.questions : null;
      const weekAccuracy = week.questions > 0 ? week.correct / week.questions : null;
      const daysUntilExam = exam.exam_date
        ? Math.ceil((new Date(exam.exam_date).getTime() - Date.now()) / 86_400_000)
        : null;

      const indicators = [
        {
          key: 'cobertura',
          label: 'Cobertura do edital',
          value: agg.total > 0 ? Math.round((agg.started / agg.total) * 100) : null,
          unit: '%',
          detail:
            agg.total > 0
              ? `${agg.started} de ${agg.total} assuntos iniciados`
              : 'Nenhum assunto cadastrado ainda',
          rule: 'assuntos com ao menos uma atividade ÷ total de assuntos do edital',
          insufficient: agg.total === 0,
        },
        {
          key: 'tempo_semana',
          label: 'Tempo estudado (7 dias)',
          value: week.minutes,
          unit: 'min',
          detail: `${week.activities} atividade(s) em ${week.days} dia(s)`,
          rule: 'soma de minutos registrados nas atividades dos últimos 7 dias',
          insufficient: week.activities === 0,
        },
        {
          key: 'acuracia',
          label: 'Aproveitamento em questões',
          value: accuracy === null ? null : Math.round(accuracy * 100),
          unit: '%',
          detail:
            accuracy === null
              ? 'Nenhuma questão registrada ainda'
              : `${agg.correct} acertos em ${agg.questions} questões`,
          rule: 'acertos ÷ questões respondidas (mínimo de 1 questão registrada)',
          insufficient: accuracy === null,
        },
        {
          key: 'revisoes',
          label: 'Revisões devidas',
          value: due.length,
          unit: '',
          detail: due.length > 0 ? 'Agendadas pelo FSRS e vencidas' : 'Nenhuma revisão vencida',
          rule: 'revisões com due_at <= agora',
          insufficient: reviews.size === 0,
        },
        {
          key: 'dominio',
          label: 'Assuntos dominados',
          value: agg.mastered,
          unit: '',
          detail: `${agg.total} assuntos no edital`,
          rule: 'assuntos com domínio estimado >= 0,8 e 10+ questões',
          insufficient: agg.total === 0,
        },
      ];

      return {
        body: {
          exam: {
            id: exam.id,
            title: exam.title,
            positionTitle: exam.position_title,
            organizationName: exam.organization_name,
            boardName: exam.board_name,
            status: exam.status,
            examDate: exam.exam_date,
            daysUntilExam,
          },
          exams: exams.rows,
          indicators,
          week: {
            minutes: week.minutes,
            questions: week.questions,
            accuracy: weekAccuracy === null ? null : Math.round(weekAccuracy * 100),
          },
          statusBreakdown: statusAgg.rows,
          todayPlan: todayItems.rows,
          recentActivities: recent.rows,
          dueReviews: due.slice(0, 5),
          priorities: priorities.items.slice(0, 3),
          engine: { version: RULES_VERSION, kind: 'deterministic' },
          empty:
            agg.total === 0
              ? {
                  reason: 'no_topics',
                  message:
                    'Importe o edital para o Cable montar disciplinas e assuntos automaticamente, ou crie manualmente.',
                }
              : null,
          today: dayKey(new Date()),
        },
      };
    },
  },
];
