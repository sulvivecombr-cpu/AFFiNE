import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePriorities } from '../src/services/priority-engine.js';
import { generatePlan } from '../src/services/planner.js';

const topic = (overrides = {}) => ({
  id: 't1',
  title: 'Assunto',
  subject_name: 'Disciplina',
  subject_weight: null,
  status: 'nao_iniciado',
  minutes_studied: 0,
  questions_total: 0,
  questions_correct: 0,
  last_studied_at: null,
  ...overrides,
});

test('never-studied topic outranks a mastered one', () => {
  const { items } = computePriorities({
    topics: [
      topic({ id: 'novo', title: 'Novo', status: 'nao_iniciado' }),
      topic({
        id: 'dominado',
        title: 'Dominado',
        status: 'dominado',
        minutes_studied: 300,
        questions_total: 40,
        questions_correct: 38,
        last_studied_at: new Date().toISOString(),
      }),
    ],
  });
  assert.equal(items[0].topicId, 'novo');
  assert.ok(items[0].score > items[1].score);
});

test('accuracy is only used with enough questions', () => {
  const { items } = computePriorities({
    topics: [topic({ questions_total: 3, questions_correct: 0, minutes_studied: 30, status: 'em_andamento' })],
  });
  assert.equal(items[0].factors.erro, undefined);
  assert.equal(items[0].confidence, 'baixa');
  assert.ok(items[0].reasons.every(reason => reason.factor !== 'erro'));
});

test('low accuracy raises the error factor and is explained', () => {
  const { items } = computePriorities({
    topics: [topic({ questions_total: 10, questions_correct: 3, minutes_studied: 60, status: 'em_andamento' })],
  });
  assert.equal(items[0].factors.erro, 0.7);
  assert.ok(items[0].reasons.some(reason => /30% em 10 questões/.test(reason.label)));
});

test('planner respects availability and does not repeat a topic', () => {
  const plan = generatePlan({
    exam: { daily_minutes: 100, study_days: [1, 2, 3, 4, 5] },
    priorities: [
      { topicId: 'a', topicTitle: 'A', status: 'nao_iniciado', score: 90, confidence: 'alta', reasons: [{ label: 'Nunca estudado' }] },
      { topicId: 'b', topicTitle: 'B', status: 'nao_iniciado', score: 80, confidence: 'alta', reasons: [{ label: 'Nunca estudado' }] },
    ],
    dueReviews: [],
    now: new Date('2026-03-02T09:00:00Z'), // Monday
  });

  const studyItems = plan.items.filter(item => item.kind !== 'descanso');
  const topicIds = studyItems.map(item => item.topicId);
  assert.equal(new Set(topicIds).size, topicIds.length, 'um assunto não deve repetir no mesmo plano');

  const perDay = new Map();
  for (const item of plan.items) {
    perDay.set(item.day, (perDay.get(item.day) ?? 0) + item.targetMinutes);
  }
  for (const [, minutes] of perDay) {
    assert.ok(minutes <= 100, `dia excedeu a disponibilidade: ${minutes}`);
  }
  assert.ok(plan.items.some(item => item.kind === 'descanso'), 'fim de semana fica sem estudo');
});

test('planner schedules due reviews before new topics', () => {
  const plan = generatePlan({
    exam: { daily_minutes: 60, study_days: [1, 2, 3, 4, 5, 6, 0] },
    priorities: [
      { topicId: 'a', topicTitle: 'A', status: 'nao_iniciado', score: 90, confidence: 'alta', reasons: [{ label: 'Nunca estudado' }] },
    ],
    dueReviews: [{ topicId: 'r', topicTitle: 'Revisão', overdueDays: 3 }],
    now: new Date('2026-03-02T09:00:00Z'),
  });
  const first = plan.items.find(item => item.targetMinutes > 0);
  assert.equal(first.kind, 'revisao');
  assert.equal(first.topicId, 'r');
});
