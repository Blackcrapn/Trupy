import Phaser from 'phaser';

const COLORS = {
  outline: '#171821',
  skin: '#d7ad82',
  leather: '#563f45',
  silver: '#aeb5c2',
};

export function createPixelTextures(scene: Phaser.Scene): void {
  createHeroFrames(scene);
  createNpcTextures(scene);
  createEnemyTextures(scene);
  createWorldTextures(scene);
  createEffects(scene);
}

function canvas(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  texture.refresh();
}

function createHeroFrames(scene: Phaser.Scene): void {
  const directions = ['down', 'up', 'side'];
  const strides = [0, 1, 2, 1, 0, -1, -2, -1];
  directions.forEach((direction) => {
    for (let frame = 0; frame < 8; frame += 1) {
      const key = `hero-${direction}-${frame}`;
      canvas(scene, key, 32, 40, (ctx) => {
        const stride = strides[frame];
        const bob = Math.abs(stride) === 2 ? 1 : 0;
        const sway = frame < 4 ? 1 : -1;
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(5, 35, 23, 4);
        ctx.fillStyle = COLORS.outline;
        ctx.fillRect(9, 2 + bob, 15, 13); ctx.fillRect(4, 14 + bob, 24, 16);
        ctx.fillRect(7 + stride, 29 + bob, 7, 9); ctx.fillRect(19 - stride, 29 + bob, 7, 9);
        ctx.fillStyle = '#282333';
        ctx.fillRect(10, 2 + bob, 13, 5); ctx.fillRect(7, 5 + bob, 4, 6); ctx.fillRect(22, 5 + bob, 3, 6);
        ctx.fillStyle = '#6c2942';
        ctx.fillRect(5 + sway, 16 + bob, 22 - Math.abs(sway), 13); ctx.fillRect(7 + sway, 27 + bob, 18, 5);
        ctx.fillStyle = '#a74463'; ctx.fillRect(7, 16 + bob, 18, 7); ctx.fillRect(10, 24 + bob, 12, 4);
        ctx.fillStyle = '#c6cad4'; ctx.fillRect(4, 15 + bob, 6, 5); ctx.fillRect(23, 15 + bob, 6, 5);
        ctx.fillStyle = '#6f7887'; ctx.fillRect(5, 16 + bob, 4, 3); ctx.fillRect(24, 16 + bob, 4, 3);
        ctx.fillStyle = COLORS.skin;
        if (direction === 'up') ctx.fillRect(11, 7 + bob, 11, 7);
        else if (direction === 'side') ctx.fillRect(14, 7 + bob, 9, 7);
        else ctx.fillRect(11, 7 + bob, 11, 8);
        ctx.fillStyle = '#f4eef4';
        if (direction === 'down') { ctx.fillRect(13, 10 + bob, 2, 2); ctx.fillRect(19, 10 + bob, 2, 2); }
        if (direction === 'side') ctx.fillRect(20, 10 + bob, 2, 2);
        ctx.fillStyle = '#6a4150'; if (direction !== 'up') ctx.fillRect(direction === 'side' ? 21 : 15, 13 + bob, 4, 1);
        ctx.fillStyle = '#3f4858'; ctx.fillRect(7 + stride, 32 + bob, 7, 5); ctx.fillRect(19 - stride, 32 + bob, 7, 5);
        ctx.fillStyle = '#b9c2ce'; ctx.fillRect(9 + stride, 30 + bob, 4, 3); ctx.fillRect(20 - stride, 30 + bob, 4, 3);
        ctx.fillStyle = '#d6af62';
        if (direction === 'side') { ctx.fillRect(5, 17 + bob, 3, 14); ctx.fillStyle = '#9aa6b4'; ctx.fillRect(3, 14 + bob, 6, 5); }
        else { ctx.fillRect(2, 17 + bob, 3, 14); ctx.fillStyle = '#9aa6b4'; ctx.fillRect(1, 14 + bob, 6, 5); }
        ctx.fillStyle = '#e5e8ef'; ctx.fillRect(14, 15 + bob, 5, 2);
      });
    }
  });
}

