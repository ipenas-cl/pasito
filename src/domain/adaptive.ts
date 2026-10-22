/**
 * Adaptive difficulty: keeps a sliding window of recent answers and moves the
 * level up when the child is comfortable (>= 80%) and down when struggling (< 50%).
 * The window resets after every change so the child gets time at the new level.
 */
export interface Difficulty {
  level: number;
  recent: boolean[];
}

export const WINDOW = 5;
export const UP_THRESHOLD = 0.8;
export const DOWN_THRESHOLD = 0.5;

export const initialDifficulty = (level = 1): Difficulty => ({ level, recent: [] });

export function recordAnswer(d: Difficulty, correct: boolean, min = 1, max = 5): Difficulty {
  const recent = [...d.recent, correct].slice(-WINDOW);
  if (recent.length < WINDOW) {
    // Fast fallback: two consecutive misses at the start lower the level.
    if (recent.length >= 2 && !recent[recent.length - 1] && !recent[recent.length - 2] && d.level > min) {
      return { level: d.level - 1, recent: [] };
    }
    return { level: d.level, recent };
  }
  const rate = recent.filter(Boolean).length / recent.length;
  if (rate >= UP_THRESHOLD && d.level < max) return { level: d.level + 1, recent: [] };
  if (rate < DOWN_THRESHOLD && d.level > min) return { level: d.level - 1, recent: [] };
  return { level: d.level, recent };
}
