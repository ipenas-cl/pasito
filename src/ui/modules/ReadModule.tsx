import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILD_WORDS, LETTERS, STORIES, SYLLABLE_FAMILIES, createRng, estimateWordTimings, isWordComplete, pickSession, placeSyllable,
  shuffle, syllableFamily, syllableTiles, tokenize, wordIndexAt, type CardState, type Child, type Story,
} from '../../domain';
import { useApp, useRecorder } from '../context';
import { Celebration, Feedback, IconButton, TopBar } from '../components/common';

type Tab = 'letters' | 'syllables' | 'build' | 'stories';
const TAB_ICON: Record<Tab, string> = { letters: '🔤', syllables: '🧩', build: '🏗️', stories: '📖' };

export function ReadModule({ child, onHome, seed }: { child: Child; onHome: () => void; seed?: number }) {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab | null>(null);
  const rng = useMemo(() => createRng(seed ?? Date.now()), [seed]);
  if (!tab) {
    return (
      <main className="screen">
        <TopBar onHome={onHome} title={t.read} />
        <div className="tile-grid">
          {(Object.keys(TAB_ICON) as Tab[]).map((k) => (
            <IconButton key={k} icon={TAB_ICON[k]} label={t[k]} className="tile" testId={`tab-${k}`} onClick={() => setTab(k)} />
          ))}
        </div>
      </main>
    );
  }
  const back = (
    <IconButton icon="⬅️" label={t.back} className="small" onClick={() => setTab(null)} testId="back" />
  );
  return (
    <main className="screen">
      <TopBar onHome={onHome} title={t[tab]} right={back} />
      {tab === 'letters' && <LettersGame child={child} rng={rng} />}
      {tab === 'syllables' && <Syllables />}
      {tab === 'build' && <BuildWords child={child} rng={rng} />}
      {tab === 'stories' && <Stories child={child} />}
    </main>
  );
}

