import type { Listener, Speaker } from '../domain';

/** Adapter over the Web Speech API (SpeechSynthesis). Always resolves, even if the engine never fires `end`. */
export class WebSpeaker implements Speaker {
  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const base = lang.split('-')[0];
    return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(base));
  }

  speak(text: string, { lang, rate = 0.85, onBoundary }: { lang: string; rate?: number; onBoundary?: (i: number) => void }) {
    return new Promise<void>((resolve) => {
      if (!this.supported) return resolve();
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      u.pitch = 1.1;
      const voice = this.pickVoice(lang);
      if (voice) u.voice = voice;
      const safety = window.setTimeout(resolve, 1500 + text.length * 120);
      const done = () => {
        window.clearTimeout(safety);
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      if (onBoundary) u.onboundary = (e) => e.name !== 'sentence' && onBoundary(e.charIndex);
      synth.speak(u);
    });
  }

  cancel() {
    if (this.supported) window.speechSynthesis.cancel();
  }
}

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function getCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Adapter over SpeechRecognition. Audio never leaves the browser's own engine; we keep nothing. */
export class WebListener implements Listener {
  get supported() {
    return !!getCtor();
  }

  listen(lang: string) {
    return new Promise<string[]>((resolve, reject) => {
      const Ctor = getCtor();
      if (!Ctor) return reject(new Error('unsupported'));
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      let settled = false;
      const timer = window.setTimeout(() => rec.stop(), 6000);
      rec.onresult = (e) => {
        settled = true;
        window.clearTimeout(timer);
        const first = e.results[0];
        resolve(Array.from({ length: first.length }, (_, i) => first[i].transcript));
      };
      rec.onerror = (e) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (e.error === 'no-speech') resolve([]);
        else reject(new Error(e.error));
      };
      rec.onend = () => {
        window.clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve([]);
        }
      };
      rec.start();
    });
  }
}
