import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseUrl = process.env.TRUPY_URL ?? 'http://127.0.0.1:4173/Trupy/';
const browser = await chromium.launch({ headless: true });
const errors = [];

async function clickStart(page) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box, 'Game canvas must be visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * .69);
}

async function runDesktop() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  await page.screenshot({ path: 'test-output/menu-desktop.png', fullPage: true });
  const title = await page.title();
  assert.match(title, /Trupy/);
  await clickStart(page);
  await page.waitForSelector('.player-card');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-output/game-desktop.png', fullPage: true });
  assert.equal(await page.locator('.game-ui').count(), 1);
  assert.equal(await page.locator('#coins-label').textContent(), '35');
  await page.keyboard.press('m');
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  await page.screenshot({ path: 'test-output/map-desktop.png', fullPage: true });
  await page.locator('.close-button').click();
  await page.keyboard.press('q');
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  assert.match(await page.locator('#panel-title').textContent(), /Задания/);
  await page.close();
}

async function runMobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`mobile console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`mobile pageerror: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await clickStart(page);
  await page.waitForSelector('.mobile-controls');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-output/game-mobile.png', fullPage: true });
  const display = await page.locator('.mobile-controls').evaluate((node) => getComputedStyle(node).display);
  assert.notEqual(display, 'none');
  const joystickBox = await page.locator('#joystick').boundingBox();
  assert.ok(joystickBox && joystickBox.width > 80);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-output/game-mobile-landscape.png', fullPage: true });
  const landscapeStick = await page.locator('#joystick').boundingBox();
  assert.ok(landscapeStick && landscapeStick.y + landscapeStick.height <= 390);
  await page.close();
}

try {
  fs.mkdirSync('test-output', { recursive: true });
  await runDesktop();
  await runMobile();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Trupy smoke tests passed.');
} finally {
  await browser.close();
}
