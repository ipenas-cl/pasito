import AxeBuilder from '@axe-core/playwright';
import { test, expect, createChild, passGate } from './fixtures';

test('first run creates a profile behind the parent gate', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('start')).toBeVisible();
  await createChild(page, 'Tomi');
  await expect(page.getByTestId('profile-Tomi')).toBeVisible();
  // Data survives a reload (IndexedDB).
  await page.reload();
  await expect(page.getByTestId('profile-Tomi')).toBeVisible();
});

test('speak: hear a word, say it, get feedback', async ({ kidPage: page }) => {
  await page.getByTestId('mod-speak').click();
  await expect(page.getByTestId('stage-words')).toBeDisabled();
  await page.getByTestId('stage-sounds').click();
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('feedback')).toContainText('¡Muy bien!');
  await page.getByTestId('next').click();
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = 'avión'));
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('feedback')).toContainText('prueba de nuevo');
});

test('numbers: drag the answer into the box', async ({ kidPage: page }) => {
  await page.getByTestId('mod-numbers').click();
  const count = await page.getByTestId('objects').locator('span').count();
  const choice = page.getByTestId(`choice-${count}`);
  const drop = page.getByTestId('dropzone');
  const from = (await choice.boundingBox())!;
  const to = (await drop.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(drop).toHaveText(String(count));
  await expect(page.getByTestId('feedback')).toContainText('¡Muy bien!');
});

test('read: build a word and read a story with highlighting', async ({ kidPage: page }) => {
  await page.getByTestId('mod-read').click();
  await page.getByTestId('tab-syllables').click();
  await expect(page.getByTestId('syl-ma')).toBeVisible();
  await page.getByTestId('back').click();
  await page.getByTestId('tab-stories').click();
  await page.getByTestId('story-el-sapo').click();
  await page.getByTestId('play').click();
  await expect(page.locator('[data-current="true"]')).toHaveCount(1);
  await page.getByTestId('stop').click();
});

test('parent dashboard shows progress and streak; English toggle', async ({ kidPage: page }) => {
  await page.getByTestId('mod-speak').click();
  await page.getByTestId('stage-sounds').click();
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('feedback')).toContainText('¡Muy bien!');
  await page.getByTestId('home').click();
  await expect(page.getByTestId('home-streak')).toHaveText('🔥 1');
  await page.getByTestId('parent-btn').click();
  await passGate(page);
  await expect(page.getByTestId('child-card-Sofi').getByTestId('streak')).toHaveText('1 día');
  await page.getByTestId('lang-en').click();
  await expect(page.getByText('Current streak')).toBeVisible();
  await page.getByTestId('exit-parent').click();
  await expect(page.getByTestId('mod-speak')).toHaveAccessibleName('Speak');
});

test('kid view has no links and passes axe', async ({ kidPage: page }) => {
  await expect(page.locator('a[href]')).toHaveCount(0);
  for (const mod of ['mod-speak', 'mod-numbers', 'mod-read']) {
    await page.getByTestId(mod).click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    await page.getByTestId('home').click();
  }
});

test('works offline after the first visit (PWA)', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // controlled by the SW now
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('start')).toBeVisible();
  await context.setOffline(false);
});
