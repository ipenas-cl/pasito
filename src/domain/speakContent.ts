/** Progressive curriculum for the speaking module. */
export type SpeakStage = 'sounds' | 'syllables' | 'words' | 'phrases';
export interface SpeakItem { id: string; stage: SpeakStage; es: string; en: string; emoji: string }

const item = (stage: SpeakStage, es: string, en: string, emoji: string): SpeakItem => ({ id: `${stage}:${es}`, stage, es, en, emoji });

export const SPEAK_ITEMS: SpeakItem[] = [
  item('sounds', 'a', 'a', '🅰️'), item('sounds', 'o', 'o', '⭕'), item('sounds', 'u', 'oo', '🦉'),
  item('sounds', 'mmm', 'mmm', '😋'), item('sounds', 'sss', 'sss', '🐍'), item('sounds', 'muu', 'moo', '🐄'),
  item('syllables', 'ma', 'ma', '👩'), item('syllables', 'pa', 'pa', '👨'), item('syllables', 'te', 'te', '🍵'),
  item('syllables', 'lu', 'lu', '🌙'), item('syllables', 'so', 'so', '☀️'), item('syllables', 'ga', 'ga', '🐱'),
  item('words', 'agua', 'water', '💧'), item('words', 'perro', 'dog', '🐶'), item('words', 'gato', 'cat', '🐱'),
  item('words', 'casa', 'house', '🏠'), item('words', 'pan', 'bread', '🍞'), item('words', 'leche', 'milk', '🥛'),
  item('words', 'manzana', 'apple', '🍎'), item('words', 'pelota', 'ball', '⚽'), item('words', 'flor', 'flower', '🌸'),
  item('words', 'auto', 'car', '🚗'),
  item('phrases', 'quiero agua', 'I want water', '💧'), item('phrases', 'hola mamá', 'hi mom', '👋'),
  item('phrases', 'el perro come', 'the dog eats', '🐶'), item('phrases', 'me gusta jugar', 'I like to play', '🧸'),
  item('phrases', 'buenas noches', 'good night', '🌙'),
];

export const SPEAK_STAGES: SpeakStage[] = ['sounds', 'syllables', 'words', 'phrases'];

/** A stage unlocks once most items of the previous stage are mastered. */
export function unlockedStages(mastered: ReadonlySet<string>): SpeakStage[] {
  const out: SpeakStage[] = ['sounds'];
  for (let i = 1; i < SPEAK_STAGES.length; i++) {
    const prev = SPEAK_ITEMS.filter((x) => x.stage === SPEAK_STAGES[i - 1]);
    const done = prev.filter((x) => mastered.has(x.id)).length;
    if (done / prev.length >= 0.6) out.push(SPEAK_STAGES[i]);
    else break;
  }
  return out;
}
