/**
 * iOS-Douz — browser smoke test
 * ---------------------------------------------------------------------------
 * Drives the real page in headless Chromium with Playwright and checks that
 * the interface behaves the way the game logic says it should:
 *
 *   node tests/browser.smoke.mjs
 *
 * Playwright is an optional *development* dependency; the shipped game itself
 * has no dependencies at all.
 *
 *   npm install --no-save playwright
 *   npx playwright install chromium
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png'
};

/** Tiny static server, so the test runs over http:// like GitHub Pages. */
async function startServer() {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    const file = join(projectRoot, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

let passed = 0;
const failures = [];

function check(description, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${description}`);
  } else {
    failures.push(description);
    console.log(`  ✗ ${description}${detail ? ` — ${detail}` : ''}`);
  }
}

const group = (name) => console.log(`\n${name}`);

const { server, url } = await startServer();
const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(url, { waitUntil: 'networkidle' });

  /* ---------------------------------------------------------------- */
  group('Boot');

  check('the page title is set', (await page.title()).includes('iOS-Douz'));
  check('every icon placeholder was expanded to SVG',
    await page.$$eval('[data-icon]', (nodes) => nodes.every((node) => node.querySelector('svg'))));
  check('the stylesheet applied the design tokens',
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() === '#007AFF'));
  check('a theme was chosen on first paint',
    await page.getAttribute('html', 'data-theme') === 'light');
  check('nine squares are rendered', await page.locator('.cell').count() === 9);
  // Regression guard: component rules set `display: flex`, which must not win
  // over the `hidden` attribute used to keep the dialogs closed.
  check('the alert and sheet backdrops start hidden',
    await page.evaluate(() => ['alertBackdrop', 'sheetBackdrop'].every(
      (id) => getComputedStyle(document.getElementById(id)).display === 'none'
    )));
  check('every square is at least 44px tall',
    await page.$$eval('.cell', (cells) => cells.every((cell) => cell.getBoundingClientRect().height >= 44)));

  /* ---------------------------------------------------------------- */
  group('Playing a round');

  // X takes the top row, O the left column: 0, 3, 1, 4, 2.
  await page.locator('.cell[data-index="0"]').click();
  check('X is drawn in the first square',
    await page.locator('.cell[data-index="0"] .mark__stroke--x').count() === 1);
  check('the turn indicator moved to O',
    await page.locator('#segmentO').evaluate((node) => node.classList.contains('is-selected')));
  check('a filled square is disabled',
    await page.locator('.cell[data-index="0"]').isDisabled());
  check('the square label describes its content',
    (await page.locator('.cell[data-index="0"]').getAttribute('aria-label')).includes('Player X'));

  await page.locator('.cell[data-index="3"]').click();
  await page.locator('.cell[data-index="1"]').click();
  await page.locator('.cell[data-index="4"]').click();
  await page.locator('.cell[data-index="2"]').click();

  check('the winning line is drawn',
    await page.locator('#winLine.is-visible').count() === 1);
  check('the three winning squares are highlighted',
    await page.locator('.cell.is-winning').count() === 3);
  check('the score card shows X as the winner',
    (await page.locator('#scoreX .score-card__unit').textContent()) === 'winner');
  check('the X score increased to 1',
    (await page.locator('#scoreXValue').textContent()) === '1');

  await page.waitForSelector('#alertBackdrop:not([hidden])');
  check('the result alert opens',
    (await page.locator('#alertTitle').textContent()) === 'Player X wins');
  check('the alert reports the score',
    (await page.locator('#alertMessage').textContent()).includes('1 – 0'));
  check('the result was announced to assistive technology',
    (await page.locator('#status').textContent()).includes('Player X wins'));

  await page.locator('.alert__action--bold').click();
  await page.waitForSelector('#alertBackdrop', { state: 'hidden' });
  check('the alert closes after choosing an action', true);
  check('Play again clears the board',
    await page.$$eval('.cell', (cells) => cells.every((cell) => cell.innerHTML.trim() === '')));
  check('Play again keeps the score',
    (await page.locator('#scoreXValue').textContent()) === '1');

  /* ---------------------------------------------------------------- */
  group('Appearance');

  await page.locator('[data-appearance="dark"]').click();
  check('choosing Dark switches the theme attribute',
    await page.getAttribute('html', 'data-theme') === 'dark');
  check('dark mode uses the darker primary colour',
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() === '#0A84FF'));

  await page.reload({ waitUntil: 'networkidle' });
  check('the dark choice survives a reload',
    await page.getAttribute('html', 'data-theme') === 'dark');
  check('the segmented control remembers the choice',
    await page.locator('[data-appearance="dark"]').getAttribute('aria-checked') === 'true');

  await page.locator('[data-appearance="auto"]').click();
  check('Auto falls back to the system preference (light here)',
    await page.getAttribute('html', 'data-theme') === 'light');

  /* ---------------------------------------------------------------- */
  group('Settings switches');

  check('sound starts enabled',
    await page.locator('#soundSwitch').getAttribute('aria-checked') === 'true');
  await page.locator('#soundSwitch').click();
  check('toggling sound flips aria-checked',
    await page.locator('#soundSwitch').getAttribute('aria-checked') === 'false');
  await page.reload({ waitUntil: 'networkidle' });
  check('the sound choice is persisted',
    await page.locator('#soundSwitch').getAttribute('aria-checked') === 'false');

  /* ---------------------------------------------------------------- */
  group('Keyboard');

  await page.locator('.cell[data-index="0"]').focus();
  await page.keyboard.press('ArrowRight');
  check('ArrowRight moves the focus one square right',
    await page.evaluate(() => document.activeElement.dataset.index) === '1');
  await page.keyboard.press('ArrowDown');
  check('ArrowDown moves the focus one square down',
    await page.evaluate(() => document.activeElement.dataset.index) === '4');
  await page.keyboard.press('Enter');
  check('Enter plays the focused square',
    await page.locator('.cell[data-index="4"] .mark__stroke--x').count() === 1);

  await page.locator('#infoButton').click();
  await page.waitForSelector('#sheetBackdrop:not([hidden])');
  check('the about sheet opens', await page.locator('.sheet').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForSelector('#sheetBackdrop', { state: 'hidden' });
  check('Escape closes the sheet', true);

  /* ---------------------------------------------------------------- */
  group('Console');

  check('no console errors were logged', consoleErrors.length === 0, consoleErrors.join(' | '));

  /* ---------------------------------------------------------------- */
  group('Screenshots');

  const shots = [
    { file: 'docs/screenshot-light.png', theme: 'light', viewport: { width: 390, height: 844 } },
    { file: 'docs/screenshot-dark.png', theme: 'dark', viewport: { width: 390, height: 844 } },
    { file: 'docs/screenshot-desktop.png', theme: 'light', viewport: { width: 1280, height: 900 } }
  ];

  for (const shot of shots) {
    const shotPage = await browser.newPage({ viewport: shot.viewport, deviceScaleFactor: 2 });
    await shotPage.goto(url, { waitUntil: 'networkidle' });
    // In a full-page capture the fixed action bar would hide a settings row,
    // so pin it into the normal flow for the screenshot only.
    await shotPage.addStyleTag({ content: '.action-bar{position:static;box-shadow:none;background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;padding-top:0.25rem}' });
    await shotPage.locator(`[data-appearance="${shot.theme}"]`).click();

    // Put a finished round on the board so the screenshot shows a real state.
    for (const index of [0, 3, 1, 4, 2]) {
      await shotPage.locator(`.cell[data-index="${index}"]`).click();
    }
    await shotPage.waitForSelector('#winLine.is-visible');
    await shotPage.locator('.alert__action[data-action="review"]').click();
    await shotPage.waitForSelector('#alertBackdrop', { state: 'hidden' });
    await shotPage.waitForTimeout(400);   // let the spring animations settle

    await shotPage.screenshot({ path: join(projectRoot, shot.file), fullPage: true });
    check(`saved ${shot.file}`, true);
    await shotPage.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${failures.length === 0
  ? `All ${passed} browser checks passed.`
  : `${failures.length} of ${passed + failures.length} browser checks FAILED:\n  - ${failures.join('\n  - ')}`}`);

process.exit(failures.length === 0 ? 0 : 1);
