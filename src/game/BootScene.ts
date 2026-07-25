import Phaser from 'phaser';
import { createPixelTextures } from '../systems/TextureFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createPixelTextures(this);
    this.createAnimations();
    this.scene.start('MenuScene');
  }

  private createAnimations(): void {
    const make = (key: string, prefix: string) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: [0, 1, 2, 3].map((index) => ({ key: `${prefix}-${index}` })),
        frameRate: 9,
        repeat: -1,
      });
    };
    make('hero-walk-down', 'hero-down');
    make('hero-walk-up', 'hero-up');
    make('hero-walk-side', 'hero-side');
  }
}
