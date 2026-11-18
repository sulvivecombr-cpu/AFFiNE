/**
 * Adaptive study priority — rules v1 (deterministic, no model calls).
 *
 * score = 100 × Σ(weight_i × factor_i)   (absolute, 0–100)
 *
 * Factors and weights (documented, versioned in RULES_VERSION):
 *   cobertura  0.45  assunto nunca estudado pesa mais que um já em andamento
 *   erro       0.30  taxa de erro real, só existe com >= 5 questões respondidas
 *   atraso     0.15  dias desde o último estudo (30 dias = saturação)
 *   peso       0.10  peso da disciplina, apenas quando o edital informa
 *
 * A factor with no data is *dropped* from the sum instead of being treated as
 * zero, and the score carries a confidence label. Nothing is invented: a topic
 * without activity gets `erro: null`, not "0% de acerto".
 */
export const RULES_VERSION = 'prioridade-v1';

const WEIGHTS = { cobertura: 0.45, erro: 0.3, atraso: 0.15, peso: 0.1 };

const COVERAGE_BY_STATUS = {
  nao_iniciado: 1,
  em_andamento: 0.6,
  revisao: 0.3,
  dominado: 0.05,
};

const MIN_QUESTIONS_FOR_ACCURACY = 5;

export function computePriorities({ topics, reviewsByTopic = new Map(), now = new Date() }) {
  const maxWeight = Math.max(
    0,
    ...topics.map(topic => (topic.subject_weight ? Number(topic.subject_weight) : 0))
  );

  const items = topics.map(topic => {
    const factors = {};
    const reasons = [];

    const coverage =
      topic.minutes_studied > 0 || topic.status !== 'nao_iniciado'
        ? COVERAGE_BY_STATUS[topic.status] ?? 0.6
        : COVERAGE_BY_STATUS.nao_iniciado;
    factors.cobertura = coverage;
    reasons.push({
      factor: 'cobertura',
      label:
        topic.minutes_studied > 0
          ? `Já estudado (${topic.minutes_studied} min), status ${topic.status.replace(/_/g, ' ')}`
          : 'Nunca estudado',
      value: coverage,
    });

    if (topic.questions_total >= MIN_QUESTIONS_FOR_ACCURACY) {
      const accuracy = topic.questions_correct / topic.questions_total;
      factors.erro = 1 - accuracy;
      reasons.push({
        factor: 'erro',
        label: `Aproveitamento de ${Math.round(accuracy * 100)}% em ${topic.questions_total} questões`,
        value: factors.erro,
      });
    }

    if (topic.last_studied_at) {
      const days = Math.max(
        0,
        Math.floor((now.getTime() - new Date(topic.last_studied_at).getTime()) / 86_400_000)
      );
      factors.atraso = Math.min(1, days / 30);
      reasons.push({
        factor: 'atraso',
        label: `Último estudo há ${days} dia(s)`,
        value: factors.atraso,
      });
    }

    if (maxWeight > 0 && topic.subject_weight) {
      factors.peso = Number(topic.subject_weight) / maxWeight;
      reasons.push({
        factor: 'peso',
        label: `Peso ${Number(topic.subject_weight)} no edital`,
        value: factors.peso,
      });
    }

    const review = reviewsByTopic.get(topic.id);
    let overdueDays = 0;
    if (review?.due_at) {
      overdueDays = Math.floor((now.getTime() - new Date(review.due_at).getTime()) / 86_400_000);
      if (overdueDays > 0) {
        reasons.push({
          factor: 'revisao',
          label: `Revisão atrasada há ${overdueDays} dia(s)`,
          value: Math.min(1, overdueDays / 10),
        });
      }
    }

    // Absolute scale: the score is the weighted sum over the four factors, so a
    // topic whose only evidence is coverage cannot reach the top of the range —
    // the missing factors lower the score instead of being silently renormalized.
    let weightedSum = 0;
    for (const [factor, value] of Object.entries(factors)) {
      weightedSum += WEIGHTS[factor] * value;
    }
    const base = weightedSum * 100;
    const reviewBoost = Math.min(15, overdueDays * 1.5);
    const score = Math.round((base + reviewBoost) * 10) / 10;

    const available = Object.keys(factors).length;
    const confidence = available >= 3 ? 'alta' : available === 2 ? 'media' : 'baixa';

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      subjectName: topic.subject_name,
      status: topic.status,
      score,
      confidence,
      factors,
      reasons,
      dueAt: review?.due_at ?? null,
    };
  });

  items.sort((a, b) => b.score - a.score);
  return { version: RULES_VERSION, items };
}
