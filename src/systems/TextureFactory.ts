/**
 * Bakes every runtime-generated sprite into Phaser textures.
 *
 * The art itself lives in `systems/sprites/*` as engine-agnostic PixelCanvas
 * builders, shaded by `systems/render/PixelCanvas`. This file is the seam where
 * that art meets Phaser: it walks each builder, resolves the lighting pass and
 * registers the result under a texture key.
 *
 * Legacy keys are preserved deliberately (`hero-down-0`, `npc-3`, `held-moonblade`,
 * `tree`, …) so existing scene code and the smoke tests keep working while the
 * underlying art is now fully sculpted.
 */

import Phaser from 'phaser';
import { buildBuildingFrames, BUILDING_SHADE, type BuildingRenderSpec } from './sprites/buildings';
import { buildEnemyFrames, ENEMY_SHADE } from './sprites/enemies';
import { buildHeroFrames, HERO_DIRS, HERO_SHADE, heroKey, renderHeroFrame } from './sprites/hero';
import { buildNpcFrames, NPC_SHADE } from './sprites/npcs';
import { buildPropFrames, PROP_SHADE } from './sprites/props';
import { buildWeaponFrames, WEAPON_SHADE } from './sprites/weapons';
import { registerAll, rawTexture } from './render/TextureBridge';
import { LightingSystem } from './world/Lighting';
import { BUILDINGS } from '../data/world';

export function createPixelTextures(scene: Phaser.Scene): void {
  registerAll(scene, buildHeroFrames(), HERO_SHADE);
  createLegacyHeroAliases(scene);
  registerAll(scene, buildNpcFrames(), NPC_SHADE);
  registerAll(scene, buildEnemyFrames(), ENEMY_SHADE);
  registerAll(scene, buildWeaponFrames(), WEAPON_SHADE);
  registerAll(scene, buildPropFrames(), PROP_SHADE);
  createBuildingTextures(scene);
  createUtilityTextures(scene);
  LightingSystem.createLightTexture(scene);
}

/**
 * The old art had three directions (`down`/`up`/`side`) with an 8-frame walk and
 * keys shaped `hero-{dir}-{frame}`. The new art has five directions and named
 * poses, so we alias the old keys onto the new walk frames — existing animation
 * definitions and the smoke tests continue to resolve.
 */
function createLegacyHeroAliases(scene: Phaser.Scene): void {
  const legacy: Array<{ legacyDir: string; dir: (typeof HERO_DIRS)[number] }> = [
    { legacyDir: 'down', dir: 'down' },
    { legacyDir: 'up', dir: 'up' },
    { legacyDir: 'side', dir: 'side' },
  ];
  for (const { legacyDir, dir } of legacy) {
    for (let frame = 0; frame < 8; frame += 1) {
      const key = `hero-${legacyDir}-${frame}`;
      if (scene.textures.exists(key)) continue;
      const source = heroKey(dir, 'walk', frame);
      if (scene.textures.exists(source)) {
        // Phaser has no true alias, so re-bake from the same builder.
        registerAll(scene, [{ key, canvas: renderHeroFrame(dir, 'walk', frame) }], HERO_SHADE);
      }
    }
  }
}

function createBuildingTextures(scene: Phaser.Scene): void {
  const specs = BUILDINGS.map((building) => ({
    id: building.id,
    name: building.name,
    w: building.w,
    h: building.h,
    wall: building.wall,
    roof: building.roof,
    doorX: building.doorX,
    style: building.style ?? 'home',
  })) as Array<BuildingRenderSpec & { id: string }>;
  registerAll(scene, buildBuildingFrames(specs), BUILDING_SHADE);
}

/**
 * Textures that are simpler to express as direct canvas paints than as sculpted
 * sprites: gradients, soft masks and single pixels used by particle systems.
 */
function createUtilityTextures(scene: Phaser.Scene): void {
  rawTexture(scene, 'pixel', 2, 2, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
  });

  rawTexture(scene, 'shadow', 24, 10, (ctx) => {
    const gradient = ctx.createRadialGradient(12, 5, 0, 12, 5, 12);
    gradient.addColorStop(0, 'rgba(6,7,12,0.5)');
    gradient.addColorStop(0.65, 'rgba(6,7,12,0.22)');
    gradient.addColorStop(1, 'rgba(6,7,12,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 24, 10);
  });

  rawTexture(scene, 'spark', 8, 8, (ctx) => {
    const gradient = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    gradient.addColorStop(0, 'rgba(255,246,206,1)');
    gradient.addColorStop(0.5, 'rgba(255,214,122,0.6)');
    gradient.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 8);
  });

  // Soft circular glow used for hit flashes and pickup pings.
  rawTexture(scene, 'glow-soft', 64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });

  // Slash arc for melee swings — a crescent that reads as a blade path.
  rawTexture(scene, 'slash-arc', 56, 56, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(28, 28, 20, -0.95, 0.95);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(28, 28, 25, -0.8, 0.8);
    ctx.stroke();
  });

  // Ground crack decal for heavy impacts.
  rawTexture(scene, 'impact-ring', 48, 24, (ctx) => {
    ctx.strokeStyle = 'rgba(228,214,196,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(24, 12, 20, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}
