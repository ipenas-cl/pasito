import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { AppProvider } from './ui/context';
import { App } from './ui/App';
import { IdbRepository } from './infra/idbRepository';
import { WebListener, WebSpeaker } from './infra/webSpeech';
import './styles.css';

registerSW({ immediate: true });

const services = { repo: new IdbRepository(), speaker: new WebSpeaker(), listener: new WebListener() };
// Optional fixed seed for deterministic screenshots/e2e (?seed=123). Never affects stored data.
const seedParam = new URLSearchParams(location.search).get('seed');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider services={services}>
      <App seed={seedParam ? Number(seedParam) : undefined} />
    </AppProvider>
  </StrictMode>,
);