function createNpcTextures(scene: Phaser.Scene): void {
  const palettes = [
    ['#5f3d75', '#c59bd8'], ['#70452e', '#e39c54'], ['#435a55', '#94bdad'], ['#386348', '#83c981'], ['#754b63', '#d091ab'],
    ['#665039', '#c39a68'], ['#3e586c', '#78a1bd'], ['#28634f', '#76d2a7'], ['#665039', '#d2a35e'], ['#793a3e', '#ed7966'],
  ];
  palettes.forEach((palette, index) => {
    canvas(scene, `npc-${index}`, 28, 38, (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(5, 34, 19, 3);
      ctx.fillStyle = COLORS.outline;
      ctx.fillRect(8, 3, 13, 13); ctx.fillRect(4, 15, 21, 15); ctx.fillRect(6, 29, 7, 7); ctx.fillRect(16, 29, 7, 7);
      ctx.fillStyle = palette[0]; ctx.fillRect(9, 3, 11, 5); ctx.fillRect(5, 16, 19, 13);
      ctx.fillStyle = palette[1]; ctx.fillRect(7, 17, 15, 5); ctx.fillRect(8, 26, 13, 3);
      ctx.fillStyle = COLORS.skin; ctx.fillRect(10, 8, 9, 7);
      ctx.fillStyle = '#f7f0ed'; ctx.fillRect(11, 10, 2, 2); ctx.fillRect(17, 10, 2, 2);
      ctx.fillStyle = '#49333c'; ctx.fillRect(13, 14, 4, 1);
      ctx.fillStyle = '#3d4553'; ctx.fillRect(6, 31, 7, 4); ctx.fillRect(16, 31, 7, 4);
      if (index === 0) { ctx.fillStyle = '#30263d'; ctx.fillRect(6, 2, 17, 7); ctx.fillRect(5, 7, 5, 12); ctx.fillRect(20, 7, 4, 12); ctx.fillStyle = '#bda8d5'; ctx.fillRect(13, 10, 4, 2); }
      if (index === 1) { ctx.fillStyle = '#a8b0b8'; ctx.fillRect(2, 15, 4, 15); ctx.fillRect(0, 12, 9, 5); ctx.fillStyle = '#e28345'; ctx.fillRect(21, 19, 5, 7); }
      if (index === 2) { ctx.fillStyle = '#c4b68c'; ctx.fillRect(24, 8, 2, 25); ctx.fillRect(22, 6, 6, 5); ctx.fillStyle = '#d3d4ce'; ctx.fillRect(10, 13, 9, 4); }
      if (index === 3) { ctx.fillStyle = '#7fc77d'; ctx.fillRect(3, 11, 5, 5); ctx.fillRect(20, 10, 5, 6); ctx.fillStyle = '#8c6048'; ctx.fillRect(21, 22, 6, 8); }
      if (index === 4) { ctx.fillStyle = '#d9b1c2'; ctx.fillRect(5, 15, 19, 6); ctx.fillStyle = '#b7a8a0'; ctx.fillRect(10, 4, 9, 3); }
      if (index === 5) { ctx.fillStyle = '#b99762'; ctx.fillRect(23, 9, 2, 23); ctx.strokeStyle = '#b99762'; ctx.lineWidth = 1; ctx.strokeRect(20, 8, 6, 25); ctx.fillStyle = '#52614c'; ctx.fillRect(7, 2, 15, 4); }
      if (index === 6) { ctx.fillStyle = '#2d3d4b'; ctx.fillRect(5, 2, 19, 5); ctx.fillRect(8, 0, 13, 4); ctx.fillStyle = '#a88658'; ctx.fillRect(24, 12, 2, 23); }
      if (index === 7) { ctx.fillStyle = '#8be0b5'; ctx.fillRect(6, 2, 4, 6); ctx.fillRect(20, 2, 4, 6); ctx.fillStyle = '#254d43'; ctx.fillRect(5, 7, 5, 11); ctx.fillRect(20, 7, 5, 11); }
      if (index === 8) { ctx.fillStyle = '#b7a274'; ctx.fillRect(6, 2, 17, 5); ctx.fillRect(10, 0, 9, 3); ctx.fillStyle = '#9ba4ad'; ctx.fillRect(23, 12, 3, 20); ctx.fillRect(20, 10, 8, 5); }
      if (index === 9) { ctx.fillStyle = '#d9dce4'; ctx.fillRect(7, 2, 15, 5); ctx.fillStyle = '#e45f53'; ctx.fillRect(13, 0, 4, 5); ctx.fillStyle = '#aeb7c2'; ctx.fillRect(23, 13, 3, 20); }
    });
  });
}

