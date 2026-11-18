/**
 * Dynamic study plan generator — planner v1.
 *
 * Inputs (all real, from the candidate's own settings):
 *   - daily_minutes / weekly_hours / study_days
 *   - exam_date (when the notice or the candidate provides one)
 *   - priorities computed by services/priority-engine.js
 *   - reviews that are due
 *
 * Output: one plan per generation (versioned, previous plan is superseded, never
 * deleted) with day-by-day items. A topic already scheduled earlier in the same
 * plan is not scheduled again for `estudo` — repetition only comes from reviews.
 */
export const PLANNER_VERSION = 'planejador-v1';

const HORIZON_DAYS = 7;
const BLOCK_MINUTES = 50;

const isoDate = date => date.toISOString().slice(0, 10);

export function generatePlan({ exam, priorities, dueReviews, now = new Date() }) {
  const dailyMinutes =
    Number(exam.daily_minutes) ||
    Math.round((Number(exam.weekly_hours ?? 0) * 60) / Math.max(1, (exam.study_days ?? [1, 2, 3, 4, 5]).length)) ||
    60;

  const studyDays = Array.isArray(exam.study_days) && exam.study_days.length > 0
    ? new Set(exam.study_days.map(Number))
    : new Set([1, 2, 3, 4, 5]);

  const items = [];
  const scheduledTopics = new Set();
  const reviewQueue = [...dueReviews];
  const queue = [...priorities];

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const horizonEnd = new Date(start);
  horizonEnd.setDate(horizonEnd.getDate() + HORIZON_DAYS - 1);

  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    const weekday = day.getDay();

    if (!studyDays.has(weekday)) {
      items.push({
        day: isoDate(day),
        topicId: null,
        kind: 'descanso',
        targetMinutes: 0,
        reason: 'Dia sem estudo na sua disponibilidade.',
      });
      continue;
    }

    let remaining = dailyMinutes;

    // 1. Reviews first — they protect what is about to be forgotten.
    while (reviewQueue.length > 0 && remaining >= 20) {
      const review = reviewQueue.shift();
      const minutes = Math.min(25, remaining);
      items.push({
        day: isoDate(day),
        topicId: review.topicId,
        kind: 'revisao',
        targetMinutes: minutes,
        reason: `Revisão vencida${review.overdueDays > 0 ? ` há ${review.overdueDays} dia(s)` : ''} (FSRS).`,
      });
      remaining -= minutes;
    }

    // 2. New/weak topics by priority, one block each, no duplicates in the plan.
    while (queue.length > 0 && remaining >= BLOCK_MINUTES) {
      const next = queue.find(item => !scheduledTopics.has(item.topicId));
      if (!next) break;
      scheduledTopics.add(next.topicId);
      queue.splice(queue.indexOf(next), 1);
      const minutes = Math.min(BLOCK_MINUTES, remaining);
      items.push({
        day: isoDate(day),
        topicId: next.topicId,
        kind: next.status === 'nao_iniciado' ? 'estudo' : 'questoes',
        targetMinutes: minutes,
        reason: `${next.reasons[0]?.label ?? 'Prioridade calculada'}; prioridade ${next.score} (${next.confidence}).`,
      });
      remaining -= minutes;
    }

    if (remaining === dailyMinutes) {
      items.push({
        day: isoDate(day),
        topicId: null,
        kind: 'descanso',
        targetMinutes: 0,
        reason: 'Sem assuntos pendentes para alocar neste dia.',
      });
    }
  }

  const rationale = {
    version: PLANNER_VERSION,
    dailyMinutes,
    studyDays: [...studyDays].sort(),
    horizonDays: HORIZON_DAYS,
    examDate: exam.exam_date ?? null,
    topicsConsidered: priorities.length,
    reviewsConsidered: dueReviews.length,
    generatedAt: now.toISOString(),
  };

  return {
    version: PLANNER_VERSION,
    horizonStart: isoDate(start),
    horizonEnd: isoDate(horizonEnd),
    items,
    rationale,
  };
}
