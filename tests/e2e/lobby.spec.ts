import { test, expect } from '@playwright/test';

test('two browsers join by code, synchronize readiness and restore after refresh', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const host = await contextA.newPage(), guest = await contextB.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
  await host.goto('/');
  await host.getByLabel('YOUR NICKNAME').fill('Alexander');
  await host.getByRole('button', { name: 'Light the beacon' }).click();
  const code = (await host.getByTestId('room-code').textContent())!;
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await guest.goto('/');
  await guest.getByRole('button', { name: 'Join a room', exact: true }).click();
  await guest.getByLabel('YOUR NICKNAME').fill('Robin');
  await guest.getByLabel('ROOM CODE', { exact: true }).fill(code.toLowerCase());
  await guest.getByRole('button', { name: 'Join the crew' }).click();
  for (const page of [host, guest]) {
    await expect(page.getByLabel('Crew members').locator('.crew-name').filter({ hasText: 'Alexander' })).toBeVisible();
    await expect(page.getByLabel('Crew members').locator('.crew-name').filter({ hasText: 'Robin' })).toBeVisible();
    await expect(page.getByText('2 keepers connected.', { exact: false })).toBeVisible();
  }
  await host.getByRole('button', { name: 'I’m ready at my station' }).click();
  await guest.getByRole('button', { name: 'I’m ready at my station' }).click();
  await expect(host.getByText('The crew is ready.', { exact: true })).toBeVisible();
  await expect(guest.getByText('The crew is ready.', { exact: true })).toBeVisible();
  await guest.reload();
  await expect(guest.getByTestId('room-code')).toHaveText(code);
  await expect(guest.getByLabel('Crew members').locator('.crew-member')).toHaveCount(2);
  await expect(guest.getByText('Stormglass + Beacon Console', { exact: true })).toBeVisible();
  await guest.getByRole('button', { name: 'Leave room', exact: true }).click();
  await expect(host.getByLabel('Crew members').locator('.crew-member')).toHaveCount(1);
  expect(errors).toEqual([]);
  await contextA.close(); await contextB.close();
});

test('invitation prefills code; wrong code has a usable error; mobile stays within viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 760 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/?room=ABC234');
  await expect(page.getByLabel('ROOM CODE', { exact: true })).toHaveValue('ABC234');
  await page.getByLabel('YOUR NICKNAME').fill('Mobile keeper');
  await page.getByRole('button', { name: 'Join the crew' }).click();
  await expect(page.getByRole('alert')).toContainText('That room has ended');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByRole('button', { name: 'Light the beacon' }).click();
  await expect(page.getByTestId('room-code')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});