function createEnemyTextures(scene: Phaser.Scene): void {
  const makeEnemy = (key: string, body: string, eye: string, shape: 'humanoid' | 'beast' | 'boss') => {
    const size = shape === 'boss' ? 50 : 36;
    canvas(scene, `enemy-${key}`, size, size, (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(5, size - 5, size - 10, 4);
      ctx.fillStyle = COLORS.outline;
      if (shape === 'beast') {
        ctx.fillRect(4, 15, 28, 14); ctx.fillRect(7, 8, 13, 12); ctx.fillRect(7, 5, 4, 7); ctx.fillRect(17, 5, 4, 7);
        ctx.fillRect(7, 27, 7, 7); ctx.fillRect(24, 27, 7, 7); ctx.fillRect(30, 18, 5, 5);
        ctx.fillStyle = body; ctx.fillRect(6, 17, 25, 10); ctx.fillRect(9, 10, 11, 10);
        ctx.fillStyle = eye; ctx.fillRect(11, 13, 2, 2); ctx.fillRect(17, 13, 2, 2);
        ctx.fillStyle = '#d9d2c2'; ctx.fillRect(10, 18, 3, 3); ctx.fillRect(15, 19, 3, 3);
      } else {
        const w = shape === 'boss' ? 30 : 20;
        const x = (size - w) / 2;
        ctx.fillRect(x + 5, 3, w - 10, 14); ctx.fillRect(x, 16, w, size - 22);
        ctx.fillRect(x + 3, size - 9, 8, 8); ctx.fillRect(x + w - 11, size - 9, 8, 8);
        ctx.fillStyle = body; ctx.fillRect(x + 7, 5, w - 14, 10); ctx.fillRect(x + 2, 18, w - 4, size - 27);
        ctx.fillStyle = eye; ctx.fillRect(x + 8, 9, 3, 2); ctx.fillRect(x + w - 11, 9, 3, 2);
        ctx.fillStyle = '#34313a'; ctx.fillRect(x + 5, 25, w - 10, 3);
        if (shape === 'boss') { ctx.fillStyle = body; ctx.fillRect(x - 5, 8, 6, 17); ctx.fillRect(x + w - 1, 8, 6, 17); ctx.fillRect(x + 3, 0, 5, 8); ctx.fillRect(x + w - 8, 0, 5, 8); }
      }
      if (key === 'husk') { ctx.fillStyle = '#a5aa83'; ctx.fillRect(5, 21, 6, 3); ctx.fillStyle = '#5f6551'; ctx.fillRect(19, 25, 8, 2); }
      if (key === 'boneguard') { ctx.fillStyle = '#ebe0c4'; ctx.fillRect(3, 17, 6, 15); ctx.fillRect(27, 17, 6, 15); ctx.fillStyle = '#d45d51'; ctx.fillRect(15, 6, 6, 3); }
      if (key === 'direwolf') { ctx.fillStyle = '#927fa0'; ctx.fillRect(22, 11, 7, 4); ctx.fillStyle = '#e06975'; ctx.fillRect(9, 13, 3, 2); }
      if (key === 'wraith') { ctx.fillStyle = '#9f82dd'; ctx.fillRect(3, 30, 5, 4); ctx.fillRect(13, 32, 5, 3); ctx.fillRect(27, 30, 5, 4); }
      if (key === 'bogling') { ctx.fillStyle = '#78c59b'; ctx.fillRect(2, 13, 7, 4); ctx.fillRect(27, 8, 5, 7); ctx.fillStyle = '#2d584c'; ctx.fillRect(11, 27, 14, 4); }
      if (key === 'cavecrawler') { ctx.fillStyle = '#d0a76b'; ctx.fillRect(3, 23, 8, 3); ctx.fillRect(24, 23, 9, 3); ctx.fillStyle = '#4a4038'; ctx.fillRect(21, 8, 8, 7); }
      if (key === 'ashborn') { ctx.fillStyle = '#ff8a55'; ctx.fillRect(5, 3, 4, 9); ctx.fillRect(15, 0, 5, 10); ctx.fillRect(27, 5, 4, 8); }
      if (key === 'nameless') { ctx.fillStyle = '#da78b0'; ctx.fillRect(4, 22, 7, 18); ctx.fillRect(39, 22, 7, 18); ctx.fillStyle = '#ffc4e5'; ctx.fillRect(20, 5, 10, 3); }
      if (key === 'cinderlord') { ctx.fillStyle = '#ff7748'; ctx.fillRect(4, 5, 7, 18); ctx.fillRect(39, 5, 7, 18); ctx.fillRect(18, 0, 6, 12); ctx.fillRect(27, 2, 6, 10); ctx.fillStyle = '#ffd56f'; ctx.fillRect(21, 9, 9, 4); }
    });
  };
  makeEnemy('husk', '#758069', '#d7d089', 'humanoid');
  makeEnemy('boneguard', '#cfc1a4', '#ef7159', 'humanoid');
  makeEnemy('direwolf', '#6d637b', '#da6570', 'beast');
  makeEnemy('wraith', '#655596', '#bda7ff', 'humanoid');
  makeEnemy('bogling', '#3f7767', '#a8ffd7', 'humanoid');
  makeEnemy('cavecrawler', '#7d624d', '#f0bd72', 'beast');
  makeEnemy('ashborn', '#a8473d', '#ffd0a3', 'humanoid');
  makeEnemy('nameless', '#8f416e', '#ffc1e4', 'boss');
  makeEnemy('cinderlord', '#ba4938', '#fff0ba', 'boss');
}

