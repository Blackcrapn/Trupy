import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './game/BootScene';
import { MenuScene } from './game/MenuScene';
import { WorldScene } from './game/WorldScene';
import { InteriorScene } from './game/InteriorScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 540,
  backgroundColor: '#090b12',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    fullscreenTarget: 'app',
  },
  input: {
    activePointers: 4,
  },
  scene: [BootScene, MenuScene, WorldScene, InteriorScene],
};

const game = new Phaser.Game(config);

window.addEventListener('beforeunload', () => game.destroy(true));
