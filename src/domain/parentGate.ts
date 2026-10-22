import { type Rng, randInt, shuffle } from './rng';

/** A multiplication challenge that toddlers can't solve but adults can, shown as words. */
export interface GateChallenge { a: number; b: number; answer: number; options: number[] }

export function createGate(rng: Rng): GateChallenge {
  const a = randInt(rng, 3, 9);
  const b = randInt(rng, 3, 9);
  const answer = a * b;
  const opts = new Set([answer]);
  while (opts.size < 4) {
    const v = answer + randInt(rng, -12, 12);
    if (v > 0) opts.add(v);
  }
  return { a, b, answer, options: shuffle(rng, [...opts]) };
}

export const checkGate = (g: GateChallenge, value: number): boolean => g.answer === value;
