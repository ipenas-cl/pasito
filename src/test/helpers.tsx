import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider, type Services } from '../ui/context';
import { MemoryRepository } from '../infra/memoryRepository';
import type { Listener, Speaker } from '../domain';

export class FakeSpeaker implements Speaker {
  supported = true;
  spoken: string[] = [];
  async speak(text: string) { this.spoken.push(text); }
  cancel() {}
}
export class FakeListener implements Listener {
  constructor(public supported = true, public heard: string[] = []) {}
  async listen() { return this.heard; }
}

export function setup(ui: ReactNode, overrides: Partial<Services> = {}) {
  const services: Services = {
    repo: new MemoryRepository(),
    speaker: new FakeSpeaker(),
    listener: new FakeListener(),
    now: () => new Date(2026, 9, 22, 10).getTime(),
    ...overrides,
  };
  const utils = render(<AppProvider services={services} lang="es">{ui}</AppProvider>);
  return { ...utils, services };
}
