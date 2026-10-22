import { useCallback, useEffect, useMemo, useState } from 'react';
import { SPEAK_ITEMS, SPEAK_STAGES, evaluateAttempt, isMastered, pickSession, unlockedStages, type CardState, type Child, type Feedback as Fb, type SpeakStage } from '../../domain';
import { useApp, useRecorder } from '../context';
import { Celebration, Feedback, IconButton, TopBar } from '../components/common';

const STAGE_ICON: Record<SpeakStage, string> = { sounds: '🔤', syllables: '🎵', words: '🧸', phrases: '💬' };
const SESSION = 6;

export function SpeakModule({ child, onHome }: { child: Child; onHome: () => void }) {
  const { t, lang, repo, clock, say, listener } = useApp();
  const record = useRecorder(child);
  const [cards, setCards] = useState<Record<string, CardState> | null>(null);
  const [stage, setStage] = useState<SpeakStage | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [feedback, setFeedback] = useState<Fb | null>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(false);

  useEffect(() => {
    void repo.getCards(child.id).then(setCards);
  }, [repo, child.id]);

  const mastered = useMemo(
    () => new Set(Object.values(cards ?? {}).filter(isMastered).map((c) => c.id.replace(/^speak:/, ''))),
    [cards],
  );
  const unlocked = unlockedStages(mastered);

  const start = (s: SpeakStage) => {
    const ids = SPEAK_ITEMS.filter((x) => x.stage === s).map((x) => x.id);
    const states = Object.fromEntries(ids.filter((id) => cards?.[`speak:${id}`]).map((id) => [id, cards![`speak:${id}`]]));
    setStage(s);
    setQueue(pickSession(ids, states, clock(), SESSION));
    setPos(0);
    setFeedback(null);
  };

  const item = SPEAK_ITEMS.find((x) => x.id === queue[pos]);
  const word = item ? (lang === 'es' ? item.es : item.en) : '';

  const hear = useCallback(() => (word ? say(word, { rate: 0.7 }) : Promise.resolve()), [word, say]);
  useEffect(() => {
    if (item) void hear();
  }, [item, hear]);

  const grade = async (fb: Fb) => {
    if (!item) return;
    setFeedback(fb);
    const next = await record('speak', item.id, fb === 'great' ? 'good' : fb === 'close' ? 'good' : 'again', cards?.[`speak:${item.id}`]);
    setCards((c) => ({ ...c, [next.id]: next }));
    void say(fb === 'great' ? t.great : fb === 'close' ? t.close : t.retry);
  };

  const attempt = async () => {
    setMicError(false);
    setListening(true);
    try {
      const heard = await listener.listen(lang === 'es' ? 'es-CL' : 'en-US');
      await grade(evaluateAttempt(word, heard).feedback);
    } catch {
      setMicError(true);
    } finally {
      setListening(false);
    }
  };

  if (!stage) {
    return (
      <main className="screen">
        <TopBar onHome={onHome} title={t.speak} />
        <div className="tile-grid">
          {SPEAK_STAGES.map((s) => {
            const open = unlocked.includes(s);
            return (
              <IconButton
                key={s}
                icon={open ? STAGE_ICON[s] : '🔒'}
                label={open ? t[`stage_${s}`] : `${t[`stage_${s}`]} · ${t.locked}`}
                className={`tile ${open ? '' : 'locked'}`}
                disabled={!open}
                testId={`stage-${s}`}
                onClick={() => start(s)}
              />
            );
          })}
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="screen center">
        <TopBar onHome={onHome} title={t.speak} />
        <Celebration show />
        <p className="big-emoji" aria-hidden="true">🏆</p>
        <h2 data-testid="session-done">{t.sessionDone}</h2>
        <IconButton icon="🔁" label={t.playAgain} className="tile" onClick={() => setStage(null)} />
      </main>
    );
  }

  return (
    <main className="screen">
      <TopBar onHome={onHome} title={t[`stage_${stage}`]} right={<span className="pill" aria-label={`${pos + 1} / ${queue.length}`}>{pos + 1}/{queue.length}</span>} />
      <Celebration show={feedback === 'great'} />
      <section className="card speak-card" aria-live="polite">
        <div className="big-emoji" aria-hidden="true">{item.emoji}</div>
        <p className="word" data-testid="speak-word">{word}</p>
      </section>
      <div className="action-row">
        <IconButton icon="🔊" label={t.listen} speak={false} onClick={() => void hear()} className="action" testId="hear" />
        {listener.supported ? (
          <IconButton icon={listening ? '👂' : '🎤'} label={listening ? t.listening : t.sayIt} speak={false} onClick={() => void attempt()} className={`action mic ${listening ? 'pulse' : ''}`} disabled={listening} testId="mic" />
        ) : (
          <IconButton icon="👍" label={t.iSaidIt} onClick={() => void grade('great')} className="action" testId="self-check" />
        )}
        {feedback && (
          <IconButton icon="➡️" label={t.next} onClick={() => { setFeedback(null); setPos((p) => p + 1); }} className="action next" testId="next" />
        )}
      </div>
      <Feedback kind={feedback} text={feedback ? t[feedback] : ''} />
      {micError && <p className="hint" role="alert">🎤✖ {t.micDenied}</p>}
    </main>
  );
}
