import { type Rng, shuffle } from './rng';

export const VOWELS = ['a', 'e', 'i', 'o', 'u'] as const;

/** Spanish phonics: each letter with a key word and the sound children say. */
export interface Letter { letter: string; sound: string; word: string; emoji: string }
export const LETTERS: Letter[] = [
  { letter: 'a', sound: 'aaa', word: 'abeja', emoji: '🐝' },
  { letter: 'e', sound: 'eee', word: 'elefante', emoji: '🐘' },
  { letter: 'i', sound: 'iii', word: 'iglú', emoji: '🛖' },
  { letter: 'o', sound: 'ooo', word: 'oso', emoji: '🐻' },
  { letter: 'u', sound: 'uuu', word: 'uva', emoji: '🍇' },
  { letter: 'm', sound: 'mmm', word: 'mamá', emoji: '👩' },
  { letter: 'p', sound: 'pe', word: 'pato', emoji: '🦆' },
  { letter: 's', sound: 'sss', word: 'sol', emoji: '☀️' },
  { letter: 'l', sound: 'lll', word: 'luna', emoji: '🌙' },
  { letter: 't', sound: 'te', word: 'tomate', emoji: '🍅' },
  { letter: 'n', sound: 'nnn', word: 'nube', emoji: '☁️' },
  { letter: 'd', sound: 'de', word: 'dado', emoji: '🎲' },
  { letter: 'r', sound: 'rrr', word: 'ratón', emoji: '🐭' },
  { letter: 'c', sound: 'ca', word: 'casa', emoji: '🏠' },
  { letter: 'g', sound: 'ga', word: 'gato', emoji: '🐱' },
  { letter: 'b', sound: 'be', word: 'barco', emoji: '⛵' },
  { letter: 'f', sound: 'fff', word: 'foca', emoji: '🦭' },
  { letter: 'v', sound: 've', word: 'vaca', emoji: '🐄' },
  { letter: 'ñ', sound: 'ñe', word: 'ñandú', emoji: '🐦' },
  { letter: 'z', sound: 'zzz', word: 'zapato', emoji: '👞' },
];

/** Consonant families in the order Chilean schools usually teach them (Método Matte style). */
export const SYLLABLE_FAMILIES = ['m', 'p', 's', 'l', 't', 'n', 'd'] as const;

export function syllableFamily(consonant: string): string[] {
  return VOWELS.map((v) => consonant + v);
}

export interface BuildWord { word: string; syllables: string[]; emoji: string; en: string }
export const BUILD_WORDS: BuildWord[] = [
  { word: 'mamá', syllables: ['ma', 'má'], emoji: '👩', en: 'mom' },
  { word: 'papá', syllables: ['pa', 'pá'], emoji: '👨', en: 'dad' },
  { word: 'mesa', syllables: ['me', 'sa'], emoji: '🪑', en: 'table' },
  { word: 'sapo', syllables: ['sa', 'po'], emoji: '🐸', en: 'toad' },
  { word: 'pelota', syllables: ['pe', 'lo', 'ta'], emoji: '⚽', en: 'ball' },
  { word: 'luna', syllables: ['lu', 'na'], emoji: '🌙', en: 'moon' },
  { word: 'dado', syllables: ['da', 'do'], emoji: '🎲', en: 'die' },
  { word: 'tomate', syllables: ['to', 'ma', 'te'], emoji: '🍅', en: 'tomato' },
  { word: 'nido', syllables: ['ni', 'do'], emoji: '🪺', en: 'nest' },
  { word: 'paloma', syllables: ['pa', 'lo', 'ma'], emoji: '🕊️', en: 'dove' },
];

/** Syllable tiles: the word's syllables plus distractors, shuffled. */
export function syllableTiles(rng: Rng, w: BuildWord, distractors = 2): string[] {
  const pool = BUILD_WORDS.flatMap((b) => b.syllables).filter((s) => !w.syllables.includes(s));
  const extra = shuffle(rng, [...new Set(pool)]).slice(0, distractors);
  return shuffle(rng, [...w.syllables, ...extra]);
}

/** Validates the next tile; returns the new built list or null if wrong. */
export function placeSyllable(w: BuildWord, built: readonly string[], tile: string): string[] | null {
  return w.syllables[built.length] === tile ? [...built, tile] : null;
}

export const isWordComplete = (w: BuildWord, built: readonly string[]): boolean =>
  built.length === w.syllables.length;

export interface Token { text: string; isWord: boolean; start: number; end: number }

/** Splits a text into word/space tokens with char offsets matching SpeechSynthesis boundary events. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tokens.push({ text: m[0], isWord: /[\p{L}\p{N}]/u.test(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** Returns the index of the word token containing the given char index (from onboundary). */
export function wordIndexAt(tokens: readonly Token[], charIndex: number): number {
  const words = tokens.filter((t) => t.isWord);
  const i = words.findIndex((t) => charIndex >= t.start && charIndex < t.end);
  if (i >= 0) return i;
  // boundary may point at the preceding space
  return words.findIndex((t) => t.start >= charIndex);
}

/** Fallback timing when the browser does not fire boundary events: ms per word. */
export function estimateWordTimings(tokens: readonly Token[], rate = 0.8): number[] {
  return tokens.filter((t) => t.isWord).map((t) => Math.round((250 + t.text.length * 70) / rate));
}

export interface Story { id: string; title: { es: string; en: string }; text: string; emoji: string; level: number }
export const STORIES: Story[] = [
  { id: 'mi-mama', emoji: '👩', level: 1, title: { es: 'Mi mamá', en: 'My mom' }, text: 'Mi mamá me ama. Yo amo a mi mamá.' },
  { id: 'el-sapo', emoji: '🐸', level: 1, title: { es: 'El sapo', en: 'The toad' }, text: 'El sapo salta. El sapo mira la luna.' },
  { id: 'la-pelota', emoji: '⚽', level: 2, title: { es: 'La pelota', en: 'The ball' }, text: 'Tito tiene una pelota. La pelota es azul. Tito juega con su papá.' },
  { id: 'el-nido', emoji: '🪺', level: 2, title: { es: 'El nido', en: 'The nest' }, text: 'La paloma hizo un nido. En el nido hay dos huevos. Pronto nacerán dos pollitos.' },
];
