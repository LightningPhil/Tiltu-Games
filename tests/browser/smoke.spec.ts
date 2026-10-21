import { test as base, expect, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const test = base.extend<{ runtimeChecks: void }>({
  runtimeChecks: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use();
    expect(errors, 'browser runtime errors').toEqual([]);
  }, { auto: true }],
});

const save = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('grid-club-v1') || '{}'));
const openGame = (page: Page, game: string) => page.locator(`.game-card[data-game="${game}"]`).click();

test('all 54 games open at the Pages path without runtime services', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto('./');
  await expect(page).toHaveTitle(/Tiltu’s Games/);
  await expect(page.locator('.game-card')).toHaveCount(54);
  const games = await page.locator('.game-card').evaluateAll(cards => cards.map(card => ({
    id: (card as HTMLElement).dataset.game!, name: card.querySelector('h2')!.textContent!,
  })));
  for (const game of games) {
    await test.step(game.name, async () => {
      await openGame(page, game.id);
      await expect(page.locator('#page-title')).toHaveText(game.name);
      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('.port-error')).toHaveCount(0);
      await page.getByRole('button', { name: 'Tiltu’s Games home', exact: true }).click();
      await expect(page.locator('.game-card')).toHaveCount(54);
    });
  }
  // All application code, graphics, audio and workers are inside the initial HTML.
  expect(requests).toHaveLength(1);
  expect(requests[0]).toBe(new URL('./', baseURL).href);
});

test('a human move receives a browser-worker reply and survives reload', async ({ page }) => {
  await page.goto('./');
  await openGame(page, 'four');
  const workers: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  await page.locator('[data-column="3"]').click();
  await expect.poll(async () => (await save(page)).four.moves.length).toBe(2);
  expect(workers.length, 'computer opponent should run in a local Web Worker').toBeGreaterThan(0);
  const before = (await save(page)).four.board;
  expect(before.filter(Boolean)).toHaveLength(2);
  await page.reload();
  await expect(page.locator('#page-title')).toHaveText('Four in a Row');
  expect((await save(page)).four.board).toEqual(before);
  await page.locator('#undo').click();
  await expect.poll(async () => (await save(page)).four.moves.length).toBe(0);
});

test('arcade round starts, responds to input and pauses on navigation', async ({ page }) => {
  await page.goto('./?game=whacker');
  await expect(page.locator('#page-title')).toHaveText('Whack-a-Party!');
  await page.locator('#start').click();
  await expect(page.locator('#round-panel')).toBeVisible();
  await page.keyboard.press('1');
  await page.getByRole('button', { name: 'Tiltu’s Games home', exact: true }).click();
  await expect(page.locator('.game-card')).toHaveCount(54);
  await openGame(page, 'whacker');
  await expect(page.locator('#page-title')).toHaveText('Whack-a-Party!');
  await expect(page.locator('#overlay-title')).toHaveText('Paused.');
});

test('phone layout supports discovery, navigation, themes and license access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('searchbox').fill('Sudoku');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await openGame(page, 'sudoku');
  await expect(page.locator('#page-title')).toHaveText('Sudoku');
  await page.locator('#game-select').selectOption('four');
  await expect(page.locator('[data-column]')).toHaveCount(7);
  await page.locator('#theme').selectOption('woodland');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'woodland');
  await page.locator('#license-info').click();
  await expect(page.getByRole('dialog')).toContainText('Copyright © 2026 Philip Leichauer');
  await expect(page.getByRole('dialog')).toContainText('three.js 0.128.0');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('deployed HTML carries the license and complete third-party notices', async ({ request }) => {
  const [home, license, notices] = await Promise.all([
    request.get('./'), request.get('LICENSE.txt'), request.get('THIRD_PARTY_NOTICES.txt'),
  ]);
  expect(home.ok()).toBe(true); expect(license.ok()).toBe(true); expect(notices.ok()).toBe(true);
  const html = await home.text(), licenseText = await license.text(), noticeText = await notices.text();
  expect(html).toContain(licenseText);
  expect(html).toContain(noticeText);
  expect(licenseText).toContain('PROPRIETARY PERSONAL-PLAY LICENSE');
  expect(noticeText).toContain('chess.js 1.4.0');
  expect(noticeText).toContain('three.js 0.128.0');
  expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+rel="stylesheet"/i);
});

test('an unmodified HTML copy plays from disk with the network disabled', async ({ page, context, request }) => {
  // Download the exact site response so this also checks the published artifact.
  const response = await request.get('./');
  expect(response.ok()).toBe(true);
  const directory = await mkdtemp(join(tmpdir(), 'tiltu-offline-'));
  try {
    const file = join(directory, 'index.html');
    await writeFile(file, await response.body());
    await context.setOffline(true);
    await page.goto(pathToFileURL(file).href);
    await expect(page.locator('.game-card')).toHaveCount(54);
    await openGame(page, 'four');
    await page.locator('[data-column="3"]').click();
    await expect.poll(async () => (await save(page)).four.moves.length).toBe(2);
    await page.getByRole('button', { name: 'Tiltu’s Games home', exact: true }).click();
    await openGame(page, 'horizon');
    await expect(page.locator('#page-title')).toHaveText('Neon Horizon');
    await expect(page.locator('.port-error')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tiltu’s Games home', exact: true }).click();
    await page.locator('#license-info').click();
    await expect(page.getByRole('dialog')).toContainText('PROPRIETARY PERSONAL-PLAY LICENSE');
  } finally {
    await page.close().catch(() => {});
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('tiltu-offline-')) {
      throw new Error('Refusing to remove a directory outside the temporary test folder');
    }
    await rm(directory, { recursive: true, force: true });
  }
});
