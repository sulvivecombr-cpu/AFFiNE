/**
 * Spaced repetition through FSRS (ts-fsrs).
 *
 * The scheduler owns the card state; Cable only mirrors `due_at`, `stability`,
 * `difficulty`, `reps` and `lapses` for querying. A rating is derived from the
 * study activity that was actually recorded, never assumed:
 *   - activity with questions and >= 80% accuracy  → Bom (3)
 *   - activity with questions and >= 50% accuracy  → Difícil (2)
 *   - activity with questions and <  50% accuracy  → Errei (1)
 *   - reading/summary activity without questions   → Bom (3)
 *   - explicit self-rating from the UI             → as provided
 */
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';

const scheduler = fsrs({ enable_fuzz: false });

export const RATING = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function ratingFromActivity({ kind, questionsTotal, questionsCorrect, explicit }) {
  if (explicit !== undefined && explicit !== null) {
    const map = { errei: Rating.Again, dificil: Rating.Hard, bom: Rating.Good, facil: Rating.Easy };
    if (map[explicit]) return map[explicit];
  }
  if (questionsTotal && questionsTotal > 0) {
    const accuracy = (questionsCorrect ?? 0) / questionsTotal;
    if (accuracy >= 0.8) return Rating.Good;
    if (accuracy >= 0.5) return Rating.Hard;
    return Rating.Again;
  }
  if (kind === 'revisao') return Rating.Good;
  return Rating.Good;
}

function toCard(row) {
  const stored = row?.card;
  if (!stored || Object.keys(stored).length === 0) return createEmptyCard(new Date(row?.due_at ?? Date.now()));
  return {
    ...stored,
    due: new Date(stored.due),
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

/**
 * @param {object|null} row existing `reviews` row
 * @param {number} rating Rating.* value
 * @param {Date} now
 */
export function schedule(row, rating, now = new Date()) {
  const card = toCard(row);
  const { card: next } = scheduler.next(card, now, rating);
  return {
    dueAt: next.due,
    card: {
      ...next,
      due: next.due.toISOString(),
      last_review: next.last_review ? next.last_review.toISOString() : null,
    },
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
  };
}
