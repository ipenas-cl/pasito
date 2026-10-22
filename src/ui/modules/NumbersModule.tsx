import { useEffect, useMemo, useRef, useState } from 'react';
import { createRng, generateTask, initialDifficulty, recordAnswer, taskAnswer, NUMBER_LEVELS, type Child, type Difficulty, type NumberTask } from '../../domain';
import { useApp, useRecorder } from '../context';
import { Celebration, DragChoices, Feedback, IconButton, TopBar } from '../components/common';
import { numberWord } from '../../i18n';

function Objects({ emoji, n, crossed = 0, testId }: { emoji: string; n: number; crossed?: number; testId?: string }) {
  return (
    <div className="objects" data-testid={testId} aria-label={String(n)} role="img">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={i >= n - crossed ? 'crossed' : ''} aria-hidden="true">{emoji}</span>
      ))}
    </div>
  );
}

export function NumbersModule({ child, onHome, seed }: { child: Child; onHome: () => void; seed?: number }) {
  const { t, lang, repo, say } = useApp();
  const record = useRecorder(child);
  const rng = useMemo(() => createRng(seed ?? Date.now()), [seed]);
  const [diff, setDiff] = useState<Difficulty | null>(null);
  const [task, setTask] = useState<NumberTask | null>(null);
  const [result, setResult] = useState<'great' | 'retry' | null>(null);
  const [placed, setPlaced] = useState<number | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void repo.getDifficulty(child.id, 'numbers').then((d) => {
      const level = d ?? initialDifficulty(1);
      setDiff(level);
      setTask(generateTask(rng, level.level));
    });
  }, [repo, child.id, rng]);

  const prompt = (tk: NumberTask) => {
    if (tk.kind === 'count') return t.howMany;
    if (tk.kind === 'recognize') return `${t.whereIs} ${lang === 'es' ? tk.target : numberWord(lang, tk.target)}?`;
    return lang === 'es' ? `${tk.a} ${tk.kind === 'add' ? 'más' : 'menos'} ${tk.b}` : `${tk.a} ${tk.kind === 'add' ? 'plus' : 'minus'} ${tk.b}`;
  };

  useEffect(() => {
    if (task) void say(prompt(task));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  if (!task || !diff) return <main className="screen" aria-busy="true" />;

  const answer = taskAnswer(task);

  const choose = async (value: number) => {
    if (result === 'great') return;
    const ok = value === answer;
    setPlaced(value);
    setResult(ok ? 'great' : 'retry');
    void say(ok ? `${value}. ${t.great}` : t.retry);
    const nextDiff = recordAnswer(diff, ok, 1, NUMBER_LEVELS);
    setDiff(nextDiff);
    await repo.saveDifficulty(child.id, 'numbers', nextDiff);
    await record('numbers', `${task.kind}:${answer}`, ok ? 'good' : 'again');
    if (!ok) window.setTimeout(() => { setPlaced(null); setResult(null); }, 900);
  };

  const next = () => {
    setTask(generateTask(rng, diff.level));
    setResult(null);
    setPlaced(null);
  };

  return (
    <main className="screen">
      <TopBar
        onHome={onHome}
        title={t.numbers}
        right={<span className="pill" data-testid="level" aria-label={`${t.level} ${diff.level}`}>{'⭐'.repeat(diff.level)}</span>}
      />
      <Celebration show={result === 'great'} />
      <section className="card numbers-card" data-kind={task.kind}>
        <IconButton icon="🔊" label={prompt(task)} onClick={() => undefined} className="small prompt-btn" />
        {task.kind === 'count' && <Objects emoji={task.emoji} n={task.count} testId="objects" />}
        {task.kind === 'recognize' && <p className="hint" aria-hidden="true">👂 🔢</p>}
        {(task.kind === 'add' || task.kind === 'sub') && (
          <div className="equation" aria-label={prompt(task)}>
            {task.kind === 'add' ? (
              <>
                <Objects emoji={task.emoji} n={task.a} />
                <span className="op">+</span>
                <Objects emoji={task.emoji} n={task.b} />
              </>
            ) : (
              <>
                <Objects emoji={task.emoji} n={task.a} crossed={task.b} />
                <span className="op">−</span>
                <span className="numeral small-num">{task.b}</span>
              </>
            )}
            <span className="op">=</span>
          </div>
        )}
        {task.kind !== 'recognize' && (
          <div ref={dropRef} className={`dropzone ${result ?? ''}`} data-testid="dropzone" aria-label={t.dropHere}>
            {placed ?? '?'}
          </div>
        )}
        {task.kind === 'recognize' && <div ref={dropRef} className="sr-only" />}
      </section>
      <DragChoices
        options={task.options}
        dropRef={dropRef}
        onDrop={(v) => void choose(v)}
        labelFor={(v) => String(v)}
        render={(v) => <span className="numeral">{v}</span>}
        disabled={result === 'great'}
      />
      <Feedback kind={result} text={result ? t[result] : ''} />
      {result === 'great' && <div className="action-row"><IconButton icon="➡️" label={t.next} onClick={next} className="action next" testId="next" /></div>}
    </main>
  );
}
