import Phaser from 'phaser';
import { createPixelTextures } from '../systems/TextureFactory';
import { HERO_DIRS, HERO_POSE_FRAMES, heroKey, type HeroPose } from '../systems/sprites/hero';
import { ENEMY_IDS, ENEMY_POSE_FRAMES, enemyKey, type EnemyPose } from '../systems/sprites/enemies';
import { NPC_POSE_FRAMES, npcKey, type NpcPose } from '../systems/sprites/npcs';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createPixelTextures(this);
    this.createAnimations();
    this.scene.start('MenuScene');
  }

  /**
   * Registers animations from the sprite factories' own frame tables, so adding a
   * pose or direction to the art produces a playable animation without editing
   * this file.
   */
  private createAnimations(): void {
    const define = (key: string, frames: string[], frameRate: number, repeat: number): void => {
      if (this.anims.exists(key) || frames.length === 0) return;
      // Skip animations whose textures failed to bake rather than registering a
      // broken animation, which Phaser would render as a missing-texture box.
      if (!frames.every((frame) => this.textures.exists(frame))) return;
      this.anims.create({ key, frames: frames.map((frame) => ({ key: frame })), frameRate, repeat });
    };

    // Per-pose playback rates: walking is brisk, idle breathing is slow, attacks
    // are fast enough to feel responsive while staying readable.
    const heroRates: Record<HeroPose, { rate: number; repeat: number }> = {
      walk: { rate: 12, repeat: -1 },
      idle: { rate: 3.4, repeat: -1 },
      attack: { rate: 18, repeat: 0 },
      dash: { rate: 1, repeat: 0 },
      hurt: { rate: 1, repeat: 0 },
    };
    for (const dir of HERO_DIRS) {
      for (const pose of Object.keys(HERO_POSE_FRAMES) as HeroPose[]) {
        const frames = Array.from({ length: HERO_POSE_FRAMES[pose] }, (_, index) => heroKey(dir, pose, index));
        const { rate, repeat } = heroRates[pose];
        define(`hero-${dir}-${pose}`, frames, rate, repeat);
      }
    }

    // Legacy walk animation keys, kept so older call sites still resolve.
    for (const legacy of ['down', 'up', 'side'] as const) {
      define(
        `hero-walk-${legacy}`,
        Array.from({ length: 8 }, (_, index) => `hero-${legacy}-${index}`),
        11,
        -1,
      );
    }

    const enemyRates: Record<EnemyPose, { rate: number; repeat: number }> = {
      idle: { rate: 3.2, repeat: -1 },
      walk: { rate: 8.5, repeat: -1 },
      attack: { rate: 12, repeat: 0 },
      hurt: { rate: 1, repeat: 0 },
      death: { rate: 8, repeat: 0 },
    };
    for (const id of ENEMY_IDS) {
      for (const pose of Object.keys(ENEMY_POSE_FRAMES) as EnemyPose[]) {
        const frames = Array.from({ length: ENEMY_POSE_FRAMES[pose] }, (_, index) => enemyKey(id, pose, index));
        const { rate, repeat } = enemyRates[pose];
        define(`enemy-${id}-${pose}`, frames, rate, repeat);
      }
    }

    for (let index = 0; index < 10; index += 1) {
      for (const pose of Object.keys(NPC_POSE_FRAMES) as NpcPose[]) {
        const frames = Array.from({ length: NPC_POSE_FRAMES[pose] }, (_, frame) => npcKey(index, pose, frame));
        define(`npc-${index}-${pose}`, frames, pose === 'talk' ? 6 : 2.8, -1);
      }
    }
  }
}
