import Phaser from 'phaser';
import { GameEvents } from './events';
import { audio } from '../systems/AudioManager';
import { SaveSystem, storageAvailable } from '../systems/SaveSystem';
import { getInterior } from '../data/world';
import { renderHeroFrame, HERO_SHADE, HERO_W, HERO_H } from '../systems/sprites/hero';

/**
 * Title screen.
 *
 * The menu is the first promise the game makes, so it shows what the game
 * actually looks like rather than plain text on a gradient: layered parallax
 * ridges, drifting fog, embers, a lit lantern, and the hero standing at the edge
 * of the valley rendered from the same sprite factory used in play.
 */
export class MenuScene extends Phaser.Scene {
  private fogBands: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#080a11');
    const { width, height } = this.scale;
    const compact = width < 620;
    const save = new SaveSystem().get();
    const hasProgress = save.level > 1 || save.reputation > 0 || Object.keys(save.questProgress).length > 0;

    this.drawSky(width, height);
    this.drawRidges(width, height);
    this.drawHero(width, height, compact);

    const titleSize = Math.round(Math.min(compact ? 64 : 92, width * (compact ? .17 : .09)));
    const titleY = height * (compact ? .2 : .23);

    // Soft glow behind the title so it reads against any ridge silhouette.
    const glow = this.add.ellipse(width / 2, titleY + 6, titleSize * 7, titleSize * 2.1, 0x2a1d38, .5);
    this.tweens.add({ targets: glow, alpha: .28, scaleX: 1.06, duration: 3600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const title = this.add.text(width / 2, titleY, 'TRUPY', {
      fontFamily: 'monospace', fontSize: `${titleSize}px`, fontStyle: 'bold', color: '#f0eaf4',
      stroke: '#2b1d36', strokeThickness: compact ? 8 : 12, letterSpacing: compact ? 5 : 10,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: titleY - 4, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(width / 2, titleY + titleSize * .84, 'ДОЛИНА МЁРТВЫХ', {
      fontFamily: 'monospace', fontSize: compact ? '13px' : '18px', color: '#c396da',
      letterSpacing: compact ? 3 : 7,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * .47, compact
      ? 'ПИКСЕЛЬНАЯ RPG • ЗАДАНИЯ • ТАЙНЫ'
      : 'Открытая пиксельная RPG • ночь, погода, разломы и тайны', {
      fontFamily: 'Arial', fontSize: compact ? '12px' : '16px', color: '#9ea1b2', align: 'center',
      wordWrap: { width: width - 36 },
    }).setOrigin(0.5);

    // A returning player should see their progress acknowledged.
    if (hasProgress) {
      this.add.text(width / 2, height * .53, `Изгнанник • уровень ${save.level} • репутация ${save.reputation}`, {
        fontFamily: 'monospace', fontSize: compact ? '10px' : '13px', color: '#7f8496',
      }).setOrigin(0.5);
    }

    this.createButton(width / 2, height * (compact ? .68 : .69), compact, hasProgress ? 'ПРОДОЛЖИТЬ ПУТЬ' : 'ВОЙТИ В ДОЛИНУ');

    this.add.text(width / 2, height - (compact ? 24 : 34), compact
      ? 'СЕНСОРНОЕ УПРАВЛЕНИЕ ПОДДЕРЖИВАЕТСЯ'
      : 'WASD / стрелки • E — действие • ЛКМ / ПРОБЕЛ — атака • SHIFT — рывок', {
      fontFamily: 'monospace', fontSize: compact ? '9px' : '12px', color: '#6b6f82',
    }).setOrigin(0.5);

    // If storage is blocked the player deserves to know before investing hours.
    if (!storageAvailable()) {
      this.add.text(width / 2, height - (compact ? 42 : 56), 'ВНИМАНИЕ: браузер блокирует сохранения — прогресс не сохранится', {
        fontFamily: 'monospace', fontSize: compact ? '9px' : '11px', color: '#d08a6a',
      }).setOrigin(0.5);
    }

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
    this.cameras.main.fadeIn(600, 8, 10, 17);
  }

  /** Banded sky gradient, stars, a moon and slow fog. */
  private drawSky(width: number, height: number): void {
    const sky = this.add.graphics();
    // Painted as discrete bands so the gradient stays in the pixel palette.
    for (let i = 0; i < 26; i += 1) {
      const shade = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x0b0d16),
        Phaser.Display.Color.ValueToColor(0x241b33),
        25,
        i,
      );
      sky.fillStyle(Phaser.Display.Color.GetColor(shade.r, shade.g, shade.b), 1);
      sky.fillRect(0, (height * 0.62 * i) / 26, width, height * 0.62 / 26 + 1);
    }

    for (let index = 0; index < Math.max(40, Math.floor(width / 18)); index += 1) {
      const star = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(20, Math.floor(height * 0.6)),
        Phaser.Math.Between(1, 2),
        Phaser.Math.Between(1, 2),
        index % 5 === 0 ? 0xc9a4e0 : 0xd8dcea,
        Phaser.Math.FloatBetween(0.18, 0.75),
      );
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.3),
        duration: Phaser.Math.Between(1400, 3800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // A pale moon gives the ridges a light direction to sit against.
    this.add.circle(width * 0.78, height * 0.17, Math.max(18, width * 0.028), 0xd9d2e8, 0.9);
    this.add.circle(width * 0.78, height * 0.17, Math.max(34, width * 0.05), 0x8f7fb4, 0.1);

    for (let band = 0; band < 3; band += 1) {
      const fog = this.add.rectangle(
        width / 2,
        height * (0.58 + band * 0.09),
        width * 1.6,
        height * (0.1 + band * 0.03),
        0x2a2b40,
        0.16 - band * 0.03,
      );
      fog.setData('speed', 6 + band * 5);
      this.fogBands.push(fog);
    }
  }

  /** Three parallax ridge layers, back to front. */
  private drawRidges(width: number, height: number): void {
    const layers = [
      { y: 0.62, color: 0x1b1d2c, step: 130, amp: 62 },
      { y: 0.70, color: 0x161824, step: 96, amp: 44 },
      { y: 0.79, color: 0x101119, step: 70, amp: 30 },
    ];
    for (const layer of layers) {
      const graphics = this.add.graphics();
      graphics.fillStyle(layer.color, 1);
      const baseY = height * layer.y;
      graphics.beginPath();
      graphics.moveTo(-20, height);
      graphics.lineTo(-20, baseY);
      for (let x = -20; x <= width + layer.step; x += layer.step) {
        const peak = baseY - (layer.amp * 0.45 + ((x * 37) % layer.amp));
        graphics.lineTo(x + layer.step / 2, peak);
        graphics.lineTo(x + layer.step, baseY - ((x * 13) % (layer.amp * 0.4)));
      }
      graphics.lineTo(width + 20, height);
      graphics.closePath();
      graphics.fillPath();
    }
    this.add.rectangle(width / 2, height * 0.9, width, height * 0.22, 0x0c0d14, 1);
  }

  /**
   * The hero standing at the valley's edge beside a lit lantern, rendered from
   * the same sprite factory the game uses — so the menu advertises the real art.
   */
  private drawHero(width: number, height: number, compact: boolean): void {
    const key = 'menu-hero';
    if (!this.textures.exists(key)) {
      const canvas = renderHeroFrame('down', 'idle', 0);
      const texture = this.textures.createCanvas(key, HERO_W, HERO_H);
      if (texture) {
        const ctx = texture.context;
        ctx.imageSmoothingEnabled = false;
        const image = ctx.createImageData(HERO_W, HERO_H);
        image.data.set(canvas.resolve(HERO_SHADE));
        ctx.putImageData(image, 0, 0);
        texture.refresh();
      }
    }
    const scale = compact ? 2.4 : 3.4;
    const groundY = height * 0.845;
    const heroX = width * (compact ? 0.5 : 0.27);

    // Lantern light pooled on the ground, so the hero stands in something.
    const pool = this.add.ellipse(heroX + 14, groundY + 4, 150, 34, 0xffb257, 0.14);
    this.tweens.add({ targets: pool, alpha: 0.07, scaleX: 1.1, duration: 1700, yoyo: true, repeat: -1 });

    const hero = this.add.image(heroX, groundY - (HERO_H * scale) / 2, key).setScale(scale);
    this.tweens.add({ targets: hero, y: hero.y - 2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    if (this.textures.exists('lantern-on')) {
      const lantern = this.add.image(heroX + 26 * scale / 2, groundY - 20 * scale / 2, 'lantern-on').setScale(scale * 0.8);
      this.tweens.add({ targets: lantern, alpha: 0.82, duration: 900, yoyo: true, repeat: -1 });
    }

    // Embers drifting up from the valley floor.
    if (this.textures.exists('ember')) {
      for (let index = 0; index < (compact ? 10 : 20); index += 1) {
        const ember = this.add.image(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(Math.floor(height * 0.7), Math.floor(height)),
          'ember',
        ).setScale(Phaser.Math.FloatBetween(0.8, 1.9)).setAlpha(Phaser.Math.FloatBetween(0.2, 0.6));
        this.tweens.add({
          targets: ember,
          y: ember.y - Phaser.Math.Between(120, 320),
          x: ember.x + Phaser.Math.Between(-50, 50),
          alpha: 0,
          duration: Phaser.Math.Between(3200, 7000),
          repeat: -1,
          delay: Phaser.Math.Between(0, 3000),
        });
      }
    }
  }

  private createButton(x: number, y: number, compact: boolean, label: string): void {
    const buttonWidth = Math.min(compact ? this.scale.width - 72 : 360, 360);
    const buttonHeight = compact ? 54 : 62;
    const container = this.add.container(x, y);
    const shadow = this.add.rectangle(5, 6, buttonWidth, buttonHeight, 0x000000, 0.4);
    const halo = this.add.rectangle(0, 0, buttonWidth + 16, buttonHeight + 16, 0xc76f8c, 0.1);
    const button = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x9d4f68, 1).setStrokeStyle(3, 0xe4a9bc);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'monospace', fontSize: compact ? '15px' : '18px', fontStyle: 'bold', color: '#fff7f2',
    }).setOrigin(0.5);
    container.add([shadow, halo, button, text]);

    // The halo pulse points at the button without needing an instruction.
    this.tweens.add({ targets: halo, alpha: 0.02, scaleX: 1.04, scaleY: 1.12, duration: 1600, yoyo: true, repeat: -1 });

    button.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { button.setFillStyle(0xb75e79); container.setScale(1.04); })
      .on('pointerout', () => { button.setFillStyle(0x9d4f68); container.setScale(1); })
      .on('pointerdown', () => this.startGame());
  }

  update(_time: number, delta: number): void {
    const { width } = this.scale;
    for (const fog of this.fogBands) {
      fog.x -= (fog.getData('speed') as number) * delta / 1000;
      if (fog.x < -width * 0.3) fog.x = width * 1.3;
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
