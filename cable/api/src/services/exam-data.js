import { query } from '../db.js';
import { computePriorities } from './priority-engine.js';

export async function loadTopicsWithSubject(examId) {
  const { rows } = await query(
    `SELECT t.*, s.name AS subject_name, s.weight AS subject_weight
       FROM topics t
       JOIN subjects s ON s.id = t.subject_id
      WHERE t.exam_id = $1
      ORDER BY s.name, t.code NULLS LAST, t.title`,
    [examId]
  );
  return rows;
}

export async function loadReviews(examId) {
  const { rows } = await query(
    `SELECT r.* FROM reviews r JOIN topics t ON t.id = r.topic_id WHERE t.exam_id = $1`,
    [examId]
  );
  const map = new Map();
  for (const row of rows) map.set(row.topic_id, row);
  return map;
}

export async function loadPriorities(examId, now = new Date()) {
  const [topics, reviews] = await Promise.all([loadTopicsWithSubject(examId), loadReviews(examId)]);
  return computePriorities({ topics, reviewsByTopic: reviews, now });
}

export function dueReviewsFrom(priorities, reviewsByTopic, now = new Date()) {
  return priorities.items
    .filter(item => item.dueAt && new Date(item.dueAt) <= now)
    .map(item => ({
      topicId: item.topicId,
      topicTitle: item.topicTitle,
      dueAt: item.dueAt,
      overdueDays: Math.max(
        0,
        Math.floor((now.getTime() - new Date(item.dueAt).getTime()) / 86_400_000)
      ),
    }));
}

export async function subjectTree(examId) {
  const { rows } = await query(
    `SELECT s.id, s.name, s.weight,
            count(t.id)::int AS topics_total,
            count(t.id) FILTER (WHERE t.status <> 'nao_iniciado')::int AS topics_started,
            count(t.id) FILTER (WHERE t.status = 'dominado')::int AS topics_mastered,
            coalesce(sum(t.minutes_studied), 0)::int AS minutes_studied,
            coalesce(sum(t.questions_total), 0)::int AS questions_total,
            coalesce(sum(t.questions_correct), 0)::int AS questions_correct
       FROM subjects s
       LEFT JOIN topics t ON t.subject_id = s.id
      WHERE s.exam_id = $1
      GROUP BY s.id
      ORDER BY s.name`,
    [examId]
  );
  return rows;
}

export function mapExam(row) {
  return {
    id: row.id,
    title: row.title,
    organizationName: row.organization_name,
    boardName: row.board_name,
    positionTitle: row.position_title,
    city: row.city,
    uf: row.uf,
    status: row.status,
    examDate: row.exam_date,
    officialSourceUrl: row.official_source_url,
    weeklyHours: row.weekly_hours === null ? null : Number(row.weekly_hours),
    studyDays: row.study_days,
    dailyMinutes: row.daily_minutes,
    experienceLevel: row.experience_level,
    onboardingDone: row.onboarding_done,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
