import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context';
import { createGate, checkGate, createRng } from '../../domain';
import { numberWord } from '../../i18n';

/** Large icon-first button. It speaks its label aloud so non-readers know what it does. */
export function IconButton({
  icon, label, onClick, speak = true, className = '', disabled, testId, pressed,
}: {
  icon: ReactNode; label: string; onClick?: () => void; speak?: boolean; className?: string; disabled?: boolean; testId?: string; pressed?: boolean;
}) {
  const { say } = useApp();
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => {
        if (speak) void say(label);
        onClick?.();
      }}
    >
      <span className="icon" aria-hidden="true">{icon}</span>
      <span className="icon-label">{label}</span>
    </button>
  );
}

export function TopBar({ onHome, title, right }: { onHome?: () => void; title?: string; right?: ReactNode }) {
  const { t } = useApp();
  return (
    <header className="topbar">
      {onHome ? <IconButton icon="🏠" label={t.home} onClick={onHome} className="small" testId="home" /> : <span />}
      {title && <h1 className="topbar-title">{title}</h1>}
      <div className="topbar-right">{right}</div>
    </header>
  );
}

const CONFETTI = ['🎉', '⭐', '🌟', '🎈', '✨'];
export function Celebration({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="celebration" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 8.3) % 100}%`, animationDelay: `${(i % 4) * 0.12}s` }}>
          {CONFETTI[i % CONFETTI.length]}
        </span>
      ))}
    </div>
  );
}

/** Live region so feedback is also announced by screen readers. */
export function Feedback({ kind, text }: { kind: 'great' | 'close' | 'retry' | null; text: string }) {
  const icon = kind === 'great' ? '🌟' : kind === 'close' ? '🙂' : kind === 'retry' ? '💪' : '';
  return (
    <div className={`feedback ${kind ?? ''}`} role="status" aria-live="polite" data-testid="feedback">
      {kind && (
        <>
          <span aria-hidden="true">{icon}</span> {text}
        </>
      )}
    </div>
  );
}

/**
 * Parent gate: a multiplication written in words. Pre-readers can't solve it,
 * and it follows the "neutral age screen" pattern from app-store kids guidelines.
 */
export function ParentGate({ onPass, onCancel, seed }: { onPass: () => void; onCancel: () => void; seed?: number }) {
  const { t, lang } = useApp();
  const gate = useMemo(() => createGate(createRng(seed ?? Date.now())), [seed]);
  const [wrong, setWrong] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="modal">
        <h2 id="gate-title">🔒 {t.gateTitle}</h2>
        <p className="gate-q" data-testid="gate-question" data-answer={gate.answer}>
          {t.gateQuestion(numberWord(lang, gate.a), numberWord(lang, gate.b))}
        </p>
        <div className="gate-options">
          {gate.options.map((o, i) => (
            <button
              key={o}
              ref={i === 0 ? first : undefined}
              type="button"
              className="gate-opt"
              onClick={() => (checkGate(gate, o) ? onPass() : (setWrong(true), onCancel()))}
            >
              {o}
            </button>
          ))}
        </div>
        {wrong && <p role="alert">✖</p>}
        <button type="button" className="text-btn" onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  );
}

/**
 * Pointer-based drag and drop that works with touch, mouse and pen.
 * A plain tap (or Enter/Space) also counts as a drop, so it never blocks a child or a keyboard user.
 */
export function DragChoices<T extends string | number>({
  options, onDrop, render, dropRef, labelFor, disabled,
}: {
  options: readonly T[];
  onDrop: (value: T) => void;
  render: (value: T) => ReactNode;
  dropRef: React.RefObject<HTMLElement>;
  labelFor: (value: T) => string;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<{ value: T; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const overTarget = (x: number, y: number) => {
    const r = dropRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  return (
    <div className="choices">
      {options.map((o) => {
        const active = drag?.value === o;
        return (
          <button
            key={String(o)}
            type="button"
            className={`choice ${active && drag?.moved ? 'dragging' : ''}`}
            aria-label={labelFor(o)}
            data-testid={`choice-${o}`}
            disabled={disabled}
            style={active && drag?.moved ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              setDrag({ value: o, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false });
            }}
            onPointerMove={(e) => {
              if (!drag || drag.value !== o) return;
              const dx = e.clientX - drag.x;
              const dy = e.clientY - drag.y;
              const moved = drag.moved || Math.hypot(dx, dy) > 8;
              setDrag({ ...drag, dx, dy, moved });
              dropRef.current?.classList.toggle('over', moved && overTarget(e.clientX, e.clientY));
            }}
            onPointerUp={(e) => {
              if (!drag || drag.value !== o) return;
              dropRef.current?.classList.remove('over');
              const wasDrag = drag.moved;
              setDrag(null);
              suppressClick.current = wasDrag;
              if (wasDrag && overTarget(e.clientX, e.clientY)) onDrop(o);
            }}
            onPointerCancel={() => setDrag(null)}
            onClick={(e) => {
              // A drag already resolved in pointerup; taps and keyboard activation land here.
              if (suppressClick.current && e.detail !== 0) {
                suppressClick.current = false;
                return;
              }
              onDrop(o);
            }}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}
