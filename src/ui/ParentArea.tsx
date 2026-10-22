import { useEffect, useState } from 'react';
import { currentStreak, isMastered, lastDays, longestStreak, moduleStats, type ActivityEvent, type CardState, type Child, type ModuleId } from '../domain';
import { useApp } from './context';
import { TopBar } from './components/common';

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐵', '🐧', '🐙', '🦁', '🐰'];

interface Summary { events: ActivityEvent[]; cards: Record<string, CardState>; level: number }

export function ParentArea({ children, onChange, onExit, onPlay }: { children: Child[]; onChange: () => void; onExit: () => void; onPlay: (c: Child) => void }) {
  const { t, lang, setLang, repo, clock } = useApp();
  const [data, setData] = useState<Record<string, Summary>>({});
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  useEffect(() => {
    void (async () => {
      const out: Record<string, Summary> = {};
      for (const c of children) {
        out[c.id] = {
          events: await repo.getEvents(c.id),
          cards: await repo.getCards(c.id),
          level: (await repo.getDifficulty(c.id, 'numbers'))?.level ?? 1,
        };
      }
      setData(out);
    })();
  }, [children, repo]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await repo.saveChild({ id: crypto.randomUUID(), name: name.trim().slice(0, 24), avatar, createdAt: clock() });
    setName('');
    onChange();
  };

  const remove = async (c: Child) => {
    if (!window.confirm(t.confirmDelete(c.name))) return;
    await repo.deleteChild(c.id);
    onChange();
  };

  const exportData = async () => {
    const blob = new Blob([JSON.stringify(await repo.exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pasito-${new Date(clock()).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const now = clock();
  const plural = (n: number) => `${n} ${n === 1 ? t.day : t.days}`;
  const MODULE_ICON: Record<ModuleId, string> = { speak: '🗣️', numbers: '🔢', read: '📖' };

  return (
    <main className="screen parent">
      <TopBar title={`👨‍👩‍👧 ${t.dashboard}`} right={<button type="button" className="text-btn" onClick={onExit} data-testid="exit-parent">← {t.exit}</button>} />
      <p className="privacy">🔐 {t.privacy}</p>

      {children.length === 0 && <p>{t.noChildren}</p>}
      <div className="child-cards">
        {children.map((c) => {
          const s = data[c.id];
          if (!s) return null;
          const stats = moduleStats(s.events);
          const week = lastDays(s.events, now, 7);
          const max = Math.max(1, ...week.map((d) => d.count));
          const mastered = Object.values(s.cards).filter(isMastered).length;
          return (
            <article key={c.id} className="child-card" data-testid={`child-card-${c.name}`}>
              <header>
                <span className="avatar" aria-hidden="true">{c.avatar}</span>
                <h2>{c.name}</h2>
                <button type="button" className="text-btn danger" onClick={() => void remove(c)}>{t.delete}</button>
              </header>
              <button type="button" className="primary play-btn" onClick={() => onPlay(c)} data-testid={`play-${c.name}`}>▶️ {t.playWith(c.name)}</button>
              <dl className="kpis">
                <div><dt>🔥 {t.currentStreak}</dt><dd data-testid="streak">{plural(currentStreak(s.events, now))}</dd></div>
                <div><dt>🏅 {t.bestStreak}</dt><dd>{plural(longestStreak(s.events))}</dd></div>
                <div><dt>🧠 {t.mastered}</dt><dd>{mastered}</dd></div>
                <div><dt>⭐ {t.numberLevel}</dt><dd>{s.level}/5</dd></div>
              </dl>
              <table className="module-table">
                <tbody>
                  {(Object.keys(stats) as ModuleId[]).map((m) => (
                    <tr key={m}>
                      <th scope="row">{MODULE_ICON[m]} {t[m]}</th>
                      <td>{stats[m].attempts} {t.attempts}</td>
                      <td>
                        <span className="bar"><span style={{ width: `${stats[m].accuracy}%` }} /></span> {stats[m].accuracy}% {t.accuracy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <figure>
                <figcaption>{t.last7}</figcaption>
                {week.every((d) => d.count === 0) ? (
                  <p className="empty-chart" data-testid="empty-chart">{t.noActivity}</p>
                ) : (
                <svg viewBox="0 0 140 50" className="spark" role="img" aria-label={week.map((d) => `${d.day}: ${d.count}`).join(', ')}>
                  {week.map((d, i) => {
                    const h = (d.count / max) * 40;
                    return <rect key={d.day} x={i * 20 + 3} y={45 - h} width="14" height={h} rx="3" />;
                  })}
                </svg>
                )}
              </figure>
            </article>
          );
        })}
      </div>

      <form className="add-child" onSubmit={(e) => void add(e)}>
        <h2>➕ {t.addChild}</h2>
        <label>
          {t.name}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} data-testid="child-name" required />
        </label>
        <fieldset>
          <legend>{t.avatar}</legend>
          <div className="avatar-pick">
            {AVATARS.map((a) => (
              <button type="button" key={a} aria-pressed={a === avatar} className={a === avatar ? 'on' : ''} onClick={() => setAvatar(a)} aria-label={a}>{a}</button>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="primary" data-testid="save-child">{t.save}</button>
      </form>

      <section className="settings">
        <h2>{t.language}</h2>
        <div className="seg" role="group" aria-label={t.language}>
          <button type="button" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>Español</button>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} data-testid="lang-en">English</button>
        </div>
        <button type="button" className="text-btn" onClick={() => void exportData()}>⬇️ {t.export}</button>
      </section>
    </main>
  );
}
