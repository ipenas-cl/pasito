/** Activity log + streaks. Days are local calendar days (YYYY-MM-DD). */
export type ModuleId = 'speak' | 'numbers' | 'read';

export interface ActivityEvent {
  childId: string;
  module: ModuleId;
  itemId: string;
  correct: boolean;
  at: number;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

/** Current streak: consecutive active days ending today (or yesterday, so it isn't lost before playing). */
export function currentStreak(events: readonly ActivityEvent[], now: number): number {
  const days = new Set(events.map((e) => dayKey(e.at)));
  let cursor = dayKey(now);
  if (!days.has(cursor)) cursor = prevDay(cursor);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  return streak;
}

export function longestStreak(events: readonly ActivityEvent[]): number {
  const days = [...new Set(events.map((e) => dayKey(e.at)))].sort();
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of days) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return best;
}

export interface ModuleStats { attempts: number; correct: number; accuracy: number }

export function moduleStats(events: readonly ActivityEvent[]): Record<ModuleId, ModuleStats> {
  const out = {} as Record<ModuleId, ModuleStats>;
  for (const m of ['speak', 'numbers', 'read'] as ModuleId[]) {
    const ev = events.filter((e) => e.module === m);
    const correct = ev.filter((e) => e.correct).length;
    out[m] = { attempts: ev.length, correct, accuracy: ev.length ? Math.round((correct / ev.length) * 100) : 0 };
  }
  return out;
}

/** Attempts per day for the last `n` days, oldest first. */
export function lastDays(events: readonly ActivityEvent[], now: number, n = 7): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(dayKey(e.at), (counts.get(dayKey(e.at)) ?? 0) + 1);
  const out: { day: string; count: number }[] = [];
  let cursor = dayKey(now);
  for (let i = 0; i < n; i++) {
    out.unshift({ day: cursor, count: counts.get(cursor) ?? 0 });
    cursor = prevDay(cursor);
  }
  return out;
}
