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
  directions.forEach((direction) => {
    for (let frame = 0; frame < 6; frame += 1) {
      const key = `hero-${direction}-${frame}`;
      canvas(scene, key, 24, 30, (ctx) => {
        const bob = frame === 1 || frame === 4 ? 1 : 0;
        const stride = frame === 1 || frame === 2 ? -2 : frame === 4 || frame === 5 ? 2 : 0;
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(4, 26, 16, 3);
        ctx.fillStyle = COLORS.outline;
        ctx.fillRect(6, 2 + bob, 12, 10);
        ctx.fillRect(3, 11 + bob, 18, 12);
        ctx.fillRect(5 + stride / 2, 22 + bob, 5, 7);
        ctx.fillRect(14 - stride / 2, 22 + bob, 5, 7);
        ctx.fillStyle = '#2b2639';
        ctx.fillRect(7, 2 + bob, 10, 4);
        ctx.fillRect(4, 12 + bob, 16, 10);
        ctx.fillStyle = '#9e425f';
        ctx.fillRect(5, 13 + bob, 14, 6);
        ctx.fillStyle = '#6a263e';
        ctx.fillRect(direction === 'side' ? 4 : 6, 18 + bob, direction === 'side' ? 14 : 12, 4);
        ctx.fillStyle = COLORS.skin;
        if (direction === 'up') ctx.fillRect(8, 6 + bob, 8, 5);
        else if (direction === 'side') ctx.fillRect(10, 6 + bob, 7, 5);
        else ctx.fillRect(8, 6 + bob, 8, 6);
        ctx.fillStyle = '#ece8f1';
        if (direction === 'down') { ctx.fillRect(9, 8 + bob, 2, 1); ctx.fillRect(14, 8 + bob, 2, 1); }
        if (direction === 'side') ctx.fillRect(15, 8 + bob, 2, 1);
        ctx.fillStyle = '#424a59';
        ctx.fillRect(5 + stride / 2, 24 + bob, 5, 4);
        ctx.fillRect(14 - stride / 2, 24 + bob, 5, 4);
        ctx.fillStyle = '#d4ad67';
        ctx.fillRect(direction === 'side' ? 5 : 2, 12 + bob, 2, 11);
        ctx.fillStyle = '#7f93a8';
        ctx.fillRect(direction === 'side' ? 4 : 1, 11 + bob, 4, 3);
        ctx.fillStyle = '#c2c8d3';
        ctx.fillRect(8, 11 + bob, 8, 2);
      });
    }
  });
}

function createNpcTextures(scene: Phaser.Scene): void {
  const palettes = [
    ['#6d477e', '#c69acb'], ['#6d4b32', '#db9f54'], ['#4b5f5b', '#8db3a5'],
    ['#3b664f', '#7fbd7a'], ['#745266', '#c691a8'], ['#66543f', '#b69772'], ['#455c70', '#7399b6'],
  ];
  palettes.push(['#326759', '#77c2a0'], ['#6f5435', '#c89c62'], ['#743d3d', '#df7965']);
  palettes.forEach((palette, index) => {
    canvas(scene, `npc-${index}`, 22, 30, (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(4, 27, 14, 2);
      ctx.fillStyle = COLORS.outline;
      ctx.fillRect(6, 2, 10, 10); ctx.fillRect(3, 11, 16, 13); ctx.fillRect(5, 23, 5, 6); ctx.fillRect(13, 23, 5, 6);
      ctx.fillStyle = palette[0];
      ctx.fillRect(7, 2, 8, 4); ctx.fillRect(4, 12, 14, 11);
      ctx.fillStyle = palette[1];
      ctx.fillRect(5, 13, 12, 4); ctx.fillRect(6, 21, 10, 2);
      ctx.fillStyle = COLORS.skin;
      ctx.fillRect(7, 6, 8, 5);
      ctx.fillStyle = '#f2edf0';
      ctx.fillRect(8, 8, 1, 1); ctx.fillRect(13, 8, 1, 1);
      ctx.fillStyle = '#382d36'; ctx.fillRect(10, 10, 3, 1);
      ctx.fillStyle = '#404653'; ctx.fillRect(5, 25, 5, 3); ctx.fillRect(13, 25, 5, 3);
      if (index === 1) { ctx.fillStyle = '#e28a48'; ctx.fillRect(2, 15, 2, 8); }
      if (index === 7) { ctx.fillStyle = '#87d8b5'; ctx.fillRect(5, 4, 2, 3); ctx.fillRect(15, 4, 2, 3); }
    });
  });
}

function createEnemyTextures(scene: Phaser.Scene): void {
  const makeEnemy = (key: string, body: string, eye: string, shape: 'humanoid' | 'wolf' | 'boss') => {
    const size = shape === 'boss' ? 36 : 26;
    canvas(scene, `enemy-${key}`, size, size, (ctx) => {
      ctx.fillStyle = COLORS.outline;
      if (shape === 'wolf') {
        ctx.fillRect(2, 8, 18, 9); ctx.fillRect(4, 4, 7, 7); ctx.fillRect(4, 3, 2, 3); ctx.fillRect(9, 3, 2, 3);
        ctx.fillRect(4, 16, 4, 5); ctx.fillRect(15, 16, 4, 5);
        ctx.fillStyle = body; ctx.fillRect(3, 9, 16, 7); ctx.fillRect(5, 5, 6, 6);
        ctx.fillStyle = eye; ctx.fillRect(6, 7, 1, 1);
      } else {
        const w = shape === 'boss' ? 20 : 12;
        const x = (size - w) / 2;
        ctx.fillRect(x + 3, 2, w - 6, 9); ctx.fillRect(x, 10, w, size - 14);
        ctx.fillRect(x + 2, size - 5, 5, 5); ctx.fillRect(x + w - 7, size - 5, 5, 5);
        ctx.fillStyle = body; ctx.fillRect(x + 4, 3, w - 8, 7); ctx.fillRect(x + 1, 11, w - 2, size - 16);
        ctx.fillStyle = eye; ctx.fillRect(x + 5, 6, 2, 2); ctx.fillRect(x + w - 7, 6, 2, 2);
        if (shape === 'boss') { ctx.fillRect(x - 2, 4, 3, 11); ctx.fillRect(x + w - 1, 4, 3, 11); }
      }
    });
  };
  makeEnemy('husk', '#758069', '#d7d089', 'humanoid');
  makeEnemy('boneguard', '#cfc1a4', '#ef7159', 'humanoid');
  makeEnemy('direwolf', '#6d637b', '#da6570', 'wolf');
  makeEnemy('wraith', '#655596', '#bda7ff', 'humanoid');
  makeEnemy('bogling', '#3f7767', '#a8ffd7', 'humanoid');
  makeEnemy('cavecrawler', '#7d624d', '#f0bd72', 'wolf');
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
