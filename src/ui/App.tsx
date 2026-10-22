import { useCallback, useEffect, useState } from 'react';
import { currentStreak, type Child } from '../domain';
import { useApp } from './context';
import { IconButton, ParentGate, TopBar } from './components/common';
import { SpeakModule } from './modules/SpeakModule';
import { NumbersModule } from './modules/NumbersModule';
import { ReadModule } from './modules/ReadModule';
import { ParentArea } from './ParentArea';

type Screen = 'profiles' | 'home' | 'speak' | 'numbers' | 'read' | 'parent';

export function App({ seed }: { seed?: number }) {
  const { t, repo, clock } = useApp();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [screen, setScreen] = useState<Screen>('profiles');
  const [gate, setGate] = useState(false);
  const [streak, setStreak] = useState(0);

  const reload = useCallback(async () => setChildren(await repo.listChildren()), [repo]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (child && screen === 'home') void repo.getEvents(child.id).then((e) => setStreak(currentStreak(e, clock())));
  }, [child, screen, repo, clock]);

  if (!children) return <main className="screen" aria-busy="true" />;

  const parentButton = (
    <IconButton icon="🔒" label={t.parents} speak={false} className="small parent-btn" onClick={() => setGate(true)} testId="parent-btn" />
  );

  let content;
  if (screen === 'parent') {
    content = <ParentArea children={children} onChange={() => void reload()} onExit={() => setScreen(child && children.some((c) => c.id === child.id) ? 'home' : 'profiles')} onPlay={(c) => { setChild(c); setScreen('home'); }} />;
  } else if (screen === 'profiles' || !child) {
    content = (
      <main className="screen">
        <TopBar title={`👣 ${t.appName}`} right={parentButton} />
        {children.length === 0 ? (
          <section className="card center welcome">
            <p className="big-emoji" aria-hidden="true">👣</p>
            <p>{t.welcome}</p>
            <button type="button" className="primary" onClick={() => setGate(true)} data-testid="start">{t.start}</button>
          </section>
        ) : (
          <>
            <h2 className="prompt"><span aria-hidden="true">👋 </span>{t.whoPlays}</h2>
            <div className="tile-grid">
              {children.map((c) => (
                <IconButton key={c.id} icon={c.avatar} label={c.name} className="tile" testId={`profile-${c.name}`} onClick={() => { setChild(c); setScreen('home'); }} />
              ))}
            </div>
          </>
        )}
      </main>
    );
  } else if (screen === 'speak') {
    content = <SpeakModule child={child} onHome={() => setScreen('home')} />;
  } else if (screen === 'numbers') {
    content = <NumbersModule child={child} onHome={() => setScreen('home')} seed={seed} />;
  } else if (screen === 'read') {
    content = <ReadModule child={child} onHome={() => setScreen('home')} seed={seed} />;
  } else {
    content = (
      <main className="screen">
        <TopBar
          title={`${child.avatar} ${child.name}`}
          right={
            <>
              <span className="pill" aria-label={`${t.streak}: ${streak}`} data-testid="home-streak">🔥 {streak}</span>
              <IconButton icon="👥" label={t.whoPlays} className="small" onClick={() => setScreen('profiles')} testId="switch-profile" />
              {parentButton}
            </>
          }
        />
        <div className="tile-grid modules">
          <IconButton icon="🗣️" label={t.speak} className="tile mod-speak" testId="mod-speak" onClick={() => setScreen('speak')} />
          <IconButton icon="🔢" label={t.numbers} className="tile mod-numbers" testId="mod-numbers" onClick={() => setScreen('numbers')} />
          <IconButton icon="📖" label={t.read} className="tile mod-read" testId="mod-read" onClick={() => setScreen('read')} />
        </div>
      </main>
    );
  }

  return (
    <>
      {content}
      {gate && (
        <ParentGate
          seed={seed}
          onCancel={() => setGate(false)}
          onPass={() => { setGate(false); setScreen('parent'); }}
        />
      )}
    </>
  );
}
