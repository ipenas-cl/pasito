import type { ActivityEvent, CardState, Child, Difficulty, ProgressRepository } from '../domain';

/** In-memory adapter, used by component tests. */
export class MemoryRepository implements ProgressRepository {
  children = new Map<string, Child>();
  cards = new Map<string, Record<string, CardState>>();
  events: ActivityEvent[] = [];
  diff = new Map<string, Difficulty>();

  async listChildren() { return [...this.children.values()].sort((a, b) => a.createdAt - b.createdAt); }
  async saveChild(c: Child) { this.children.set(c.id, c); }
  async deleteChild(id: string) {
    this.children.delete(id);
    this.cards.delete(id);
    this.events = this.events.filter((e) => e.childId !== id);
  }
  async getCards(childId: string) { return { ...(this.cards.get(childId) ?? {}) }; }
  async saveCard(childId: string, card: CardState) {
    this.cards.set(childId, { ...(this.cards.get(childId) ?? {}), [card.id]: card });
  }
  async logEvent(e: ActivityEvent) { this.events.push(e); }
  async getEvents(childId: string) { return this.events.filter((e) => e.childId === childId); }
  async getDifficulty(childId: string, key: string) { return this.diff.get(`${childId}:${key}`); }
  async saveDifficulty(childId: string, key: string, d: Difficulty) { this.diff.set(`${childId}:${key}`, d); }
  async exportAll() { return { children: [...this.children.values()], events: this.events }; }
}