function createWorldTextures(scene: Phaser.Scene): void {
  canvas(scene, 'tree', 42, 58, (ctx) => {
    ctx.fillStyle = COLORS.outline; ctx.fillRect(17, 31, 10, 26); ctx.fillRect(5, 9, 32, 33); ctx.fillRect(11, 3, 21, 13);
    ctx.fillStyle = '#44372f'; ctx.fillRect(19, 31, 6, 24);
    ctx.fillStyle = '#203a31'; ctx.fillRect(7, 11, 28, 27); ctx.fillRect(13, 5, 17, 12);
    ctx.fillStyle = '#315346'; ctx.fillRect(10, 12, 7, 6); ctx.fillRect(23, 9, 7, 7); ctx.fillRect(17, 24, 10, 6);
  });
  canvas(scene, 'rock', 30, 24, (ctx) => {
    ctx.fillStyle = COLORS.outline; ctx.fillRect(2, 8, 26, 14); ctx.fillRect(7, 3, 16, 7);
    ctx.fillStyle = '#555861'; ctx.fillRect(4, 9, 22, 11); ctx.fillRect(8, 5, 14, 6);
    ctx.fillStyle = '#777b84'; ctx.fillRect(9, 6, 8, 3);
  });
  canvas(scene, 'grave', 20, 30, (ctx) => {
    ctx.fillStyle = COLORS.outline; ctx.fillRect(3, 6, 14, 23); ctx.fillRect(6, 2, 8, 6);
    ctx.fillStyle = '#6d7279'; ctx.fillRect(5, 7, 10, 19); ctx.fillRect(7, 4, 6, 5);
    ctx.fillStyle = '#454950'; ctx.fillRect(9, 10, 2, 9); ctx.fillRect(7, 13, 6, 2);
  });
  canvas(scene, 'herb-moonwort', 16, 16, (ctx) => {
    ctx.fillStyle = '#18221e'; ctx.fillRect(7, 5, 2, 10);
    ctx.fillStyle = '#82cbb0'; ctx.fillRect(2, 6, 5, 4); ctx.fillRect(9, 3, 5, 5); ctx.fillRect(9, 10, 5, 3);
    ctx.fillStyle = '#d3fff0'; ctx.fillRect(10, 4, 2, 2);
  });
  canvas(scene, 'herb-shadebloom', 16, 16, (ctx) => {
    ctx.fillStyle = '#253026'; ctx.fillRect(7, 6, 2, 9);
    ctx.fillStyle = '#8d68ba'; ctx.fillRect(3, 4, 5, 5); ctx.fillRect(8, 2, 5, 6); ctx.fillRect(8, 8, 5, 4);
    ctx.fillStyle = '#e0c4ff'; ctx.fillRect(8, 5, 2, 2);
  });
  canvas(scene, 'charm', 14, 18, (ctx) => {
    ctx.fillStyle = '#1a1720'; ctx.fillRect(3, 4, 8, 11);
    ctx.fillStyle = '#d7ad5d'; ctx.fillRect(4, 5, 6, 9); ctx.fillRect(6, 2, 2, 4);
    ctx.fillStyle = '#6a365d'; ctx.fillRect(6, 7, 2, 4);
  });
  canvas(scene, 'lantern-off', 16, 24, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(7, 0, 2, 24); ctx.fillRect(2, 4, 12, 3); ctx.fillRect(3, 7, 10, 10);
    ctx.fillStyle = '#4d5059'; ctx.fillRect(5, 9, 6, 6);
  });
  canvas(scene, 'lantern-on', 16, 24, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(7, 0, 2, 24); ctx.fillRect(2, 4, 12, 3); ctx.fillRect(3, 7, 10, 10);
    ctx.fillStyle = '#f4b85b'; ctx.fillRect(5, 9, 6, 6); ctx.fillStyle = '#fff0a8'; ctx.fillRect(7, 10, 2, 3);
  });
  canvas(scene, 'altar', 42, 34, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(2, 14, 38, 18); ctx.fillRect(8, 7, 26, 9);
    ctx.fillStyle = '#5b5467'; ctx.fillRect(4, 16, 34, 14); ctx.fillRect(10, 9, 22, 9);
    ctx.fillStyle = '#9a6dcc'; ctx.fillRect(19, 12, 4, 8);
  });
  canvas(scene, 'herb-bog-reed', 18, 20, (ctx) => {
    ctx.fillStyle = '#182821'; ctx.fillRect(8, 4, 2, 16); ctx.fillStyle = '#4b9c77'; ctx.fillRect(3, 7, 5, 3); ctx.fillRect(10, 3, 5, 4); ctx.fillRect(11, 12, 5, 3); ctx.fillStyle = '#a3f0c8'; ctx.fillRect(11, 4, 2, 2);
  });
  canvas(scene, 'glowcap', 18, 18, (ctx) => {
    ctx.fillStyle = '#1d2028'; ctx.fillRect(7, 8, 4, 9); ctx.fillStyle = '#7accc5'; ctx.fillRect(3, 4, 12, 6); ctx.fillRect(5, 2, 8, 4); ctx.fillStyle = '#d6fff7'; ctx.fillRect(6, 3, 3, 2);
  });
  canvas(scene, 'cargo', 24, 22, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(1, 3, 22, 18); ctx.fillStyle = '#6c4f35'; ctx.fillRect(3, 5, 18, 14); ctx.fillStyle = '#bd8b4c'; ctx.fillRect(10, 5, 4, 14); ctx.fillRect(3, 10, 18, 3); ctx.fillStyle = '#b9708d'; ctx.fillRect(11, 10, 2, 3);
  });
  canvas(scene, 'miner-tools', 22, 22, (ctx) => {
    ctx.fillStyle = '#272934'; ctx.fillRect(3, 14, 16, 6); ctx.fillStyle = '#9b7448'; ctx.fillRect(9, 3, 3, 15); ctx.fillStyle = '#aeb5bd'; ctx.fillRect(3, 2, 15, 4); ctx.fillRect(2, 4, 4, 3); ctx.fillRect(16, 4, 4, 3);
  });
  canvas(scene, 'chest-closed', 30, 24, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(1, 7, 28, 16); ctx.fillRect(4, 3, 22, 6); ctx.fillStyle = '#6d4b32'; ctx.fillRect(3, 9, 24, 12); ctx.fillStyle = '#8c6240'; ctx.fillRect(6, 5, 18, 5); ctx.fillStyle = '#d0a052'; ctx.fillRect(13, 8, 5, 9);
  });
  canvas(scene, 'chest-open', 30, 28, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(1, 12, 28, 15); ctx.fillRect(4, 2, 22, 5); ctx.fillStyle = '#6d4b32'; ctx.fillRect(3, 14, 24, 11); ctx.fillStyle = '#8c6240'; ctx.fillRect(6, 4, 18, 5); ctx.fillStyle = '#e4bd6a'; ctx.fillRect(13, 13, 5, 8);
  });
  canvas(scene, 'door-glow', 22, 30, (ctx) => {
    ctx.fillStyle = 'rgba(188,121,218,.15)'; ctx.fillRect(1, 1, 20, 28); ctx.fillStyle = '#b87bd0'; ctx.fillRect(2, 1, 2, 28); ctx.fillRect(18, 1, 2, 28); ctx.fillRect(2, 1, 18, 2);
  });
  canvas(scene, 'mine-lift', 42, 42, (ctx) => {
    ctx.fillStyle = '#171821'; ctx.fillRect(2, 5, 38, 35); ctx.fillStyle = '#514a43'; ctx.fillRect(5, 8, 32, 29); ctx.fillStyle = '#a27c4d'; ctx.fillRect(8, 10, 4, 25); ctx.fillRect(30, 10, 4, 25); ctx.fillRect(8, 18, 26, 4); ctx.fillStyle = '#d4b46e'; ctx.fillRect(19, 22, 4, 8);
  });
  canvas(scene, 'rift-core', 34, 42, (ctx) => {
    ctx.fillStyle = 'rgba(158,75,184,.25)'; ctx.fillRect(3, 4, 28, 34); ctx.fillStyle = '#1a1222'; ctx.fillRect(10, 3, 14, 36); ctx.fillStyle = '#7b3f96'; ctx.fillRect(12, 6, 10, 30); ctx.fillStyle = '#cf7ce8'; ctx.fillRect(15, 9, 5, 24); ctx.fillStyle = '#f0c8ff'; ctx.fillRect(16, 15, 3, 10); ctx.fillStyle = '#8c52a2'; ctx.fillRect(5, 9, 5, 6); ctx.fillRect(24, 26, 5, 6);
  });
  canvas(scene, 'firefly', 6, 6, (ctx) => { ctx.fillStyle = '#d9ff9c'; ctx.fillRect(2, 2, 2, 2); ctx.fillStyle = 'rgba(190,255,126,.35)'; ctx.fillRect(0, 2, 6, 2); ctx.fillRect(2, 0, 2, 6); });
  canvas(scene, 'ember', 6, 8, (ctx) => { ctx.fillStyle = '#ff6d3d'; ctx.fillRect(2, 2, 3, 5); ctx.fillStyle = '#ffd36a'; ctx.fillRect(3, 1, 2, 3); });
  canvas(scene, 'projectile-bolt', 14, 4, (ctx) => { ctx.fillStyle = '#e7d9ae'; ctx.fillRect(0, 1, 12, 2); ctx.fillStyle = '#7ab49f'; ctx.fillRect(11, 0, 3, 4); });
  canvas(scene, 'projectile-magic', 10, 10, (ctx) => { ctx.fillStyle = '#562c68'; ctx.fillRect(1, 1, 8, 8); ctx.fillStyle = '#d285ff'; ctx.fillRect(3, 2, 5, 5); ctx.fillStyle = '#fff'; ctx.fillRect(4, 3, 2, 2); });
}

function createEffects(scene: Phaser.Scene): void {
  canvas(scene, 'spark', 6, 6, (ctx) => { ctx.fillStyle = '#fff1a1'; ctx.fillRect(2, 0, 2, 6); ctx.fillRect(0, 2, 6, 2); });
  canvas(scene, 'shadow', 18, 7, (ctx) => { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(1, 2, 16, 4); ctx.fillRect(4, 1, 10, 6); });
  canvas(scene, 'pixel', 2, 2, (ctx) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 2, 2); });
}
