import { test, expect, passGate } from './fixtures';

const SHOTS = process.env.QA_SHOTS;
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

test('full parent journey: create, play, progress, switch child, no dead ends', async ({ page }) => {
  await page.goto('./?seed=7');
  // First run: welcome → parent gate → dashboard.
  await page.getByTestId('start').click();
  await passGate(page);
  await page.getByTestId('child-name').fill('Emiliano');
  await page.getByTestId('save-child').click();
  const card = page.getByTestId('child-card-Emiliano');
  await expect(card).toBeVisible();
  // Empty week renders a friendly message, not a dashed line of 1px bars.
  await expect(card.getByTestId('empty-chart')).toBeVisible();
  await expect(card.locator('svg.spark')).toHaveCount(0);
  await shot(page, '01-dashboard-new-child');

  // The dashboard offers a direct way to play with the child.
  await page.getByTestId('play-Emiliano').click();
  await expect(page.getByTestId('mod-speak')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Emiliano/ })).toBeVisible();
  await shot(page, '02-home-emiliano');

  // Play numbers by tapping the right answer, then go back home.
  await page.getByTestId('mod-numbers').click();
  await expect(page.getByTestId('objects').locator('span').first()).toBeVisible();
  const count = await page.getByTestId('objects').locator('span').count();
  await page.getByTestId(`choice-${count}`).click();
  await expect(page.getByTestId('feedback')).toContainText('¡Muy bien!');
  await shot(page, '03-playing-numbers');
  await page.getByTestId('home').click();

  // Speak and read are reachable and have a way back.
  await page.getByTestId('mod-speak').click();
  await shot(page, '04-playing-speak');
  await page.getByTestId('home').click();
  await page.getByTestId('mod-read').click();
  await shot(page, '05-playing-read');
  await page.getByTestId('home').click();
  await expect(page.getByTestId('home-streak')).toHaveText('🔥 1');

  // Progress updates in the dashboard.
  await page.getByTestId('parent-btn').click();
  await passGate(page);
  await expect(card.getByTestId('streak')).toHaveText('1 día');
  await expect(card.locator('svg.spark')).toBeVisible();
  await shot(page, '06-dashboard-progress');

  // Add a second child and play with them straight from the dashboard.
  await page.getByTestId('child-name').fill('Sofi');
  await page.getByTestId('save-child').click();
  await page.getByTestId('play-Sofi').click();
  await expect(page.getByRole('heading', { name: /Sofi/ })).toBeVisible();

  // Child picker from home, then back to Emiliano.
  await page.getByTestId('switch-profile').click();
  await expect(page.getByTestId('profile-Emiliano')).toBeVisible();
  await expect(page.getByTestId('profile-Sofi')).toBeVisible();
  await shot(page, '07-child-picker');
  await page.getByTestId('profile-Emiliano').click();
  await expect(page.getByTestId('home-streak')).toHaveText('🔥 1');

  // Exiting the dashboard returns to where you were; refresh keeps profiles.
  await page.getByTestId('parent-btn').click();
  await passGate(page);
  await page.getByTestId('exit-parent').click();
  await expect(page.getByTestId('mod-speak')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('profile-Emiliano')).toBeVisible();
});

test('works without any speech APIs (graceful degradation)', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition; delete w.webkitSpeechRecognition; delete w.speechSynthesis;
    Object.defineProperty(window, 'speechSynthesis', { value: undefined });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByTestId('start').click();
  await passGate(page);
  await page.getByTestId('child-name').fill('Ana');
  await page.getByTestId('save-child').click();
  await page.getByTestId('play-Ana').click();
  for (const m of ['mod-speak', 'mod-numbers', 'mod-read']) {
    await page.getByTestId(m).click();
    await page.getByTestId('home').click();
  }
  expect(errors).toEqual([]);
  await ctx.close();
});
