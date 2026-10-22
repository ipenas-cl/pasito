import { describe, expect, it } from 'vitest';
import {
  BOX_INTERVALS, MAX_BOX, newCard, review, pickSession, isMastered,
  initialDifficulty, recordAnswer, WINDOW,
  evaluateAttempt, normalize, levenshtein,
  createRng, generateTask, taskAnswer, levelSpec, makeOptions,
  syllableFamily, BUILD_WORDS, syllableTiles, placeSyllable, isWordComplete, tokenize, wordIndexAt, estimateWordTimings,
  currentStreak, longestStreak, moduleStats, lastDays, dayKey, type ActivityEvent,
  createGate, checkGate, unlockedStages, SPEAK_ITEMS,
} from './index';

const NOW = new Date(2026, 9, 22, 10, 0).getTime();
const DAY = 86_400_000;

describe('spaced repetition', () => {
  it('promotes on good and easy, demotes on again', () => {
    let c = newCard('x', NOW);
    c = review(c, 'good', NOW);
    expect(c.box).toBe(1);
    expect(c.due).toBe(NOW + BOX_INTERVALS[1]);
    c = review(c, 'easy', NOW);
    expect(c.box).toBe(3);
    expect(isMastered(c)).toBe(true);
    c = review(c, 'again', NOW);
    expect(c.box).toBe(1);
    expect(c.seen).toBe(3);
    expect(c.correct).toBe(2);
  });
  it('clamps boxes', () => {
    let c = newCard('x', NOW);
    c = review(c, 'again', NOW);
    expect(c.box).toBe(0);
    for (let i = 0; i < 10; i++) c = review(c, 'easy', NOW);
    expect(c.box).toBe(MAX_BOX);
  });
  it('picks due cards first, then new ones in order', () => {
    const states = {
      a: { ...newCard('a', NOW), box: 2, due: NOW - 10 },
      b: { ...newCard('b', NOW), box: 1, due: NOW - 1000 },
      c: { ...newCard('c', NOW), box: 4, due: NOW + DAY },
    };
    expect(pickSession(['a', 'b', 'c', 'd', 'e'], states, NOW, 4, 2)).toEqual(['b', 'a', 'd', 'e']);
  });
  it('fills a session with least-known cards when nothing is due', () => {
    const states = {
      a: { ...newCard('a', NOW), box: 4, due: NOW + DAY },
      b: { ...newCard('b', NOW), box: 2, due: NOW + DAY },
    };
    expect(pickSession(['a', 'b'], states, NOW, 2)).toEqual(['b', 'a']);
  });
});

describe('adaptive difficulty', () => {
  it('levels up after a strong window and resets the window', () => {
    let d = initialDifficulty(1);
    for (let i = 0; i < WINDOW; i++) d = recordAnswer(d, true);
    expect(d).toEqual({ level: 2, recent: [] });
  });
  it('levels down after two early misses', () => {
    let d = initialDifficulty(3);
    d = recordAnswer(d, false);
    d = recordAnswer(d, false);
    expect(d.level).toBe(2);
  });
  it('stays in range', () => {
    let d = initialDifficulty(5);
    for (let i = 0; i < WINDOW; i++) d = recordAnswer(d, true, 1, 5);
    expect(d.level).toBe(5);
    d = initialDifficulty(1);
    for (let i = 0; i < 10; i++) d = recordAnswer(d, false);
    expect(d.level).toBe(1);
  });
  it('holds level on mixed results', () => {
    let d = initialDifficulty(2);
    for (const r of [true, false, true, true, false]) d = recordAnswer(d, r);
    expect(d.level).toBe(2);
    expect(d.recent).toHaveLength(WINDOW);
  });
});

describe('speech matching', () => {
  it('normalizes accents and punctuation', () => {
    expect(normalize('¡Mamá!  ')).toBe('mama');
    expect(levenshtein('gato', 'pato')).toBe(1);
  });
  it('is generous with small mistakes', () => {
    expect(evaluateAttempt('manzana', ['manana']).feedback).toBe('great');
    expect(evaluateAttempt('perro', ['pero']).feedback).toBe('great');
    expect(evaluateAttempt('casa', ['es una casa']).feedback).toBe('great');
    expect(evaluateAttempt('pelota', ['pelo']).feedback).toBe('close');
    expect(evaluateAttempt('leche', ['avión']).feedback).toBe('retry');
    expect(evaluateAttempt('leche', []).feedback).toBe('retry');
  });
  it('uses the best alternative', () => {
    expect(evaluateAttempt('gato', ['plato', 'gato']).score).toBe(1);
  });
});