/** "Listen and tap the letter": spaced repetition over the phonics alphabet (always Spanish sounds). */
function LettersGame({ child, rng }: { child: Child; rng: () => number }) {
  const { t, say, repo, clock } = useApp();
  const record = useRecorder(child);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [target, setTarget] = useState<string | null>(null);
  const [fb, setFb] = useState<'great' | 'retry' | null>(null);

  const nextRound = (states: Record<string, CardState>) => {
    const ids = LETTERS.map((l) => l.letter);
    const local = Object.fromEntries(ids.filter((id) => states[`read:letter:${id}`]).map((id) => [id, states[`read:letter:${id}`]]));
    const [pick] = pickSession(ids, local, clock(), 1, 1);
    setTarget(pick);
    setFb(null);
  };
  useEffect(() => {
    void repo.getCards(child.id).then((c) => { setCards(c); nextRound(c); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const letter = LETTERS.find((l) => l.letter === target);
  const options = useMemo(() => {
    if (!letter) return [];
    const others = shuffle(rng, LETTERS.filter((l) => l.letter !== letter.letter)).slice(0, 2);
    return shuffle(rng, [letter, ...others]);
  }, [letter, rng]);

  const prompt = () => letter && say(`${letter.sound}… ${letter.word}`, { lang: 'es-CL', rate: 0.7 });
  useEffect(() => {
    void prompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);

  if (!letter) return null;
  const choose = async (l: string) => {
    const ok = l === letter.letter;
    setFb(ok ? 'great' : 'retry');
    void say(ok ? `${letter.letter}, ${letter.word}` : letter.sound, { lang: 'es-CL' });
    const next = await record('read', `letter:${letter.letter}`, ok ? 'good' : 'again', cards[`read:letter:${letter.letter}`]);
    const updated = { ...cards, [next.id]: next };
    setCards(updated);
    if (ok) window.setTimeout(() => nextRound(updated), 1200);
  };

  return (
    <section className="card">
      <Celebration show={fb === 'great'} />
      <IconButton icon="🔊" label={t.findLetter} speak={false} onClick={() => void prompt()} className="action" testId="hear" />
      <div className="big-emoji" aria-hidden="true">{fb === 'great' ? letter.emoji : '❓'}</div>
      <div className="choices">
        {options.map((o) => (
          <button key={o.letter} type="button" className="choice letter" data-testid={`letter-${o.letter}`} aria-label={o.letter} onClick={() => void choose(o.letter)}>
            {o.letter.toUpperCase()}{o.letter}
          </button>
        ))}
      </div>
      <Feedback kind={fb} text={fb ? t[fb] : ''} />
    </section>
  );
}

function Syllables() {
  const { say } = useApp();
  const [family, setFamily] = useState<string>(SYLLABLE_FAMILIES[0]);
  return (
    <section className="card">
      <div className="family-row" role="tablist">
        {SYLLABLE_FAMILIES.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={f === family} className={`chip ${f === family ? 'on' : ''}`} onClick={() => { setFamily(f); void say(syllableFamily(f).join(', '), { lang: 'es-CL', rate: 0.6 }); }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="choices">
        {syllableFamily(family).map((s) => (
          <button key={s} type="button" className="choice syllable" data-testid={`syl-${s}`} onClick={() => void say(s, { lang: 'es-CL', rate: 0.6 })}>
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}

function BuildWords({ child, rng }: { child: Child; rng: () => number }) {
  const { t, lang, say } = useApp();
  const record = useRecorder(child);
  const order = useMemo(() => shuffle(rng, BUILD_WORDS), [rng]);
  const [i, setI] = useState(0);
  const w = order[i % order.length];
  const tiles = useMemo(() => syllableTiles(rng, w), [rng, w]);
  const [built, setBuilt] = useState<string[]>([]);
  const [shake, setShake] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = isWordComplete(w, built);

  useEffect(() => { void say(w.word, { lang: 'es-CL', rate: 0.7 }); }, [w, say]);

  const tap = (tile: string, idx: number) => {
    if (done) return;
    const next = placeSyllable(w, built, tile);
    void say(tile, { lang: 'es-CL', rate: 0.7 });
    if (!next) {
      setShake(`${tile}-${idx}`);
      setMistakes((m) => m + 1);
      window.setTimeout(() => setShake(null), 500);
      return;
    }
    setBuilt(next);
    if (isWordComplete(w, next)) {
      window.setTimeout(() => void say(`${w.word}! ${t.great}`, { lang: 'es-CL' }), 400);
      void record('read', `build:${w.word}`, mistakes === 0 ? 'good' : 'again');
    }
  };
  const used = [...built];
  return (
    <section className="card">
      <Celebration show={done} />
      <p className="hint">{t.tapInOrder}</p>
      <div className="big-emoji" aria-hidden="true">{w.emoji}</div>
      {lang === 'en' && <p className="hint">({w.en})</p>}
      <div className="slots" data-testid="slots" aria-label={built.join('')}>
        {w.syllables.map((_s, k) => (
          <span key={k} className={`slot ${built[k] ? 'filled' : ''}`}>{built[k] ?? ''}</span>
        ))}
      </div>
      <div className="choices">
        {tiles.map((tile, idx) => {
          const usedIdx = used.indexOf(tile);
          const isUsed = usedIdx >= 0;
          if (isUsed) used.splice(usedIdx, 1);
          return (
            <button key={`${tile}-${idx}`} type="button" disabled={isUsed} className={`choice syllable ${shake === `${tile}-${idx}` ? 'shake' : ''}`} data-testid={`tile-${tile}`} onClick={() => tap(tile, idx)}>
              {tile}
            </button>
          );
        })}
      </div>
      <Feedback kind={done ? 'great' : null} text={t.great} />
      {done && (
        <div className="action-row">
          <IconButton icon="➡️" label={t.next} className="action next" testId="next" onClick={() => { setI((x) => x + 1); setBuilt([]); setMistakes(0); }} />
        </div>
      )}
    </section>
  );
}

function Stories({ child }: { child: Child }) {
  const { lang } = useApp();
  const [story, setStory] = useState<Story | null>(null);
  if (story) return <Reader story={story} child={child} onBack={() => setStory(null)} />;
  return (
    <div className="tile-grid">
      {STORIES.map((s) => (
        <IconButton key={s.id} icon={s.emoji} label={s.title[lang]} className="tile" testId={`story-${s.id}`} onClick={() => setStory(s)} />
      ))}
    </div>
  );
}

/** Reads the story aloud and highlights each word, from boundary events or an estimated timeline. */
function Reader({ story, child, onBack }: { story: Story; child: Child; onBack: () => void }) {
  const { t, say, speaker } = useApp();
  const record = useRecorder(child);
  const tokens = useMemo(() => tokenize(story.text), [story]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);
  const runId = useRef(0);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => { clear(); speaker.cancel(); }, [speaker]);

  const play = async () => {
    clear();
    setPlaying(true);
    let gotBoundary = false;
    const startedAt = Date.now();
    const run = ++runId.current;
    // Fallback timeline in case the engine has no boundary events (common on Android/Chrome voices).
    const timings = estimateWordTimings(tokens);
    let acc = 0;
    timings.forEach((ms, idx) => {
      timers.current.push(window.setTimeout(() => { if (!gotBoundary) setCurrent(idx); }, acc));
      acc += ms;
    });
    await say(story.text, {
      lang: 'es-CL',
      rate: 0.8,
      onBoundary: (ci) => { gotBoundary = true; setCurrent(wordIndexAt(tokens, ci)); },
    });
    const remaining = gotBoundary ? 0 : Math.max(0, acc - (Date.now() - startedAt));
    await new Promise((r) => timers.current.push(window.setTimeout(r, remaining)));
    if (run !== runId.current) return; // stopped or restarted
    setPlaying(false);
    setCurrent(-1);
    void record('read', `story:${story.id}`, 'good');
  };

  let w = -1;
  return (
    <section className="card reader">
      <div className="big-emoji" aria-hidden="true">{story.emoji}</div>
      <p className="story" data-testid="story-text">
        {tokens.map((tok, k) => {
          if (!tok.isWord) return <span key={k}>{tok.text}</span>;
          w++;
          const idx = w;
          return (
            <button key={k} type="button" className={`story-word ${idx === current ? 'hl' : ''}`} data-current={idx === current} onClick={() => void say(tok.text, { lang: 'es-CL', rate: 0.7 })}>
              {tok.text}
            </button>
          );
        })}
      </p>
      <div className="action-row">
        <IconButton icon="⬅️" label={t.back} className="action" onClick={onBack} />
        {playing ? (
          <IconButton icon="⏹️" label={t.stop} speak={false} className="action" onClick={() => { runId.current++; clear(); speaker.cancel(); setPlaying(false); setCurrent(-1); }} testId="stop" />
        ) : (
          <IconButton icon="▶️" label={t.readAloud} speak={false} className="action next" onClick={() => void play()} testId="play" />
        )}
      </div>
    </section>
  );
}
