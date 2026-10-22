import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActivityEvent, CardState, Child, Difficulty, ProgressRepository } from '../domain';

interface PasitoDB extends DBSchema {
  children: { key: string; value: Child };
  cards: { key: [string, string]; value: CardState & { childId: string } ; indexes: { byChild: string } };
  events: { key: number; value: ActivityEvent; indexes: { byChild: string } };
  difficulty: { key: [string, string]; value: { childId: string; key: string; d: Difficulty } };
}

export class IdbRepository implements ProgressRepository {
  private db: Promise<IDBPDatabase<PasitoDB>>;

  constructor(name = 'pasito') {
    this.db = openDB<PasitoDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('children', { keyPath: 'id' });
        const cards = db.createObjectStore('cards', { keyPath: ['childId', 'id'] });
        cards.createIndex('byChild', 'childId');
        const events = db.createObjectStore('events', { autoIncrement: true });
        events.createIndex('byChild', 'childId');
        db.createObjectStore('difficulty', { keyPath: ['childId', 'key'] });
      },
    });
  }

  async listChildren() {
    return (await (await this.db).getAll('children')).sort((a, b) => a.createdAt - b.createdAt);
  }
  async saveChild(child: Child) {
    await (await this.db).put('children', child);
  }
  async deleteChild(id: string) {
    const db = await this.db;
    const tx = db.transaction(['children', 'cards', 'events', 'difficulty'], 'readwrite');
    await tx.objectStore('children').delete(id);
    for (const store of ['cards', 'events'] as const) {
      const idx = tx.objectStore(store).index('byChild');
      for (let c = await idx.openCursor(id); c; c = await c.continue()) await c.delete();
    }
    const diff = tx.objectStore('difficulty');
    for (let c = await diff.openCursor(); c; c = await c.continue()) if (c.value.childId === id) await c.delete();
    await tx.done;
  }
  async getCards(childId: string) {
    const all = await (await this.db).getAllFromIndex('cards', 'byChild', childId);
    return Object.fromEntries(all.map(({ childId: _c, ...card }) => [card.id, card as CardState]));
  }
  async saveCard(childId: string, card: CardState) {
    await (await this.db).put('cards', { ...card, childId });
  }
  async logEvent(event: ActivityEvent) {
    await (await this.db).add('events', event);
  }
  async getEvents(childId: string) {
    return (await this.db).getAllFromIndex('events', 'byChild', childId);
  }
  async getDifficulty(childId: string, key: string) {
    return (await (await this.db).get('difficulty', [childId, key]))?.d;
  }
  async saveDifficulty(childId: string, key: string, d: Difficulty) {
    await (await this.db).put('difficulty', { childId, key, d });
  }
  async exportAll() {
    const db = await this.db;
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      children: await db.getAll('children'),
      cards: await db.getAll('cards'),
      events: await db.getAll('events'),
      difficulty: await db.getAll('difficulty'),
    };
  }
}
