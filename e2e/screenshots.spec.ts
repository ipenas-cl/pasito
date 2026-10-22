import { test, expect, createChild, passGate } from './fixtures';

const shot = (name: string) => `docs/screenshots/${name}.png`;
test.skip(!process.env.SCREENSHOTS, 'run with npm run screenshots');

test('capture README screenshots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=7');
  await createChild(page, 'Sofi');
  await page.getByTestId('parent-btn').click();
  await passGate(page);
  await page.getByTestId('child-name').fill('Tomi');
  await page.getByRole('button', { name: '🐼' }).click();
  await page.getByTestId('save-child').click();
  await page.getByTestId('exit-parent').click();
  await page.screenshot({ path: shot('profiles') });

  await page.getByTestId('profile-Sofi').click();
  await page.screenshot({ path: shot('home') });

  await page.getByTestId('mod-speak').click();
  await page.getByTestId('stage-sounds').click();
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('feedback')).toContainText('¡Muy bien!');
  await page.screenshot({ path: shot('speak') });
  await page.getByTestId('home').click();

  await page.getByTestId('mod-numbers').click();
  await page.screenshot({ path: shot('numbers') });
  // play a few rounds so the dashboard has data
  for (let i = 0; i < 5; i++) {
    const n = await page.getByTestId('objects').locator('span').count();
    await page.getByTestId(`choice-${n}`).click();
    await page.getByTestId('next').click();
  }
  await page.screenshot({ path: shot('numbers-level2') });
  await page.getByTestId('home').click();

  await page.getByTestId('mod-read').click();
  await page.getByTestId('tab-build').click();
  await page.screenshot({ path: shot('build-words') });
  await page.getByTestId('back').click();
  await page.getByTestId('tab-stories').click();
  await page.getByTestId('story-la-pelota').click();
  await page.getByTestId('play').click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: shot('story') });
  await page.getByTestId('stop').click();
  await page.getByTestId('home').click();

  await page.getByTestId('parent-btn').click();
  await page.screenshot({ path: shot('parent-gate') });
  await passGate(page);
  await page.screenshot({ path: shot('dashboard'), fullPage: true });
});
