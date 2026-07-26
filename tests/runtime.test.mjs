/**
 * Runtime integration test.
 *
 * Boots the real Phaser scenes in Node (via tests/headless-harness.mjs) and
 * exercises the update loop. This catches the class of bug that neither
 * `tsc --noEmit` nor the data tests can see: animations pointing at texture keys
 * that were never baked, systems used before they're constructed, and exceptions
 * thrown inside per-frame code.
 *
 * Run: node tests/runtime.test.mjs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { installDom, buildProject } from './headless-harness.mjs';

const failures = [];
process.on('uncaughtException', (error) => {
  failures.push(`uncaught: ${error.message}`);
});
process.on('unhandledRejection', (error) => {
  failures.push(`rejection: ${error instanceof Error ? error.message : String(error)}`);
});

installDom();
const OUT = buildProject();
const here = path.dirname(new URL(import.meta.url).pathname);
const Phaser = (await import(path.join(here, 'phaser-shim.mjs'))).default;

const { BootScene } = await import(`${OUT}/game/BootScene.mjs`);
const { MenuScene } = await import(`${OUT}/game/MenuScene.mjs`);
const { WorldScene } = await import(`${OUT}/game/WorldScene.mjs`);
const { InteriorScene } = await import(`${OUT}/game/InteriorScene.mjs`);

const game = new Phaser.Game({
  type: Phaser.CANVAS,
  width: 960,
  height: 540,
  banner: false,
  audio: { noAudio: true },
  canvas: document.createElement('canvas'),
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, MenuScene, WorldScene, InteriorScene],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Boot: textures and animations must all bake.
await wait(2500);
const textureCount = Object.keys(game.textures.list).length;
assert.ok(textureCount > 380, `expected the sprite factories to bake a full atlas, got ${textureCount} textures`);
assert.ok(game.anims.anims.size > 70, `expected pose animations to register, got ${game.anims.anims.size}`);

// ---- World: the scene must build and populate.
game.scene.stop('MenuScene');
game.scene.start('WorldScene');
await wait(3000);
const world = game.scene.getScene('WorldScene');
assert.ok(world.scene.isActive(), 'WorldScene should be active');
assert.ok(world.children.list.length > 300, `world should be populated, got ${world.children.list.length} objects`);
assert.ok(world.enemies.getLength() > 10, `enemies should spawn, got ${world.enemies.getLength()}`);

// ---- Update loop: many frames without throwing.
for (let frame = 0; frame < 120; frame += 1) {
  world.update(1000 + frame * 16, 16);
}

// ---- Interiors: every one must load, since each is a reachable room.
const { INTERIORS } = await import(`${OUT}/data/world.mjs`);
for (const interior of INTERIORS) {
  game.scene.stop('WorldScene');
  game.scene.start('InteriorScene', { interiorId: interior.id, returnX: 430, returnY: 585 });
  await wait(140);
  const scene = game.scene.getScene('InteriorScene');
  assert.ok(scene.scene.isActive(), `interior ${interior.id} should load`);
  scene.update(2000, 16);
}

assert.deepEqual(failures, [], `runtime errors: ${failures.join(' | ')}`);
game.destroy(true);

console.log(`Runtime checks passed: ${textureCount} textures, ${game.anims.anims.size} animations, ${INTERIORS.length} interiors.`);
setTimeout(() => process.exit(0), 200);
