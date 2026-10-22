import { describe, expect, it } from 'vitest';
import { IdbRepository } from './idbRepository';
import { newCard } from '../domain';

describe('IdbRepository', () => {
  it('persists children, cards, events and difficulty and cascades deletes', async () => {
    const repo = new IdbRepository('test-' + Math.random());
    await repo.saveChild({ id: 'a', name: 'Sofi', avatar: '🦊', createdAt: 1 });
    await repo.saveChild({ id: 'b', name: 'Tomi', avatar: '🐼', createdAt: 2 });
    await repo.saveCard('a', newCard('speak:x', 0));
    await repo.logEvent({ childId: 'a', module: 'speak', itemId: 'x', correct: true, at: 5 });
    await repo.saveDifficulty('a', 'numbers', { level: 3, recent: [] });
    expect((await repo.listChildren()).map((c) => c.name)).toEqual(['Sofi', 'Tomi']);
    expect(Object.keys(await repo.getCards('a'))).toEqual(['speak:x']);
    expect(await repo.getEvents('a')).toHaveLength(1);
    expect((await repo.getDifficulty('a', 'numbers'))?.level).toBe(3);
    await repo.deleteChild('a');
    expect((await repo.listChildren()).map((c) => c.name)).toEqual(['Tomi']);
    expect(await repo.getEvents('a')).toHaveLength(0);
    expect(await repo.getCards('a')).toEqual({});
    expect(await repo.getDifficulty('a', 'numbers')).toBeUndefined();
  });
});
