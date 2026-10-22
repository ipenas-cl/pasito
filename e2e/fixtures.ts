import { test as base, expect, type Page } from '@playwright/test';

/** Fake SpeechRecognition that "hears" whatever word is on screen (or window.__heard). */
const fakeSpeech = () => {
  class FakeRecognition {
    lang = 'es-CL';
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    start() {
      setTimeout(() => {
        const w = window as unknown as { __heard?: string };
        const heard = w.__heard ?? document.querySelector('[data-testid="speak-word"]')?.textContent ?? '';
        this.onresult?.({ results: [[{ transcript: heard }]] });
        this.onend?.();
      }, 150);
    }
    stop() {}
  }
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
};

export const test = base.extend<{ kidPage: Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript(fakeSpeech);
    await use(page);
  },
  /** A page with one child profile ("Sofi") already created via the parent gate. */
  kidPage: async ({ page }, use) => {
    await page.goto('./?seed=7');
    await createChild(page, 'Sofi');
    await page.getByTestId('profile-Sofi').click();
    await use(page);
  },
});

export async function passGate(page: Page) {
  const answer = await page.getByTestId('gate-question').getAttribute('data-answer');
  await page.getByRole('dialog').getByRole('button', { name: answer!, exact: true }).click();
}

export async function createChild(page: Page, name: string, fromStart = true) {
  if (fromStart) await page.getByTestId('start').or(page.getByTestId('parent-btn')).first().click();
  await passGate(page);
  await page.getByTestId('child-name').fill(name);
  await page.getByTestId('save-child').click();
  await expect(page.getByTestId(`child-card-${name}`)).toBeVisible();
  await page.getByTestId('exit-parent').click();
}

export { expect };
