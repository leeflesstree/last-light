import { test, expect } from '@playwright/test';

test('two players share private clues, solve a ship, refresh, and try another encounter', async ({ browser }, testInfo) => {
  test.setTimeout(process.env.PUBLIC_TEST_URL ? 90_000 : 30_000);
  const desktop = await browser.newContext();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const host = await desktop.newPage(), guest = await mobile.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
  try {
    await host.goto('/');
    if (process.env.PUBLIC_TEST_URL) expect(new URL(host.url()).origin).toBe(new URL(process.env.PUBLIC_TEST_URL).origin);
    await host.getByLabel('YOUR NICKNAME').fill('Alex');
    await host.getByRole('button', { name: 'Light the beacon' }).click();
    const code = (await host.getByTestId('room-code').textContent())!;
    await guest.goto(`/?room=${code}`);
    await guest.getByLabel('YOUR NICKNAME').fill('Robin');
    await guest.getByRole('button', { name: 'Join the crew' }).click();
    await expect(guest.getByTestId('room-code')).toHaveText(code);
    for (const page of [host, guest]) await page.getByRole('button', { name: /ready at my station/ }).click();
    await host.getByRole('checkbox', { name: 'Include an unscored practice encounter' }).uncheck();
    await host.getByRole('button', { name: 'Begin the watch' }).click();
    for (const page of [host, guest]) await expect(page.getByRole('heading', { name: 'The Wandering Tern', exact: true })).toBeVisible();
    await expect(host.getByTestId('private-chart')).toBeVisible();
    await expect(host.getByTestId('private-message')).toBeVisible();
    await expect(host.getByTestId('private-weather')).toHaveCount(0);
    await expect(guest.getByTestId('private-chart')).toHaveCount(0);
    await expect(guest.getByTestId('private-weather')).toBeVisible();
    await host.screenshot({ path: testInfo.outputPath('encounter-desktop.png'), fullPage: true });
    await guest.screenshot({ path: testInfo.outputPath('encounter-mobile.png'), fullPage: true });
    const chart = (await host.getByTestId('private-chart').locator('p').textContent())!;
    const message = (await host.getByTestId('private-message').locator('p').textContent())!;
    const weather = (await guest.getByTestId('private-weather').locator('p').textContent())!;
    const codebook = (await guest.getByTestId('private-codebook').locator('p').textContent())!;
    const unsafe = /past the (reef|buoy)/.exec(weather)![1];
    const route = ['A', 'B', 'C'].find(id => !new RegExp(`Route ${id} passes the ([^.]+)`).exec(chart)![1].includes(unsafe))!;
    const request = /request word (ONE|TWO|THREE)/.exec(message)![1];
    const signal = new RegExp(`${request} = (Anchor|Bell|Star)`).exec(codebook)![1];
    for (const [page, stations] of [[host, ['Chart Table', 'Signal Desk']], [guest, ['Stormglass', 'Beacon Console']]] as const) {
      for (const station of stations) await page.getByRole('button', { name: `Share ${station} clue`, exact: true }).click();
    }
    await expect(host.getByLabel('Shared clue log').locator('li')).toHaveCount(4);
    await expect(guest.getByLabel('Shared clue log').locator('li')).toHaveCount(4);
    await guest.reload();
    await expect(guest.getByTestId('private-codebook').locator('p')).toHaveText(codebook);
    await expect(guest.getByLabel('Shared clue log').locator('li')).toHaveCount(4);
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host.getByRole('radio', { name: `Route ${route}`, exact: true }).check();
    await host.getByRole('radio', { name: signal, exact: true }).check();
    await host.getByRole('button', { name: 'Propose answer', exact: true }).click();
    await expect(guest.getByTestId('current-proposal')).toHaveText(`Route ${route} + ${signal}`);
    await guest.getByRole('button', { name: 'Confirm this proposal', exact: true }).click();
    await expect(host.getByText('1/2 keepers confirmed', { exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Update proposal', exact: true }).click();
    await expect(guest.getByText('0/2 keepers confirmed', { exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Confirm this proposal', exact: true }).click();
    await guest.getByRole('button', { name: 'Confirm this proposal', exact: true }).click();
    for (const page of [host, guest]) await expect(page.getByRole('heading', { name: 'Ship rescued!', exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Continue to next ship', exact: true }).click();
    await guest.getByRole('button', { name: 'Continue to next ship', exact: true }).click();
    await expect(guest.getByTestId('current-proposal')).toHaveCount(0);
    await expect(guest.getByText('No clues shared yet.', { exact: false })).toBeVisible();
    await host.getByRole('button', { name: 'Return crew to lobby', exact: true }).click();
    await expect(guest.getByRole('button', { name: /ready at my station/ })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await desktop.close(); await mobile.close(); }
});