describe('numbers', () => {
  it('generates valid tasks for every level', () => {
    const rng = createRng(42);
    for (let level = 1; level <= 5; level++) {
      const { max, kinds } = levelSpec(level);
      for (let i = 0; i < 200; i++) {
        const t = generateTask(rng, level);
        expect(kinds).toContain(t.kind);
        const ans = taskAnswer(t);
        expect(t.options).toContain(ans);
        expect(new Set(t.options).size).toBe(t.options.length);
        expect(ans).toBeGreaterThanOrEqual(0);
        if (t.kind === 'add') expect(t.a + t.b).toBe(ans);
        if (t.kind === 'sub') expect(t.a - t.b).toBe(ans);
        if (t.kind !== 'recognize') expect(ans).toBeLessThanOrEqual(max);
        expect(t.options.every((o) => o >= 0)).toBe(true);
      }
    }
  });
  it('is deterministic for a seed', () => {
    expect(generateTask(createRng(7), 3)).toEqual(generateTask(createRng(7), 3));
  });
  it('makes three distinct options', () => {
    expect(makeOptions(createRng(1), 0, 3)).toHaveLength(3);
  });
});

describe('reading', () => {
  it('builds syllable families', () => {
    expect(syllableFamily('m')).toEqual(['ma', 'me', 'mi', 'mo', 'mu']);
  });
  it('builds a word from tiles in order', () => {
    const w = BUILD_WORDS.find((b) => b.word === 'pelota')!;
    const tiles = syllableTiles(createRng(3), w);
    expect(tiles).toEqual(expect.arrayContaining(w.syllables));
    expect(tiles).toHaveLength(5);
    expect(placeSyllable(w, [], 'lo')).toBeNull();
    let built = placeSyllable(w, [], 'pe')!;
    built = placeSyllable(w, built, 'lo')!;
    expect(isWordComplete(w, built)).toBe(false);
    built = placeSyllable(w, built, 'ta')!;
    expect(isWordComplete(w, built)).toBe(true);
  });
  it('tokenizes with offsets and maps boundaries to words', () => {
    const tokens = tokenize('El sapo salta.');
    expect(tokens.filter((t) => t.isWord).map((t) => t.text)).toEqual(['El', 'sapo', 'salta']);
    expect(wordIndexAt(tokens, 0)).toBe(0);
    expect(wordIndexAt(tokens, 3)).toBe(1);
    expect(wordIndexAt(tokens, 2)).toBe(1);
    expect(wordIndexAt(tokens, 9)).toBe(2);
    expect(estimateWordTimings(tokens)).toHaveLength(3);
  });
  it('handles ñ and accents as letters', () => {
    expect(tokenize('Ñandú corrió').filter((t) => t.isWord).map((t) => t.text)).toEqual(['Ñandú', 'corrió']);
  });
});

describe('progress and streaks', () => {
  const ev = (daysAgo: number, correct = true, module: ActivityEvent['module'] = 'speak'): ActivityEvent => ({
    childId: 'c', module, itemId: 'x', correct, at: NOW - daysAgo * DAY,
  });
  it('counts a streak ending today or yesterday', () => {
    expect(currentStreak([ev(0), ev(1), ev(2), ev(4)], NOW)).toBe(3);
    expect(currentStreak([ev(1), ev(2)], NOW)).toBe(2);
    expect(currentStreak([ev(2)], NOW)).toBe(0);
    expect(currentStreak([], NOW)).toBe(0);
  });
  it('finds the longest streak', () => {
    expect(longestStreak([ev(0), ev(1), ev(5), ev(6), ev(7), ev(8)])).toBe(4);
  });
  it('computes per-module accuracy', () => {
    const s = moduleStats([ev(0, true, 'numbers'), ev(0, false, 'numbers'), ev(0, true, 'read')]);
    expect(s.numbers).toEqual({ attempts: 2, correct: 1, accuracy: 50 });
    expect(s.read.accuracy).toBe(100);
    expect(s.speak.attempts).toBe(0);
  });
  it('buckets the last days', () => {
    const d = lastDays([ev(0), ev(0), ev(2)], NOW, 3);
    expect(d.map((x) => x.count)).toEqual([1, 0, 2]);
    expect(d[2].day).toBe(dayKey(NOW));
  });
});

describe('parent gate', () => {
  it('generates solvable multiplication with 4 positive options', () => {
    const rng = createRng(9);
    for (let i = 0; i < 100; i++) {
      const g = createGate(rng);
      expect(g.options).toHaveLength(4);
      expect(g.options).toContain(g.answer);
      expect(g.options.every((o) => o > 0)).toBe(true);
      expect(checkGate(g, g.a * g.b)).toBe(true);
      expect(checkGate(g, g.a * g.b + 1)).toBe(false);
    }
  });
});

describe('speak curriculum', () => {
  it('unlocks stages progressively', () => {
    expect(unlockedStages(new Set())).toEqual(['sounds']);
    const sounds = SPEAK_ITEMS.filter((x) => x.stage === 'sounds').map((x) => x.id);
    expect(unlockedStages(new Set(sounds))).toEqual(['sounds', 'syllables']);
  });
});
