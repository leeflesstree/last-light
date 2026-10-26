import { test, expect, type Page } from '@playwright/test';
import { solveClueText } from '../helpers/puzzle-notes';
import type { PuzzleFamily, RouteId } from '../../src/shared/protocol';

test('a crew practices, wins a full watch, replays in the same room, and completes a defeat', async ({ browser }, testInfo) => {
  test.setTimeout(process.env.PUBLIC_TEST_URL ? 180_000 : 45_000);
  const desktop = await browser.newContext();
  const phone = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' });
  const host = await desktop.newPage(), guest = await phone.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
  async function ready() {
    for (const page of [host, guest]) await expect(page.getByRole('button', { name: /ready at my station/ })).toBeVisible();
    for (const page of [host, guest]) await page.getByRole('button', { name: /ready at my station/ }).click();
    await host.getByRole('button', { name: 'Begin the watch', exact: true }).click();
  }
  async function resolve(correct: boolean) {
    await expect(host.getByTestId('private-chart')).toBeVisible();
    await expect(guest.getByTestId('private-weather')).toBeVisible();
    const notes: Record<string, string> = {};
    for (const [page, ids] of [[host, ['chart', 'message']], [guest, ['weather', 'codebook']]] as const) {
      for (const id of ids) notes[id] = (await page.getByTestId(`private-${id}`).locator('p').textContent())!;
    }
    const family = await host.locator('.encounter-screen').getAttribute('data-family') as PuzzleFamily;
    const routes = await host.locator('input[name="route"]').evaluateAll(inputs => inputs.map(input => input.getAttribute('value'))) as RouteId[];
    const answer = solveClueText(family, routes, notes);
    const signals = await host.locator('input[name="signal"]').evaluateAll(inputs => inputs.map(input => input.getAttribute('value')));
    const signal = correct ? answer.signalId : signals.find(value => value !== answer.signalId)!;
    await host.getByRole('radio', { name: `Route ${answer.routeId}`, exact: true }).check();
    await host.getByRole('radio', { name: signal, exact: true }).check();
    await host.getByRole('button', { name: 'Propose answer', exact: true }).click();
    for (const page of [host, guest]) await page.getByRole('button', { name: 'Confirm this proposal', exact: true }).click();
    await expect(guest.getByTestId('result-explanation')).toBeVisible();
  }
  async function advance() {
    const id = await host.locator('.encounter-screen').getAttribute('data-encounter');
    for (const page of [host, guest]) await page.getByRole('button', { name: /^Continue to/ }).click();
    for (const page of [host, guest]) await expect(page.locator('.encounter-screen')).not.toHaveAttribute('data-encounter', id!);
  }
  try {
    await host.goto('/');
    await host.getByLabel('YOUR NICKNAME').fill('Alex');
    await host.getByRole('button', { name: 'Light the beacon' }).click();
    const code = (await host.getByTestId('room-code').textContent())!;
    await guest.goto(`/?room=${code}`);
    await guest.getByLabel('YOUR NICKNAME').fill('Robin');
    await guest.getByRole('button', { name: 'Join the crew', exact: true }).click();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
    await ready();
    await expect(host.getByRole('heading', { name: 'The Practice Boat', exact: true })).toBeVisible();
    await expect(host.getByRole('radio', { name: /^Route/ })).toHaveCount(2);
    await resolve(false);
    await expect(guest.getByTestId('damage-count')).toHaveText('Damage: 0/3');
    await advance();
    for (const family of ['SAFE_PASSAGE', 'BROKEN_COMPASS', 'SIGNAL_FOG']) {
      await expect(host.locator('.encounter-screen')).toHaveAttribute('data-family', family);
      if (family === 'BROKEN_COMPASS') {
        await guest.reload();
        await expect(guest.locator('.encounter-screen')).toHaveAttribute('data-family', family);
        expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await host.screenshot({ path: testInfo.outputPath('compass-desktop.png'), fullPage: true });
        await guest.screenshot({ path: testInfo.outputPath('compass-mobile.png'), fullPage: true });
      }
      await resolve(true);
      if (family !== 'SIGNAL_FOG') await advance();
    }
    for (const page of [host, guest]) {
      await expect(page.getByRole('heading', { name: 'The coast is safe!', exact: true })).toBeVisible();
      await expect(page.getByTestId('session-summary')).toHaveText('3 ships rescued · 0 damage marks · 3 ships guided');
    }
    await host.screenshot({ path: testInfo.outputPath('victory.png'), fullPage: true });
    await host.getByRole('button', { name: 'Play again', exact: true }).click();
    await expect(guest.getByRole('button', { name: /ready at my station/ })).toBeVisible();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
    await host.getByRole('checkbox', { name: 'Include an unscored practice encounter' }).uncheck();
    await ready();
    for (let i = 0; i < 3; i++) { await resolve(false); if (i < 2) await advance(); }
    for (const page of [host, guest]) {
      await expect(page.getByRole('heading', { name: 'The watch has ended.', exact: true })).toBeVisible();
      await expect(page.getByTestId('session-summary')).toHaveText('0 ships rescued · 3 damage marks · 3 ships guided');
    }
    expect(errors).toEqual([]);
  } finally { await desktop.close(); await phone.close(); }
});
