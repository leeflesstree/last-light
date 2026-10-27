import { test, expect, type Page, type Locator } from '@playwright/test';
import { solveClueText } from '../helpers/puzzle-notes';
import type { PuzzleFamily, RouteId } from '../../src/shared/protocol';

// Reach controls through the real tab order; never focus or click them programmatically.
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 100; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Control was not reachable through the keyboard tab order');
}
async function activate(page: Page, target: Locator) { await tabTo(page, target); await page.keyboard.press('Space'); }
async function radio(page: Page, name: string, value: string) {
  const choices = page.locator(`input[name="${name}"]`);
  const values = await choices.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
  const checked = await choices.evaluateAll(inputs => inputs.findIndex(input => (input as HTMLInputElement).checked));
  await tabTo(page, choices.nth(Math.max(0, checked)));
  for (let i = 0; i < (values.indexOf(value) - Math.max(0, checked) + values.length) % values.length; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
}

test('keyboard-only crew marks the chart, recovers markers, and wins a full watch', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const desktop = await browser.newContext({ reducedMotion: 'reduce' });
  const phone = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' });
  const host = await desktop.newPage(), guest = await phone.newPage();
  try {
    await host.goto('/');
    await tabTo(host, host.getByLabel('YOUR NICKNAME')); await host.keyboard.type('Alex');
    await activate(host, host.getByRole('button', { name: 'Light the beacon' }));
    const code = (await host.getByTestId('room-code').textContent())!;
    await guest.goto(`/?room=${code}`);
    await tabTo(guest, guest.getByLabel('YOUR NICKNAME')); await guest.keyboard.type('Robin');
    await activate(guest, guest.getByRole('button', { name: 'Join the crew', exact: true }));
    await expect(guest.getByTestId('room-code')).toHaveText(code);
    await activate(host, host.getByRole('checkbox', { name: 'Include an unscored practice encounter' }));
    for (const page of [host, guest]) await activate(page, page.getByRole('button', { name: /ready at my station/ }));
    await activate(host, host.getByRole('button', { name: 'Begin the watch', exact: true }));
    await expect(host.getByRole('heading', { name: 'The shared sea chart' })).toBeVisible();
    await activate(host, host.getByRole('button', { name: 'Mark Route A: Inspect', exact: true }));
    await expect(guest.getByRole('status').filter({ hasText: 'Alex: Route A' })).toContainText('Inspect');
    await guest.reload();
    await expect(guest.getByRole('status').filter({ hasText: 'Alex: Route A' })).toContainText('Inspect');
    await activate(guest, guest.getByRole('button', { name: 'Mark Route B: Avoid', exact: true }));
    await expect(host.getByRole('status').filter({ hasText: 'Robin: Route B' })).toContainText('Avoid');
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host.screenshot({ path: testInfo.outputPath('chart-desktop.png'), fullPage: true });
    await guest.screenshot({ path: testInfo.outputPath('chart-mobile.png'), fullPage: true });
    for (let ship = 0; ship < 3; ship++) {
      const notes: Record<string, string> = {};
      for (const [page, ids] of [[host, ['chart', 'message']], [guest, ['weather', 'codebook']]] as const) {
        for (const id of ids) {
          notes[id] = (await page.getByTestId(`private-${id}`).locator('p').textContent())!;
          const station = await page.getByTestId(`private-${id}`).locator('.eyebrow').textContent();
          await activate(page, page.getByRole('button', { name: `Share ${station} clue`, exact: true }));
        }
      }
      const family = await host.locator('.encounter-screen').getAttribute('data-family') as PuzzleFamily;
      const routes = await host.locator('input[name="route"]').evaluateAll(inputs => inputs.map(input => input.getAttribute('value'))) as RouteId[];
      const answer = solveClueText(family, routes, notes);
      await radio(host, 'route', answer.routeId); await radio(host, 'signal', answer.signalId);
      await activate(host, host.getByRole('button', { name: 'Propose answer', exact: true }));
      for (const page of [host, guest]) await activate(page, page.getByRole('button', { name: 'Confirm this proposal', exact: true }));
      await expect(guest.getByTestId('result-explanation')).toBeVisible();
      await expect(host.locator('.chart-rescued')).toHaveCSS('animation-name', 'none');
      if (ship < 2) {
        for (const page of [host, guest]) await activate(page, page.getByRole('button', { name: 'Continue to next ship', exact: true }));
        await expect(host.getByText('No route markers yet. Each keeper can place one.', { exact: true })).toBeVisible();
      }
    }
    await expect(guest.getByRole('heading', { name: 'The coast is safe!', exact: true })).toBeVisible();
    await activate(host, host.getByRole('button', { name: 'Play again', exact: true }));
    await expect(guest.getByTestId('room-code')).toHaveText(code);
  } finally { await desktop.close(); await phone.close(); }
});
