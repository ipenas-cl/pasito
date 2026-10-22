/** Compares what the speech recognizer heard with the target word. */
export type Feedback = 'great' | 'close' | 'retry';

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents; ñ becomes n which is fine for kids
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x && !y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/**
 * Children's speech is imprecise and recognizers return several alternatives,
 * so we score the best alternative and are generous with thresholds.
 */
export function evaluateAttempt(target: string, alternatives: readonly string[]): { feedback: Feedback; score: number } {
  const t = normalize(target);
  let best = 0;
  for (const alt of alternatives) {
    const n = normalize(alt);
    if (!n) continue;
    // The recognizer may wrap the word ("es una casa"): accept if it contains it.
    const score = n.split(' ').includes(t) || n === t ? 1 : Math.max(similarity(t, n), ...n.split(' ').map((w) => similarity(t, w)));
    best = Math.max(best, score);
  }
  const feedback: Feedback = best >= 0.75 ? 'great' : best >= 0.45 ? 'close' : 'retry';
  return { feedback, score: Math.round(best * 100) / 100 };
}
