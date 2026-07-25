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
    for (let frame = 0; frame < 4; frame += 1) {
      const key = `hero-${direction}-${frame}`;
      canvas(scene, key, 20, 24, (ctx) => {
        const bob = frame % 2;
        const leg = frame === 1 ? -1 : frame === 3 ? 1 : 0;
        ctx.fillStyle = COLORS.outline;
        ctx.fillRect(5, 2 + bob, 10, 8);
        ctx.fillRect(3, 9 + bob, 14, 10);
        ctx.fillRect(5 + leg, 18 + bob, 4, 5);
        ctx.fillRect(11 - leg, 18 + bob, 4, 5);
        ctx.fillStyle = '#332d42';
        ctx.fillRect(6, 2 + bob, 8, 3);
        ctx.fillRect(4, 10 + bob, 12, 8);
        ctx.fillStyle = '#8f4058';
        ctx.fillRect(5, 11 + bob, 10, 5);
        ctx.fillStyle = COLORS.skin;
        if (direction === 'up') ctx.fillRect(7, 5 + bob, 6, 4);
        else if (direction === 'side') ctx.fillRect(8, 5 + bob, 6, 4);
        else ctx.fillRect(7, 5 + bob, 6, 5);
        ctx.fillStyle = '#d7dbe4';
        if (direction !== 'up') ctx.fillRect(direction === 'side' ? 12 : 8, 6 + bob, 1, 1);
        ctx.fillStyle = '#5d6676';
        ctx.fillRect(5 + leg, 19 + bob, 4, 3);
        ctx.fillRect(11 - leg, 19 + bob, 4, 3);
        ctx.fillStyle = '#c59b5d';
        ctx.fillRect(3, 10 + bob, 2, 8);
      });
    }
  });
}

function createNpcTextures(scene: Phaser.Scene): void {
  const palettes = [
    ['#6d477e', '#c69acb'], ['#6d4b32', '#db9f54'], ['#4b5f5b', '#8db3a5'],
    ['#3b664f', '#7fbd7a'], ['#745266', '#c691a8'], ['#66543f', '#b69772'], ['#455c70', '#7399b6'],
  ];
  palettes.forEach((palette, index) => {
    canvas(scene, `npc-${index}`, 18, 24, (ctx) => {
      ctx.fillStyle = COLORS.outline;
      ctx.fillRect(5, 2, 8, 8);
      ctx.fillRect(3, 9, 12, 11);
      ctx.fillRect(4, 19, 4, 5);
      ctx.fillRect(10, 19, 4, 5);
      ctx.fillStyle = palette[0];
      ctx.fillRect(6, 2, 6, 3);
      ctx.fillRect(4, 10, 10, 9);
      ctx.fillStyle = palette[1];
      ctx.fillRect(5, 11, 8, 3);
      ctx.fillStyle = COLORS.skin;
      ctx.fillRect(6, 5, 6, 4);
      ctx.fillStyle = '#e8e3d9';
      ctx.fillRect(7, 6, 1, 1);
      ctx.fillRect(10, 6, 1, 1);
    });
  });
}

function createEnemyTextures(scene: Phaser.Scene): void {
  const makeEnemy = (key: string, body: string, eye: string, shape: 'humanoid' | 'wolf' | 'boss') => {
    const size = shape === 'boss' ? 30 : 22;
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
  makeEnemy('nameless', '#8f416e', '#ffc1e4', 'boss');
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
  canvas(scene, 'projectile-bolt', 14, 4, (ctx) => { ctx.fillStyle = '#e7d9ae'; ctx.fillRect(0, 1, 12, 2); ctx.fillStyle = '#7ab49f'; ctx.fillRect(11, 0, 3, 4); });
  canvas(scene, 'projectile-magic', 10, 10, (ctx) => { ctx.fillStyle = '#562c68'; ctx.fillRect(1, 1, 8, 8); ctx.fillStyle = '#d285ff'; ctx.fillRect(3, 2, 5, 5); ctx.fillStyle = '#fff'; ctx.fillRect(4, 3, 2, 2); });
}

function createEffects(scene: Phaser.Scene): void {
  canvas(scene, 'spark', 6, 6, (ctx) => { ctx.fillStyle = '#fff1a1'; ctx.fillRect(2, 0, 2, 6); ctx.fillRect(0, 2, 6, 2); });
  canvas(scene, 'shadow', 18, 7, (ctx) => { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(1, 2, 16, 4); ctx.fillRect(4, 1, 10, 6); });
  canvas(scene, 'pixel', 2, 2, (ctx) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 2, 2); });
}
