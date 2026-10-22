import type { CardState } from './srs';
import type { ActivityEvent } from './progress';
import type { Difficulty } from './adaptive';

export interface Child {
  id: string;
  name: string;
  avatar: string;
  birthYear?: number;
  createdAt: number;
}

/** Port: persistence of profiles and progress. Adapters: IndexedDB (app) and in-memory (tests). */
export interface ProgressRepository {
  listChildren(): Promise<Child[]>;
  saveChild(child: Child): Promise<void>;
  deleteChild(id: string): Promise<void>;
  getCards(childId: string): Promise<Record<string, CardState>>;
  saveCard(childId: string, card: CardState): Promise<void>;
  logEvent(event: ActivityEvent): Promise<void>;
  getEvents(childId: string): Promise<ActivityEvent[]>;
  getDifficulty(childId: string, key: string): Promise<Difficulty | undefined>;
  saveDifficulty(childId: string, key: string, d: Difficulty): Promise<void>;
  exportAll(): Promise<unknown>;
}

/** Port: text-to-speech. */
export interface Speaker {
  readonly supported: boolean;
  speak(text: string, opts: { lang: string; rate?: number; onBoundary?: (charIndex: number) => void }): Promise<void>;
  cancel(): void;
}

/** Port: speech recognition. Returns alternatives heard, or throws. */
export interface Listener {
  readonly supported: boolean;
  listen(lang: string): Promise<string[]>;
}
