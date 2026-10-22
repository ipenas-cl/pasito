import { type Rng, randInt, shuffle } from './rng';

export type NumberTask =
  | { kind: 'count'; emoji: string; count: number; options: number[] }
  | { kind: 'recognize'; target: number; options: number[] }
  | { kind: 'add' | 'sub'; a: number; b: number; emoji: string; answer: number; options: number[] };

export const NUMBER_LEVELS = 5;
const EMOJI = ['🍎', '⭐', '🐟', '🎈', '🐞', '🌼', '🚗', '🍪'];

/** Level -> what kind of tasks and how large the numbers are. */
export function levelSpec(level: number): { max: number; kinds: NumberTask['kind'][] } {
  switch (level) {
    case 1: return { max: 3, kinds: ['count'] };
    case 2: return { max: 5, kinds: ['count', 'recognize'] };
    case 3: return { max: 10, kinds: ['count', 'recognize', 'add'] };
    case 4: return { max: 10, kinds: ['recognize', 'add', 'sub'] };
    default: return { max: 20, kinds: ['add', 'sub'] };
  }
}

export function makeOptions(rng: Rng, answer: number, max: number, n = 3): number[] {
  const opts = new Set([answer]);
  let guard = 0;
  while (opts.size < n && guard++ < 100) {
    const delta = randInt(rng, 1, 3) * (rng() < 0.5 ? -1 : 1);
    const v = answer + delta;
    if (v >= 0 && v <= Math.max(max, answer + 3)) opts.add(v);
  }
  return shuffle(rng, [...opts]);
}

export function generateTask(rng: Rng, level: number): NumberTask {
  const { max, kinds } = levelSpec(Math.min(Math.max(level, 1), NUMBER_LEVELS));
  const kind = kinds[randInt(rng, 0, kinds.length - 1)];
  const emoji = EMOJI[randInt(rng, 0, EMOJI.length - 1)];
  if (kind === 'count') {
    const count = randInt(rng, 1, max);
    return { kind, emoji, count, options: makeOptions(rng, count, max) };
  }
  if (kind === 'recognize') {
    const target = randInt(rng, 0, max);
    return { kind, target, options: makeOptions(rng, target, max) };
  }
  if (kind === 'add') {
    const answer = randInt(rng, 2, max);
    const a = randInt(rng, 1, answer - 1);
    return { kind, a, b: answer - a, emoji, answer, options: makeOptions(rng, answer, max) };
  }
  const a = randInt(rng, 2, max);
  const b = randInt(rng, 1, a - 1);
  return { kind: 'sub', a, b, emoji, answer: a - b, options: makeOptions(rng, a - b, max) };
}

export const taskAnswer = (t: NumberTask): number =>
  t.kind === 'count' ? t.count : t.kind === 'recognize' ? t.target : t.answer;
