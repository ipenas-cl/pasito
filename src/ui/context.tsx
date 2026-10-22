import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Child, Listener, ProgressRepository, Speaker, ModuleId, CardState, Grade } from '../domain';
import { newCard, review } from '../domain';
import { DICTS, speechLang, type Dict, type Lang } from '../i18n';

export interface Services {
  repo: ProgressRepository;
  speaker: Speaker;
  listener: Listener;
  now?: () => number;
}

interface AppCtx extends Services {
  lang: Lang;
  setLang(l: Lang): void;
  t: Dict;
  say(text: string, opts?: { lang?: string; onBoundary?: (i: number) => void; rate?: number }): Promise<void>;
  clock(): number;
}

const Ctx = createContext<AppCtx | null>(null);

const initialLang = (): Lang => {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pasito.lang') : null;
  return stored === 'en' || stored === 'es' ? stored : 'es';
};

export function AppProvider({ services, children, lang: forced }: { services: Services; children: ReactNode; lang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(forced ?? initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('pasito.lang', l);
    document.documentElement.lang = l === 'es' ? 'es-CL' : 'en';
  }, []);
  const value = useMemo<AppCtx>(() => {
    const clock = services.now ?? Date.now;
    return {
      ...services,
      lang,
      setLang,
      t: DICTS[lang],
      clock,
      say: (text, opts = {}) => services.speaker.speak(text, { lang: opts.lang ?? speechLang(lang), rate: opts.rate, onBoundary: opts.onBoundary }),
    };
  }, [services, lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}

/** Records an answer: logs the event and updates the spaced-repetition card. */
export function useRecorder(child: Child) {
  const { repo, clock } = useApp();
  return useCallback(
    async (module: ModuleId, itemId: string, grade: Grade, existing?: CardState): Promise<CardState> => {
      const now = clock();
      const key = `${module}:${itemId}`;
      const base = existing ?? (await repo.getCards(child.id))[key] ?? newCard(key, now);
      const next = review(base, grade, now);
      await repo.saveCard(child.id, next);
      await repo.logEvent({ childId: child.id, module, itemId, correct: grade !== 'again', at: now });
      return next;
    },
    [repo, clock, child.id],
  );
}
