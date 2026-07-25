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
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('trupy-save-v1', JSON.stringify({ version: 2, coins: 1000, reputation: 20, tutorialDone: true })));
  await page.waitForSelector('canvas');
  await page.screenshot({ path: 'test-output/menu-desktop.png', fullPage: true });
  const title = await page.title();
  assert.match(title, /Trupy/);
  await clickStart(page);
  await page.waitForSelector('.player-card');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-output/game-desktop.png', fullPage: true });
  assert.equal(await page.locator('.game-ui').count(), 1);
  assert.equal(await page.locator('#coins-label').textContent(), '1000');
  assert.equal(await page.locator('.ability-slot').count(), 2);
  assert.equal(await page.locator('.minimap-svg').count(), 1);
  const measuredFps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const frame = () => {
      frames += 1;
      if (performance.now() - start >= 1000) resolve(frames); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
  assert.ok(Number(measuredFps) >= 5, `Expected the headless renderer to remain responsive, got ${measuredFps}`);
  await page.waitForFunction(() => document.documentElement.dataset.audio === 'running');
  const saveVersion = await page.evaluate(() => JSON.parse(localStorage.getItem('trupy-save-v1') ?? '{}').version);
  assert.equal(saveVersion, 2);
  assert.equal(await page.locator('.hotbar-weapon').count(), 8);
  await page.locator('[data-panel="shop"]').click();
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  await page.screenshot({ path: 'test-output/shop-desktop.png', fullPage: true });
  assert.ok(await page.locator('[data-buy="graveaxe"]').isEnabled());
  await page.locator('[data-buy="graveaxe"]').click();
  await page.waitForFunction(() => document.querySelector('#coins-label')?.textContent === '910');
  await page.locator('.close-button').click();
  assert.equal(await page.locator('[data-hotbar-weapon="graveaxe"]').count(), 1);
  assert.ok(await page.locator('[data-hotbar-weapon="graveaxe"]').evaluate((node) => node.classList.contains('active')));
  await page.locator('[data-hotbar-weapon="rustblade"]').click();
  await page.waitForFunction(() => document.querySelector('#weapon-name')?.textContent === 'Ржавый клинок');
  await page.locator('[data-hotbar-weapon="graveaxe"]').click();
  await page.waitForFunction(() => document.querySelector('#weapon-name')?.textContent === 'Могильный топор');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.heldWeapon), 'graveaxe');
  await page.mouse.click(720, 500);
  await page.keyboard.press('1');
  await page.waitForFunction(() => document.querySelector('#weapon-name')?.textContent === 'Ржавый клинок');
  await page.keyboard.press('2');
  await page.waitForFunction(() => document.querySelector('#weapon-name')?.textContent === 'Могильный топор');
  await page.mouse.wheel(0, -120);
  await page.waitForFunction(() => document.querySelector('#weapon-name')?.textContent === 'Ржавый клинок');
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(() => document.querySelector('#weapon-name')?.textContent === 'Могильный топор');
  await page.locator('[data-panel="inventory"]').click();
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  assert.match(await page.locator('#panel-title').textContent(), /Инвентарь/);
  await page.screenshot({ path: 'test-output/inventory-desktop.png', fullPage: true });
  await page.locator('.close-button').click();
  await page.locator('[data-panel="pause"]').click();
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  assert.equal(await page.locator('[data-volume]').count(), 4);
  await page.locator('.close-button').click();
  await page.locator('[data-panel="map"]').click();
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  assert.equal(await page.locator('.world-map .map-zone').count(), 9);
  assert.equal(await page.locator('.world-map-svg').count(), 1);
  assert.equal(await page.locator('.world-map .map-rift').count(), 3);
  await page.screenshot({ path: 'test-output/map-desktop.png', fullPage: true });
  await page.locator('.close-button').click();
  await page.locator('[data-panel="journal"]').click();
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  assert.match(await page.locator('#panel-title').textContent(), /Задания/);
  await page.locator('.close-button').click();
  await page.mouse.click(720, 500);
  await page.waitForTimeout(120);
  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('trupy-save-v1') ?? '{}').currentScene === 'player_home');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-output/interior-desktop.png', fullPage: true });
  await page.mouse.click(720, 500);
  await page.waitForTimeout(120);
  await page.keyboard.press('e');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('trupy-save-v1') ?? '{}').currentScene === 'world');
  await page.waitForTimeout(700);
  await page.locator('.ability-slot.dash').click();
  await page.waitForFunction(() => (document.querySelector('#dash-cooldown')?.textContent ?? '').length > 0);
  await page.waitForTimeout(220);
  await page.locator('.ability-slot.special').click();
  await page.waitForFunction(() => (document.querySelector('#special-cooldown')?.textContent ?? '').length > 0);
  await page.close();
}

async function runNewInteriors() {
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`interior console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`interior pageerror: ${error.stack ?? error.message}`));
  for (const interiorId of ['marsh_hut', 'dock_house', 'citadel_gatehouse']) {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.evaluate((id) => localStorage.setItem('trupy-save-v1', JSON.stringify({ version: 2, coins: 300, reputation: 20, tutorialDone: true, currentScene: id, playerPosition: { x: 430, y: 585 } })), interiorId);
    await clickStart(page);
    await page.waitForSelector('.player-card');
    await page.waitForFunction((id) => JSON.parse(localStorage.getItem('trupy-save-v1') ?? '{}').currentScene === id, interiorId);
    assert.equal(await page.locator('#weapon-hotbar').count(), 1);
  }
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
  assert.equal(await page.locator('.mobile-button.dash').count(), 1);
  assert.equal(await page.locator('.mobile-button.special').count(), 1);
  await page.locator('[data-panel="inventory"]').click();
  await page.waitForSelector('#screen-panel[aria-hidden="false"]');
  assert.equal(await page.locator('.equipment-paperdoll').count(), 1);
  await page.screenshot({ path: 'test-output/inventory-mobile.png', fullPage: true });
  await page.locator('.close-button').click();
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
  await runNewInteriors();
  await runMobile();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Trupy smoke tests passed.');
} finally {
  await browser.close();
}
