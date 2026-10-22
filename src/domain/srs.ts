/**
 * Spaced repetition based on a Leitner system with 5 boxes.
 * Young children need short intervals, so boxes are measured in hours/days.
 */
export interface CardState {
  id: string;
  box: number; // 0..MAX_BOX
  due: number; // epoch ms
  seen: number;
  correct: number;
  lastSeen?: number;
}

export const MAX_BOX = 5;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Interval after landing in a given box. */
export const BOX_INTERVALS = [0, 4 * HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY];

export type Grade = 'again' | 'good' | 'easy';

export function newCard(id: string, now: number): CardState {
  return { id, box: 0, due: now, seen: 0, correct: 0 };
}

export function review(card: CardState, grade: Grade, now: number): CardState {
  let box = card.box;
  if (grade === 'again') box = Math.max(0, box - 2);
  else if (grade === 'good') box = Math.min(MAX_BOX, box + 1);
  else box = Math.min(MAX_BOX, box + 2);
  return {
    ...card,
    box,
    due: now + BOX_INTERVALS[box],
    seen: card.seen + 1,
    correct: card.correct + (grade === 'again' ? 0 : 1),
    lastSeen: now,
  };
}

export const isMastered = (c: CardState): boolean => c.box >= 3;

/**
 * Picks the next items for a session: due cards first (most overdue first),
 * then introduces up to `newLimit` unseen items in curriculum order.
 */
export function pickSession(
  curriculum: readonly string[],
  states: Readonly<Record<string, CardState>>,
  now: number,
  size: number,
  newLimit = 3,
): string[] {
  const due = curriculum
    .filter((id) => states[id] && states[id].due <= now)
    .sort((a, b) => states[a].due - states[b].due || states[a].box - states[b].box);
  const fresh = curriculum.filter((id) => !states[id]).slice(0, newLimit);
  const picked = [...due.slice(0, size), ...fresh].slice(0, size);
  if (picked.length < size) {
    // Fill with the least-known cards so a session is never empty.
    const rest = curriculum
      .filter((id) => states[id] && !picked.includes(id))
      .sort((a, b) => states[a].box - states[b].box || states[a].due - states[b].due);
    picked.push(...rest.slice(0, size - picked.length));
  }
  return picked;
}
