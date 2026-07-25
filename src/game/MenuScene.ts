import Phaser from 'phaser';
import { GameEvents } from './events';
import { audio } from '../systems/AudioManager';
import { SaveSystem } from '../systems/SaveSystem';
import { getInterior } from '../data/world';

export class MenuScene extends Phaser.Scene {
  private particles: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#090b12');
    const { width, height } = this.scale;
    const compact = width < 620;
    const titleSize = Math.round(Math.min(compact ? 64 : 92, width * (compact ? .17 : .09)));
    const titleY = height * (compact ? .22 : .25);
    const mist = this.add.graphics();
    mist.fillStyle(0x202437, 0.8).fillRect(0, height * 0.57, width, height * 0.43);
    mist.fillStyle(0x191c2b, 1);
    for (let x = 0; x < width; x += 80) {
      const ridge = 20 + ((x * 17) % 55);
      mist.fillTriangle(x, height * 0.60, x + 55, height * 0.60 - ridge, x + 110, height * 0.60);
    }
    for (let index = 0; index < Math.max(24, Math.floor(width / 32)); index += 1) {
      const particle = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(40, height - 50),
        Phaser.Math.Between(1, 3),
        Phaser.Math.Between(1, 3),
        index % 4 === 0 ? 0xb879d9 : 0x596079,
        Phaser.Math.FloatBetween(0.2, 0.8),
      );
      particle.setData('speed', Phaser.Math.FloatBetween(4, 13));
      this.particles.push(particle);
    }
    this.add.text(width / 2, titleY, 'TRUPY', {
      fontFamily: 'monospace', fontSize: `${titleSize}px`, fontStyle: 'bold', color: '#e9e4ef',
      stroke: '#291d35', strokeThickness: compact ? 8 : 12, letterSpacing: compact ? 5 : 10,
    }).setOrigin(0.5);
    this.add.text(width / 2, titleY + titleSize * .88, 'ДОЛИНА МЁРТВЫХ', {
      fontFamily: 'monospace', fontSize: compact ? '13px' : '18px', color: '#bb8fd2', letterSpacing: compact ? 3 : 7,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * .52, compact ? 'ПИКСЕЛЬНАЯ RPG • ЗАДАНИЯ • ТАЙНЫ' : 'Открытая пиксельная RPG • задания • оружие • тайны', {
      fontFamily: 'Arial', fontSize: compact ? '12px' : '17px', color: '#a9acba', align: 'center',
      wordWrap: { width: width - 36 },
    }).setOrigin(0.5);

    const buttonWidth = Math.min(compact ? width - 72 : 360, 360);
    const buttonHeight = compact ? 54 : 62;
    const start = this.add.container(width / 2, height * .69);
    const shadow = this.add.rectangle(5, 6, buttonWidth, buttonHeight, 0x000000, 0.35);
    const button = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x9d4f68, 1).setStrokeStyle(3, 0xe0a1b5);
    const label = this.add.text(0, 0, 'ВОЙТИ В ДОЛИНУ', { fontFamily: 'monospace', fontSize: compact ? '15px' : '18px', fontStyle: 'bold', color: '#fff7f2' }).setOrigin(0.5);
    start.add([shadow, button, label]);
    button.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { button.setFillStyle(0xb75e79); start.setScale(1.04); })
      .on('pointerout', () => { button.setFillStyle(0x9d4f68); start.setScale(1); })
      .on('pointerdown', () => this.startGame());

    this.add.text(width / 2, height - (compact ? 24 : 34), compact ? 'СЕНСОРНОЕ УПРАВЛЕНИЕ ПОДДЕРЖИВАЕТСЯ' : 'WASD / стрелки • E — действие • ЛКМ / ПРОБЕЛ — атака', {
      fontFamily: 'monospace', fontSize: compact ? '9px' : '13px', color: '#6f7386',
    }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  update(_time: number, delta: number): void {
    const height = this.scale.height;
    for (const particle of this.particles) {
      particle.y -= particle.getData('speed') * delta / 1000;
      particle.x += Math.sin((particle.y + particle.x) * 0.02) * 0.15;
      if (particle.y < 20) particle.y = height - 20;
    }
  }

  private startGame(): void {
    void audio.unlock();
    GameEvents.emit('audio-unlock');
    this.cameras.main.flash(160, 168, 100, 141);
    this.cameras.main.fadeOut(420, 9, 11, 18);
    this.time.delayedCall(430, () => {
      const save = new SaveSystem().get();
      if (save.currentScene !== 'world' && getInterior(save.currentScene)) {
        const point = save.playerPosition ?? { x: 430, y: 585 };
        this.scene.start('InteriorScene', { interiorId: save.currentScene, returnX: point.x, returnY: point.y });
      } else this.scene.start('WorldScene');
    });
  }
}
