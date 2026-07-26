(function(){
  var registry = {}, cache = {};
  function __define(id, fn){ registry[id] = fn; }
  function __req(id){
    if (cache[id]) return cache[id].exports;
    var module = { exports: {} };
    cache[id] = module;
    var fn = registry[id];
    if (!fn) { console.error('missing module', id); return module.exports; }
    fn(module.exports, module, __req);
    return module.exports;
  }
__define("src/main.ts", function(exports, module, __req){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
({});
const BootScene_1 = __req("src/game/BootScene.ts");
const MenuScene_1 = __req("src/game/MenuScene.ts");
const WorldScene_1 = __req("src/game/WorldScene.ts");
const InteriorScene_1 = __req("src/game/InteriorScene.ts");
const config = {
    type: phaser_1.default.AUTO,
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
        mode: phaser_1.default.Scale.RESIZE,
        autoCenter: phaser_1.default.Scale.NO_CENTER,
        fullscreenTarget: 'app',
    },
    input: {
        activePointers: 4,
    },
    scene: [BootScene_1.BootScene, MenuScene_1.MenuScene, WorldScene_1.WorldScene, InteriorScene_1.InteriorScene],
};
const game = new phaser_1.default.Game(config);
window.addEventListener('beforeunload', () => game.destroy(true));

});
__define("src/game/BootScene.ts", function(exports, module, __req){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootScene = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
const TextureFactory_1 = __req("src/systems/TextureFactory.ts");
const hero_1 = __req("src/systems/sprites/hero.ts");
const enemies_1 = __req("src/systems/sprites/enemies.ts");
const npcs_1 = __req("src/systems/sprites/npcs.ts");
class BootScene extends phaser_1.default.Scene {
    constructor() {
        super('BootScene');
    }
    create() {
        (0, TextureFactory_1.createPixelTextures)(this);
        this.createAnimations();
        this.scene.start('MenuScene');
    }
    /**
     * Registers animations from the sprite factories' own frame tables, so adding a
     * pose or direction to the art produces a playable animation without editing
     * this file.
     */
    createAnimations() {
        const define = (key, frames, frameRate, repeat) => {
            if (this.anims.exists(key) || frames.length === 0)
                return;
            // Skip animations whose textures failed to bake rather than registering a
            // broken animation, which Phaser would render as a missing-texture box.
            if (!frames.every((frame) => this.textures.exists(frame)))
                return;
            this.anims.create({ key, frames: frames.map((frame) => ({ key: frame })), frameRate, repeat });
        };
        // Per-pose playback rates: walking is brisk, idle breathing is slow, attacks
        // are fast enough to feel responsive while staying readable.
        const heroRates = {
            walk: { rate: 12, repeat: -1 },
            idle: { rate: 3.4, repeat: -1 },
            attack: { rate: 18, repeat: 0 },
            dash: { rate: 1, repeat: 0 },
            hurt: { rate: 1, repeat: 0 },
        };
        for (const dir of hero_1.HERO_DIRS) {
            for (const pose of Object.keys(hero_1.HERO_POSE_FRAMES)) {
                const frames = Array.from({ length: hero_1.HERO_POSE_FRAMES[pose] }, (_, index) => (0, hero_1.heroKey)(dir, pose, index));
                const { rate, repeat } = heroRates[pose];
                define(`hero-${dir}-${pose}`, frames, rate, repeat);
            }
        }
        // Legacy walk animation keys, kept so older call sites still resolve.
        for (const legacy of ['down', 'up', 'side']) {
            define(`hero-walk-${legacy}`, Array.from({ length: 8 }, (_, index) => `hero-${legacy}-${index}`), 11, -1);
        }
        const enemyRates = {
            idle: { rate: 3.2, repeat: -1 },
            walk: { rate: 8.5, repeat: -1 },
            attack: { rate: 12, repeat: 0 },
            hurt: { rate: 1, repeat: 0 },
            death: { rate: 8, repeat: 0 },
        };
        for (const id of enemies_1.ENEMY_IDS) {
            for (const pose of Object.keys(enemies_1.ENEMY_POSE_FRAMES)) {
                const frames = Array.from({ length: enemies_1.ENEMY_POSE_FRAMES[pose] }, (_, index) => (0, enemies_1.enemyKey)(id, pose, index));
                const { rate, repeat } = enemyRates[pose];
                define(`enemy-${id}-${pose}`, frames, rate, repeat);
            }
        }
        for (let index = 0; index < 10; index += 1) {
            for (const pose of Object.keys(npcs_1.NPC_POSE_FRAMES)) {
                const frames = Array.from({ length: npcs_1.NPC_POSE_FRAMES[pose] }, (_, frame) => (0, npcs_1.npcKey)(index, pose, frame));
                define(`npc-${index}-${pose}`, frames, pose === 'talk' ? 6 : 2.8, -1);
            }
        }
    }
}
exports.BootScene = BootScene;

});
__define("src/systems/TextureFactory.ts", function(exports, module, __req){
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPixelTextures = createPixelTextures;
const buildings_1 = __req("src/systems/sprites/buildings.ts");
const enemies_1 = __req("src/systems/sprites/enemies.ts");
const hero_1 = __req("src/systems/sprites/hero.ts");
const npcs_1 = __req("src/systems/sprites/npcs.ts");
const props_1 = __req("src/systems/sprites/props.ts");
const weapons_1 = __req("src/systems/sprites/weapons.ts");
const TextureBridge_1 = __req("src/systems/render/TextureBridge.ts");
const Lighting_1 = __req("src/systems/world/Lighting.ts");
const world_1 = __req("src/data/world.ts");
function createPixelTextures(scene) {
    (0, TextureBridge_1.registerAll)(scene, (0, hero_1.buildHeroFrames)(), hero_1.HERO_SHADE);
    createLegacyHeroAliases(scene);
    (0, TextureBridge_1.registerAll)(scene, (0, npcs_1.buildNpcFrames)(), npcs_1.NPC_SHADE);
    (0, TextureBridge_1.registerAll)(scene, (0, enemies_1.buildEnemyFrames)(), enemies_1.ENEMY_SHADE);
    (0, TextureBridge_1.registerAll)(scene, (0, weapons_1.buildWeaponFrames)(), weapons_1.WEAPON_SHADE);
    (0, TextureBridge_1.registerAll)(scene, (0, props_1.buildPropFrames)(), props_1.PROP_SHADE);
    createBuildingTextures(scene);
    createUtilityTextures(scene);
    Lighting_1.LightingSystem.createLightTexture(scene);
}
/**
 * The old art had three directions (`down`/`up`/`side`) with an 8-frame walk and
 * keys shaped `hero-{dir}-{frame}`. The new art has five directions and named
 * poses, so we alias the old keys onto the new walk frames — existing animation
 * definitions and the smoke tests continue to resolve.
 */
function createLegacyHeroAliases(scene) {
    const legacy = [
        { legacyDir: 'down', dir: 'down' },
        { legacyDir: 'up', dir: 'up' },
        { legacyDir: 'side', dir: 'side' },
    ];
    for (const { legacyDir, dir } of legacy) {
        for (let frame = 0; frame < 8; frame += 1) {
            const key = `hero-${legacyDir}-${frame}`;
            if (scene.textures.exists(key))
                continue;
            const source = (0, hero_1.heroKey)(dir, 'walk', frame);
            if (scene.textures.exists(source)) {
                // Phaser has no true alias, so re-bake from the same builder.
                (0, TextureBridge_1.registerAll)(scene, [{ key, canvas: (0, hero_1.renderHeroFrame)(dir, 'walk', frame) }], hero_1.HERO_SHADE);
            }
        }
    }
}
function createBuildingTextures(scene) {
    const specs = world_1.BUILDINGS.map((building) => {
        var _a;
        return ({
            id: building.id,
            name: building.name,
            w: building.w,
            h: building.h,
            wall: building.wall,
            roof: building.roof,
            doorX: building.doorX,
            style: (_a = building.style) !== null && _a !== void 0 ? _a : 'home',
        });
    });
    (0, TextureBridge_1.registerAll)(scene, (0, buildings_1.buildBuildingFrames)(specs), buildings_1.BUILDING_SHADE);
}
/**
 * Textures that are simpler to express as direct canvas paints than as sculpted
 * sprites: gradients, soft masks and single pixels used by particle systems.
 */
function createUtilityTextures(scene) {
    (0, TextureBridge_1.rawTexture)(scene, 'pixel', 2, 2, (ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 2, 2);
    });
    (0, TextureBridge_1.rawTexture)(scene, 'shadow', 24, 10, (ctx) => {
        const gradient = ctx.createRadialGradient(12, 5, 0, 12, 5, 12);
        gradient.addColorStop(0, 'rgba(6,7,12,0.5)');
        gradient.addColorStop(0.65, 'rgba(6,7,12,0.22)');
        gradient.addColorStop(1, 'rgba(6,7,12,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 24, 10);
    });
    (0, TextureBridge_1.rawTexture)(scene, 'spark', 8, 8, (ctx) => {
        const gradient = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
        gradient.addColorStop(0, 'rgba(255,246,206,1)');
        gradient.addColorStop(0.5, 'rgba(255,214,122,0.6)');
        gradient.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 8, 8);
    });
    // Soft circular glow used for hit flashes and pickup pings.
    (0, TextureBridge_1.rawTexture)(scene, 'glow-soft', 64, 64, (ctx) => {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
    });
    // Slash arc for melee swings — a crescent that reads as a blade path.
    (0, TextureBridge_1.rawTexture)(scene, 'slash-arc', 56, 56, (ctx) => {
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
    (0, TextureBridge_1.rawTexture)(scene, 'impact-ring', 48, 24, (ctx) => {
        ctx.strokeStyle = 'rgba(228,214,196,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(24, 12, 20, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
    });
}

});
__define("src/systems/sprites/buildings.ts", function(exports, module, __req){
"use strict";
/**
 * Building sprites for Trupy — sculpted pseudo-3D architecture.
 *
 * A top-down action-RPG reads as flat the instant its houses are rectangles.
 * These builders rebuild the nine world buildings as *volumes*: every structure
 * shows a lit front face and a shadowed receding side face, a roof with genuine
 * thickness (pitched roofs have two slopes meeting at a ridge, flat roofs a
 * parapet with a visible top and a shadowed inner face), an eave overhang that
 * casts a shadow band down onto the wall, recessed windows and doors with jamb
 * thickness, and a soft cast shadow anchoring the whole thing to the ground.
 *
 * Lighting convention matches the rest of the game: the key light comes from the
 * upper-left (see DEFAULT_SHADE / PROP_SHADE). So throughout this file:
 *   - the FRONT face (normal toward camera) reads at full light,
 *   - the RIGHT side face recedes into shadow (it faces away from the light),
 *   - roof LEFT/UPPER slopes are lit, RIGHT/LOWER slopes are shadowed,
 *   - the ground shadow is thrown DOWN and slightly RIGHT.
 * Keeping that single rule everywhere is what makes the buildings feel lit by
 * the same sun as the trees and the hero.
 *
 * COORDINATE CONTRACT (important for integration):
 * The renderer works in world units (1 canvas pixel = 1 world unit, matching the
 * old flat WorldScene.drawBuildings). The wall body is exactly `w × h` world
 * units, and it is placed CENTRED in the canvas both axes — so the finished
 * texture can be dropped with `add.image(building.x, building.y, key)` at the
 * default origin (0.5, 0.5) and the wall body lands precisely on the collision
 * box WorldScene builds from `w`, `h` and `doorX`. Roof volume, spires, side
 * faces, eaves and the cast shadow all live inside the surrounding margin, so
 * they overhang the collision box visually without shifting the anchor. The
 * door opening is centred on `doorX` at the wall's bottom edge, matching
 * `getBuildingDoor()`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILDING_SHADE = void 0;
exports.renderBuilding = renderBuilding;
exports.buildingKey = buildingKey;
exports.buildBuildingFrames = buildBuildingFrames;
const PixelCanvas_1 = __req("src/systems/render/PixelCanvas.ts");
const Palette_1 = __req("src/systems/render/Palette.ts");
/**
 * Shading for buildings. Close to PROP_SHADE so a house is lit like everything
 * around it, but with a little more directional intensity and a touch less rim:
 * big flat faces want a clear light/shadow split across the two visible sides,
 * and a strong rim on a large silhouette would just look like a glowing outline.
 */
exports.BUILDING_SHADE = {
    lightX: -0.55,
    lightY: -0.72,
    lightZ: 0.44,
    intensity: 0.66,
    ambient: 0.5,
    ambientColor: '#4f5f8c',
    occlusion: 0.4,
    rim: 0.16,
    rimColor: '#9fb0dc',
    bands: 5,
    dither: 0.42,
};
const OUTLINE = '#111019';
const RIM = '#8b97bf';
/** Shared keyline pass: dark silhouette line with a faint cool lit edge up-left. */
function finish(c) {
    c.outline(OUTLINE, { lightEdge: (0, Palette_1.mix)(OUTLINE, RIM, 0.5), alpha: 0.9 });
}
function marginsFor(style, w, h) {
    // Depth of the receding side face — scales gently with size so big buildings
    // don't look shallow and small ones don't look like they're toppling over.
    const depth = Math.round(Math.min(30, Math.max(16, w * 0.11)));
    const eave = 10; // roof overhang past the wall, both sides
    const shadow = Math.round(Math.max(20, h * 0.16));
    switch (style) {
        case 'chapel':
            // Tall pitched roof + bell tower/spire well above the wall top.
            return { top: Math.round(h * 0.95 + 30), side: depth + eave + 6, bottom: shadow };
        case 'inn':
            // Two-storey pitch + a hanging sign bracket sticking out the side.
            return { top: Math.round(h * 0.5 + 22), side: depth + eave + 18, bottom: shadow };
        case 'forge':
            // Tall chimney with a smoke plume above it.
            return { top: Math.round(h * 0.62 + 26), side: depth + eave + 6, bottom: shadow };
        case 'citadel':
            // Crenellated parapet + banners; not very tall but wide-shouldered.
            return { top: Math.round(h * 0.34 + 26), side: depth + eave + 10, bottom: shadow };
        case 'warehouse':
            return { top: Math.round(h * 0.34 + 18), side: depth + eave + 6, bottom: shadow };
        case 'marsh':
            // Stilts raise the hut; shadow falls under the raised floor.
            return { top: Math.round(h * 0.42 + 20), side: depth + eave + 8, bottom: Math.round(shadow + h * 0.12) };
        case 'cottage':
            return { top: Math.round(h * 0.5 + 18), side: depth + eave + 4, bottom: shadow };
        case 'home':
        default:
            return { top: Math.round(h * 0.55 + 18), side: depth + eave + 4, bottom: shadow };
    }
}
function makeFrame(spec) {
    const { w, h, style } = spec;
    const m = marginsFor(style, w, h);
    const vert = Math.max(m.top, m.bottom);
    const cw = w + m.side * 2;
    const ch = h + vert * 2;
    const c = new PixelCanvas_1.PixelCanvas(cw, ch);
    const wx = m.side;
    const wy = vert;
    const depth = Math.round(Math.min(30, Math.max(16, w * 0.11)));
    return {
        c,
        wx, wy, w, h,
        left: wx, right: wx + w, top: wy, bottom: wy + h,
        cx: wx + w / 2,
        doorCx: wx + w / 2 + spec.doorX,
        depth,
        wall: (0, Palette_1.intToHex)(spec.wall),
        roof: (0, Palette_1.intToHex)(spec.roof),
    };
}
// ---------------------------------------------------------------------------
// Shared volume primitives
// ---------------------------------------------------------------------------
/**
 * The two-face body: a lit flat front and a shadowed side receding up-and-right.
 * This is the single most important trick — a parallelogram side face pinned to
 * the front's right edge instantly reads as "a box seen in 3/4" instead of a
 * flat panel. Height is set so occlusion/depth-sort treats it as a tall object.
 */
function boxBody(f, x, y, w, h, base, opts = {}) {
    var _a, _b;
    const depth = f.depth;
    const height = (_a = opts.height) !== null && _a !== void 0 ? _a : 40;
    const side = (0, Palette_1.shift)(base, -0.14, 8); // receding face drifts cooler + darker
    // Side face first (behind the front), as a parallelogram sheared up-right.
    f.c.polygon([
        [x + w, y],
        [x + w + depth, y - depth * 0.62],
        [x + w + depth, y + h - depth * 0.62],
        [x + w, y + h],
    ], side, { shape: 'flat', height, shade: (_b = opts.sideShade) !== null && _b !== void 0 ? _b : 0.82 });
    // Front face, flat and lit.
    f.c.rect(x, y, w, h, base, { shape: 'flat', height });
}
/**
 * A roof cap that sits over the top edge of the (already-drawn) side face, so the
 * box reads as capped rather than open. A thin lit sliver along the top-front
 * edge sells the eave thickness.
 */
function boxTopCap(f, x, y, w, base) {
    const depth = f.depth;
    f.c.polygon([
        [x, y],
        [x + w, y],
        [x + w + depth, y - depth * 0.62],
        [x + depth, y - depth * 0.62],
    ], (0, Palette_1.shift)(base, 0.06), { shape: 'flat', height: 44 });
}
/**
 * Eave shadow: a dark band painted onto the top of the wall just under the roof
 * overhang. Alpha-composited so it darkens whatever wall/timbering is beneath.
 * This one detail does more for perceived depth than anything else — it says the
 * roof physically projects out over the wall and blocks the sky light.
 */
function eaveShadow(f, x, y, w, band = 6) {
    f.c.rect(x, y, w, band, '#0c0b12', { shape: 'flat', height: 39, emissive: true, alpha: 0.34 });
    f.c.rect(x, y, w, Math.max(1, Math.round(band / 3)), '#0c0b12', { shape: 'flat', height: 39, emissive: true, alpha: 0.28 });
}
/**
 * A pitched (gable) roof shown in 3/4: an upper-left lit slope and a lower-right
 * shadowed slope meeting at a ridge, plus a shadowed right gable-end so the roof
 * has thickness on the side that matches the body's side face. `overL/overR`
 * push the eaves out past the wall to create the overhang.
 */
function gableRoof(f, left, right, eaveY, ridgeY, base, opts = {}) {
    var _a, _b, _c;
    const overL = (_a = opts.overL) !== null && _a !== void 0 ? _a : 10;
    const overR = (_b = opts.overR) !== null && _b !== void 0 ? _b : 10;
    const depth = f.depth;
    const midX = (left + right) / 2 + ((_c = opts.ridgeShift) !== null && _c !== void 0 ? _c : 0);
    const el = left - overL;
    const er = right + overR;
    // World roof colours are near-black; a plain lightness shift barely moves such
    // a dark base, so the lit slope is MIXED toward a warm moon-grey to guarantee
    // a readable fold, while the shadow slope only lifts a touch off the base.
    // This is the difference between "one dark mass" and "two planes meeting".
    const lit = (0, Palette_1.mix)((0, Palette_1.shift)(base, 0.06, -6), '#8f8496', 0.42);
    const dark = (0, Palette_1.shift)(base, 0.03, 12);
    const ridgeBack = ridgeY - depth * 0.62;
    // Lower-right shadowed slope (draw first; the lit slope overlaps its ridge).
    f.c.polygon([
        [midX, ridgeY],
        [er, eaveY],
        [er + depth, eaveY - depth * 0.62],
        [midX + depth, ridgeBack],
    ], dark, { shape: 'flat', height: 48, shade: 0.9 });
    // Right gable end (the triangular thickness of the roof on the receding side)
    // — the darkest roof plane since it faces away from the light entirely.
    f.c.polygon([
        [er, eaveY],
        [er + depth, eaveY - depth * 0.62],
        [midX + depth, ridgeBack],
        [midX, ridgeY],
    ], (0, Palette_1.shift)(base, -0.04, 12), { shape: 'flat', height: 47, shade: 0.72 });
    // Upper-left lit slope.
    f.c.polygon([
        [el, eaveY],
        [midX, ridgeY],
        [midX + depth, ridgeBack],
        [el + depth, eaveY - depth * 0.62],
    ], lit, { shape: 'flat', height: 49 });
    // Ridge cap: a bright crest where the slopes meet, plus the shadowed hip line
    // down the right so the two planes read as genuinely folded.
    f.c.line(el + 1, eaveY - 1, midX, ridgeY - 1, (0, Palette_1.shift)(lit, 0.14), 2, { height: 50, emissive: true, alpha: 0.5 });
    f.c.line(midX, ridgeY, midX + depth, ridgeBack, (0, Palette_1.shift)(lit, 0.2), 2, { height: 51, emissive: true, alpha: 0.6 });
    f.c.line(er - 1, eaveY - 1, midX, ridgeY, '#0d0c12', 1, { height: 49, emissive: true, alpha: 0.4 });
}
/**
 * Combing / tiling / corrugation lines that run PARALLEL to a roof slope. Given
 * the eave endpoint and the ridge apex of a slope, we walk points along the eave
 * and draw short strokes toward the ridge — so texture follows the pitch instead
 * of fanning from a point (which is what read as scratches in the first pass).
 */
function slopeTexture(f, eaveA, eaveB, apex, color, opts = {}) {
    var _a, _b, _c;
    const step = (_a = opts.step) !== null && _a !== void 0 ? _a : 9;
    const frac = (_b = opts.frac) !== null && _b !== void 0 ? _b : 0.72;
    const alpha = (_c = opts.alpha) !== null && _c !== void 0 ? _c : 0.42;
    const span = Math.hypot(eaveB[0] - eaveA[0], eaveB[1] - eaveA[1]);
    const n = Math.max(2, Math.round(span / step));
    for (let i = 1; i < n; i += 1) {
        const t = i / n;
        const sx = eaveA[0] + (eaveB[0] - eaveA[0]) * t;
        const sy = eaveA[1] + (eaveB[1] - eaveA[1]) * t;
        // Toward the apex, but only part-way, so strokes don't collide at the ridge.
        const ex = sx + (apex[0] - sx) * frac;
        const ey = sy + (apex[1] - sy) * frac;
        f.c.line(sx, sy, ex, ey, color, 1, { height: 49, shade: 0.9, alpha });
    }
}
/**
 * A flat/battlemented roof: a parapet ring with a lit top surface, a shadowed
 * inner face (the wall-walk drops away from the light), and — for citadels — a
 * row of merlons. Reads as a solid mass with a walkable top, not a lid.
 */
function parapetRoof(f, left, right, topY, base, opts = {}) {
    var _a;
    const over = (_a = opts.over) !== null && _a !== void 0 ? _a : 10;
    const depth = f.depth;
    const el = left - over;
    const er = right + over;
    const wallTop = (0, Palette_1.shift)(base, 0.08, -4);
    const inner = (0, Palette_1.shift)(base, -0.2, 10);
    const parapetH = Math.round(depth * 0.9);
    // Top surface of the parapet (lit), seen as a receding band.
    f.c.polygon([
        [el, topY],
        [er, topY],
        [er + depth, topY - depth * 0.62],
        [el + depth, topY - depth * 0.62],
    ], wallTop, { shape: 'flat', height: 46 });
    // Inner face dropping into the roof court (shadow).
    f.c.polygon([
        [el, topY],
        [er, topY],
        [er, topY + parapetH],
        [el, topY + parapetH],
    ], inner, { shape: 'flat', height: 44, shade: 0.72 });
    // Front lip of the parapet catching light.
    f.c.rect(el, topY + parapetH - 2, er - el, 2, (0, Palette_1.shift)(wallTop, 0.06), { shape: 'flat', height: 45 });
    if (opts.crenellate) {
        // Merlons standing up off the top band; each shows a lit cap and a shadowed
        // right cheek so the battlement itself has little volumes.
        const step = Math.max(20, Math.round((er - el) / 7));
        const merlonW = Math.round(step * 0.55);
        const merlonH = Math.round(depth * 0.8);
        for (let mx = el; mx <= er - merlonW; mx += step) {
            f.c.rect(mx, topY - merlonH, merlonW, merlonH, base, { shape: 'flat', height: 50 });
            f.c.polygon([
                [mx + merlonW, topY - merlonH],
                [mx + merlonW + depth * 0.5, topY - merlonH - depth * 0.31],
                [mx + merlonW + depth * 0.5, topY - depth * 0.31],
                [mx + merlonW, topY],
            ], (0, Palette_1.shift)(base, -0.16, 8), { shape: 'flat', height: 50, shade: 0.8 });
            f.c.polygon([
                [mx, topY - merlonH],
                [mx + merlonW, topY - merlonH],
                [mx + merlonW + depth * 0.5, topY - merlonH - depth * 0.31],
                [mx + depth * 0.5, topY - merlonH - depth * 0.31],
            ], wallTop, { shape: 'flat', height: 51 });
        }
    }
}
/**
 * A recessed window: a dark inset (the opening in shadow) framed by a jamb, with
 * a lit sill jutting below and a lit top-left jamb — the recess and the sill
 * lip are what read as depth. Optionally emissive (lit from within at night).
 */
function window(f, x, y, w, h, glass, opts = {}) {
    const frame = (0, Palette_1.shift)(f.wall, -0.16, 6);
    const frameLit = (0, Palette_1.shift)(f.wall, 0.1);
    // Jamb block behind everything.
    f.c.rect(x - 2, y - 2, w + 4, h + 4, frame, { shape: 'flat', height: 38 });
    // The glass/opening, recessed (pre-darkened via shade unless it's glowing).
    if (opts.emissive) {
        f.c.rect(x, y, w, h, glass, { shape: 'flat', height: 36, emissive: true });
        // Warm spill onto the sill and a soft halo.
        f.c.ellipse(x + w / 2, y + h + 2, w * 0.7, 3, glass, { shape: 'flat', height: 36, emissive: true, alpha: 0.3 });
    }
    else {
        f.c.rect(x, y, w, h, glass, { shape: 'flat', height: 36, shade: 0.62 });
        // A cool sky glint in the upper-left corner of the pane.
        f.c.rect(x + 1, y + 1, Math.max(1, w - 4), Math.max(1, Math.round(h * 0.35)), (0, Palette_1.shift)(glass, 0.14), { shape: 'flat', height: 36, shade: 0.85, alpha: 0.6 });
    }
    if (opts.arch) {
        // Round the top: a dark half-disc opening + a frame arc above.
        f.c.ellipse(x + w / 2, y, w / 2, w / 2, opts.emissive ? glass : (0, Palette_1.shift)(glass, -0.06), { shape: 'flat', height: 36, emissive: opts.emissive, shade: opts.emissive ? 1 : 0.6 });
        f.c.ellipse(x + w / 2, y, w / 2 + 2, w / 2 + 2, frame, { shape: 'flat', height: 37, alpha: 0.0 });
    }
    if (opts.mullion) {
        f.c.rect(x + Math.round(w / 2), y, 1, h, frame, { shape: 'flat', height: 37 });
        f.c.rect(x, y + Math.round(h / 2), w, 1, frame, { shape: 'flat', height: 37 });
    }
    // Lit top-left jamb edge (light catches the near side of the reveal).
    f.c.rect(x - 2, y - 2, 1, h + 3, frameLit, { shape: 'flat', height: 39 });
    f.c.rect(x - 2, y - 2, w + 3, 1, frameLit, { shape: 'flat', height: 39 });
    // Sill: a lit lip that projects below the opening.
    f.c.rect(x - 3, y + h + 1, w + 6, 2, (0, Palette_1.shift)(f.wall, 0.12), { shape: 'flat', height: 40 });
    f.c.rect(x - 3, y + h + 3, w + 6, 1, (0, Palette_1.shift)(f.wall, -0.1), { shape: 'flat', height: 39, shade: 0.8 });
}
/**
 * A doorway: a recessed dark opening with a thick frame (visible jamb on the lit
 * side), a lintel, and a small handle. Sits at the wall's bottom edge, centred
 * on `doorCx`. Returns nothing — purely decorative; collision is WorldScene's.
 */
function doorway(f, opts = {}) {
    var _a, _b;
    const dw = (_a = opts.w) !== null && _a !== void 0 ? _a : 42;
    const dh = (_b = opts.h) !== null && _b !== void 0 ? _b : 54;
    const x = Math.round(f.doorCx - dw / 2);
    const y = f.bottom - dh;
    const frame = (0, Palette_1.shift)(f.wall, -0.2, 6);
    const frameLit = (0, Palette_1.shift)(f.wall, 0.12);
    // Frame slab.
    f.c.rect(x - 4, y - 4, dw + 8, dh + 4, frame, { shape: 'flat', height: 41 });
    // Recessed opening — very dark, warm hint if it leads inside.
    const inside = opts.interiorHint ? (0, Palette_1.mix)('#191016', '#3a2418', 0.4) : '#141019';
    f.c.rect(x, y, dw, dh, inside, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
    if (opts.arched) {
        f.c.ellipse(x + dw / 2, y, dw / 2, dw / 2, frame, { shape: 'flat', height: 41 });
        f.c.ellipse(x + dw / 2, y + 1, dw / 2 - 3, dw / 2 - 3, inside, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
    }
    // Lit left jamb + lintel top-left (near side of the reveal).
    f.c.rect(x - 4, y - 4, 2, dh + 4, frameLit, { shape: 'flat', height: 42 });
    f.c.rect(x - 4, y - 4, dw + 8, 2, frameLit, { shape: 'flat', height: 42 });
    // Shadowed right jamb.
    f.c.rect(x + dw + 1, y - 4, 2, dh + 4, (0, Palette_1.shift)(f.wall, -0.28, 8), { shape: 'flat', height: 41, shade: 0.7 });
    // Handle / ring.
    f.c.circle(x + dw - 6, y + dh * 0.55, 2, opts.interiorHint ? '#e2b45f' : '#8a8189', { shape: 'round', height: 36 });
}
/** Cast shadow on the ground, thrown down and slightly right of the footprint. */
function castShadow(f, opts = {}) {
    var _a;
    const spread = (_a = opts.spread) !== null && _a !== void 0 ? _a : 1;
    const cx = f.cx + f.w * 0.06;
    const cy = f.bottom + Math.round(f.h * 0.06);
    f.c.groundShadow(cx, cy, (f.w / 2 + f.depth) * 0.98 * spread, Math.max(10, f.h * 0.12) * spread, 0.4);
}
/** Faint horizontal courses to break up a large stone/plaster wall. */
function courses(f, x, y, w, h, step, tint = -0.08) {
    for (let cy = y + step; cy < y + h; cy += step) {
        f.c.rect(x, cy, w, 1, (0, Palette_1.shift)(f.wall, tint, 4), { shape: 'flat', height: 40, shade: 0.9, alpha: 0.5 });
    }
}
// ---------------------------------------------------------------------------
// Per-style builders
// ---------------------------------------------------------------------------
/** home — modest stone cottage, thatch roof, small chimney. */
function buildHome(spec) {
    const f = makeFrame(spec);
    castShadow(f);
    const wallH = f.h;
    // Chimney on the far (right) side, drawn before the body so the roof overlaps.
    const chimX = f.right - Math.round(f.w * 0.2);
    const roofPeakY = f.top - Math.round(wallH * 0.42);
    f.c.rect(chimX, roofPeakY - 14, 12, 24, (0, Palette_1.shift)(f.wall, -0.06, 6), { shape: 'flat', height: 52 });
    boxTopCap(f, chimX, roofPeakY - 14, 12, (0, Palette_1.shift)(f.wall, -0.06, 6));
    f.c.rect(chimX - 1, roofPeakY - 15, 14, 2, (0, Palette_1.shift)(f.wall, 0.1), { shape: 'flat', height: 53 });
    boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 40 });
    courses(f, f.left, f.top, f.w, wallH, 16);
    // Thatch roof: gable with a warm, coarse straw colour derived from the roof int.
    const thatch = (0, Palette_1.mix)(f.roof, '#8a7043', 0.35);
    const eaveY = f.top + Math.round(wallH * 0.06);
    gableRoof(f, f.left, f.right, eaveY, roofPeakY, thatch, { overL: 11, overR: 11 });
    // Thatch combing on the lit slope, following the pitch (eave → ridge).
    slopeTexture(f, [f.left - 11, eaveY], [f.cx, roofPeakY], [f.cx, roofPeakY], (0, Palette_1.shift)(thatch, -0.12, 4), { step: 8, frac: 0.5, alpha: 0.4 });
    slopeTexture(f, [f.cx, roofPeakY], [f.right + 11, eaveY], [f.cx, roofPeakY], (0, Palette_1.shift)(thatch, -0.16, 6), { step: 9, frac: 0.5, alpha: 0.35 });
    eaveShadow(f, f.left, eaveY - 1, f.w, 6);
    // One window each side of the door, and the door.
    doorway(f, { interiorHint: true });
    const winY = f.top + Math.round(wallH * 0.42);
    const winW = Math.round(f.w * 0.16);
    window(f, f.left + Math.round(f.w * 0.14), winY, winW, Math.round(winW * 0.9), '#7fa2a8', { mullion: true });
    if (Math.abs(f.right - Math.round(f.w * 0.14) - winW - f.doorCx) > winW + 20) {
        window(f, f.right - Math.round(f.w * 0.14) - winW, winY, winW, Math.round(winW * 0.9), '#7fa2a8', { mullion: true });
    }
    finish(f.c);
    return f.c;
}
/** inn — two storeys, hanging sign bracket, warm lit windows, larger. */
function buildInn(spec) {
    const f = makeFrame(spec);
    castShadow(f);
    const wallH = f.h;
    const floorY = f.top + Math.round(wallH * 0.46); // storey division
    boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 42 });
    // Upper storey jetty: the top floor oversails the lower by a couple px, a
    // classic timber-frame inn silhouette, with a shadow beneath the overhang.
    f.c.rect(f.left - 3, floorY, f.w + 3, 4, (0, Palette_1.shift)(f.wall, 0.06), { shape: 'flat', height: 43 });
    f.c.rect(f.left - 3, floorY + 4, f.w + 3, 3, '#0c0b12', { shape: 'flat', height: 42, emissive: true, alpha: 0.3 });
    // A couple of exposed horizontal beams.
    f.c.rect(f.left, f.top + Math.round(wallH * 0.2), f.w, 2, (0, Palette_1.shift)((0, Palette_1.mix)(f.wall, '#4a3324', 0.5), -0.04), { shape: 'flat', height: 41 });
    // Steep pitched roof (inns read tall).
    const ridgeY = f.top - Math.round(wallH * 0.34);
    const eaveY = f.top + Math.round(wallH * 0.04);
    gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12 });
    eaveShadow(f, f.left, eaveY - 1, f.w, 6);
    // Warm lit windows — this is what makes the inn feel occupied at night.
    const warm = '#f2b45a';
    const lowY = f.top + Math.round(wallH * 0.62);
    const upY = f.top + Math.round(wallH * 0.18);
    const winW = Math.round(f.w * 0.16);
    const winH = Math.round(winW * 1.05);
    const cols = [f.left + Math.round(f.w * 0.13), f.cx - winW / 2, f.right - Math.round(f.w * 0.13) - winW];
    for (const wxp of cols) {
        window(f, Math.round(wxp), upY, winW, winH, warm, { emissive: true, mullion: true });
        // lower-storey windows skip where the door is.
        if (Math.abs(wxp + winW / 2 - f.doorCx) > winW + 16) {
            window(f, Math.round(wxp), lowY, winW, Math.round(winH * 0.8), warm, { emissive: true, mullion: true });
        }
    }
    doorway(f, { w: 46, interiorHint: true });
    // Hanging sign bracket projecting from the front-left, with a swinging board.
    const bx = f.left + 6;
    const by = floorY - 6;
    f.c.rect(bx, by, 20, 2, (0, Palette_1.shift)(MATERIAL_IRON, -0.02), { shape: 'cylinder-x', height: 44, curve: 0.8 });
    f.c.rect(bx, by, 2, 8, (0, Palette_1.shift)(MATERIAL_IRON, -0.06), { shape: 'cylinder-y', height: 44 });
    f.c.line(bx + 18, by + 2, bx + 18, by + 8, '#2a2530', 1, { height: 43 });
    const sign = (0, Palette_1.mix)(f.roof, '#6b4a30', 0.5);
    f.c.rect(bx + 12, by + 8, 16, 12, sign, { shape: 'flat', height: 42 });
    f.c.rect(bx + 12, by + 8, 16, 12, (0, Palette_1.shift)(sign, 0.0), { shape: 'flat', height: 42, alpha: 0 });
    f.c.rect(bx + 12, by + 8, 1, 12, (0, Palette_1.shift)(sign, 0.14), { shape: 'flat', height: 43 });
    f.c.circle(bx + 20, by + 14, 2, warm, { shape: 'round', height: 43, emissive: true, alpha: 0.9 });
    finish(f.c);
    return f.c;
}
/** forge — stone base, glowing forge-mouth, tall smoke-stained chimney. */
function buildForge(spec) {
    const f = makeFrame(spec);
    castShadow(f);
    const wallH = f.h;
    // Tall chimney on the right, drawn first with a smoke plume rising above it.
    const chimX = f.right - Math.round(f.w * 0.22);
    const chimW = Math.round(f.w * 0.13);
    const chimTop = f.top - Math.round(wallH * 0.5);
    // Smoke: soft grey puffs fading upward (emissive so they don't get lit as solids).
    for (let i = 0; i < 4; i += 1) {
        const t = i / 3;
        f.c.ellipse(chimX + chimW / 2 + i * 3, chimTop - 6 - i * 9, 5 + i * 2, 4 + i * 1.5, (0, Palette_1.mix)('#3a363f', '#1c1a22', 0.4), { shape: 'flat', emissive: true, alpha: 0.32 - t * 0.16 });
    }
    const chimStone = (0, Palette_1.shift)(f.wall, -0.02, 4);
    f.c.rect(chimX, chimTop, chimW, f.top - chimTop + 18, chimStone, { shape: 'flat', height: 52 });
    boxTopCap(f, chimX, chimTop, chimW, chimStone);
    // Soot staining down the chimney front.
    f.c.rect(chimX + 2, chimTop + 4, chimW - 4, Math.round(wallH * 0.3), '#171319', { shape: 'flat', height: 52, emissive: true, alpha: 0.28 });
    f.c.rect(chimX - 1, chimTop - 1, chimW + 2, 2, (0, Palette_1.shift)(chimStone, 0.1), { shape: 'flat', height: 53 });
    boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 40 });
    courses(f, f.left, f.top, f.w, wallH, 14, -0.1); // stone coursing
    // Low-pitched roof.
    const ridgeY = f.top - Math.round(wallH * 0.24);
    const eaveY = f.top + Math.round(wallH * 0.06);
    gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12, ridgeShift: -Math.round(f.w * 0.04) });
    eaveShadow(f, f.left, eaveY - 1, f.w, 6);
    // The open forge-mouth: a big arched opening glowing orange, off to one side of
    // the door. This is the signature — emissive so it lights the night.
    const mouthW = Math.round(f.w * 0.26);
    const mouthH = Math.round(wallH * 0.34);
    const mouthX = f.left + Math.round(f.w * 0.1);
    const my = f.bottom - mouthH - 4;
    f.c.rect(mouthX - 3, my - 3, mouthW + 6, mouthH + 3, (0, Palette_1.shift)(f.wall, -0.22, 6), { shape: 'flat', height: 41 }); // stone surround
    f.c.ellipse(mouthX + mouthW / 2, my, mouthW / 2 + 3, mouthW / 2 + 3, (0, Palette_1.shift)(f.wall, -0.22, 6), { shape: 'flat', height: 41 });
    // Glow gradient: deep ember at the edges to hot yellow-white in the throat.
    f.c.rect(mouthX, my, mouthW, mouthH, '#e2582c', { shape: 'flat', height: 34, emissive: true });
    f.c.ellipse(mouthX + mouthW / 2, my, mouthW / 2, mouthW / 2, '#e2582c', { shape: 'flat', height: 34, emissive: true });
    f.c.ellipse(mouthX + mouthW / 2, my + mouthH * 0.5, mouthW * 0.34, mouthH * 0.4, '#ff8a45', { shape: 'flat', height: 34, emissive: true });
    f.c.ellipse(mouthX + mouthW / 2, my + mouthH * 0.55, mouthW * 0.18, mouthH * 0.25, '#ffd27a', { shape: 'flat', height: 34, emissive: true, alpha: 0.95 });
    // Warm halo spilling onto the surrounding stone.
    f.c.ellipse(mouthX + mouthW / 2, my + mouthH * 0.4, mouthW * 0.9, mouthH * 0.9, '#ff8a45', { shape: 'flat', height: 35, emissive: true, alpha: 0.14 });
    doorway(f, { w: 44, interiorHint: true });
    // A small lit window high up, catching forge-light.
    const winW = Math.round(f.w * 0.14);
    window(f, f.right - Math.round(f.w * 0.2) - winW, f.top + Math.round(wallH * 0.3), winW, Math.round(winW * 0.8), '#ff9a52', { emissive: true, mullion: true });
    finish(f.c);
    return f.c;
}
/** cottage — timber-framed Tudor: plaster panels between dark cross-beams. */
function buildCottage(spec) {
    const f = makeFrame(spec);
    castShadow(f);
    const wallH = f.h;
    // Plaster body (lighten the wall toward off-white daub between the timbers).
    const plaster = (0, Palette_1.mix)(f.wall, '#d8c9a6', 0.45);
    boxBody(f, f.left, f.top, f.w, wallH, plaster, { height: 38 });
    // Dark oak framing: sill, mid-rail, corner posts, top plate, and the
    // characteristic diagonal braces. Drawn as slightly proud beams (small height
    // bump) so the lighting pass gives them a faint edge over the plaster.
    const beam = (0, Palette_1.mix)(f.wall, '#3a2718', 0.66);
    const beamLit = (0, Palette_1.shift)(beam, 0.08);
    const post = 4;
    const drawBeamH = (x, y, w, t = post) => {
        f.c.rect(x, y, w, t, beam, { shape: 'flat', height: 41 });
        f.c.rect(x, y, w, 1, beamLit, { shape: 'flat', height: 42 });
    };
    const drawBeamV = (x, y, h, t = post) => {
        f.c.rect(x, y, t, h, beam, { shape: 'flat', height: 41 });
        f.c.rect(x, y, 1, h, beamLit, { shape: 'flat', height: 42 });
    };
    const midY = f.top + Math.round(wallH * 0.5);
    drawBeamH(f.left, f.top, f.w); // top plate
    drawBeamH(f.left, midY, f.w); // mid rail
    drawBeamH(f.left, f.bottom - post, f.w); // sill
    drawBeamV(f.left, f.top, wallH); // left post
    drawBeamV(f.right - post, f.top, wallH); // right post
    // A couple of studs + herringbone braces in the upper panels.
    const studs = 3;
    for (let s = 1; s <= studs; s += 1) {
        const sx = f.left + Math.round((f.w * s) / (studs + 1));
        drawBeamV(sx, f.top, midY - f.top, 3);
    }
    // Diagonal braces bottom corners → centre (Tudor look).
    f.c.line(f.left + post, f.bottom - post, f.left + Math.round(f.w * 0.28), midY + post, beam, 3, { height: 41 });
    f.c.line(f.right - post, f.bottom - post, f.right - Math.round(f.w * 0.28), midY + post, beam, 3, { height: 41 });
    // Steep thatch/tile gable.
    const ridgeY = f.top - Math.round(wallH * 0.4);
    const eaveY = f.top + Math.round(wallH * 0.02);
    gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 10, overR: 10 });
    eaveShadow(f, f.left, eaveY - 1, f.w, 6);
    // Front gable pediment (plaster triangle with a king-post) above the eaves.
    f.c.polygon([[f.left + 2, eaveY], [f.cx, ridgeY + 3], [f.right - 2, eaveY]], plaster, { shape: 'flat', height: 43 });
    f.c.line(f.cx, ridgeY + 3, f.cx, eaveY, beam, 2, { height: 44 });
    f.c.line(f.left + 4, eaveY, f.cx, ridgeY + 4, beam, 2, { height: 44 });
    f.c.line(f.right - 4, eaveY, f.cx, ridgeY + 4, beam, 2, { height: 44 });
    doorway(f, { w: 38, h: 48, interiorHint: true });
    // Small leaded windows in the panels.
    const winW = Math.round(f.w * 0.17);
    const winY = f.top + Math.round(wallH * 0.62);
    const lx = f.left + Math.round(f.w * 0.12);
    const rx = f.right - Math.round(f.w * 0.12) - winW;
    if (Math.abs(lx + winW / 2 - f.doorCx) > winW + 14)
        window(f, lx, winY, winW, Math.round(winW * 0.75), '#88a6ab', { mullion: true });
    if (Math.abs(rx + winW / 2 - f.doorCx) > winW + 14)
        window(f, rx, winY, winW, Math.round(winW * 0.75), '#88a6ab', { mullion: true });
    finish(f.c);
    return f.c;
}
/** chapel — tall stone nave, steep pitched roof, bell tower with a spire. */
function buildChapel(spec) {
    const f = makeFrame(spec);
    castShadow(f, { spread: 1.05 });
    const wallH = f.h;
    boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 42 });
    courses(f, f.left, f.top, f.w, wallH, 15, -0.09);
    // Steep nave roof.
    const ridgeY = f.top - Math.round(wallH * 0.42);
    const eaveY = f.top + Math.round(wallH * 0.03);
    gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12 });
    // Nave pediment (stone gable) with a round rose window.
    f.c.polygon([[f.left + 2, eaveY], [f.cx, ridgeY + 2], [f.right - 2, eaveY]], f.wall, { shape: 'flat', height: 43 });
    const roseY = eaveY - Math.round((eaveY - ridgeY) * 0.42);
    f.c.circle(f.cx, roseY, 7, (0, Palette_1.shift)(f.wall, -0.2, 6), { shape: 'flat', height: 44 });
    f.c.circle(f.cx, roseY, 5, (0, Palette_1.mix)('#9b88be', '#2a2436', 0.2), { shape: 'flat', height: 44, emissive: true, alpha: 0.9 });
    f.c.circle(f.cx, roseY, 2, '#d8ccf0', { shape: 'flat', height: 44, emissive: true });
    eaveShadow(f, f.left, eaveY - 1, f.w, 6);
    // Bell tower rising off the front-left corner, taller than the nave, capped by
    // a pyramidal spire. Its own two-face body keeps the 3/4 read consistent.
    const towW = Math.round(f.w * 0.3);
    const towX = f.left + Math.round(f.w * 0.04);
    const towTopY = f.top - Math.round(wallH * 0.7);
    boxBody(f, towX, towTopY, towW, f.bottom - towTopY, (0, Palette_1.shift)(f.wall, 0.02, -2), { height: 54 });
    courses(f, towX, towTopY, towW, f.bottom - towTopY, 14, -0.09);
    // Belfry: a dark arched opening near the top with a hanging bell.
    const belfryW = Math.round(towW * 0.5);
    const belfryX = towX + Math.round((towW - belfryW) / 2);
    const belfryY = towTopY + Math.round(towW * 0.5);
    f.c.rect(belfryX, belfryY, belfryW, Math.round(towW * 0.6), '#14111a', { shape: 'flat', height: 50, emissive: true, alpha: 0.95 });
    f.c.ellipse(belfryX + belfryW / 2, belfryY, belfryW / 2, belfryW / 2, '#14111a', { shape: 'flat', height: 50, emissive: true, alpha: 0.95 });
    f.c.ellipse(belfryX + belfryW / 2, belfryY + Math.round(towW * 0.28), belfryW * 0.32, belfryW * 0.4, (0, Palette_1.mix)(MATERIAL_BRONZE, '#000', 0.1), { shape: 'dome', height: 51, curve: 0.9 });
    f.c.ellipse(belfryX + belfryW / 2 - 1, belfryY + Math.round(towW * 0.22), belfryW * 0.16, belfryW * 0.18, (0, Palette_1.shift)(MATERIAL_BRONZE, 0.14), { shape: 'dome', height: 52, curve: 0.9 });
    // Spire: an overhanging pyramidal cap split down the middle into a lit left
    // face and a shadowed right face, so it reads as a true four-sided pyramid
    // seen slightly from the side (not a flat triangle). Same lit/dark scheme as
    // the pitched roofs. A slim finial cross tops it.
    const apexX = towX + towW / 2;
    const spireApexY = towTopY - Math.round(towW * 1.2);
    const sl = towX - 4; // eaves overhang the tower on both sides
    const sr = towX + towW + 4;
    const spireLit = (0, Palette_1.mix)((0, Palette_1.shift)(f.roof, 0.06, -6), '#8f8496', 0.4);
    const spireDark = (0, Palette_1.shift)(f.roof, -0.02, 12);
    // Right (shadow) face: base right-half up to the apex.
    f.c.polygon([[apexX, towTopY], [sr, towTopY], [apexX, spireApexY]], spireDark, { shape: 'flat', height: 55, shade: 0.82 });
    // Left (lit) face: base left-half up to the apex.
    f.c.polygon([[sl, towTopY], [apexX, towTopY], [apexX, spireApexY]], spireLit, { shape: 'flat', height: 56 });
    // Bright arris (the near vertical edge of the pyramid) + a dark eaves line.
    f.c.line(apexX, towTopY, apexX, spireApexY, (0, Palette_1.shift)(spireLit, 0.16), 1, { height: 57, emissive: true, alpha: 0.6 });
    f.c.line(sl, towTopY, sr, towTopY, '#0d0c12', 1, { height: 55, emissive: true, alpha: 0.4 });
    // Finial cross.
    f.c.rect(apexX - 1, spireApexY - 9, 2, 9, MATERIAL_BONE, { shape: 'flat', height: 58 });
    f.c.rect(apexX - 3, spireApexY - 6, 7, 2, MATERIAL_BONE, { shape: 'flat', height: 58 });
    // Arched windows down the nave, cool stained glass.
    const winW = Math.round(f.w * 0.12);
    const winH = Math.round(wallH * 0.4);
    const winY = f.top + Math.round(wallH * 0.4);
    const naveCols = [f.cx + Math.round(f.w * 0.02), f.right - Math.round(f.w * 0.16)];
    for (const wxp of naveCols) {
        if (Math.abs(wxp + winW / 2 - f.doorCx) < winW + 14)
            continue;
        window(f, Math.round(wxp), winY, winW, winH, (0, Palette_1.mix)('#9b88be', '#3a2f52', 0.3), { arch: true, emissive: true, mullion: true });
    }
    // Arched double door at the base of the tower / nave front.
    doorway(f, { w: 44, h: 58, arched: true, interiorHint: true });
    finish(f.c);
    return f.c;
}
/** marsh — stilted plank hut, sagging thatch, hanging nets over black water. */
function buildMarsh(spec) {
    const f = makeFrame(spec);
    const wallH = f.h;
    // The hut is raised on stilts; the visible plank box is the UPPER ~68% of h,
    // the lower band is open piling above the water. Collision still uses full h.
    const floorLift = Math.round(wallH * 0.3);
    const hutTop = f.top;
    const hutH = wallH - floorLift;
    const hutBottom = hutTop + hutH;
    // Cast shadow lands under the raised hut, faint on the water.
    f.c.groundShadow(f.cx + f.w * 0.05, f.bottom + 2, f.w * 0.5, Math.max(8, f.h * 0.1), 0.32);
    // A dark strip of bog water the stilts stand in, so the raised floor reads.
    f.c.ellipse(f.cx, f.bottom, f.w * 0.52, Math.max(5, f.h * 0.06), (0, Palette_1.mix)('#1b2b2a', '#0d1613', 0.4), { shape: 'flat', height: 0, emissive: true, alpha: 0.7 });
    // Stilts: legible posts of paler driftwood so they don't melt into the hut,
    // as cylinders (side-lit) with a receding partner behind each front post.
    const wood = (0, Palette_1.mix)(f.wall, '#4a3a2a', 0.5);
    const stiltWood = (0, Palette_1.mix)(wood, '#9a8763', 0.35); // catches moonlight, stands out
    const stiltXs = [f.left + 10, f.cx - 3, f.right - 18];
    for (const sx of stiltXs) {
        // Receding partner first (behind + up-right, darker).
        f.c.rect(sx + f.depth * 0.5, hutBottom - 2 - f.depth * 0.31, 5, floorLift + 4, (0, Palette_1.shift)(stiltWood, -0.18, 8), { shape: 'cylinder-y', height: 26, curve: 0.85, shade: 0.7 });
        // Front post.
        f.c.rect(sx, hutBottom - 2, 7, floorLift + 6, stiltWood, { shape: 'cylinder-y', height: 30, curve: 0.9 });
        // A lashed collar where it meets the deck.
        f.c.rect(sx - 1, hutBottom - 1, 9, 2, (0, Palette_1.shift)(MATERIAL_BRONZE, -0.1), { shape: 'cylinder-x', height: 31, curve: 0.8 });
    }
    // Cross-bracing between stilts.
    f.c.line(f.left + 13, hutBottom + 6, f.cx, f.bottom - 3, (0, Palette_1.shift)(stiltWood, -0.12), 2, { height: 28 });
    f.c.line(f.right - 15, hutBottom + 6, f.cx + 3, f.bottom - 3, (0, Palette_1.shift)(stiltWood, -0.12), 2, { height: 28 });
    // Plank-walled hut body.
    boxBody(f, f.left, hutTop, f.w, hutH, wood, { height: 38 });
    // Deep shadow on the hut underside (the floor overhangs the open piling).
    f.c.rect(f.left, hutBottom, f.w, 4, '#0a0f0e', { shape: 'flat', height: 37, emissive: true, alpha: 0.4 });
    // Vertical plank seams + a couple of warped/leaning planks.
    for (let px = f.left + 6; px < f.right - 2; px += 8) {
        const warp = ((px * 7) % 3) - 1;
        f.c.rect(px + warp, hutTop, 1, hutH, (0, Palette_1.shift)(wood, -0.14, 6), { shape: 'flat', height: 38, shade: 0.85, alpha: 0.7 });
    }
    // Ledge/deck lip at the hut floor.
    f.c.rect(f.left - 2, hutBottom - 3, f.w + 4, 3, (0, Palette_1.shift)(wood, 0.08), { shape: 'flat', height: 39 });
    // Sagging thatch roof — a shallow gable pulled down at the eaves for a droop.
    const ridgeY = hutTop - Math.round(hutH * 0.34);
    const eaveY = hutTop + Math.round(hutH * 0.02);
    const thatch = (0, Palette_1.mix)(f.roof, '#6b5836', 0.4);
    gableRoof(f, f.left, f.right, eaveY, ridgeY, thatch, { overL: 13, overR: 13, ridgeShift: Math.round(f.w * 0.05) });
    // Droop: darker sagging fringe hanging below the eave line.
    for (let dx = f.left - 8; dx < f.right + 8; dx += 6) {
        const sag = 3 + (((dx * 5) % 4));
        f.c.rect(dx, eaveY, 3, sag, (0, Palette_1.shift)(thatch, -0.12, 6), { shape: 'flat', height: 47, shade: 0.85 });
    }
    eaveShadow(f, f.left, eaveY + 1, f.w, 5);
    // A hanging fishing net on the front-right, and a small dark window.
    const netX = f.right - Math.round(f.w * 0.26);
    const netY = hutTop + Math.round(hutH * 0.34);
    const netW = Math.round(f.w * 0.2);
    const netH = Math.round(hutH * 0.5);
    for (let gy = 0; gy <= netH; gy += 5)
        f.c.line(netX, netY + gy, netX + netW, netY + gy + 3, (0, Palette_1.mix)(wood, '#c9bd9a', 0.5), 1, { height: 40, alpha: 0.5 });
    for (let gx = 0; gx <= netW; gx += 5)
        f.c.line(netX + gx, netY, netX + gx + 3, netY + netH, (0, Palette_1.mix)(wood, '#c9bd9a', 0.5), 1, { height: 40, alpha: 0.5 });
    // A couple of net floats.
    f.c.circle(netX + 4, netY + netH - 2, 2, (0, Palette_1.mix)(MATERIAL_BRONZE, wood, 0.3), { shape: 'round', height: 41 });
    doorway(f, { w: 36, h: Math.round(hutH * 0.7), interiorHint: true });
    const winW = Math.round(f.w * 0.14);
    window(f, f.left + Math.round(f.w * 0.14), netY, winW, Math.round(winW * 0.9), (0, Palette_1.mix)('#73c69d', '#1f2b27', 0.3), { emissive: true, mullion: true });
    finish(f.c);
    return f.c;
}
/** warehouse — long low store, big double doors, planked roof, loading bay. */
function buildWarehouse(spec) {
    const f = makeFrame(spec);
    castShadow(f);
    const wallH = f.h;
    boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 40 });
    // Horizontal plank siding.
    for (let py = f.top + 8; py < f.bottom - 2; py += 9) {
        f.c.rect(f.left, py, f.w, 1, (0, Palette_1.shift)(f.wall, -0.1, 4), { shape: 'flat', height: 40, shade: 0.9, alpha: 0.6 });
    }
    // Corner posts + a mid post for a timber-store look.
    for (const px of [f.left, f.cx - 2, f.right - 4]) {
        f.c.rect(px, f.top, 4, wallH, (0, Palette_1.mix)(f.wall, '#3a2b1e', 0.5), { shape: 'flat', height: 41 });
        f.c.rect(px, f.top, 1, wallH, (0, Palette_1.shift)((0, Palette_1.mix)(f.wall, '#3a2b1e', 0.5), 0.08), { shape: 'flat', height: 42 });
    }
    // Shallow planked roof with a slight pitch (low, wide building).
    const ridgeY = f.top - Math.round(wallH * 0.2);
    const eaveY = f.top + Math.round(wallH * 0.02);
    gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12 });
    // Corrugation: ribs running up-slope, lit ribs on the left, faint on the right.
    slopeTexture(f, [f.left - 12, eaveY], [f.cx, ridgeY], [f.cx, ridgeY], (0, Palette_1.shift)(f.roof, 0.1, -4), { step: 7, frac: 0.85, alpha: 0.45 });
    slopeTexture(f, [f.cx, ridgeY], [f.right + 12, eaveY], [f.cx, ridgeY], (0, Palette_1.shift)(f.roof, -0.12, 6), { step: 7, frac: 0.85, alpha: 0.4 });
    eaveShadow(f, f.left, eaveY - 1, f.w, 6);
    // Big double loading doors centred on doorCx, with plank battens + a beam over.
    const dw = Math.round(Math.min(f.w * 0.42, 90));
    const dh = Math.round(wallH * 0.66);
    const dx = Math.round(f.doorCx - dw / 2);
    const dy = f.bottom - dh;
    f.c.rect(dx - 4, dy - 6, dw + 8, dh + 6, (0, Palette_1.mix)(f.wall, '#3a2b1e', 0.55), { shape: 'flat', height: 41 }); // frame
    f.c.rect(dx - 6, dy - 8, dw + 12, 5, (0, Palette_1.mix)(f.wall, '#2f2216', 0.6), { shape: 'flat', height: 44 }); // lintel beam
    const doorWood = (0, Palette_1.mix)(f.roof, '#5a4126', 0.5);
    f.c.rect(dx, dy, dw, dh, doorWood, { shape: 'flat', height: 37 });
    // Split down the middle + Z-braces on each leaf.
    f.c.rect(dx + Math.round(dw / 2) - 1, dy, 2, dh, '#161119', { shape: 'flat', height: 37, emissive: true, alpha: 0.8 });
    const brace = (0, Palette_1.shift)(doorWood, -0.12);
    f.c.line(dx + 3, dy + dh - 3, dx + dw / 2 - 3, dy + 3, brace, 2, { height: 38 });
    f.c.line(dx + dw / 2 + 3, dy + dh - 3, dx + dw - 3, dy + 3, brace, 2, { height: 38 });
    for (let by = dy + 6; by < dy + dh; by += 10)
        f.c.rect(dx, by, dw, 1, brace, { shape: 'flat', height: 38, alpha: 0.5 });
    // Loading-bay platform lip at the base.
    f.c.rect(dx - 8, f.bottom - 4, dw + 16, 5, (0, Palette_1.shift)(f.wall, 0.06), { shape: 'flat', height: 30 });
    f.c.rect(dx - 8, f.bottom + 1, dw + 16, 2, '#0c0b12', { shape: 'flat', height: 29, emissive: true, alpha: 0.3 });
    // A hoist beam + pulley projecting from the gable peak.
    f.c.rect(f.cx - 2, ridgeY - 2, Math.round(f.w * 0.14), 3, (0, Palette_1.mix)(f.wall, '#2f2216', 0.6), { shape: 'cylinder-x', height: 50, curve: 0.8 });
    f.c.circle(f.cx + Math.round(f.w * 0.12), ridgeY + 2, 3, MATERIAL_IRON, { shape: 'round', height: 50 });
    f.c.line(f.cx + Math.round(f.w * 0.12), ridgeY + 4, f.cx + Math.round(f.w * 0.12), ridgeY + 14, '#2a2530', 1, { height: 49 });
    // A couple of small dark windows high on the gable.
    const winW = Math.round(f.w * 0.1);
    window(f, f.left + Math.round(f.w * 0.1), f.top + Math.round(wallH * 0.2), winW, Math.round(winW * 0.8), '#7c9ba5', { mullion: true });
    window(f, f.right - Math.round(f.w * 0.1) - winW, f.top + Math.round(wallH * 0.2), winW, Math.round(winW * 0.8), '#7c9ba5', { mullion: true });
    finish(f.c);
    return f.c;
}
/** citadel — massive fortified gatehouse: crenellations, portcullis, banners. */
function buildCitadel(spec) {
    const f = makeFrame(spec);
    castShadow(f, { spread: 1.08 });
    const wallH = f.h;
    // Red-tinted fortress stone.
    const stone = (0, Palette_1.mix)(f.wall, '#5a3e42', 0.35);
    // Two flanking drum-ish towers + a central curtain, all one silhouette. We
    // draw the central block then push the towers slightly proud on each side and
    // a touch taller, each with its own crenellated top.
    const towW = Math.round(f.w * 0.24);
    const centerL = f.left + towW;
    const centerR = f.right - towW;
    // Central curtain body.
    boxBody(f, centerL, f.top + Math.round(wallH * 0.06), centerR - centerL, wallH - Math.round(wallH * 0.06), stone, { height: 44 });
    // Flanking towers (drawn after so they sit in front at the corners).
    const towTopY = f.top - Math.round(wallH * 0.02);
    boxBody(f, f.left, towTopY, towW, f.bottom - towTopY, (0, Palette_1.shift)(stone, 0.03, -2), { height: 50 });
    boxBody(f, f.right - towW, towTopY, towW, f.bottom - towTopY, (0, Palette_1.shift)(stone, -0.02, 2), { height: 48 });
    // Heavy coursed masonry.
    courses(f, f.left, f.top, f.w, wallH, 13, -0.1);
    // Crenellated tops: central parapet lower, tower parapets higher.
    parapetRoof(f, centerL, centerR, f.top + Math.round(wallH * 0.06), stone, { crenellate: true, over: 6 });
    parapetRoof(f, f.left, f.left + towW, towTopY, (0, Palette_1.shift)(stone, 0.03, -2), { crenellate: true, over: 5 });
    parapetRoof(f, f.right - towW, f.right, towTopY, (0, Palette_1.shift)(stone, -0.02, 2), { crenellate: true, over: 5 });
    // Machicolation shadow band under the central parapet (projecting battlement).
    eaveShadow(f, centerL - 4, f.top + Math.round(wallH * 0.06) + Math.round(f.depth * 0.9), centerR - centerL + 8, 5);
    // The great arched gate with a portcullis, centred on doorCx.
    const gw = Math.round(Math.min((centerR - centerL) * 0.72, f.w * 0.3));
    const gh = Math.round(wallH * 0.62);
    const gx = Math.round(f.doorCx - gw / 2);
    const gy = f.bottom - gh;
    // Recessed gate arch surround.
    f.c.rect(gx - 5, gy - 4, gw + 10, gh + 4, (0, Palette_1.shift)(stone, -0.16, 6), { shape: 'flat', height: 45 });
    f.c.ellipse(gx + gw / 2, gy, gw / 2 + 5, gw / 2 + 5, (0, Palette_1.shift)(stone, -0.16, 6), { shape: 'flat', height: 45 });
    // Dark throat.
    const throat = (0, Palette_1.mix)('#170f14', '#3a1a1a', 0.3);
    f.c.rect(gx, gy, gw, gh, throat, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
    f.c.ellipse(gx + gw / 2, gy, gw / 2, gw / 2, throat, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
    // Portcullis grid (iron bars catching a cold edge), hanging in the arch.
    const bar = MATERIAL_IRON;
    for (let vx = gx + 4; vx < gx + gw; vx += 7)
        f.c.rect(vx, gy - Math.round(gw * 0.1), 2, Math.round(gh * 0.62), (0, Palette_1.shift)(bar, -0.04), { shape: 'cylinder-y', height: 35, curve: 0.8 });
    for (let hy = gy + 6; hy < gy + Math.round(gh * 0.55); hy += 9)
        f.c.rect(gx + 3, hy, gw - 6, 2, bar, { shape: 'cylinder-x', height: 35, curve: 0.8 });
    // Spiked bottom of the portcullis.
    for (let vx = gx + 4; vx < gx + gw; vx += 7)
        f.c.polygon([[vx, gy + Math.round(gh * 0.52)], [vx + 2, gy + Math.round(gh * 0.52)], [vx + 1, gy + Math.round(gh * 0.58)]], (0, Palette_1.shift)(bar, 0.1), { shape: 'flat', height: 35 });
    // Lit arrow-slit windows on the towers (glowing — the fort is garrisoned).
    const slitW = Math.max(3, Math.round(towW * 0.14));
    const slitGlow = '#e88a52';
    for (const tcx of [f.left + Math.round(towW * 0.5), f.right - Math.round(towW * 0.5)]) {
        for (const sy of [f.top + Math.round(wallH * 0.28), f.top + Math.round(wallH * 0.56)]) {
            f.c.rect(tcx - slitW / 2 - 1, sy - 1, slitW + 2, Math.round(wallH * 0.14) + 2, (0, Palette_1.shift)(stone, -0.2, 6), { shape: 'flat', height: 46 });
            f.c.rect(tcx - slitW / 2, sy, slitW, Math.round(wallH * 0.14), slitGlow, { shape: 'flat', height: 34, emissive: true });
        }
    }
    // Twin banners hanging either side of the gate — dark red heraldic cloth with
    // a device, a subtle sag, catching a little light on the near fold.
    const banW = Math.round(f.w * 0.09);
    const banH = Math.round(wallH * 0.4);
    const banCloth = '#8e2f43';
    for (const [bx, dir] of [[centerL + 6, 1], [centerR - 6 - banW, 1]]) {
        void dir;
        const byTop = f.top + Math.round(wallH * 0.12);
        // Pole/rod.
        f.c.rect(bx - 2, byTop - 3, banW + 4, 2, (0, Palette_1.shift)(MATERIAL_IRON, -0.04), { shape: 'cylinder-x', height: 47, curve: 0.8 });
        // Cloth with a swallowtail bottom.
        f.c.rect(bx, byTop, banW, banH, banCloth, { shape: 'flat', height: 43 });
        f.c.polygon([[bx, byTop + banH], [bx + banW, byTop + banH], [bx + banW, byTop + banH - Math.round(banH * 0.16)], [bx + banW / 2, byTop + banH - Math.round(banH * 0.04)], [bx, byTop + banH - Math.round(banH * 0.16)]], (0, Palette_1.mix)(banCloth, '#111', 0.5), { shape: 'flat', height: 42 });
        // Lit near fold + shadowed far fold.
        f.c.rect(bx, byTop, 1, banH, (0, Palette_1.shift)(banCloth, 0.12), { shape: 'flat', height: 44 });
        f.c.rect(bx + banW - 1, byTop, 1, banH, (0, Palette_1.shift)(banCloth, -0.14), { shape: 'flat', height: 42 });
        // Heraldic device (a pale mark).
        f.c.circle(bx + banW / 2, byTop + Math.round(banH * 0.38), Math.max(2, banW * 0.24), (0, Palette_1.mix)(MATERIAL_GOLD, banCloth, 0.2), { shape: 'flat', height: 44 });
    }
    finish(f.c);
    return f.c;
}
// A few material constants pulled in without importing the whole MATERIAL map,
// keeping the builders readable. Values mirror Palette.MATERIAL.
const MATERIAL_IRON = '#6b7180';
const MATERIAL_BRONZE = '#a9743c';
const MATERIAL_GOLD = '#d3a24f';
const MATERIAL_BONE = '#d8cdb0';
const BUILDERS = {
    home: buildHome,
    inn: buildInn,
    forge: buildForge,
    cottage: buildCottage,
    chapel: buildChapel,
    marsh: buildMarsh,
    warehouse: buildWarehouse,
    citadel: buildCitadel,
};
/** Render one building spec into a finished PixelCanvas. Unknown styles fall
 *  back to the modest `home` cottage so a bad style string still draws. */
function renderBuilding(spec) {
    var _a;
    const builder = (_a = BUILDERS[spec.style]) !== null && _a !== void 0 ? _a : buildHome;
    return builder(spec);
}
/** Texture key for a building id: `building-<id>`. */
function buildingKey(id) {
    return `building-${id}`;
}
/**
 * Build every building frame as (key, canvas) pairs for baking into the atlas.
 * Pass the BUILDINGS array (each entry carries its own `id`); we read the same
 * fields the flat renderer used. Resolve each canvas with BUILDING_SHADE.
 */
function buildBuildingFrames(buildings) {
    return buildings.map((b) => ({ key: buildingKey(b.id), canvas: renderBuilding(b) }));
}

});
__define("src/systems/render/PixelCanvas.ts", function(exports, module, __req){
"use strict";
/**
 * PixelCanvas — a tiny software rasteriser that gives flat pixel art volume.
 *
 * Every sprite in Trupy is generated at runtime. Drawing them with plain
 * `fillRect` calls reads flat, so instead we rasterise into a depth-aware buffer:
 * each pixel stores a colour, a surface normal and a height. Once the shapes are
 * down we run a lighting pass that applies a directional light, an ambient sky
 * bounce, contact occlusion and a rim highlight — the same lighting model a 3D
 * renderer uses, quantised back down to a small palette so it still reads as
 * pixel art.
 *
 * The result is "light 3D": sculpted, readable sprites that never stop being pixels.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.shift = exports.mix = exports.rgbToHex = exports.hexToRgb = exports.PixelCanvas = void 0;
exports.materialRamp = materialRamp;
exports.vary = vary;
const Palette_1 = __req("src/systems/render/Palette.ts");
Object.defineProperty(exports, "hexToRgb", { enumerable: true, get: function () { return Palette_1.hexToRgb; } });
Object.defineProperty(exports, "mix", { enumerable: true, get: function () { return Palette_1.mix; } });
Object.defineProperty(exports, "rgbToHex", { enumerable: true, get: function () { return Palette_1.rgbToHex; } });
Object.defineProperty(exports, "shift", { enumerable: true, get: function () { return Palette_1.shift; } });
const DEFAULT_SHADE = {
    lightX: -0.55,
    lightY: -0.72,
    lightZ: 0.42,
    intensity: 0.62,
    ambient: 0.52,
    ambientColor: '#5a6b96',
    occlusion: 0.42,
    rim: 0.3,
    rimColor: '#d6dcf0',
    bands: 5,
    dither: 0.5,
};
/** 4x4 Bayer matrix, normalised to 0..1. Ordered dithering without noise. */
const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
class PixelCanvas {
    constructor(width, height) {
        Object.defineProperty(this, "width", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "height", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "buffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.width = width;
        this.height = height;
        this.buffer = new Array(width * height);
        for (let i = 0; i < width * height; i += 1) {
            this.buffer[i] = { r: 0, g: 0, b: 0, a: 0, nx: 0, ny: 0, nz: 1, height: 0, shade: 1, emissive: false, shadowOnly: false };
        }
    }
    index(x, y) {
        return y * this.width + x;
    }
    inside(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }
    /** Write one pixel with a normal and height. Alpha-composites over what's there. */
    plot(x, y, color, normal, options = {}) {
        var _a, _b, _c, _d;
        const px = Math.round(x);
        const py = Math.round(y);
        if (!this.inside(px, py))
            return;
        const alpha = clamp01((_a = options.alpha) !== null && _a !== void 0 ? _a : 1);
        if (alpha <= 0)
            return;
        const { r, g, b } = (0, Palette_1.hexToRgb)(color);
        const target = this.buffer[this.index(px, py)];
        if (alpha >= 1) {
            target.r = r;
            target.g = g;
            target.b = b;
            target.a = 1;
        }
        else {
            const inv = 1 - alpha;
            target.r = r * alpha + target.r * inv;
            target.g = g * alpha + target.g * inv;
            target.b = b * alpha + target.b * inv;
            target.a = Math.min(1, alpha + target.a * inv);
        }
        const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
        target.nx = normal[0] / len;
        target.ny = normal[1] / len;
        target.nz = normal[2] / len;
        target.height = (_b = options.height) !== null && _b !== void 0 ? _b : 0;
        target.shade = (_c = options.shade) !== null && _c !== void 0 ? _c : 1;
        target.emissive = (_d = options.emissive) !== null && _d !== void 0 ? _d : false;
        target.shadowOnly = false;
    }
    /** True when a pixel belongs to the sprite body (not a cast shadow). */
    isBody(x, y) {
        if (!this.inside(x, y))
            return false;
        const p = this.buffer[this.index(x, y)];
        return p.a > 0.1 && !p.shadowOnly;
    }
    /** Normal for a point inside a shape, given its 0..1 position within the shape. */
    shapeNormal(shape, u, v, curve) {
        // u,v are -1..1 from the shape centre.
        switch (shape) {
            case 'round': {
                const d = Math.hypot(u, v);
                const z = Math.sqrt(Math.max(0.04, 1 - Math.min(1, d * d)));
                return [u * curve, v * curve, z];
            }
            case 'dome': {
                const d = Math.hypot(u, v);
                const z = Math.sqrt(Math.max(0.04, 1 - Math.min(1, d * d)));
                return [u * curve * 0.8, v * curve * 1.15, z];
            }
            case 'cylinder-x':
                return [0, v * curve, Math.sqrt(Math.max(0.05, 1 - Math.min(1, v * v)))];
            case 'cylinder-y':
                return [u * curve, 0, Math.sqrt(Math.max(0.05, 1 - Math.min(1, u * u)))];
            case 'bevel': {
                const edge = Math.max(Math.abs(u), Math.abs(v));
                if (edge < 0.62)
                    return [0, 0, 1];
                return [Math.abs(u) > Math.abs(v) ? Math.sign(u) * curve : 0, Math.abs(v) >= Math.abs(u) ? Math.sign(v) * curve : 0, 0.72];
            }
            case 'cone': {
                const d = Math.hypot(u, v) || 0.0001;
                return [(u / d) * curve * 0.9, (v / d) * curve * 0.9, 0.62];
            }
            case 'flat':
            default:
                return [0, 0, 1];
        }
    }
    rect(x, y, w, h, color, options = {}) {
        var _a, _b;
        const shape = (_a = options.shape) !== null && _a !== void 0 ? _a : 'flat';
        const curve = (_b = options.curve) !== null && _b !== void 0 ? _b : 0.85;
        const x0 = Math.round(x);
        const y0 = Math.round(y);
        const width = Math.round(w);
        const height = Math.round(h);
        if (width <= 0 || height <= 0)
            return;
        for (let j = 0; j < height; j += 1) {
            for (let i = 0; i < width; i += 1) {
                const u = width === 1 ? 0 : (i / (width - 1)) * 2 - 1;
                const v = height === 1 ? 0 : (j / (height - 1)) * 2 - 1;
                this.plot(x0 + i, y0 + j, color, this.shapeNormal(shape, u, v, curve), options);
            }
        }
    }
    ellipse(cx, cy, rx, ry, color, options = {}) {
        var _a, _b;
        const shape = (_a = options.shape) !== null && _a !== void 0 ? _a : 'round';
        const curve = (_b = options.curve) !== null && _b !== void 0 ? _b : 0.9;
        const x0 = Math.floor(cx - rx);
        const x1 = Math.ceil(cx + rx);
        const y0 = Math.floor(cy - ry);
        const y1 = Math.ceil(cy + ry);
        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const u = rx === 0 ? 0 : (x + 0.5 - cx) / rx;
                const v = ry === 0 ? 0 : (y + 0.5 - cy) / ry;
                if (u * u + v * v > 1.02)
                    continue;
                this.plot(x, y, color, this.shapeNormal(shape, u, v, curve), options);
            }
        }
    }
    circle(cx, cy, r, color, options = {}) {
        this.ellipse(cx, cy, r, r, color, options);
    }
    line(x0, y0, x1, y1, color, thickness = 1, options = {}) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
        const half = (thickness - 1) / 2;
        for (let s = 0; s <= steps; s += 1) {
            const t = s / steps;
            const px = x0 + dx * t;
            const py = y0 + dy * t;
            for (let j = 0; j < thickness; j += 1) {
                for (let i = 0; i < thickness; i += 1) {
                    this.plot(px - half + i, py - half + j, color, [0, 0, 1], options);
                }
            }
        }
    }
    /** Filled polygon via scanline. Points are [x,y] pairs. */
    polygon(points, color, options = {}) {
        var _a, _b;
        if (points.length < 3)
            return;
        const shape = (_a = options.shape) !== null && _a !== void 0 ? _a : 'flat';
        const curve = (_b = options.curve) !== null && _b !== void 0 ? _b : 0.85;
        let minY = Infinity;
        let maxY = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        for (const [px, py] of points) {
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
        }
        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
            const crossings = [];
            for (let i = 0; i < points.length; i += 1) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
                    crossings.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
                }
            }
            crossings.sort((p, q) => p - q);
            for (let c = 0; c + 1 < crossings.length; c += 2) {
                for (let x = Math.round(crossings[c]); x <= Math.round(crossings[c + 1]); x += 1) {
                    const u = ((x - minX) / spanX) * 2 - 1;
                    const v = ((y - minY) / spanY) * 2 - 1;
                    this.plot(x, y, color, this.shapeNormal(shape, u, v, curve), options);
                }
            }
        }
    }
    /** Vertical gradient band — dithered so it stays in-palette. */
    gradientRect(x, y, w, h, top, bottom, options = {}) {
        const steps = Math.max(1, Math.round(h));
        for (let j = 0; j < steps; j += 1) {
            const t = steps === 1 ? 0 : j / (steps - 1);
            const color = (0, Palette_1.mix)(top, bottom, t);
            this.rect(x, y + j, w, 1, color, { ...options, shape: 'flat' });
        }
    }
    /**
     * Outline the current silhouette. This is what makes sprites pop against the
     * dark world — a dark keyline plus a subtle lit edge on the light side.
     */
    outline(color, options = {}) {
        var _a;
        const alpha = (_a = options.alpha) !== null && _a !== void 0 ? _a : 1;
        const additions = [];
        for (let y = 0; y < this.height; y += 1) {
            for (let x = 0; x < this.width; x += 1) {
                // Only outline outside the body. Cast shadows get overwritten, not traced.
                if (this.isBody(x, y))
                    continue;
                let touchesBody = false;
                let litSide = false;
                for (let dy = -1; dy <= 1; dy += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        if (dx === 0 && dy === 0)
                            continue;
                        if (!this.isBody(x + dx, y + dy))
                            continue;
                        touchesBody = true;
                        // A body pixel below-right means we sit on the upper-left lit edge.
                        if (dx >= 0 && dy >= 0)
                            litSide = true;
                    }
                }
                if (touchesBody) {
                    additions.push({ x, y, color: litSide && options.lightEdge ? options.lightEdge : color });
                }
            }
        }
        for (const add of additions) {
            this.plot(add.x, add.y, add.color, [0, 0, 1], { alpha, shade: 1, emissive: true });
        }
    }
    /** Soft elliptical drop shadow on the ground. Drawn under everything. */
    groundShadow(cx, cy, rx, ry, strength = 0.34) {
        const x0 = Math.floor(cx - rx);
        const x1 = Math.ceil(cx + rx);
        const y0 = Math.floor(cy - ry);
        const y1 = Math.ceil(cy + ry);
        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                if (!this.inside(x, y))
                    continue;
                const u = rx === 0 ? 0 : (x + 0.5 - cx) / rx;
                const v = ry === 0 ? 0 : (y + 0.5 - cy) / ry;
                const d = u * u + v * v;
                if (d > 1)
                    continue;
                const target = this.buffer[this.index(x, y)];
                if (target.a > 0.1)
                    continue;
                const falloff = (1 - Math.sqrt(d)) ** 1.4;
                const alpha = strength * falloff;
                target.r = 8;
                target.g = 9;
                target.b = 14;
                target.a = Math.max(target.a, alpha);
                target.emissive = true;
                target.shadowOnly = true;
            }
        }
    }
    /** Run the lighting pass and return the finished RGBA bytes. */
    resolve(options = {}) {
        const cfg = { ...DEFAULT_SHADE, ...options };
        const out = new Uint8ClampedArray(this.width * this.height * 4);
        const lightLen = Math.hypot(cfg.lightX, cfg.lightY, cfg.lightZ) || 1;
        const lx = cfg.lightX / lightLen;
        const ly = cfg.lightY / lightLen;
        const lz = cfg.lightZ / lightLen;
        const ambient = (0, Palette_1.hexToRgb)(cfg.ambientColor);
        const rim = (0, Palette_1.hexToRgb)(cfg.rimColor);
        for (let y = 0; y < this.height; y += 1) {
            for (let x = 0; x < this.width; x += 1) {
                const i = this.index(x, y);
                const p = this.buffer[i];
                const o = i * 4;
                if (p.a <= 0.004)
                    continue;
                if (p.emissive) {
                    out[o] = p.r;
                    out[o + 1] = p.g;
                    out[o + 2] = p.b;
                    out[o + 3] = p.a * 255;
                    continue;
                }
                // Directional (Lambert, half-shifted so back faces still read).
                const ndotl = p.nx * lx + p.ny * ly + p.nz * lz;
                let light = cfg.ambient + cfg.intensity * Math.max(0, ndotl * 0.5 + 0.5) ** 1.35;
                // Contact occlusion: neighbours that stand taller shade this pixel.
                if (cfg.occlusion > 0) {
                    let occ = 0;
                    let samples = 0;
                    for (let dy = -1; dy <= 1; dy += 1) {
                        for (let dx = -1; dx <= 1; dx += 1) {
                            if (dx === 0 && dy === 0)
                                continue;
                            const nx2 = x + dx;
                            const ny2 = y + dy;
                            samples += 1;
                            if (!this.inside(nx2, ny2))
                                continue;
                            const n = this.buffer[this.index(nx2, ny2)];
                            if (n.a <= 0.1)
                                continue;
                            // Taller neighbour toward the light occludes more.
                            const towardLight = dx * lx + dy * ly < 0 ? 1.5 : 0.6;
                            if (n.height > p.height)
                                occ += Math.min(1, (n.height - p.height) / 6) * towardLight;
                        }
                    }
                    if (samples > 0)
                        light *= 1 - clamp01(occ / samples) * cfg.occlusion;
                }
                // Rim light: the silhouette edge on the far side from the light catches
                // a cool bounce, which is what separates a sprite from a dark background.
                let rimAmount = 0;
                if (cfg.rim > 0) {
                    let exposed = 0;
                    for (let dy = -1; dy <= 1; dy += 1) {
                        for (let dx = -1; dx <= 1; dx += 1) {
                            if (dx === 0 && dy === 0)
                                continue;
                            if (this.isBody(x + dx, y + dy))
                                continue;
                            // Empty toward the shadow side (opposite the light) = rim.
                            if (dx * -lx + dy * -ly > 0.35)
                                exposed += 1;
                        }
                    }
                    if (exposed > 0)
                        rimAmount = clamp01(exposed / 3) * cfg.rim;
                }
                light *= p.shade;
                // Quantise into bands, dithering only across a band boundary. Flat faces
                // stay clean; only genuine gradients pick up the checker texture.
                if (cfg.bands > 1) {
                    const scaled = clamp01(light / 1.4) * (cfg.bands - 1);
                    const floor = Math.floor(scaled);
                    const frac = scaled - floor;
                    let stepped = floor;
                    if (cfg.dither > 0) {
                        // Dither band is narrow: only pixels near the midpoint alternate.
                        const edge = 0.5 - cfg.dither * 0.34;
                        if (frac > 1 - edge)
                            stepped = floor + 1;
                        else if (frac > edge)
                            stepped = floor + (frac > BAYER[y & 3][x & 3] ? 1 : 0);
                    }
                    else {
                        stepped = Math.round(scaled);
                    }
                    light = (Math.min(cfg.bands - 1, Math.max(0, stepped)) / (cfg.bands - 1)) * 1.4;
                }
                // Ambient bounce tints the shadows cool.
                const shadowMix = clamp01((1 - clamp01(light)) * 0.42);
                let r = p.r * light + ambient.r * shadowMix * 0.55;
                let g = p.g * light + ambient.g * shadowMix * 0.55;
                let b = p.b * light + ambient.b * shadowMix * 0.55;
                if (rimAmount > 0) {
                    r += rim.r * rimAmount * 0.55;
                    g += rim.g * rimAmount * 0.55;
                    b += rim.b * rimAmount * 0.55;
                }
                out[o] = r;
                out[o + 1] = g;
                out[o + 2] = b;
                out[o + 3] = p.a * 255;
            }
        }
        return out;
    }
    /** Raw buffer access for the offline sprite previewer. */
    debugPixels(options = {}) {
        return this.resolve(options);
    }
}
exports.PixelCanvas = PixelCanvas;
/** Helper: build a material ramp with the world's light/shadow hues baked in. */
function materialRamp(base, steps = 5, spread = 0.36) {
    return (0, Palette_1.ramp)(base, { steps, spread, lightHue: 44, shadowHue: 254, hueBias: 15, saturationBias: 0.1 });
}
/** Slightly randomised colour, for scattering variety across many instances. */
function vary(base, seed, amount = 0.05) {
    const wobble = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
    return (0, Palette_1.shift)(base, (wobble - 0.5) * amount * 2, (wobble - 0.5) * 12);
}

});
__define("src/systems/render/Palette.ts", function(exports, module, __req){
"use strict";
/**
 * Palette mathematics for the Trupy pixel renderer.
 *
 * Flat pixel art dies on flat fills. Every material colour here expands into a
 * ramp whose highlights drift warm and whose shadows drift cool — the same trick
 * hand-painted pixel art uses to imply a light source and a sky bounce without
 * ever leaving a small palette.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATERIAL = exports.Ramp = void 0;
exports.hexToRgb = hexToRgb;
exports.rgbToHex = rgbToHex;
exports.intToHex = intToHex;
exports.hexToInt = hexToInt;
exports.rgbToHsl = rgbToHsl;
exports.hslToRgb = hslToRgb;
exports.shift = shift;
exports.mix = mix;
exports.luminance = luminance;
exports.ramp = ramp;
const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const clamp01 = (value) => clamp(value, 0, 1);
function hexToRgb(hex) {
    const raw = hex.replace('#', '').trim();
    if (raw.length === 3) {
        return {
            r: parseInt(raw[0] + raw[0], 16),
            g: parseInt(raw[1] + raw[1], 16),
            b: parseInt(raw[2] + raw[2], 16),
        };
    }
    const value = parseInt(raw.slice(0, 6), 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
function rgbToHex({ r, g, b }) {
    const byte = (value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
    return `#${byte(r)}${byte(g)}${byte(b)}`;
}
function intToHex(value) {
    return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}
function hexToInt(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (r << 16) | (g << 8) | b;
}
function rgbToHsl({ r, g, b }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const delta = max - min;
    const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let h;
    if (max === rn)
        h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn)
        h = ((bn - rn) / delta + 2) / 6;
    else
        h = ((rn - gn) / delta + 4) / 6;
    return { h: h * 360, s, l };
}
function hslToRgb({ h, s, l }) {
    const hn = (((h % 360) + 360) % 360) / 360;
    const sn = clamp01(s);
    const ln = clamp01(l);
    if (sn === 0) {
        const grey = ln * 255;
        return { r: grey, g: grey, b: grey };
    }
    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;
    const channel = (t) => {
        let tn = t;
        if (tn < 0)
            tn += 1;
        if (tn > 1)
            tn -= 1;
        if (tn < 1 / 6)
            return p + (q - p) * 6 * tn;
        if (tn < 1 / 2)
            return q;
        if (tn < 2 / 3)
            return p + (q - p) * (2 / 3 - tn) * 6;
        return p;
    };
    return {
        r: channel(hn + 1 / 3) * 255,
        g: channel(hn) * 255,
        b: channel(hn - 1 / 3) * 255,
    };
}
/** Shift a colour in HSL space. Lightness delta is absolute, hue is degrees. */
function shift(hex, lightness, hue = 0, saturation = 0) {
    const hsl = rgbToHsl(hexToRgb(hex));
    return rgbToHex(hslToRgb({
        h: hsl.h + hue,
        s: clamp01(hsl.s + saturation),
        l: clamp01(hsl.l + lightness),
    }));
}
function mix(a, b, amount) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const t = clamp01(amount);
    return rgbToHex({
        r: ca.r + (cb.r - ca.r) * t,
        g: ca.g + (cb.g - ca.g) * t,
        b: ca.b + (cb.b - ca.b) * t,
    });
}
function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
/**
 * A ramp of related shades generated from one base colour.
 *
 * Index 0 is the brightest shade and the last index the deepest shadow; the base
 * colour sits at `baseIndex`, so `at(baseIndex)` round-trips the input.
 */
class Ramp {
    constructor(base, options = {}) {
        var _a, _b, _c, _d, _e, _f;
        Object.defineProperty(this, "base", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: base
        });
        Object.defineProperty(this, "shades", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const steps = (_a = options.steps) !== null && _a !== void 0 ? _a : 5;
        const spread = (_b = options.spread) !== null && _b !== void 0 ? _b : 0.34;
        const lightHue = (_c = options.lightHue) !== null && _c !== void 0 ? _c : 44;
        const shadowHue = (_d = options.shadowHue) !== null && _d !== void 0 ? _d : 258;
        const hueBias = (_e = options.hueBias) !== null && _e !== void 0 ? _e : 13;
        const saturationBias = (_f = options.saturationBias) !== null && _f !== void 0 ? _f : 0.09;
        this.baseIndex = Math.min(steps - 1, Math.round((steps - 1) * 0.5));
        const hsl = rgbToHsl(hexToRgb(base));
        const shades = [];
        for (let index = 0; index < steps; index += 1) {
            // t: +1 at the brightest shade, -1 at the deepest.
            const t = this.baseIndex === 0 || steps === 1
                ? 0
                : index < this.baseIndex
                    ? (this.baseIndex - index) / this.baseIndex
                    : -(index - this.baseIndex) / Math.max(1, steps - 1 - this.baseIndex);
            const targetHue = t >= 0 ? lightHue : shadowHue;
            const hueDelta = shortestHueDelta(hsl.h, targetHue) * (Math.abs(t) * (hueBias / 180));
            shades.push(rgbToHex(hslToRgb({
                h: hsl.h + hueDelta,
                // Highlights desaturate toward the light, shadows deepen in colour.
                s: clamp01(hsl.s - t * saturationBias),
                l: clamp01(hsl.l + t * spread * 0.5),
            })));
        }
        this.shades = shades;
    }
    at(index) {
        const clamped = clamp(Math.round(index), 0, this.shades.length - 1);
        return this.shades[clamped];
    }
    /** Sample the ramp with a continuous 0..1 factor (1 = brightest). */
    sample(factor) {
        return this.at((1 - clamp01(factor)) * (this.shades.length - 1));
    }
    get highlight() { return this.shades[0]; }
    get light() { return this.at(this.baseIndex - 1); }
    get mid() { return this.at(this.baseIndex); }
    get shadow() { return this.at(this.baseIndex + 1); }
    get deep() { return this.shades[this.shades.length - 1]; }
}
exports.Ramp = Ramp;
function shortestHueDelta(from, to) {
    let delta = ((to - from) % 360 + 540) % 360 - 180;
    if (delta === -180)
        delta = 180;
    return delta;
}
const rampCache = new Map();
/** Cached ramp lookup — texture builders call this thousands of times. */
function ramp(base, options = {}) {
    var _a, _b, _c, _d, _e, _f;
    const key = `${base}|${(_a = options.steps) !== null && _a !== void 0 ? _a : 5}|${(_b = options.spread) !== null && _b !== void 0 ? _b : 0.34}|${(_c = options.lightHue) !== null && _c !== void 0 ? _c : 44}|${(_d = options.shadowHue) !== null && _d !== void 0 ? _d : 258}|${(_e = options.hueBias) !== null && _e !== void 0 ? _e : 13}|${(_f = options.saturationBias) !== null && _f !== void 0 ? _f : 0.09}`;
    const cached = rampCache.get(key);
    if (cached)
        return cached;
    const created = new Ramp(base, options);
    rampCache.set(key, created);
    return created;
}
/**
 * The world palette. Materials, not decorations — every sprite in the valley
 * pulls from this so the whole game reads as one place.
 */
exports.MATERIAL = {
    skin: '#c9986b',
    skinPale: '#d6b48f',
    skinDead: '#96a08b',
    leather: '#6d4b39',
    leatherDark: '#4a3229',
    cloth: '#7a4356',
    clothCold: '#40506b',
    steel: '#9aa4b4',
    steelDark: '#5d6675',
    iron: '#6b7180',
    gold: '#d3a24f',
    bronze: '#a9743c',
    bone: '#d8cdb0',
    boneOld: '#a99f83',
    wood: '#6b4a30',
    woodPale: '#8c6743',
    stone: '#6a6d78',
    stoneDark: '#484b55',
    granite: '#7b7468',
    slate: '#565a66',
    thatch: '#8a7043',
    moss: '#4c6b4a',
    foliage: '#2f4a38',
    foliageDeep: '#1f3327',
    foliageLit: '#456b4c',
    grass: '#3d5a41',
    soil: '#4a3b2f',
    ash: '#5a5259',
    emberCore: '#ff8a45',
    ember: '#e2582c',
    flame: '#ffb257',
    voidPurple: '#7b3f96',
    voidBright: '#cf7ce8',
    spirit: '#8fa8d8',
    toxic: '#6fae7c',
    water: '#2f5a68',
    waterLit: '#4d8497',
    blood: '#8e2f43',
    rust: '#8a5236',
};

});
__define("src/systems/sprites/enemies.ts", function(exports, module, __req){
"use strict";
/**
 * The bestiary — Trupy's enemy sprite factory.
 *
 * Same philosophy as the hero (see ./hero.ts): every creature is generated at
 * runtime and sculpted from shaped primitives rather than stacked rectangles, so
 * the depth-aware lighting in PixelCanvas gives them real volume. What matters
 * most here is the *silhouette*: a player under pressure identifies a threat by
 * its outline in a single frame, long before any surface detail registers. So
 * each of the nine creatures is built around one unmistakable shape —
 *
 *   husk        tall, thin, stooped, arms hanging past the knees
 *   boneguard   broad wall of a skeleton behind a round shield
 *   direwolf    long low horizontal quadruped, head down and forward
 *   wraith      floating teardrop, no legs, dissolving into mist
 *   bogling     squat sphere, belly wider than shoulders
 *   cavecrawler wide low arthropod bristling with legs
 *   ashborn     cracked humanoid leaking light from its fissures
 *   nameless    (boss) impossibly tall, many-armed, veiled — vertical menace
 *   cinderlord  (boss) massive armoured mass, horned, caped in embers — bulk
 *
 * Bosses are not scaled-up mooks: they get their own larger canvases, asymmetry,
 * and extra silhouette-defining parts (arms, horns, capes) so their scale reads
 * as *presence*, not zoom.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENEMY_IDS = exports.ENEMY_SHADE = exports.ENEMY_SIZE = exports.ENEMY_POSE_FRAMES = void 0;
exports.enemyDim = enemyDim;
exports.enemyKey = enemyKey;
exports.renderEnemyFrame = renderEnemyFrame;
exports.buildEnemyFrames = buildEnemyFrames;
const PixelCanvas_1 = __req("src/systems/render/PixelCanvas.ts");
const Palette_1 = __req("src/systems/render/Palette.ts");
/** Frame counts per pose — mirrors the hero's cadence for animation timing. */
exports.ENEMY_POSE_FRAMES = {
    idle: 4, // slow breathe / hover loop
    walk: 6, // full locomotion cycle
    attack: 3, // wind-up, strike, recover
    hurt: 1, // single recoil pose
    death: 4, // progressive collapse
};
/**
 * Per-enemy canvas sizes. Kept generous enough that arms, capes and lunging
 * attack frames never clip the edge. Boss dimensions roughly track their
 * `scale` field in ENEMIES but are hand-tuned for their specific silhouette
 * (nameless is tall and narrow; cinderlord is a wide slab).
 */
exports.ENEMY_SIZE = {
    husk: { w: 34, h: 46 },
    boneguard: { w: 40, h: 46 },
    direwolf: { w: 48, h: 34 }, // wide + short: the quadruped reads horizontally
    wraith: { w: 36, h: 48 },
    bogling: { w: 38, h: 40 },
    cavecrawler: { w: 50, h: 32 }, // widest footprint, lowest profile
    ashborn: { w: 38, h: 48 },
    nameless: { w: 52, h: 66 }, // tallest thing in the game
    cinderlord: { w: 60, h: 62 }, // heaviest mass in the game
};
/** Fallback dimension for an unknown id, so the factory never throws. */
const DEFAULT_DIM = { w: 40, h: 46 };
function enemyDim(id) {
    var _a;
    return (_a = exports.ENEMY_SIZE[id]) !== null && _a !== void 0 ? _a : DEFAULT_DIM;
}
/**
 * Base tints copied from ENEMIES (content.ts) as hex, so this file stays free of
 * a runtime import cycle with the data layer. Each is the creature's primary
 * material colour; ramps and accents are derived from it in the draw functions.
 */
const TINT = {
    husk: '#9ca87c',
    boneguard: '#d7c9aa',
    direwolf: '#7d708a',
    wraith: '#796aab',
    bogling: '#4e8a75',
    cavecrawler: '#8b7159',
    ashborn: '#c35d47',
    nameless: '#b25987',
    cinderlord: '#e06143',
};
const OUTLINE = '#101019';
const RIM = '#8f9bc4';
const VOID_EYE = '#d3f0ff'; // cold spectral eye-shine, used across the undead
const ZERO_K = { bob: 0, stride: 0, reach: 0, lean: 0, collapse: 0, recoil: 0, squash: 0 };
/**
 * Resolve motion for a pose/frame. `speed` scales the walk bounce so fast, light
 * creatures (the wolf) bob more energetically than heavy ones (the bosses).
 */
function kinematics(pose, frame, speed = 1) {
    switch (pose) {
        case 'idle': {
            // Gentle 4-frame breathe. A half-pixel lift at the top of the cycle.
            const phase = (frame / exports.ENEMY_POSE_FRAMES.idle) * Math.PI * 2;
            return { ...ZERO_K, bob: Math.sin(phase) > 0.3 ? -1 : 0 };
        }
        case 'walk': {
            // 6-frame gait: sinusoidal stride, bounce peaks between contacts.
            const phase = (frame / exports.ENEMY_POSE_FRAMES.walk) * Math.PI * 2;
            const stride = Math.round(Math.sin(phase) * 3);
            const bob = Math.round((Math.abs(Math.cos(phase)) - 0.5) * 2 * speed);
            return { ...ZERO_K, stride, bob, lean: Math.round(Math.abs(Math.sin(phase)) * 0.6) };
        }
        case 'attack': {
            // wind-up (draw back), strike (full extension), recover.
            const table = [
                { ...ZERO_K, reach: -3, lean: -2, bob: 0 },
                { ...ZERO_K, reach: 8, lean: 3, bob: -1, squash: 1 },
                { ...ZERO_K, reach: 3, lean: 1, bob: 0 },
            ];
            return table[Math.min(2, frame)];
        }
        case 'hurt':
            // Knocked back and down, torso jolted away from the blow.
            return { ...ZERO_K, recoil: -3, lean: -3, bob: 1, squash: 2 };
        case 'death': {
            // 4 frames easing toward the ground; collapse drives sink + fade + splay.
            const t = Math.min(1, frame / (exports.ENEMY_POSE_FRAMES.death - 1));
            const eased = t * t; // accelerate as it falls
            return { ...ZERO_K, collapse: eased, bob: Math.round(eased * 4), squash: Math.round(eased * 3) };
        }
        default:
            return ZERO_K;
    }
}
/** Death fade: bodies dim and thin out as they collapse. */
function deathAlpha(k) {
    return 1 - k.collapse * 0.55;
}
// ---------------------------------------------------------------------------
// Individual creatures. Each function owns its anatomy and reads `k` however
// suits its build. Convention (matching hero.ts): groundShadow first, body from
// back to front, outline last (added by the shared dispatcher).
// ---------------------------------------------------------------------------
/**
 * HUSK — a starved, half-feral human. The read is verticality gone wrong: a
 * narrow stooped frame, a head sunk between hunched shoulders, and arms so long
 * and slack they hang past the knees. Torn rags flap at the hem. No weapon; it
 * claws. Hollow glowing eyes mark it as no longer human.
 */
function drawHusk(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 4;
    c.groundShadow(cx, groundY, 8 - k.squash, 3, 0.4);
    const alpha = deathAlpha(k);
    const skin = (0, Palette_1.mix)(TINT.husk, '#6f5a48', 0.35); // sickly grey-green flesh
    const skinDeep = (0, Palette_1.shift)(skin, -0.14, -6);
    const rag = (0, Palette_1.mix)(TINT.husk, '#4a4436', 0.5); // filthy torn cloth
    const lean = k.lean + k.recoil;
    // Death: the whole figure folds forward and down.
    const fold = Math.round(k.collapse * 10);
    const baseY = 4 + k.bob + Math.round(k.collapse * 8);
    // Long, slack, ape-like arms — the husk's signature. Upper arm splays a little
    // off the hunched shoulder, then a LONG forearm hangs almost to the shins so
    // the hands dangle past the knees. Drawn behind the torso so they read as
    // trailing limply. On the attack the near arm swings a raking claw forward.
    const armSwing = Math.round(k.stride * 0.8);
    const armReach = Math.round(k.reach); // near arm rakes forward on strike
    [-1, 1].forEach((side) => {
        const ax = cx + side * 5 + lean;
        const swing = side > 0 ? armReach : Math.round(armReach * -0.3);
        // Upper arm (short) canting outward from the sunken shoulder.
        c.rect(ax - 1 + side, baseY + 13, 3, 6, rag, { shape: 'cylinder-y', height: 6, curve: 0.85, alpha });
        // Forearm (long, ~10px) hanging down and slightly outward — the drooping read.
        const fx = ax + side * 2 + swing;
        c.rect(fx - 1, baseY + 18, 3, 10 - fold, skin, { shape: 'cylinder-y', height: 5, curve: 0.9, alpha });
        // Splayed clawing hand near knee height, fingers as short dark spurs.
        const hy = baseY + 28 - fold;
        c.ellipse(fx + 0.5, hy, 2.4, 2, skinDeep, { shape: 'round', height: 4, alpha });
        for (let d = -1; d <= 1; d += 1) {
            c.line(fx + 0.5, hy + 1, fx + 0.5 + d, hy + 3, skinDeep, 1, { height: 4, alpha });
        }
    });
    // Spindly legs, knees slightly bent.
    const legY = baseY + 26;
    [-1, 1].forEach((side, i) => {
        const lx = cx + side * 3 + Math.round(k.stride * side * 0.6);
        c.rect(lx - 1, legY, 3, 12 - fold, skinDeep, { shape: 'cylinder-y', height: 4, shade: i === 0 ? 0.8 : 1, alpha });
        c.ellipse(lx + 0.5, legY + 12 - fold, 2.4, 1.6, skinDeep, { shape: 'round', height: 4, shade: 0.85, alpha });
    });
    // Torso: a gaunt cylinder, ribs implied by a darker central shade. Narrow.
    const torsoY = baseY + 12;
    c.rect(cx - 4 + lean, torsoY, 8, 12 - Math.round(fold * 0.5), skin, { shape: 'cylinder-y', height: 9, curve: 0.95, alpha });
    // Sunken sternum shadow — reads as an emaciated ribcage.
    c.rect(cx - 1 + lean, torsoY + 2, 2, 7, skinDeep, { shape: 'flat', height: 9, shade: 0.7, alpha });
    // Ragged loincloth / shirt hem, torn into points that lag behind the stride.
    const hemSway = Math.round(k.stride * 0.5);
    c.polygon([
        [cx - 5 + lean, torsoY + 9],
        [cx + 5 + lean, torsoY + 9],
        [cx + 4 + lean + hemSway, torsoY + 15],
        [cx + 1 + lean + hemSway, torsoY + 12],
        [cx - 1 + lean + hemSway, torsoY + 15],
        [cx - 4 + lean + hemSway, torsoY + 12],
    ], rag, { shape: 'cylinder-y', height: 7, curve: 0.7, alpha });
    // Head, sunk forward between the shoulders (the signature stoop).
    const headY = baseY + 4 + fold;
    const headX = cx + lean + Math.round(k.lean * 1.5);
    c.rect(cx - 1.5 + lean, baseY + 10, 3, 4, skinDeep, { shape: 'cylinder-y', height: 8, shade: 0.7, alpha }); // neck
    c.ellipse(headX, headY + 3, 4, 4.4, skin, { shape: 'dome', height: 13, curve: 0.95, alpha });
    // Gaunt jaw shadow and hollow cheeks.
    c.ellipse(headX, headY + 5, 3, 2.4, skinDeep, { shape: 'round', height: 12, shade: 0.75, alpha });
    // Hollow eyes: two dark pits with a faint cold glow, unless fully dead.
    if (k.collapse < 0.7) {
        [-1.6, 1.6].forEach((ox) => {
            c.rect(headX + ox - 0.5, headY + 2, 2, 2, '#171512', { shape: 'flat', height: 14, alpha });
            c.rect(headX + ox, headY + 2.5, 1, 1, VOID_EYE, { emissive: true, alpha: alpha * 0.85 });
        });
    }
}
/**
 * BONEGUARD — an armoured skeleton drilled to hold a line. The read is *mass and
 * defence*: a broad round shield fills one side of the silhouette, a crested
 * helm caps the skull, and between them the exposed ribcage shows the thing is
 * dead. It plants and bashes rather than lunges.
 */
function drawBoneguard(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 4;
    c.groundShadow(cx, groundY, 10 - k.squash, 3.4, 0.42);
    const alpha = deathAlpha(k);
    const bone = TINT.boneguard;
    const boneShade = (0, Palette_1.shift)(bone, -0.16, 12);
    const steel = '#8f97a6';
    const steelDark = (0, Palette_1.shift)(steel, -0.2, 10);
    const lean = k.lean + k.recoil;
    const baseY = 4 + k.bob + Math.round(k.collapse * 10);
    // On death the frame clatters apart: parts drift and drop.
    const scatter = Math.round(k.collapse * 6);
    // Legs: bare bone, braced apart for a wide, stable stance.
    const legY = baseY + 27;
    [-1, 1].forEach((side, i) => {
        const lx = cx + side * 5 + Math.round(k.stride * side * 0.5);
        c.rect(lx - 1.5, legY, 3, 11 + scatter, boneShade, { shape: 'cylinder-y', height: 5, shade: i === 0 ? 0.78 : 1, alpha });
        c.ellipse(lx, legY + 11 + scatter, 2.6, 1.8, boneShade, { shape: 'round', height: 5, alpha }); // foot
        // Knee knob — a joint sphere, the volume cue on an otherwise stick leg.
        c.circle(lx, legY + 5, 1.8, bone, { shape: 'round', height: 6, alpha });
    });
    // Ribcage torso: a cylinder with carved rib lines so it reads as hollow bone.
    const torsoY = baseY + 13;
    c.rect(cx - 5 + lean, torsoY, 10, 12, bone, { shape: 'cylinder-y', height: 9, curve: 0.95, alpha });
    c.rect(cx - 2 + lean, torsoY + 1, 4, 11, (0, Palette_1.shift)(bone, -0.06), { shape: 'flat', height: 9, shade: 0.82, alpha }); // spine gutter
    // Individual ribs as short dark arcs across the chest.
    for (let r = 0; r < 4; r += 1) {
        c.rect(cx - 5 + lean, torsoY + 1 + r * 2.5, 10, 1, boneShade, { shape: 'cylinder-x', height: 9, shade: 0.7, alpha });
    }
    // Pelvis wedge under the ribs.
    c.polygon([
        [cx - 5 + lean, torsoY + 12],
        [cx + 5 + lean, torsoY + 12],
        [cx + 3 + lean, torsoY + 16],
        [cx - 3 + lean, torsoY + 16],
    ], boneShade, { shape: 'cylinder-y', height: 8, alpha });
    // Skull with a crested helm. Helm crest adds an aggressive top spike.
    const headY = baseY + 4;
    const headX = cx + lean;
    c.rect(cx - 1.5 + lean, baseY + 11, 3, 3, boneShade, { shape: 'cylinder-y', height: 9, shade: 0.7, alpha }); // neck vertebrae
    c.ellipse(headX, headY + 4, 4, 4.2, bone, { shape: 'dome', height: 15, curve: 0.95, alpha });
    // Eye sockets: deep black pits with a pinprick of cold light.
    [-1.7, 1.7].forEach((ox) => {
        c.rect(headX + ox - 0.5, headY + 3, 2, 2, '#14140f', { shape: 'flat', height: 16, alpha });
        if (k.collapse < 0.6)
            c.rect(headX + ox, headY + 3.5, 1, 1, VOID_EYE, { emissive: true, alpha: alpha * 0.8 });
    });
    c.rect(headX - 1, headY + 6, 2, 1, boneShade, { shape: 'flat', height: 15, shade: 0.7, alpha }); // nasal cavity
    // Helm: a steel dome cap over the crown plus a forward crest fin.
    c.ellipse(headX, headY + 1.5, 4.4, 2.8, steel, { shape: 'dome', height: 17, curve: 1, alpha: alpha });
    c.polygon([
        [headX - 0.5, headY - 3 - scatter],
        [headX + 1.5, headY - 3 - scatter],
        [headX + 1, headY + 1],
        [headX, headY + 1],
    ], steelDark, { shape: 'bevel', height: 18, alpha });
    // Shield arm (creature's left / screen right): the defining feature. A big
    // round steel disc with a boss, held forward. Bashes on the strike frame.
    const shieldX = cx + 8 + lean + Math.round(k.reach * 0.7);
    const shieldY = torsoY + 4;
    c.circle(shieldX, shieldY, 6.5, steel, { shape: 'dome', height: 12, curve: 1, alpha });
    c.circle(shieldX, shieldY, 6.5, steelDark, { shape: 'round', height: 11, shade: 0.6, alpha }); // rim ring drawn under...
    c.circle(shieldX, shieldY, 5, steel, { shape: 'dome', height: 12, curve: 1, alpha }); // ...then the face on top
    c.circle(shieldX, shieldY, 1.8, (0, Palette_1.shift)(steel, 0.12), { shape: 'round', height: 14, alpha }); // central boss
    // Weapon arm (screen left): a bone club/mace held low and out to the side at
    // rest — kept well clear of the skull so the head silhouette stays clean —
    // then hauled up and forward on the strike frame to bash over the shield.
    const armX = cx - 7 + lean;
    const swing = k.reach > 4 ? 1 : 0; // strike frame raises the whole weapon
    const raise = swing * 8; // how far the mace lifts when it swings
    c.rect(armX - 1, torsoY + 3, 3, 6, boneShade, { shape: 'cylinder-y', height: 8, alpha }); // upper arm
    // Forearm angles down-and-out at rest, up-and-forward on strike.
    const foreX = armX - 3;
    const foreY = torsoY + 6 - raise;
    c.rect(foreX, foreY, 3, 7, bone, { shape: 'cylinder-y', height: 8, alpha });
    // Mace head sits at the far low corner at rest (never near the head).
    c.circle(foreX + 1, foreY + 8, 2.6, steelDark, { shape: 'round', height: 10, alpha });
    c.circle(foreX + 1, foreY + 8, 1.2, steel, { shape: 'round', height: 11, alpha }); // flanged glint
}
/**
 * DIREWOLF — a corrupted beast that runs on all fours. The read is a long, low,
 * *horizontal* mass: shoulders and haunches high, spine dipping between, a heavy
 * head thrust forward and down at throat height. Mangy fur breaks the outline
 * into spikes; the muzzle snarls open on attack.
 */
function drawDirewolf(c, k) {
    const groundY = c.height - 3;
    const midX = c.width / 2;
    c.groundShadow(midX, groundY, 16 - k.squash, 3.2, 0.4);
    const alpha = deathAlpha(k);
    const fur = TINT.direwolf;
    const furDark = (0, Palette_1.shift)(fur, -0.16, 8);
    const furLight = (0, Palette_1.shift)(fur, 0.1, -6);
    // Facing screen-right (head on the right). Death: legs splay, body sinks flat.
    const sink = Math.round(k.collapse * 8);
    const baseY = 7 + k.bob + sink; // body rides low — a heavy predator, not a deer
    const gait = k.stride;
    const lunge = Math.round(k.reach * 0.7); // whole head/neck drives forward on attack
    // ---- Four muscled legs. Each is real anatomy, not a stilt: a thick upper limb
    // (haunch/shoulder muscle) tapering down a narrower shank to a small paw. They
    // are SHORT — a dire wolf stands low — but still clearly legs, with real ground
    // clearance and negative space between the pairs. Drawn first; the haunch and
    // shoulder masses are then laid over their tops so the body→leg join reads as a
    // continuous muscled slope, never an abrupt peg-joint. Front and rear pairs
    // swing out of phase and lift at different points, so the gait reads as a trot.
    const groundLine = groundY - 1;
    const drawLeg = (hipX, phase, shade, front) => {
        const swing = Math.round(Math.sin(phase) * gait); // fore/aft reach of the paw
        const lift = Math.max(0, -Math.cos(phase)) * 3; // paw lifts through the swing
        const hipY = baseY + 12; // where the limb leaves the body mass
        const kneeY = baseY + 18 + Math.round(sink * 0.5);
        const footY = groundLine - Math.round(lift) + sink;
        const kneeX = hipX + Math.round(swing * 0.35) + (front ? 1 : -1);
        const footX = hipX + swing + (front ? 2 : -1);
        // Upper limb: thick at the hip, tapering toward the knee (cylinder-y gives it
        // a rounded, muscled front).
        c.polygon([
            [hipX - 2.5, hipY],
            [hipX + 2.5, hipY],
            [kneeX + 1.5, kneeY],
            [kneeX - 1.5, kneeY],
        ], furDark, { shape: 'cylinder-y', height: 5, shade, curve: 0.9, alpha });
        // Shank: narrower, angling to the paw — the taper that says "leg, not peg".
        c.polygon([
            [kneeX - 1.5, kneeY - 1],
            [kneeX + 1.5, kneeY - 1],
            [footX + 1, footY],
            [footX - 1, footY],
        ], furDark, { shape: 'cylinder-y', height: 4, shade: shade * 0.9, curve: 0.9, alpha });
        // Small paw pad, wider than the ankle so it grips the ground.
        c.ellipse(footX + 0.5, footY, 2.3, 1.4, furDark, { shape: 'round', height: 4, shade, alpha });
    };
    // Far pair first (dimmer for depth), then near pair. Wider stance front/back.
    drawLeg(midX - 8, 0, 0.6, false); // far rear
    drawLeg(midX + 9, Math.PI, 0.6, true); // far front
    drawLeg(midX - 11, Math.PI, 0.95, false); // near rear
    drawLeg(midX + 12, 0, 1, true); // near front
    // ---- Body: a long, low horizontal barrel slung between two muscle masses.
    // Haunch (rear) is the bulkiest; chest/shoulder (front) carries the head. The
    // masses OVERLAP the tops of the legs so the transition reads as anatomy, and
    // sit high enough on the leg that real leg still shows below them.
    const bodyY = baseY + 6; // barrel low, but leaving clearance for visible legs
    // Rear haunch: a rounded thigh mass swelling down toward the back legs.
    c.ellipse(midX - 9, bodyY + 4, 7.5, 6, fur, { shape: 'round', height: 9, curve: 1, alpha });
    c.ellipse(midX - 10, bodyY + 5, 4, 3.5, furDark, { shape: 'round', height: 8, shade: 0.9, alpha }); // haunch crease
    // Front shoulder: a chest/shoulder mass feeding into the front legs.
    c.ellipse(midX + 9, bodyY + 4, 6, 5.5, fur, { shape: 'round', height: 9, curve: 1, alpha });
    // The barrel connecting them.
    c.rect(midX - 12, bodyY, 22, 8, fur, { shape: 'cylinder-x', height: 9, curve: 0.95, alpha });
    // A shallow tuck-up of the belly toward the loin, so the underside isn't a slab
    // but the legs stay clear of it.
    c.ellipse(midX + 2, bodyY + 7, 5, 1.6, furDark, { shape: 'cylinder-x', height: 7, shade: 0.85, alpha });
    // Spine ridge — a lit strip along the top so the barrel reads as rounded.
    c.rect(midX - 11, bodyY, 20, 1, furLight, { shape: 'flat', height: 10, alpha });
    // Mangy fur: dark spikes bristling off the back and haunch, breaking outline.
    for (let s = 0; s < 6; s += 1) {
        const sx = midX - 10 + s * 3.4;
        c.polygon([
            [sx, bodyY - 1],
            [sx + 2, bodyY - 1],
            [sx + 1, bodyY - 3 - (s % 2)],
        ], furDark, { shape: 'flat', height: 10, alpha });
    }
    // ---- Neck + head, thrust forward and low toward the prey (down-right).
    const headX = midX + 15 + lunge;
    const headY = bodyY + 3 + Math.round(k.reach * 0.3);
    c.polygon([
        [midX + 8, bodyY],
        [midX + 14, bodyY - 1],
        [headX, headY - 2],
        [headX, headY + 4],
        [midX + 9, bodyY + 7],
    ], fur, { shape: 'cylinder-y', height: 8, curve: 0.9, alpha }); // thick neck
    // Skull.
    c.ellipse(headX, headY, 5, 4.2, fur, { shape: 'dome', height: 11, curve: 0.95, alpha });
    // Elongated snarling muzzle jutting forward.
    const jawGap = k.reach > 4 ? 2 : 0.5; // mouth gapes on the strike frame
    c.polygon([
        [headX + 2, headY - 2],
        [headX + 9, headY - 1],
        [headX + 8, headY + 1],
        [headX + 2, headY + 1],
    ], furDark, { shape: 'cylinder-x', height: 11, curve: 0.85, alpha }); // upper jaw
    c.polygon([
        [headX + 2, headY + 1 + jawGap],
        [headX + 8, headY + 1 + jawGap],
        [headX + 7, headY + 3 + jawGap],
        [headX + 2, headY + 3 + jawGap],
    ], (0, Palette_1.shift)(fur, -0.1), { shape: 'cylinder-x', height: 10, curve: 0.85, alpha }); // lower jaw
    // Fangs: tiny bone triangles at the mouth line when it snarls.
    if (jawGap > 1) {
        for (let t = 0; t < 3; t += 1) {
            const tx = headX + 3 + t * 2;
            c.polygon([[tx, headY + 1], [tx + 1.2, headY + 1], [tx + 0.5, headY + 2.4]], '#e8e0c8', { shape: 'flat', height: 12, alpha });
        }
    }
    // Ears, pinned back and pointed.
    c.polygon([[headX - 3, headY - 3], [headX - 1, headY - 6], [headX, headY - 2]], furDark, { shape: 'flat', height: 12, alpha });
    c.polygon([[headX + 1, headY - 3], [headX + 3, headY - 6], [headX + 3, headY - 2]], furDark, { shape: 'flat', height: 12, alpha });
    // Feral eye: a hot ember glow, the one warm accent on a cold grey beast.
    if (k.collapse < 0.7) {
        c.rect(headX + 1, headY - 1, 1.6, 1.6, '#ffb84a', { emissive: true, alpha: alpha * 0.9 });
    }
    // Ragged tail sweeping off the haunch, opposite the head.
    const tailSwing = Math.round(Math.sin((k.stride / 3) * Math.PI) * 3);
    c.polygon([
        [midX - 15, bodyY + 2],
        [midX - 17, bodyY + 1 + tailSwing],
        [midX - 20, bodyY + 4 + tailSwing],
        [midX - 15, bodyY + 5],
    ], furDark, { shape: 'cylinder-y', height: 7, alpha });
}
/**
 * WRAITH — a floating spectre. The read is *no legs*: a hovering teardrop of
 * tattered shroud that widens at the shoulders and frays into drifting rags and
 * mist at the bottom, never touching the ground. Two cold eyes burn in the void
 * of the hood. Everything is semi-transparent, so it looks incorporeal.
 */
function drawWraith(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 3;
    // A faint, diffuse shadow well below it — it hovers, so the shadow is weak.
    c.groundShadow(cx, groundY, 7, 2.2, 0.22);
    const shroud = TINT.wraith;
    const shroudDark = (0, Palette_1.shift)(shroud, -0.18, 6);
    const shroudLight = (0, Palette_1.shift)(shroud, 0.14, -8);
    // Hover: the idle bob is the primary motion; on death it sinks and fades out.
    const hover = k.bob + Math.round(Math.sin((k.stride / 3) * Math.PI) * 1.5);
    const baseY = 6 + hover + Math.round(k.collapse * 6);
    const bodyAlpha = (1 - k.collapse * 0.8) * 0.9; // ghostly even when alive
    const lean = k.lean + k.recoil;
    // Dissolving base of mist. Not discrete tendrils (those read as legs) but a
    // soft, overlapping cloud: broad low-alpha lobes that fatten near the body and
    // thin out below, so the bottom of the silhouette blurs into vapour instead of
    // sprouting limbs. Two layers — a wide faint haze, then denser wisps inside it.
    const mistFade = 1 - k.collapse; // the mist thins as the spectre unravels
    // Wide diffuse haze, one continuous band that sways as a whole.
    const hazeSway = Math.round(Math.sin(k.stride * 0.9) * 2);
    c.ellipse(cx + lean + hazeSway, baseY + 30, 9, 6 * mistFade, shroudDark, { shape: 'flat', height: 2, alpha: bodyAlpha * 0.18 });
    c.ellipse(cx + lean + hazeSway, baseY + 26, 8, 6, shroud, { shape: 'cylinder-y', height: 4, alpha: bodyAlpha * 0.3 });
    // A few fat, curling wisps peeling off the cloud — wide and short so they read
    // as vapour curls, never as legs. They overlap, leaving no clean gaps.
    for (let s = 0; s < 4; s += 1) {
        const sway = Math.sin((k.stride + s * 1.6) * 0.8) * 3;
        const mx = cx - 7 + s * 5 + lean;
        const len = (7 + (s % 2) * 3) * mistFade;
        c.polygon([
            [mx - 2.5, baseY + 24],
            [mx + 2.5, baseY + 24],
            [mx + 2 + sway, baseY + 24 + len],
            [mx - 1 + sway, baseY + 24 + len + 1],
        ], shroudDark, { shape: 'cylinder-y', height: 3, alpha: bodyAlpha * 0.32 });
    }
    // Body: a hooded teardrop. Wide cowl-shoulders tapering to a wispy point.
    c.polygon([
        [cx - 9 + lean, baseY + 10],
        [cx + 9 + lean, baseY + 10],
        [cx + 6 + lean, baseY + 26],
        [cx + 2 + lean, baseY + 30],
        [cx - 2 + lean, baseY + 30],
        [cx - 6 + lean, baseY + 26],
    ], shroud, { shape: 'cylinder-y', height: 8, curve: 0.9, alpha: bodyAlpha });
    // Inner fold shadow gives the shroud depth rather than a flat cutout.
    c.polygon([
        [cx - 4 + lean, baseY + 12],
        [cx + 4 + lean, baseY + 12],
        [cx + 1 + lean, baseY + 28],
        [cx - 1 + lean, baseY + 28],
    ], shroudDark, { shape: 'flat', height: 8, shade: 0.7, alpha: bodyAlpha });
    // Reaching wispy arms/sleeves that flare out on the attack (a grasping lunge).
    const reach = Math.round(k.reach * 0.9);
    [-1, 1].forEach((side) => {
        const ax = cx + side * 8 + lean;
        c.polygon([
            [ax, baseY + 11],
            [ax + side * 2, baseY + 12],
            [ax + side * (5 + reach), baseY + 18 + reach],
            [ax + side * (3 + reach), baseY + 20 + reach],
        ], shroud, { shape: 'cylinder-y', height: 7, alpha: bodyAlpha });
        // Skeletal hand at the tip when reaching to strike.
        if (reach > 4) {
            c.ellipse(ax + side * (5 + reach), baseY + 19 + reach, 1.8, 1.8, shroudLight, { shape: 'round', height: 7, alpha: bodyAlpha });
        }
    });
    // Cowl: a raised hood peak framing a black void where a face should be.
    c.polygon([
        [cx - 6 + lean, baseY + 10],
        [cx + 6 + lean, baseY + 10],
        [cx + 4 + lean, baseY + 2],
        [cx + lean, baseY - 2],
        [cx - 4 + lean, baseY + 2],
    ], shroud, { shape: 'dome', height: 10, curve: 0.9, alpha: bodyAlpha });
    // The hood's interior void.
    c.ellipse(cx + lean, baseY + 6, 4, 5, '#0c0a14', { shape: 'flat', height: 9, alpha: bodyAlpha * 0.95 });
    // Two burning eyes — the strongest, most identifiable mark on the wraith.
    // These stay bright until nearly gone (fade with collapse).
    const eyeA = (1 - k.collapse) * 0.95;
    [-1.7, 1.7].forEach((ox) => {
        c.circle(cx + ox + lean, baseY + 5.5, 1.4, '#eafbff', { emissive: true, alpha: eyeA });
        c.circle(cx + ox + lean, baseY + 5.5, 0.8, '#8fe4ff', { emissive: true, alpha: eyeA });
    });
    // A soft cool aura bleed around the eyes sells the emissive glow.
    c.ellipse(cx + lean, baseY + 6, 5, 5.5, '#5fd0ff', { emissive: true, alpha: eyeA * 0.14 });
}
/**
 * BOGLING — a drowned corpse bloated with swamp gas. The read is *swollen and
 * squat*: a huge sagging belly wider than the shoulders, stubby limbs, a
 * lolling head, all dripping. Waterweed hangs off it and it slouches low. Sickly
 * green-black, glistening wet.
 */
function drawBogling(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 3;
    c.groundShadow(cx, groundY, 11 - k.squash, 3.4, 0.42);
    const alpha = deathAlpha(k);
    const flesh = TINT.bogling;
    const fleshDark = (0, Palette_1.shift)(flesh, -0.16, -8);
    const fleshLight = (0, Palette_1.shift)(flesh, 0.12, -4); // wet highlight tone
    const weed = (0, Palette_1.mix)(flesh, '#2f3a24', 0.6);
    const baseY = 6 + k.bob + Math.round(k.collapse * 8);
    const lean = k.lean + k.recoil;
    // Belly wobble: the bloat jiggles on the walk and deflates a touch on death.
    const wobble = Math.round(Math.sin((k.stride / 3) * Math.PI) * 1);
    const deflate = Math.round(k.collapse * 3);
    // Stubby legs, set wide under the belly, barely supporting the mass.
    const legY = baseY + 26;
    [-1, 1].forEach((side, i) => {
        const lx = cx + side * 6 + Math.round(k.stride * side * 0.4);
        c.rect(lx - 2, legY, 4, 7, fleshDark, { shape: 'cylinder-y', height: 4, shade: i === 0 ? 0.8 : 1, alpha });
        c.ellipse(lx, legY + 7, 3, 1.8, fleshDark, { shape: 'round', height: 4, alpha }); // splayed foot
    });
    // The belly: an enormous low sphere, the dominant shape. Drawn before the
    // upper body so the torso appears to sit back into the bloat.
    const bellyY = baseY + 18 + wobble;
    c.ellipse(cx + lean * 0.5, bellyY, 12 - deflate, 10 - deflate, flesh, { shape: 'round', height: 9, curve: 1, alpha });
    // Taut, glistening highlight on the belly's upper-left — sells "wet + full".
    c.ellipse(cx - 3 + lean * 0.5, bellyY - 3, 4, 3, fleshLight, { shape: 'round', height: 11, alpha: alpha * 0.8 });
    // A dark distended navel / split seam.
    c.rect(cx - 0.5 + lean * 0.5, bellyY + 2, 1.5, 4, fleshDark, { shape: 'flat', height: 9, shade: 0.6, alpha });
    // Narrow slumped shoulders sitting atop the belly (shoulders < belly = bloat).
    const shoulderY = baseY + 9;
    c.rect(cx - 5 + lean, shoulderY, 10, 8, flesh, { shape: 'cylinder-y', height: 10, curve: 0.9, alpha });
    // Short swollen arms hanging limp, one raised to swipe on attack.
    const reach = Math.round(k.reach * 0.8);
    c.rect(cx - 8 + lean, shoulderY + 1, 4, 8, flesh, { shape: 'cylinder-y', height: 8, shade: 0.85, alpha });
    c.ellipse(cx - 6 + lean, shoulderY + 9, 2.6, 2.4, fleshDark, { shape: 'round', height: 8, shade: 0.85, alpha });
    c.rect(cx + 5 + lean, shoulderY + 1 - Math.max(0, reach), 4, 8, flesh, { shape: 'cylinder-y', height: 9, alpha });
    c.ellipse(cx + 7 + lean, shoulderY + 9 - Math.max(0, reach), 2.8, 2.6, fleshDark, { shape: 'round', height: 9, alpha });
    // Head: lolling to one side, jaw slack. Sits low, half-sunk into the shoulders.
    const headTilt = 2; // permanent lifeless tilt
    const headX = cx + lean + headTilt;
    const headY = baseY + 3;
    c.ellipse(headX, headY + 3, 4.4, 4, flesh, { shape: 'dome', height: 12, curve: 0.95, alpha });
    // Bloated cheek and slack lower jaw.
    c.ellipse(headX + 1, headY + 5, 3, 2.4, fleshDark, { shape: 'round', height: 11, shade: 0.85, alpha });
    // Dead white eyes, no glow — this one is drowned, not spectral.
    if (k.collapse < 0.7) {
        [-1.5, 1.5].forEach((ox) => {
            c.rect(headX + ox - 0.5, headY + 2, 2, 2, '#cfd8c4', { shape: 'flat', height: 13, alpha });
            c.rect(headX + ox, headY + 2.5, 1, 1, '#3a4230', { shape: 'flat', height: 13, alpha });
        });
    }
    // Waterweed draped over the head and shoulders — thin dark strands hanging,
    // swaying slightly. This ragged fringe is a big part of the read.
    for (let s = 0; s < 5; s += 1) {
        const sway = Math.sin((k.stride + s) * 0.8) * 1.5;
        const wx = cx - 6 + s * 3 + lean;
        c.line(wx, headY + 1, wx + sway, headY + 10 + (s % 2) * 3, weed, 1, { height: 12, alpha: alpha * 0.9 });
    }
    // A few drip beads leaving the belly, reinforcing "sodden".
    if (k.collapse < 0.5) {
        c.rect(cx - 8 + lean, bellyY + 6, 1, 2, fleshLight, { emissive: true, alpha: 0.5 });
        c.rect(cx + 9 + lean, bellyY + 4, 1, 2, fleshLight, { emissive: true, alpha: 0.5 });
    }
}
/**
 * CAVECRAWLER — a chittering subterranean arthropod. The read is *many legs, low
 * and wide*: a segmented chitinous body hugging the ground with a bristling fan
 * of jointed legs on both sides and a fanged, mandibled head up front. Nothing
 * humanoid about it — pure bug threat.
 */
function drawCavecrawler(c, k) {
    const groundY = c.height - 3;
    const midX = c.width / 2;
    c.groundShadow(midX, groundY, 17 - k.squash, 3, 0.4);
    const alpha = deathAlpha(k);
    const chitin = TINT.cavecrawler;
    const chitinDark = (0, Palette_1.shift)(chitin, -0.18, 10);
    const chitinLight = (0, Palette_1.shift)(chitin, 0.12, -6);
    // Faces screen-right (head/mandibles on the right).
    const sink = Math.round(k.collapse * 6);
    const baseY = 8 + k.bob + sink; // body slung low — a wide, ground-hugging bug
    const groundLine = groundY - 1;
    // ---- Segment layout, back (left) to front (right). Each plate has its own
    // crown height `top`: the thorax hump rises high, then the plates descend
    // toward the low tail, so the silhouette has a real domed high point instead of
    // reading as one horizontal smear. `r` is the plate half-width.
    const bodyY = baseY + 5;
    const segs = [
        { x: midX - 17, r: 4.4, top: bodyY - 1 }, // tail plate (lowest)
        { x: midX - 12, r: 6, top: bodyY - 4 }, // abdomen
        { x: midX - 6, r: 6.8, top: bodyY - 8 }, // rising
        { x: midX, r: 6.6, top: bodyY - 11 }, // THORAX HUMP — the high point
        { x: midX + 6, r: 5.4, top: bodyY - 7 }, // dropping toward the neck
        { x: midX + 11, r: 4.2, top: bodyY - 3 }, // neck plate
    ];
    // ---- Legs: jointed arachnid limbs that ARCH — femur rising up-and-out from
    // the body to a knee above the attachment, then the tibia angling back down to
    // the ground. The arch gives the low bug real vertical presence and reads as
    // "scuttling" rather than a fringe of straight spikes. They stay short and
    // stocky so the creature keeps its low, wide profile. Ripple down the body;
    // drawn first so the plates overlap their roots. On death they curl inward + up.
    const curl = k.collapse * 3;
    for (let i = 0; i < segs.length - 1; i += 1) {
        const s = segs[i];
        const rootY = s.top + s.r * 0.9; // leg leaves the lower flank of the plate
        const phase = (k.stride / 3) * Math.PI + i * 0.9; // ripple down the body
        const step = Math.round(Math.sin(phase) * 2); // fore/aft scuttle of the foot
        const kneeLift = 3 + Math.round(Math.abs(Math.cos(phase)) * 1.5); // arch height
        [-1, 1].forEach((side) => {
            const kneeX = s.x + side * (5 - curl);
            const kneeY = rootY - kneeLift + Math.round(curl * 2); // knee rides above the root
            const footX = s.x + side * (7 - curl * 2) + step;
            const footY = groundLine + sink - Math.round(curl);
            const shade = side < 0 ? 0.62 : 1; // far legs darker for depth
            // Femur: body → knee (rises up and out into the arch).
            c.line(s.x, rootY, kneeX, kneeY, chitinDark, 2, { height: 6, shade, alpha });
            // Tibia: knee → foot on the ground (angles back down).
            c.line(kneeX, kneeY, footX, footY, chitinDark, 1, { height: 5, shade, alpha });
            // Tarsal claw tip biting the floor.
            if (k.collapse < 0.5)
                c.rect(footX + side * 0.5, footY, 1, 1, chitinDark, { shape: 'flat', height: 4, shade, alpha });
        });
    }
    // ---- Segmented carapace: overlapping chitin plates. Each is a tall dome
    // (aspect ~1.0, not flattened) rising to its own crown, so the row builds into
    // a humped back. Drawn back-to-front so the front plates overlap the ones
    // behind, reinforcing the descending overlap toward the tail.
    segs.forEach((s, i) => {
        const h = groundLine - s.top; // taller plates read as more raised
        c.ellipse(s.x, s.top + s.r, s.r, s.r, chitin, { shape: 'dome', height: 8 + h * 0.4, curve: 1, alpha });
        // Bright crown ridge along the top of each plate — sells the raised dome.
        c.ellipse(s.x - 1, s.top + 1, s.r * 0.55, s.r * 0.35, chitinLight, { shape: 'dome', height: 10 + h * 0.4, alpha: alpha * 0.8 });
        // Dark seam in front of each plate (the overlap shadow).
        c.rect(s.x + s.r - 1, s.top, 1, s.r * 1.5, chitinDark, { shape: 'flat', height: 7, shade: 0.55, alpha });
    });
    // A short spine tuft cresting the thorax hump, emphasising the high point.
    const hump = segs[3];
    for (let t = -1; t <= 1; t += 1) {
        c.polygon([
            [hump.x + t * 2 - 0.8, hump.top + 1],
            [hump.x + t * 2 + 0.8, hump.top + 1],
            [hump.x + t * 2, hump.top - 2 - (t === 0 ? 1 : 0)],
        ], chitinDark, { shape: 'cone', height: 16, alpha });
    }
    // ---- Head: a large, distinct armoured node LIFTED above the body line and
    // thrust forward on a short neck, clearly separated from the carapace. The
    // mandibles project off the front as their own forms (not fused into the head),
    // spreading wide on the attack frame.
    const neck = segs[segs.length - 1];
    const headX = midX + 18;
    const headY = neck.top + 1; // sits up near the crest, above the body midline
    // Short neck stalk connecting the front plate to the raised head.
    c.polygon([
        [neck.x + 1, neck.top + 2],
        [neck.x + 2, neck.top + neck.r],
        [headX - 2, headY + 4],
        [headX - 3, headY],
    ], chitinDark, { shape: 'cylinder-y', height: 8, alpha });
    // The head capsule — bigger than any single old segment, its own rounded mass.
    c.ellipse(headX, headY + 2, 5.2, 4.6, chitin, { shape: 'dome', height: 13, curve: 1, alpha });
    c.ellipse(headX - 1, headY + 0.5, 2.4, 1.6, chitinLight, { shape: 'dome', height: 15, alpha: alpha * 0.8 }); // head highlight
    // Mandibles: two hooked pincers reaching off the FRONT of the head, with a
    // clear gap (dark) between them and the head mass. They gape on the strike.
    const spread = k.reach > 4 ? 3 : 1;
    [-1, 1].forEach((side) => {
        c.polygon([
            [headX + 4, headY + side * 1.5],
            [headX + 10, headY + side * (spread + 1)],
            [headX + 9, headY + side * (spread + 2.6)],
            [headX + 4, headY + side * 3],
        ], chitinDark, { shape: 'cylinder-x', height: 11, curve: 0.8, alpha });
        // Pale fang tip curving inward.
        c.ellipse(headX + 9.5, headY + side * (spread + 1.6), 1, 1, '#d8ccae', { shape: 'round', height: 12, alpha });
    });
    // A pair of short antennae sweeping up off the head, adding to the bug read.
    c.line(headX + 2, headY - 2, headX + 6, headY - 6, chitinDark, 1, { height: 13, alpha });
    c.line(headX + 3, headY - 2, headX + 8, headY - 4, chitinDark, 1, { height: 13, alpha });
    // Cluster of small glowing eyes on the raised head — a menacing glint.
    if (k.collapse < 0.7) {
        [[-1.5, -1], [1, -1.4], [-0.5, 1], [2, 0.5]].forEach(([ox, oy]) => {
            c.rect(headX + ox - 0.5, headY + oy - 0.5, 1.3, 1.3, '#c9ff7a', { emissive: true, alpha: alpha * 0.85 });
        });
    }
    // A raised, curling tail-stinger off the low rear plate — asymmetry and threat,
    // and a second vertical accent balancing the head end.
    const tail = segs[0];
    const tailLift = Math.round(k.reach * 0.4);
    c.polygon([
        [tail.x - 1, tail.top + tail.r],
        [tail.x - 4, tail.top - 3 - tailLift],
        [tail.x - 2, tail.top - 7 - tailLift],
        [tail.x, tail.top - 3 - tailLift],
        [tail.x + 2, tail.top + 2],
    ], chitinDark, { shape: 'cylinder-y', height: 9, alpha });
    c.polygon([
        [tail.x - 3, tail.top - 7 - tailLift],
        [tail.x - 1, tail.top - 11 - tailLift],
        [tail.x, tail.top - 6 - tailLift],
    ], '#d8ccae', { shape: 'cone', height: 11, alpha }); // bone stinger tip
}
/**
 * ASHBORN — a humanoid of burnt charcoal with fire trapped inside. The read is a
 * cracked stone figure lit from within: matte black-red plating split by a
 * branching network of glowing fissures, brightest at the core, radiating heat
 * shimmer. The emissive cracks are the whole identity, so they get real glow.
 */
function drawAshborn(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 4;
    c.groundShadow(cx, groundY, 8 - k.squash, 3, 0.4);
    const alpha = deathAlpha(k);
    const char = (0, Palette_1.mix)(TINT.ashborn, '#2a1c1c', 0.62); // near-black charcoal skin
    const charDark = (0, Palette_1.shift)(char, -0.08, 0);
    // The internal fire cools as the creature dies (fissures dim toward ember).
    const heat = 1 - k.collapse * 0.85;
    const lava = (0, Palette_1.mix)('#ff9038', '#7a2410', k.collapse * 0.7);
    const core = (0, Palette_1.mix)('#ffd27a', '#ff6a2a', k.collapse * 0.5);
    const baseY = 4 + k.bob + Math.round(k.collapse * 8);
    const lean = k.lean + k.recoil;
    const crumble = Math.round(k.collapse * 3);
    // Helper: draw a glowing fissure segment (dark crack edges + emissive centre).
    const fissure = (x0, y0, x1, y1, bright = 1) => {
        c.line(x0, y0, x1, y1, lava, 1, { emissive: true, alpha: alpha * heat * bright });
    };
    // Legs: cracked charcoal columns with a lava seam up each shin.
    const legY = baseY + 26;
    [-1, 1].forEach((side, i) => {
        const lx = cx + side * 4 + Math.round(k.stride * side * 0.6);
        c.rect(lx - 1.5, legY, 4, 12 - crumble, char, { shape: 'cylinder-y', height: 5, shade: i === 0 ? 0.85 : 1, alpha });
        c.ellipse(lx + 0.5, legY + 12 - crumble, 2.6, 1.8, charDark, { shape: 'round', height: 5, alpha });
        fissure(lx, legY + 1, lx, legY + 9 - crumble, 0.8); // shin crack
    });
    // Torso: a blocky charcoal cylinder. The molten core glows at the chest.
    const torsoY = baseY + 12;
    c.rect(cx - 5 + lean, torsoY, 10, 13, char, { shape: 'cylinder-y', height: 9, curve: 0.9, alpha });
    // The core: a bright emissive well at the sternum, radiating cracks outward.
    c.ellipse(cx + lean, torsoY + 6, 3.4, 4, core, { emissive: true, alpha: alpha * heat });
    c.ellipse(cx + lean, torsoY + 6, 2, 2.4, (0, Palette_1.mix)(core, '#fff2c8', 0.6), { emissive: true, alpha: alpha * heat });
    // Branching fissures spidering out from the core across the chest.
    fissure(cx + lean, torsoY + 3, cx - 3 + lean, torsoY, 0.9);
    fissure(cx + lean, torsoY + 3, cx + 3 + lean, torsoY + 1, 0.9);
    fissure(cx + lean, torsoY + 9, cx - 4 + lean, torsoY + 12, 0.9);
    fissure(cx + lean, torsoY + 9, cx + 4 + lean, torsoY + 11, 0.9);
    fissure(cx - 3 + lean, torsoY + 5, cx - 5 + lean, torsoY + 7, 0.7);
    fissure(cx + 3 + lean, torsoY + 5, cx + 5 + lean, torsoY + 8, 0.7);
    // Arms: charcoal, the striking arm rearing back then hammering forward. A
    // fissure runs down the forearm and flares brighter as it swings (stoking).
    const reach = Math.round(k.reach);
    // Off arm.
    c.rect(cx - 8 + lean, torsoY + 1, 4, 9, char, { shape: 'cylinder-y', height: 8, shade: 0.85, alpha });
    c.ellipse(cx - 6 + lean, torsoY + 10, 2.6, 2.4, charDark, { shape: 'round', height: 8, shade: 0.85, alpha });
    fissure(cx - 6 + lean, torsoY + 3, cx - 6 + lean, torsoY + 9, 0.6);
    // Striking arm.
    const saX = cx + 6 + lean + Math.max(0, reach - 2);
    const saY = torsoY + 1 - Math.max(0, Math.round(reach * 0.4));
    c.rect(saX - 2, saY, 4, 9, char, { shape: 'cylinder-y', height: 9, alpha });
    c.ellipse(saX, saY + 9, 3, 2.8, charDark, { shape: 'round', height: 9, alpha });
    // Molten fist — the hand glows hot when cocked/striking.
    const fistHeat = k.reach !== 0 ? 1 : 0.5;
    c.ellipse(saX, saY + 9, 2, 2, lava, { emissive: true, alpha: alpha * heat * fistHeat });
    fissure(saX, saY + 2, saX, saY + 8, 0.8 + fistHeat * 0.2);
    // Head: a cracked skull-like block with burning eyes and a molten crown seam.
    const headY = baseY + 3;
    const headX = cx + lean;
    c.rect(cx - 1.5 + lean, baseY + 10, 3, 3, charDark, { shape: 'cylinder-y', height: 9, shade: 0.7, alpha }); // neck
    c.ellipse(headX, headY + 4, 4.2, 4.4, char, { shape: 'dome', height: 14, curve: 0.95, alpha });
    // Cracked-open crown: a jagged emissive seam across the top of the skull.
    fissure(headX - 3, headY + 1, headX + 3, headY, 0.9);
    fissure(headX - 1, headY + 1, headX, headY + 4, 0.7);
    // Eyes: molten slits.
    [-1.6, 1.6].forEach((ox) => {
        c.rect(headX + ox - 0.5, headY + 3.5, 2, 1.4, core, { emissive: true, alpha: alpha * heat });
    });
    // Heat haze: a faint emissive bloom over the whole figure while it burns hot.
    if (k.collapse < 0.5) {
        c.ellipse(headX, torsoY + 4, 8, 12, '#ff6a2a', { emissive: true, alpha: 0.05 * heat });
    }
    // On death: rising embers where the body is coming apart.
    if (k.collapse > 0.3) {
        for (let e = 0; e < 4; e += 1) {
            c.rect(cx - 4 + e * 2.5 + lean, torsoY - e * 2 + crumble, 1, 1, core, { emissive: true, alpha: heat * 0.7 });
        }
    }
}
/**
 * NAMELESS — the first boss. Not bulk but *wrongness of proportion*: an
 * impossibly tall, slender horror, elegant and still, with FOUR arms fanned in
 * an unsettling gesture, a veil hiding the upper face, and a thin crown of
 * spines. It should read as a silhouette that is almost beautiful and entirely
 * wrong — the vertical opposite of the cinderlord's mass.
 */
function drawNameless(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 4;
    c.groundShadow(cx, groundY, 11 - k.squash, 3.6, 0.44);
    const alpha = deathAlpha(k);
    const flesh = (0, Palette_1.mix)(TINT.nameless, '#e8d3dd', 0.35); // pale, bloodless porcelain
    const fleshDark = (0, Palette_1.shift)(flesh, -0.16, 6);
    const gown = (0, Palette_1.shift)(TINT.nameless, -0.12, 4); // deep wine gown
    const gownDark = (0, Palette_1.shift)(gown, -0.12, 4);
    const gownLight = (0, Palette_1.shift)(gown, 0.12, -4);
    const gold = '#d8b25a';
    // A tall, slow idle sway rather than a bob — regal, floating menace.
    const sway = Math.round(Math.sin((k.bob + k.stride) * 0.7) * 1);
    const baseY = 5 + k.bob + Math.round(k.collapse * 12);
    const lean = k.lean + k.recoil + sway;
    // Death: the tall frame buckles and folds down dramatically.
    const fold = Math.round(k.collapse * 14);
    // The gown pools to the floor — no legs visible, a long tapering column that
    // makes the figure read as gliding. Widens at the hem into a pooled skirt.
    const gownTop = baseY + 20;
    const hemSway = Math.round(Math.sin((k.stride) * 0.8) * 2);
    c.polygon([
        [cx - 5 + lean, gownTop],
        [cx + 5 + lean, gownTop],
        [cx + 11 + hemSway, groundY - fold],
        [cx - 11 + hemSway, groundY - fold],
    ], gown, { shape: 'cylinder-y', height: 8, curve: 0.9, alpha });
    // Vertical fold lines elongate the silhouette.
    [-6, -2, 2, 6].forEach((ox, i) => {
        c.line(cx + ox * 0.5 + lean, gownTop + 1, cx + ox + hemSway, groundY - fold - 1, i % 2 ? gownDark : gownLight, 1, { height: 8, shade: 0.85, alpha });
    });
    // A gilded hem band.
    c.rect(cx - 11 + hemSway, groundY - 2 - fold, 22, 2, gold, { shape: 'cylinder-x', height: 8, shade: 0.8, alpha });
    // Slender torso, unnaturally long and narrow. Corset-like gilded seam.
    const torsoY = baseY + 10;
    c.rect(cx - 3.5 + lean, torsoY, 7, 12, gown, { shape: 'cylinder-y', height: 10, curve: 0.95, alpha });
    c.line(cx + lean, torsoY + 1, cx + lean, torsoY + 11, gold, 1, { height: 11, shade: 0.9, alpha });
    c.rect(cx - 3.5 + lean, torsoY + 5, 7, 1, gold, { shape: 'flat', height: 10, shade: 0.85, alpha });
    // FOUR arms — the signature. Upper pair raised wide in an eerie welcome; lower
    // pair lower and closer. Long, thin, ending in delicate elongated hands. The
    // whole fan spreads further on the attack (a grasping embrace).
    const spread = 1 + (k.reach > 4 ? 0.5 : 0) + k.reach * 0.05;
    const drawArm = (side, shoulderY, angle, len, shade) => {
        const sx = cx + side * 3 + lean;
        // Elbow out along the angle, hand continuing further out and up/down.
        const ex = sx + side * Math.round(len * 0.55 * spread);
        const ey = shoulderY + Math.round(angle * len * 0.4);
        const hx = ex + side * Math.round(len * 0.5 * spread);
        const hy = ey + Math.round(angle * len * 0.55) - Math.round(k.reach * 0.3);
        c.line(sx, shoulderY, ex, ey, flesh, 2, { height: 9, shade, alpha });
        c.line(ex, ey, hx, hy, flesh, 2, { height: 9, shade: shade * 0.95, alpha });
        // Long-fingered hand: a small palm plus splayed finger lines.
        c.ellipse(hx, hy, 1.8, 1.6, fleshDark, { shape: 'round', height: 9, shade, alpha });
        for (let f = -1; f <= 1; f += 1) {
            c.line(hx, hy, hx + side * 2, hy + f * 2 + Math.round(angle), fleshDark, 1, { height: 9, shade, alpha });
        }
    };
    // Upper arms: raised high and wide (angle negative = upward).
    drawArm(-1, torsoY + 1, -1.1, 12, 0.82);
    drawArm(1, torsoY + 1, -1.1, 12, 1);
    // Lower arms: reaching outward and slightly down.
    drawArm(-1, torsoY + 6, 0.5, 11, 0.78);
    drawArm(1, torsoY + 6, 0.5, 11, 0.95);
    // Slender neck and a narrow, tilted head.
    const headY = baseY + 1 + Math.round(fold * 0.5);
    const headX = cx + lean + Math.round(sway);
    c.rect(cx - 1 + lean, baseY + 8, 2, 4, fleshDark, { shape: 'cylinder-y', height: 11, shade: 0.7, alpha }); // long neck
    c.ellipse(headX, headY + 4, 3.4, 4.2, flesh, { shape: 'dome', height: 15, curve: 0.95, alpha });
    // The veil: a translucent band across the eyes, hiding the upper face. Below
    // it, a small serene mouth — the "unsettling grace".
    c.rect(headX - 3.2, headY + 2.5, 6.4, 2.4, gownDark, { shape: 'cylinder-x', height: 16, shade: 0.9, alpha: alpha * 0.85 });
    // Two faint glowing eyes bleeding through the veil.
    if (k.collapse < 0.7) {
        [-1.4, 1.4].forEach((ox) => {
            c.rect(headX + ox - 0.5, headY + 3, 1.4, 1.4, '#ffd6ec', { emissive: true, alpha: alpha * 0.7 });
        });
    }
    c.rect(headX - 1, headY + 6, 2, 1, fleshDark, { shape: 'flat', height: 15, shade: 0.8, alpha }); // small mouth
    // Crown of thin spines — a jagged halo that tops the tall silhouette and reads
    // as royalty-gone-wrong. Slightly asymmetric on purpose.
    const spikes = [-3, -1.5, 0, 1.5, 3];
    spikes.forEach((ox, i) => {
        const h = 4 + (i === 2 ? 3 : (i % 2 === 0 ? 2 : 0)); // tallest at centre
        c.polygon([
            [headX + ox - 0.8, headY + 1],
            [headX + ox + 0.8, headY + 1],
            [headX + ox + (i - 2) * 0.4, headY + 1 - h],
        ], gold, { shape: 'cone', height: 17, shade: 0.9, alpha });
    });
}
/**
 * CINDERLORD — the final boss. Pure *mass and heat*: a towering, wide-shouldered
 * armoured warlord with a great horned helm, a molten core burning behind the
 * breastplate, gauntleted fists the size of the husk's whole torso, and a
 * cape of drifting embers. Where nameless is a thin vertical, this is a
 * broad, heavy pyramid that dominates the frame.
 */
function drawCinderlord(c, k) {
    const cx = c.width / 2;
    const groundY = c.height - 4;
    c.groundShadow(cx, groundY, 16 - k.squash, 4.2, 0.5);
    const alpha = deathAlpha(k);
    const plate = (0, Palette_1.mix)(TINT.cinderlord, '#2c1a1a', 0.55); // scorched dark iron
    const plateDark = (0, Palette_1.shift)(plate, -0.1, 4);
    const plateLight = (0, Palette_1.shift)(plate, 0.12, -4);
    const heat = 1 - k.collapse * 0.85;
    const lava = (0, Palette_1.mix)('#ff8a30', '#7a2410', k.collapse * 0.7);
    const core = (0, Palette_1.mix)('#ffd884', '#ff5e24', k.collapse * 0.5);
    const gold = '#c99a44';
    const baseY = 4 + k.bob + Math.round(k.collapse * 12);
    const lean = k.lean + k.recoil;
    const buckle = Math.round(k.collapse * 8); // heavy collapse
    // ---- Cape of embers behind everything: a broad dark mantle flaring out at
    // the shoulders, its lower edge dissolving into rising emissive sparks.
    const capeSway = Math.round(Math.sin((k.stride / 3) * Math.PI) * 2);
    c.polygon([
        [cx - 13 + lean, baseY + 12],
        [cx + 13 + lean, baseY + 12],
        [cx + 16 + capeSway, groundY - 2 - buckle],
        [cx - 16 + capeSway, groundY - 2 - buckle],
    ], (0, Palette_1.mix)(plate, '#1a1012', 0.5), { shape: 'cylinder-y', height: 4, curve: 0.85, alpha });
    // Ember sparks lifting off the cape's ragged lower edge.
    for (let s = 0; s < 7; s += 1) {
        const sx = cx - 12 + s * 4 + capeSway;
        const sy = groundY - 4 - ((s * 3) % 9) - buckle;
        c.rect(sx, sy, 1, 1 + (s % 2), lava, { emissive: true, alpha: heat * (0.5 + (s % 3) * 0.15) });
    }
    // ---- Legs: enormous armoured columns planted wide. Sabatons flare at the
    // feet; molten seams glow between the plates.
    const legY = baseY + 34;
    [-1, 1].forEach((side, i) => {
        const lx = cx + side * 8 + Math.round(k.stride * side * 0.4);
        c.rect(lx - 3, legY, 6, 14 - buckle, plate, { shape: 'cylinder-y', height: 6, shade: i === 0 ? 0.82 : 1, alpha });
        c.rect(lx - 4, legY + 12 - buckle, 8, 4, plateDark, { shape: 'bevel', height: 6, shade: i === 0 ? 0.82 : 1, alpha }); // sabaton
        // Knee cop — a bevelled plate with a glowing rivet.
        c.rect(lx - 3, legY + 4, 6, 3, plateLight, { shape: 'bevel', height: 7, shade: i === 0 ? 0.82 : 1, alpha });
        c.line(lx, legY + 1, lx, legY + 11 - buckle, lava, 1, { emissive: true, alpha: alpha * heat * 0.7 });
    });
    // ---- Massive torso: a broad barrel breastplate. Widest at the chest, so the
    // whole figure is a top-heavy pyramid of armour.
    const torsoY = baseY + 14;
    c.rect(cx - 11 + lean, torsoY, 22, 16, plate, { shape: 'cylinder-y', height: 11, curve: 0.9, alpha });
    // Fauld (skirt of plates) below the breastplate.
    for (let p = 0; p < 5; p += 1) {
        c.rect(cx - 10 + p * 4 + lean, torsoY + 15, 4, 5 - buckle, plateDark, { shape: 'bevel', height: 9, alpha });
    }
    // The molten core: a huge glowing furnace behind a cracked breastplate vent.
    // This is the boss's heart and the eye is drawn to it.
    c.ellipse(cx + lean, torsoY + 7, 5, 6, (0, Palette_1.mix)(core, '#3a1408', 0.3), { emissive: true, alpha: alpha * heat }); // vent shadow ring
    c.ellipse(cx + lean, torsoY + 7, 4, 5, core, { emissive: true, alpha: alpha * heat });
    c.ellipse(cx + lean, torsoY + 7, 2.4, 3, (0, Palette_1.mix)(core, '#fff2cc', 0.7), { emissive: true, alpha: alpha * heat });
    // Grated vent bars across the core (dark plate strips over the glow).
    for (let g = -1; g <= 1; g += 1) {
        c.rect(cx - 4 + lean, torsoY + 5 + g * 2.5, 8, 1, plateDark, { shape: 'flat', height: 12, alpha });
    }
    // Fissures cracking outward from the core across the breastplate.
    c.line(cx + lean, torsoY + 2, cx - 5 + lean, torsoY, lava, 1, { emissive: true, alpha: alpha * heat * 0.8 });
    c.line(cx + lean, torsoY + 2, cx + 5 + lean, torsoY + 1, lava, 1, { emissive: true, alpha: alpha * heat * 0.8 });
    // ---- Huge spiked pauldrons — the widest points of the silhouette, sitting
    // above the shoulders like a second, larger head-height line. Asymmetric: the
    // weapon-side pauldron is bigger and spikier.
    const drawPauldron = (side, size) => {
        const px = cx + side * 12 + lean;
        c.ellipse(px, torsoY, size, size * 0.8, plate, { shape: 'dome', height: 13, curve: 1, alpha });
        c.ellipse(px - side, torsoY - 1, size * 0.5, size * 0.35, plateLight, { shape: 'dome', height: 14, alpha: alpha * 0.7 });
        // Spikes fanning off the top of the pauldron.
        for (let s = -1; s <= 1; s += 1) {
            c.polygon([
                [px + s * size * 0.6 - 1, torsoY - size * 0.6],
                [px + s * size * 0.6 + 1, torsoY - size * 0.6],
                [px + s * size * 0.6, torsoY - size * 0.6 - 4 - Math.abs(s === 0 ? 2 : 0)],
            ], plateDark, { shape: 'cone', height: 14, alpha });
        }
    };
    drawPauldron(-1, 5.5);
    drawPauldron(1, 6.5); // weapon side, bigger
    // ---- Arms and gauntleted fists. The weapon arm (screen right) hauls a
    // massive fist back then hammers down on the strike; the off arm braces.
    const reach = Math.round(k.reach);
    // Off arm.
    c.rect(cx - 13 + lean, torsoY + 3, 5, 10, plate, { shape: 'cylinder-y', height: 9, shade: 0.85, alpha });
    c.rect(cx - 15 + lean, torsoY + 12, 7, 6, plateDark, { shape: 'round', height: 9, shade: 0.85, alpha }); // fist
    // Weapon arm.
    const waX = cx + 13 + lean + Math.round(reach * 0.5);
    const waY = torsoY + 3 - Math.max(0, Math.round(reach * 0.5));
    c.rect(waX - 2, waY, 5, 10, plate, { shape: 'cylinder-y', height: 10, alpha });
    // Enormous gauntlet fist, knuckles glowing with trapped heat.
    c.rect(waX - 3, waY + 9, 8, 7, plate, { shape: 'round', height: 10, alpha });
    for (let kx = 0; kx < 3; kx += 1) {
        c.rect(waX - 2 + kx * 2.5, waY + 9, 1.6, 1.6, lava, { emissive: true, alpha: alpha * heat * (k.reach !== 0 ? 1 : 0.6) });
    }
    // ---- Horned helm: a heavy dome with a face-slit and a great pair of curving
    // horns that top the whole silhouette. The horns are the final "this is the
    // big one" signal.
    const headY = baseY + 2;
    const headX = cx + lean;
    c.rect(cx - 3 + lean, baseY + 10, 6, 4, plateDark, { shape: 'cylinder-y', height: 10, shade: 0.75, alpha }); // gorget/neck
    c.ellipse(headX, headY + 5, 5.5, 5, plate, { shape: 'dome', height: 17, curve: 0.95, alpha });
    // A dark T-slit visor with molten eyes burning behind it.
    c.rect(headX - 3.5, headY + 4, 7, 2, '#120a0a', { shape: 'flat', height: 18, alpha });
    c.rect(headX - 0.5, headY + 4, 1.5, 4, '#120a0a', { shape: 'flat', height: 18, alpha });
    if (k.collapse < 0.7) {
        [-2.2, 2.2].forEach((ox) => {
            c.rect(headX + ox - 0.5, headY + 4.2, 1.6, 1.4, core, { emissive: true, alpha: alpha * heat });
        });
    }
    // A gilded brow ridge.
    c.rect(headX - 4, headY + 2, 8, 1.4, gold, { shape: 'cylinder-x', height: 18, shade: 0.85, alpha });
    // Great heavy horns — thick at the temple, curving up and out to a point. Kept
    // broad (a wide base tapering over several pixels) so they read as ram horns,
    // not antennae; they are the final, unmissable "this is the big one" signal.
    const horn = (0, Palette_1.mix)(plate, '#3a2418', 0.4);
    const hornLit = (0, Palette_1.shift)(horn, 0.14, -4);
    [-1, 1].forEach((side) => {
        // Base horn body: a fat wedge from the temple sweeping outward and up.
        c.polygon([
            [headX + side * 2, headY + 4],
            [headX + side * 5, headY + 5],
            [headX + side * 10, headY - 3],
            [headX + side * 12, headY - 9],
            [headX + side * 9, headY - 9],
            [headX + side * 6, headY - 2],
            [headX + side * 2, headY + 1],
        ], horn, { shape: 'cone', height: 16, shade: side < 0 ? 0.82 : 1, alpha });
        // Lit ridge along the horn's upper edge to give it round volume.
        c.line(headX + side * 4, headY, headX + side * 11, headY - 8, hornLit, 1, { height: 17, shade: side < 0 ? 0.82 : 1, alpha });
        // Dark banded grooves near the base — the classic horn texture cue.
        c.line(headX + side * 4, headY + 3, headX + side * 6, headY + 1, plateDark, 1, { height: 16, shade: 0.7, alpha });
        c.line(headX + side * 6, headY + 1, headX + side * 8, headY - 2, plateDark, 1, { height: 16, shade: 0.7, alpha });
        // Heat glow at the horn root where it fuses to the burning skull.
        c.rect(headX + side * 3, headY + 2, 1.4, 1.4, lava, { emissive: true, alpha: alpha * heat * 0.6 });
    });
}
// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
/** Which draw function builds which creature, plus its gait "energy". */
const BUILDERS = {
    husk: { draw: drawHusk, speed: 0.8 },
    boneguard: { draw: drawBoneguard, speed: 0.7 },
    direwolf: { draw: drawDirewolf, speed: 1.4 }, // fast, bouncy gait
    wraith: { draw: drawWraith, speed: 1 },
    bogling: { draw: drawBogling, speed: 0.7 },
    cavecrawler: { draw: drawCavecrawler, speed: 1.2 },
    ashborn: { draw: drawAshborn, speed: 0.9 },
    nameless: { draw: drawNameless, speed: 0.6 }, // slow, regal
    cinderlord: { draw: drawCinderlord, speed: 0.6 }, // slow, heavy
};
/** Shared shading config for the bestiary — a touch moodier than the hero's. */
exports.ENEMY_SHADE = {
    lightX: -0.5,
    lightY: -0.76,
    lightZ: 0.4,
    intensity: 0.64,
    ambient: 0.46, // slightly darker fill: monsters lurk
    ambientColor: '#47547e',
    occlusion: 0.44,
    rim: 0.26,
    rimColor: '#9aa6d0',
    bands: 5,
    dither: 0.44,
};
/** Stable texture key for one enemy frame. */
function enemyKey(id, pose, frame) {
    return `enemy-${id}-${pose}-${frame}`;
}
/** Render a single enemy frame into a fresh, correctly-sized canvas. */
function renderEnemyFrame(id, pose, frame) {
    const dim = enemyDim(id);
    const canvas = new PixelCanvas_1.PixelCanvas(dim.w, dim.h);
    const builder = BUILDERS[id];
    if (!builder)
        return canvas; // unknown id → empty canvas rather than a throw
    const k = kinematics(pose, frame, builder.speed);
    builder.draw(canvas, k);
    // Dark keyline + faint lit edge on the upper-left, exactly like the hero, so
    // enemies read against the dark world with the same visual language.
    canvas.outline(OUTLINE, { lightEdge: (0, Palette_1.mix)(OUTLINE, RIM, 0.5), alpha: 0.94 });
    return canvas;
}
/** Every frame in the bestiary, as (key, canvas) pairs for the texture atlas. */
function buildEnemyFrames() {
    const frames = [];
    for (const id of Object.keys(BUILDERS)) {
        for (const pose of Object.keys(exports.ENEMY_POSE_FRAMES)) {
            for (let frame = 0; frame < exports.ENEMY_POSE_FRAMES[pose]; frame += 1) {
                frames.push({ key: enemyKey(id, pose, frame), canvas: renderEnemyFrame(id, pose, frame) });
            }
        }
    }
    return frames;
}
/** Convenience re-exports mirroring hero.ts. */
exports.ENEMY_IDS = Object.keys(BUILDERS);

});
__define("src/systems/sprites/hero.ts", function(exports, module, __req){
"use strict";
/**
 * The exile — Trupy's player character.
 *
 * Built as a sculpted figure rather than a stack of rectangles: the torso is a
 * cylinder, the head a dome, the pauldrons are spheres, and the cloak hangs as a
 * separate shaded plane that lags behind the walk cycle. Eight facing directions,
 * a breathing idle, a three-frame attack swing and a dash pose all come from the
 * same builder so the silhouette stays consistent.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mix = exports.HERO_COLORS = exports.HERO_SHADE = exports.HERO_POSE_FRAMES = exports.HERO_DIRS = exports.HERO_H = exports.HERO_W = void 0;
exports.heroKey = heroKey;
exports.renderHeroFrame = renderHeroFrame;
exports.buildHeroFrames = buildHeroFrames;
const PixelCanvas_1 = __req("src/systems/render/PixelCanvas.ts");
const Palette_1 = __req("src/systems/render/Palette.ts");
Object.defineProperty(exports, "mix", { enumerable: true, get: function () { return Palette_1.mix; } });
exports.HERO_W = 36;
exports.HERO_H = 46;
exports.HERO_DIRS = ['down', 'down-side', 'side', 'up-side', 'up'];
const SKIN = Palette_1.MATERIAL.skin;
const SKIN_SHADE = (0, Palette_1.shift)(SKIN, -0.1, -6);
const CLOTH = '#7c3b52';
const CLOTH_DEEP = '#5a2b3d';
const LEATHER = Palette_1.MATERIAL.leather;
const STEEL = Palette_1.MATERIAL.steel;
const HAIR = '#3a2b33';
const OUTLINE = '#14151d';
const RIM = '#8f9bc4';
function kinematics(pose, frame) {
    switch (pose) {
        case 'walk': {
            // 8-frame cycle: two contact poses, two passing poses.
            const phase = (frame / 8) * Math.PI * 2;
            const stride = Math.round(Math.sin(phase) * 3);
            const bob = Math.abs(Math.sin(phase)) > 0.72 ? 0 : 1;
            return { stride, bob, lean: Math.round(Math.abs(Math.sin(phase)) * 0.8), reach: 0, cloak: -Math.round(Math.sin(phase) * 1.6), twist: Math.round(Math.cos(phase) * 1.4), squash: 0 };
        }
        case 'idle': {
            // Slow breathing: chest rises, cloak sways.
            const phase = (frame / 4) * Math.PI * 2;
            return { stride: 0, bob: Math.sin(phase) > 0.4 ? -1 : 0, lean: 0, reach: 0, cloak: Math.round(Math.sin(phase) * 1.2), twist: 0, squash: 0 };
        }
        case 'attack': {
            // 3 frames: wind-up (back), strike (full extension), recover.
            const table = [
                { stride: -1, bob: 0, lean: -2, reach: -3, cloak: 2, twist: -2, squash: 0 },
                { stride: 2, bob: -1, lean: 3, reach: 7, cloak: -3, twist: 3, squash: 1 },
                { stride: 1, bob: 0, lean: 1, reach: 3, cloak: -1, twist: 1, squash: 0 },
            ];
            return table[Math.min(2, frame)];
        }
        case 'dash':
            return { stride: 4, bob: -2, lean: 4, reach: -2, cloak: -6, twist: 2, squash: 0 };
        case 'hurt':
            return { stride: -2, bob: 1, lean: -3, reach: -4, cloak: 3, twist: -3, squash: 2 };
        default:
            return { stride: 0, bob: 0, lean: 0, reach: 0, cloak: 0, twist: 0, squash: 0 };
    }
}
/** Which way the figure faces, as a 2D unit-ish vector in sprite space. */
function facingVector(dir) {
    switch (dir) {
        case 'down': return { fx: 0, fy: 1 };
        case 'down-side': return { fx: 0.72, fy: 0.66 };
        case 'side': return { fx: 1, fy: 0 };
        case 'up-side': return { fx: 0.72, fy: -0.66 };
        case 'up': return { fx: 0, fy: -1 };
    }
}
function drawHero(canvas, spec) {
    const k = kinematics(spec.pose, spec.frame);
    const { fx, fy } = facingVector(spec.dir);
    const cx = exports.HERO_W / 2;
    const baseY = 6 + k.bob;
    // Ground contact shadow first — anchors the figure to the world.
    canvas.groundShadow(cx, exports.HERO_H - 5, 9 - k.squash, 3.4, 0.42);
    const leanX = Math.round(k.lean * fx);
    const leanY = Math.round(k.lean * fy * 0.5);
    // ----- Cloak. From the front the cloak sits behind the body and only its
    // edges peek out; from behind it fills the silhouette. Drawing it to match
    // the viewing angle is what keeps the front pose from turning into a slab.
    const cloakVisibility = spec.dir === 'up' ? 1 : spec.dir === 'up-side' ? 0.78 : spec.dir === 'side' ? 0.5 : spec.dir === 'down-side' ? 0.3 : 0.22;
    const cloakTop = baseY + 11;
    // Stops above the boots so the legs stay readable in the walk cycle.
    const cloakH = 16 + k.squash;
    const cloakW = Math.round(6 + 11 * cloakVisibility);
    const cloakX = cx - Math.round(fx * k.cloak * 0.7) + (spec.dir === 'side' ? -3 : 0);
    const sway = Math.round(k.cloak * 0.5);
    canvas.polygon([
        [cloakX - cloakW / 2, cloakTop],
        [cloakX + cloakW / 2, cloakTop],
        [cloakX + cloakW / 2 + sway + 2, cloakTop + cloakH],
        [cloakX - cloakW / 2 + sway - 2, cloakTop + cloakH],
    ], CLOTH_DEEP, { shape: 'cylinder-y', height: 2, curve: 0.75 });
    // Centre fold: a darker seam that stops the cloak reading as one flat shape.
    if (cloakVisibility > 0.45) {
        canvas.rect(cloakX - 1 + sway, cloakTop + 3, 3, cloakH - 5, (0, Palette_1.shift)(CLOTH_DEEP, -0.08), { shape: 'flat', height: 1, shade: 0.8 });
    }
    // ----- Legs. Rear leg first so the near leg overlaps it.
    const legY = baseY + 25;
    const legs = spec.dir === 'side'
        ? [{ x: cx - 2 - k.stride, z: 3 }, { x: cx - 1 + k.stride, z: 6 }]
        : [{ x: cx - 5 + Math.round(k.stride * 0.5), z: 4 }, { x: cx + 1 - Math.round(k.stride * 0.5), z: 5 }];
    legs.forEach((leg, index) => {
        const shade = index === 0 ? 0.76 : 1;
        canvas.rect(leg.x, legY, 4, 9, LEATHER, { shape: 'cylinder-y', height: leg.z, shade, curve: 0.9 });
        canvas.rect(leg.x - 1, legY + 8, 6, 5, (0, Palette_1.shift)(LEATHER, -0.15), { shape: 'bevel', height: leg.z, shade, curve: 0.8 });
        canvas.rect(leg.x, legY + 7, 4, 1, (0, Palette_1.shift)(LEATHER, 0.12), { shape: 'flat', height: leg.z, shade });
    });
    // ----- Torso: a cylinder, so it rounds toward the edges.
    const torsoY = baseY + 12;
    const torsoW = spec.dir === 'side' ? 11 : 14;
    const torsoX = cx - torsoW / 2 + leanX;
    // Torso tapers: wider at the chest, narrower at the waist.
    canvas.rect(torsoX, torsoY + leanY, torsoW, 9, CLOTH, { shape: 'cylinder-y', height: 8, curve: 0.95 });
    canvas.rect(torsoX + 1, torsoY + leanY + 9, torsoW - 2, 4, CLOTH, { shape: 'cylinder-y', height: 8, curve: 0.95 });
    // Belt with a buckle: reads as a waist and breaks up the torso mass.
    canvas.rect(torsoX + 1, torsoY + leanY + 10, torsoW - 2, 3, (0, Palette_1.shift)(LEATHER, -0.04), { shape: 'cylinder-y', height: 9, curve: 0.8 });
    canvas.rect(cx - 2 + leanX, torsoY + leanY + 10, 3, 3, Palette_1.MATERIAL.bronze, { shape: 'bevel', height: 10, curve: 0.7 });
    if (spec.dir !== 'up') {
        // Tunic V, only visible from the front.
        canvas.polygon([
            [cx + leanX - 3, torsoY + leanY + 1],
            [cx + leanX + 3, torsoY + leanY + 1],
            [cx + leanX, torsoY + leanY + 6],
        ], (0, Palette_1.shift)(CLOTH, -0.12), { shape: 'flat', height: 9 });
    }
    // Shoulder pauldrons: spheres, the strongest volume cue on the figure.
    const shoulderY = torsoY + leanY;
    const pauldronOffsets = spec.dir === 'side'
        ? [{ x: cx - 4 + k.twist, z: 11, shade: 0.78 }, { x: cx + 1 + k.twist, z: 13, shade: 1 }]
        : [{ x: cx - torsoW / 2 - 1 + leanX, z: 12, shade: 0.88 }, { x: cx + torsoW / 2 - 3 + leanX, z: 12, shade: 1 }];
    pauldronOffsets.forEach((p) => {
        canvas.ellipse(p.x + 2, shoulderY + 1.5, 3.4, 2.8, STEEL, { shape: 'round', height: p.z, shade: p.shade, curve: 1 });
        canvas.rect(p.x + 0.5, shoulderY + 3, 4, 1, (0, Palette_1.shift)(STEEL, -0.18), { shape: 'flat', height: p.z - 1, shade: p.shade });
    });
    // ----- Weapon arm, extended on attack frames.
    const armY = shoulderY + 3;
    const reachX = Math.round(fx * k.reach);
    const reachY = Math.round(fy * k.reach);
    const armSwing = spec.pose === 'walk' ? Math.round(k.stride * 0.5) : 0;
    if (spec.dir === 'side') {
        canvas.rect(cx + 2 + reachX, armY + reachY + armSwing, 3, 7, CLOTH, { shape: 'cylinder-y', height: 10, curve: 0.9 });
        canvas.ellipse(cx + 3.5 + reachX, armY + 7 + reachY + armSwing, 2.2, 2, SKIN, { shape: 'round', height: 11 });
    }
    else {
        canvas.rect(cx + torsoW / 2 - 2 + reachX + leanX, armY + reachY + armSwing, 3, 7, CLOTH, { shape: 'cylinder-y', height: 10, curve: 0.9 });
        canvas.ellipse(cx + torsoW / 2 - 0.5 + reachX + leanX, armY + 7 + reachY + armSwing, 2.2, 2, SKIN, { shape: 'round', height: 11 });
        // Off hand swings opposite the weapon hand.
        canvas.rect(cx - torsoW / 2 - 1 + leanX, armY - armSwing, 3, 7, CLOTH, { shape: 'cylinder-y', height: 9, shade: 0.84, curve: 0.9 });
        canvas.ellipse(cx - torsoW / 2 + 0.5 + leanX, armY + 7 - armSwing, 2, 1.9, SKIN, { shape: 'round', height: 10, shade: 0.84 });
    }
    // ----- Head: a dome with a jaw, plus hair and hood shading.
    const headY = baseY + 1;
    const headW = spec.dir === 'side' ? 9 : 11;
    const headX = cx - headW / 2 + leanX + (spec.dir === 'side' ? 1 : 0);
    // Neck, tucked so the head sits on the shoulders rather than floating.
    canvas.rect(cx - 1.5 + leanX, headY + 8, 3, 4, SKIN_SHADE, { shape: 'cylinder-y', height: 12, shade: 0.7 });
    canvas.ellipse(headX + headW / 2, headY + 5, headW / 2, 4.8, SKIN, { shape: 'dome', height: 16, curve: 0.92 });
    // Hair over the crown, following the dome.
    canvas.ellipse(headX + headW / 2, headY + 2.6, headW / 2 + 0.4, 3.2, HAIR, { shape: 'dome', height: 17, curve: 0.85 });
    if (spec.dir === 'up') {
        // From behind: all hair, no face.
        canvas.ellipse(headX + headW / 2, headY + 4.6, headW / 2, 4.4, (0, Palette_1.shift)(HAIR, 0.03), { shape: 'dome', height: 16, curve: 0.9 });
    }
    else if (spec.dir === 'side' || spec.dir === 'up-side') {
        canvas.rect(headX + 0.5, headY + 3.5, 3, 5, HAIR, { shape: 'cylinder-y', height: 16, curve: 0.7 });
        if (spec.dir === 'side') {
            canvas.rect(headX + headW - 3.5, headY + 4.5, 2, 2, '#efe6ee', { shape: 'flat', height: 17 });
            canvas.rect(headX + headW - 3.5, headY + 5.5, 1, 1, '#2b2430', { shape: 'flat', height: 17 });
        }
    }
    else {
        // Eyes: bright sclera with a dark pupil, one pixel each.
        const eyeY = headY + 4.5;
        const eyeSpread = spec.dir === 'down-side' ? [-2, 1] : [-2.5, 1.5];
        eyeSpread.forEach((offset) => {
            canvas.rect(headX + headW / 2 + offset, eyeY, 2, 2, '#efe6ee', { shape: 'flat', height: 17 });
            canvas.rect(headX + headW / 2 + offset, eyeY + 1, 1, 1, '#2b2430', { shape: 'flat', height: 17 });
        });
        // Brow shadow adds a scowl and reads as depth.
        canvas.rect(headX + 1.5, headY + 3, headW - 3, 1, (0, Palette_1.shift)(HAIR, -0.05), { shape: 'flat', height: 17, shade: 0.9 });
        canvas.rect(headX + headW / 2 - 1, headY + 7.5, 2, 1, (0, Palette_1.shift)(SKIN, -0.24, -8), { shape: 'flat', height: 16 });
    }
    // Hood collar wraps the neck and ties head to torso.
    canvas.rect(cx - torsoW / 2 + 1 + leanX, headY + 9.5, torsoW - 2, 3, CLOTH_DEEP, { shape: 'cylinder-y', height: 11, curve: 0.85 });
    // Dark keyline everywhere, with a faint lit edge on the upper-left only.
    canvas.outline(OUTLINE, { lightEdge: (0, Palette_1.mix)(OUTLINE, RIM, 0.5), alpha: 0.94 });
}
/** Key for a generated hero frame texture. */
function heroKey(dir, pose, frame) {
    return `hero-${dir}-${pose}-${frame}`;
}
exports.HERO_POSE_FRAMES = {
    walk: 8,
    idle: 4,
    attack: 3,
    dash: 1,
    hurt: 1,
};
/** Render one hero frame into a fresh canvas. */
function renderHeroFrame(dir, pose, frame) {
    const canvas = new PixelCanvas_1.PixelCanvas(exports.HERO_W, exports.HERO_H);
    drawHero(canvas, { dir, pose, frame });
    return canvas;
}
exports.HERO_SHADE = {
    lightX: -0.5,
    lightY: -0.76,
    lightZ: 0.4,
    intensity: 0.66,
    ambient: 0.5,
    ambientColor: '#4f5f8c',
    occlusion: 0.4,
    rim: 0.2,
    rimColor: '#9fb0dc',
    bands: 5,
    dither: 0.42,
};
/** Every frame the hero needs, as (key, canvas) pairs. */
function buildHeroFrames() {
    const frames = [];
    for (const dir of exports.HERO_DIRS) {
        for (const pose of Object.keys(exports.HERO_POSE_FRAMES)) {
            for (let frame = 0; frame < exports.HERO_POSE_FRAMES[pose]; frame += 1) {
                frames.push({ key: heroKey(dir, pose, frame), canvas: renderHeroFrame(dir, pose, frame) });
            }
        }
    }
    return frames;
}
exports.HERO_COLORS = { CLOTH, CLOTH_DEEP, LEATHER, STEEL, SKIN, OUTLINE, RIM };

});
__define("src/systems/sprites/npcs.ts", function(exports, module, __req){
"use strict";
/**
 * The townsfolk — Trupy's NPC sprite factory.
 *
 * These are the ten humans the exile meets in the valley. They live in the same
 * world as the hero (see ./hero.ts) and must read as the same *art*: sculpted
 * from shaped primitives rather than stacked rectangles, lit by the same
 * depth-aware pass in PixelCanvas, outlined with the same dark keyline. So the
 * anatomy approach is deliberately the hero's — torso is a cylinder, head a
 * dome, shoulders and joints are spheres — and the shared conventions hold:
 * groundShadow first, body drawn back-to-front, outline last.
 *
 * What separates one villager from the next is *silhouette and profession*, not
 * surface detail. A player recognises the blacksmith by her bare broad arms and
 * the hammer, the priestess by her tall hood and bowed head, the miner by the
 * lamp on his helmet — all before any colour registers. So each NPC is built
 * around one unmistakable read:
 *
 *   mora     tall austere hood, head bowed over prayer beads
 *   runa     broad shoulders, bare muscled arms, leather apron, hammer
 *   gran     stooped and short, leaning on a staff, lantern in hand
 *   vesna    hooded, light + lithe, bow in hand, quiver of arrows on back
 *   elira    slight, long loose hair, simple dress and shawl
 *   orrin    well-fed and round, fine coat, ledger under arm, coin pouch
 *   ferryman wide flat hat, oilskin cloak, tall pole/oar
 *   iva      wild-haired witch, ragged bog-green robes, herb basket
 *   bram     helmet with a glowing lamp, pickaxe over shoulder, dusty
 *   serah    broken plate armour, red scarf trailing, sword sheathed at hip
 *
 * Every NPC uses their `accent` colour (from NPCS in content.ts) as the dominant
 * garment hue, so the sprite matches the accent that themes their dialogue and
 * home interior. Accents are inlined here as hex — like enemies.ts, this keeps
 * the sprite layer free of an import cycle with the data/content layer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPC_SHADE = exports.NPC_POSE_FRAMES = exports.NPC_H = exports.NPC_W = void 0;
exports.npcKey = npcKey;
exports.renderNpcFrame = renderNpcFrame;
exports.buildNpcFrames = buildNpcFrames;
const PixelCanvas_1 = __req("src/systems/render/PixelCanvas.ts");
const Palette_1 = __req("src/systems/render/Palette.ts");
/** Shared canvas footprint. Generous enough that staves, bows and gesturing
 * arms never clip the edge; matches the hero's proportions so scale reads true
 * when both stand in the same scene. */
exports.NPC_W = 34;
exports.NPC_H = 46;
/** Frame counts per pose. Idle is a slow breathing loop; talk is a livelier
 * gesture loop used while a dialogue box is open. */
exports.NPC_POSE_FRAMES = {
    idle: 4, // gentle breathe / sway
    talk: 4, // head bob + gesturing hand
};
const OUTLINE = '#12131b';
const RIM = '#8f9bc4';
/**
 * Accent hues for the ten NPCs, indexed to match the NPCS array order in
 * content.ts. Inlined as hex to avoid a runtime import of the data layer.
 */
const ACCENT = [
    '#b78cff', // 0 mora     — pale violet, priestess
    '#e3a560', // 1 runa     — warm amber, smith
    '#9fc6b4', // 2 gran     — muted sage, lamplighter
    '#81c784', // 3 vesna    — green, hunter
    '#d3a1b1', // 4 elira    — dusty rose
    '#c5a47e', // 5 orrin    — tan/gold, merchant
    '#88a7c2', // 6 ferryman — cold slate blue
    '#76c9a1', // 7 iva      — bog green, witch
    '#c6a26d', // 8 bram     — dusty ochre, miner
    '#e47b68', // 9 serah    — red, deserter
];
/** Fallback so the factory never throws on an out-of-range index. */
const accentOf = (index) => { var _a; return (_a = ACCENT[index]) !== null && _a !== void 0 ? _a : Palette_1.MATERIAL.cloth; };
function kinematics(pose, frame) {
    const n = exports.NPC_POSE_FRAMES[pose];
    const phase = (frame / n) * Math.PI * 2;
    switch (pose) {
        case 'idle':
            // Slow breathing: the chest lifts near the top of the cycle, garments
            // drift a pixel to the side. No hand gesture at rest.
            return {
                bob: Math.sin(phase) > 0.5 ? -1 : 0,
                breath: Math.sin(phase) > 0.2 ? 1 : 0,
                nod: 0,
                gesture: 0,
                sway: Math.round(Math.sin(phase) * 1.2),
            };
        case 'talk':
            // Livelier: the head bobs on every beat and one hand rises and falls as
            // if punctuating speech.
            return {
                bob: 0,
                breath: Math.sin(phase) > 0 ? 1 : 0,
                nod: Math.round(Math.sin(phase * 2) * 1.1),
                gesture: Math.round((Math.sin(phase) * 0.5 + 0.5) * 3),
                sway: Math.round(Math.cos(phase) * 1),
            };
    }
}
/**
 * Draw the shared human base: ground shadow, legs, a tapering cylinder torso and
 * a domed head with skin, and returns the anchor points. Face and headwear are
 * intentionally NOT drawn here — hoods, hats and helmets replace the face, so
 * each profession decides what tops the head.
 */
function drawBase(c, build, colors, k, opts = {}) {
    const cx = c.width / 2;
    const baseY = 5 + build.drop + k.bob;
    const groundY = c.height - 4;
    // Contact shadow first — anchors the figure. Wider builds cast wider shadows.
    c.groundShadow(cx, groundY, build.torsoHalf + 3, 3.2, 0.4);
    const leanX = Math.round(build.stoop * 0.6);
    // ----- Legs. Rear leg shaded down so the near leg reads in front. A robed or
    // skirted NPC hides the legs under a hem, so we only draw stubby boots.
    const legY = baseY + build.torsoH + 11;
    const legSpread = Math.max(2, build.torsoHalf - 3);
    [-1, 1].forEach((side, i) => {
        const lx = cx + side * legSpread - 1.5;
        if (!opts.skirt) {
            c.rect(lx, legY, 3, build.legH, colors.legs, { shape: 'cylinder-y', height: 4, shade: i === 0 ? 0.78 : 1, curve: 0.9 });
        }
        // Boot / foot at the bottom, always visible.
        c.ellipse(lx + 1.5, legY + (opts.skirt ? build.legH - 2 : build.legH), 2.6, 1.8, (0, Palette_1.shift)(colors.legs, -0.12), { shape: 'round', height: 4, shade: i === 0 ? 0.82 : 1 });
    });
    // ----- Torso: a cylinder that tapers to the waist, exactly like the hero's.
    const torsoTop = baseY + build.headR * 2 + 1;
    const torsoBottom = torsoTop + build.torsoH;
    c.rect(cx - build.torsoHalf + leanX, torsoTop, build.torsoHalf * 2, build.torsoH - 3, colors.garb, { shape: 'cylinder-y', height: 8, curve: 0.95 });
    // Waist taper.
    c.rect(cx - build.torsoHalf + 1 + leanX, torsoTop + build.torsoH - 3, build.torsoHalf * 2 - 2, 3, colors.garb, { shape: 'cylinder-y', height: 8, curve: 0.95 });
    // ----- Head: a dome on a short neck, set forward by the stoop.
    const headCx = cx + leanX + Math.round(build.stoop);
    const headCy = baseY + build.headR + k.nod;
    // Neck ties the head to the shoulders.
    c.rect(cx - 1.5 + leanX, baseY + build.headR * 2 - 2, 3, 4, (0, Palette_1.shift)(colors.skin, -0.12, -6), { shape: 'cylinder-y', height: 12, shade: 0.72 });
    c.ellipse(headCx, headCy + 1, build.headR, build.headR + 0.4, colors.skin, { shape: 'dome', height: 16, curve: 0.92 });
    const shoulderY = torsoTop;
    return { cx, baseY, torsoTop, torsoBottom, headCx, headCy, shoulderY, leanX };
}
/**
 * A simple forward-facing face: two eyes with pupils and a mouth. Kept identical
 * in construction to the hero's face so the villagers feel drawn by the same
 * hand. `talk` opens the mouth on alternate frames for a bit of life.
 */
function drawFace(c, a, headR, talk, frame) {
    const eyeY = a.headCy + 0.5;
    [-1, 1].forEach((side) => {
        const ex = a.headCx + side * (headR * 0.42) - 0.5;
        c.rect(ex, eyeY, 2, 2, '#efe6ee', { shape: 'flat', height: 17 });
        c.rect(ex + (side < 0 ? 0 : 1), eyeY + 1, 1, 1, '#2b2430', { shape: 'flat', height: 17 });
    });
    // Brow shadow for a bit of gravity to the expression.
    c.rect(a.headCx - headR + 1.5, a.headCy - 1, headR * 2 - 3, 1, (0, Palette_1.shift)('#2b2430', 0.1), { shape: 'flat', height: 17, shade: 0.9 });
    // Mouth. Open on alternate talk frames.
    const mouthW = talk && frame % 2 === 1 ? 2 : 3;
    const mouthH = talk && frame % 2 === 1 ? 2 : 1;
    c.rect(a.headCx - mouthW / 2, a.headCy + headR - 1.5, mouthW, mouthH, (0, Palette_1.shift)(Palette_1.MATERIAL.skin, -0.26, -8), { shape: 'flat', height: 16 });
}
/**
 * Two arms hanging from the shoulders in garment colour, ending in skin hands.
 * `gestureSide` (−1 left, +1 right, 0 none) lifts one forearm for the talk pose;
 * `bareColor` swaps the sleeve colour for bare skin (the blacksmith). Returns
 * the hand positions so a profession can place a held item in the hand.
 */
function drawArms(c, a, build, sleeve, skin, k, gestureSide, bare = false) {
    const armColor = bare ? skin : sleeve;
    const armLen = build.torsoH - 2;
    const shoulderX = build.shoulder;
    const hands = {};
    [-1, 1].forEach((side) => {
        const sx = a.cx + side * shoulderX + a.leanX;
        // Gesturing arm bends up; others hang straight with a slight breath sway.
        const lift = side === gestureSide ? k.gesture : 0;
        const shade = side === -1 ? 0.86 : 1; // far arm slightly darker
        // Upper arm from the shoulder.
        c.rect(sx - 1.5, a.shoulderY + 1, 3, armLen - lift, armColor, { shape: 'cylinder-y', height: 9, curve: 0.9, shade });
        // Bare arms get a hint of muscle: a lighter highlight down the outer edge.
        if (bare) {
            c.rect(sx - 1.5 + (side > 0 ? 2 : 0), a.shoulderY + 2, 1, armLen - lift - 2, (0, Palette_1.shift)(skin, 0.1), { shape: 'flat', height: 10, shade });
        }
        // Hand at the end.
        const hx = sx;
        const hy = a.shoulderY + armLen - lift + 1;
        c.ellipse(hx, hy, 2, 1.9, skin, { shape: 'round', height: 11, shade });
        hands[side] = [hx, hy];
    });
    return { left: hands[-1], right: hands[1] };
}
/** Dark keyline + faint lit edge, applied once at the very end of every NPC. */
function finish(c) {
    c.outline(OUTLINE, { lightEdge: (0, Palette_1.mix)(OUTLINE, RIM, 0.5), alpha: 0.94 });
}
// ---------------------------------------------------------------------------
// The ten villagers. Each owns its build proportions, palette and the one or
// two props that make its profession legible at a glance.
// ---------------------------------------------------------------------------
/**
 * 0. MORA — priestess. The read is *austere verticality*: a tall pointed hood
 * that swallows the head in shadow, a long straight robe to the floor, hands
 * clasped low over a string of prayer beads. Head bowed. No skin but the face
 * deep inside the cowl.
 */
function drawMora(c, k, frame, talk) {
    const accent = accentOf(0);
    const robe = (0, Palette_1.mix)(Palette_1.MATERIAL.clothCold, '#2b2f45', 0.4); // deep cold habit
    const build = { torsoHalf: 6, torsoH: 16, headR: 4.6, legH: 8, stoop: 1, drop: 0, shoulder: 6 };
    const colors = { skin: Palette_1.MATERIAL.skinPale, hair: '#3a2b33', garb: robe, trim: accent, legs: (0, Palette_1.shift)(robe, -0.1) };
    const a = drawBase(c, build, colors, k, { skirt: true });
    // Long robe skirt to the floor — a single tapering column, the priestess read.
    const hemSway = k.sway;
    c.polygon([
        [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 5],
        [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 5],
        [a.cx + build.torsoHalf + 2 + hemSway, c.height - 5],
        [a.cx - build.torsoHalf - 2 + hemSway, c.height - 5],
    ], robe, { shape: 'cylinder-y', height: 6, curve: 0.8 });
    // Central seam so the robe isn't one flat slab.
    c.rect(a.cx - 1 + a.leanX + Math.round(hemSway * 0.5), a.torsoTop + 6, 2, c.height - a.torsoTop - 12, (0, Palette_1.shift)(robe, -0.08), { shape: 'flat', height: 5, shade: 0.82 });
    // Clasped hands low over the belly, holding prayer beads.
    const handY = a.torsoTop + 9;
    [-1, 1].forEach((side) => {
        c.ellipse(a.cx + side * 2, handY, 2, 1.8, Palette_1.MATERIAL.skinPale, { shape: 'round', height: 10, shade: 0.9 });
    });
    // Prayer beads: a small loop of accent dots hanging from the hands.
    for (let i = 0; i < 5; i += 1) {
        const t = i / 4;
        const bx = a.cx - 2 + t * 4;
        const by = handY + 2 + Math.sin(t * Math.PI) * 3;
        c.circle(bx, by, 0.9, accent, { shape: 'round', height: 11 });
    }
    c.circle(a.cx, handY + 6, 1.1, Palette_1.MATERIAL.gold, { shape: 'round', height: 11 }); // pendant
    // ----- Hood: a tall cowl that peaks above the crown and drapes onto the
    // shoulders, leaving the face in shadow. This is the whole silhouette.
    const hx = a.headCx;
    const hy = a.headCy;
    // Shoulder drape of the hood.
    c.rect(a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop - 1, build.torsoHalf * 2 + 2, 5, robe, { shape: 'cylinder-x', height: 11, curve: 0.85 });
    // The cowl itself: a peaked shape rising above the head.
    c.polygon([
        [hx, hy - build.headR - 5],
        [hx + build.headR + 1.5, hy + 1],
        [hx + build.headR, hy + build.headR + 1],
        [hx - build.headR, hy + build.headR + 1],
        [hx - build.headR - 1.5, hy + 1],
    ], (0, Palette_1.shift)(robe, 0.04), { shape: 'dome', height: 17, curve: 0.85 });
    // Face cavity: a darkened oval inside the cowl, only a pale face and eyes.
    c.ellipse(hx, hy + 1.5, build.headR - 1, build.headR - 0.5, (0, Palette_1.shift)(Palette_1.MATERIAL.skinPale, -0.18, -4), { shape: 'flat', height: 15, shade: 0.7 });
    drawFace(c, a, build.headR - 1, talk, frame);
    // Accent trim along the hood edge.
    c.line(hx - build.headR - 1.5, hy + 1, hx, hy - build.headR - 4, accent, 1, { height: 17, shade: 0.9 });
    c.line(hx + build.headR + 1.5, hy + 1, hx, hy - build.headR - 4, accent, 1, { height: 17, shade: 0.9 });
}
/**
 * 1. RUNA — blacksmith. The read is *strength*: the broadest shoulders in town,
 * bare muscled arms, a heavy leather apron over the chest, soot on the skin, and
 * a smith's hammer resting head-down by her side. Hair tied back out of the fire.
 */
function drawRuna(c, k, frame, talk) {
    const accent = accentOf(1);
    // Tan work-leather apron, deliberately kept LIGHT and warm so it separates
    // cleanly from the dark tunic behind and from the exposed arms in front.
    const apron = (0, Palette_1.mix)(accent, Palette_1.MATERIAL.leather, 0.35);
    // The broadest build in town: wide shoulders, thick torso, planted stance.
    const build = { torsoHalf: 9, torsoH: 14, headR: 5, legH: 10, stoop: 0, drop: 0, shoulder: 9 };
    // Bare skin kept close to full skin tone (only lightly sooted) so the arms
    // read unmistakably as flesh, not sleeve — the muscled-arms tell.
    const skin = (0, Palette_1.mix)(Palette_1.MATERIAL.skin, '#7a5a3f', 0.12);
    const tunic = (0, Palette_1.mix)('#3a2c26', accent, 0.12); // dark undershirt behind the apron
    const colors = { skin, hair: '#4a2f22', garb: tunic, trim: accent, legs: Palette_1.MATERIAL.leatherDark };
    const a = drawBase(c, build, colors, k);
    // Bare, muscled arms — thick, drawn before the apron so the apron overlaps the
    // chest. drawArms already lightens the outer edge for a muscle highlight; here
    // we also thicken the upper arm into a visible bicep bulge.
    const hands = drawArms(c, a, build, tunic, skin, k, talk ? 1 : 0, true);
    [-1, 1].forEach((side) => {
        const sx = a.cx + side * build.shoulder + a.leanX;
        c.ellipse(sx, a.shoulderY + 4, 2.4, 3, skin, { shape: 'round', height: 10, shade: side < 0 ? 0.86 : 1 }); // bicep
    });
    // Heavy leather apron: a broad bib over the chest tapering to the knees. Wide
    // and pale — the single loudest professional signal on the figure.
    c.polygon([
        [a.cx - build.torsoHalf + 2 + a.leanX, a.torsoTop],
        [a.cx + build.torsoHalf - 2 + a.leanX, a.torsoTop],
        [a.cx + build.torsoHalf - 1 + a.leanX, a.torsoTop + build.torsoH + 6],
        [a.cx - build.torsoHalf + 1 - a.leanX, a.torsoTop + build.torsoH + 6],
    ], apron, { shape: 'cylinder-y', height: 10, curve: 0.9 });
    // Bib top edge highlight so the apron reads as a distinct front panel.
    c.rect(a.cx - build.torsoHalf + 2 + a.leanX, a.torsoTop, build.torsoHalf * 2 - 4, 1, (0, Palette_1.shift)(apron, 0.12), { shape: 'flat', height: 11 });
    // Soot scorch marks and a burn hole.
    c.rect(a.cx - 3, a.torsoTop + 7, 3, 3, (0, Palette_1.shift)(apron, -0.16), { shape: 'flat', height: 10, shade: 0.75 });
    c.rect(a.cx + 2, a.torsoTop + 11, 2, 2, (0, Palette_1.shift)(apron, -0.14), { shape: 'flat', height: 10, shade: 0.75 });
    // Neck strap + waist tie of the apron in darker leather.
    c.line(a.cx - 3, a.torsoTop - 2, a.cx - 2, a.torsoTop + 1, Palette_1.MATERIAL.leatherDark, 1, { height: 11 });
    c.line(a.cx + 3, a.torsoTop - 2, a.cx + 2, a.torsoTop + 1, Palette_1.MATERIAL.leatherDark, 1, { height: 11 });
    c.rect(a.cx - build.torsoHalf + 1, a.torsoTop + build.torsoH - 4, build.torsoHalf * 2 - 2, 2, Palette_1.MATERIAL.leatherDark, { shape: 'cylinder-y', height: 10 });
    // Hair tied back in a short tail — practical, out of the forge.
    c.ellipse(a.headCx, a.headCy - build.headR + 1, build.headR + 0.3, 2.6, colors.hair, { shape: 'dome', height: 17, curve: 0.85 });
    c.ellipse(a.headCx - build.headR + 0.5, a.headCy, 1.6, 2.4, colors.hair, { shape: 'round', height: 15 }); // side
    drawFace(c, a, build.headR, talk, frame);
    // Big smith's hammer held across the body in BOTH hands, head up by the near
    // shoulder — far more legible than a small tool at the hip. A stout haft and a
    // chunky squared steel head with a bright struck face.
    const gripLoX = hands.left[0];
    const gripLoY = hands.left[1];
    const headX = a.cx + build.torsoHalf - 1;
    const headY = a.torsoTop + 1;
    c.line(gripLoX, gripLoY, headX, headY + 3, Palette_1.MATERIAL.wood, 3, { shape: 'cylinder-x', height: 12 }); // haft across the chest
    c.line(gripLoX, gripLoY, headX, headY + 3, (0, Palette_1.shift)(Palette_1.MATERIAL.woodPale, 0.05), 1, { height: 13, shade: 1 }); // lit side of haft
    // Squared hammer head at the top of the haft.
    c.rect(headX - 1, headY - 2, 5, 7, Palette_1.MATERIAL.steelDark, { shape: 'bevel', height: 14, curve: 0.8 });
    c.rect(headX - 1, headY - 2, 5, 1.5, (0, Palette_1.shift)(Palette_1.MATERIAL.steel, 0.16), { shape: 'flat', height: 15 }); // top struck-face highlight
    c.rect(headX + 3, headY - 1, 1.5, 5, (0, Palette_1.shift)(Palette_1.MATERIAL.steel, 0.12), { shape: 'flat', height: 15 }); // lit edge
    // Near hand gripping the haft high up.
    c.ellipse(headX - 3, headY + 4, 2, 1.9, skin, { shape: 'round', height: 13 });
}
/**
 * 2. GRAN — old lamplighter / graveyard warden. The read is *age and burden*: a
 * short, forward-stooped frame under a heavy coat, both hands leaning on a tall
 * walking staff, a lantern hanging from the other hand. White beard, bowed back.
 */
function drawGran(c, k, frame, talk) {
    const accent = accentOf(2);
    const coat = (0, Palette_1.mix)(accent, '#41463f', 0.55); // muddy sage greatcoat
    // Short and bent: small head, low drop, strong stoop.
    const build = { torsoHalf: 6.5, torsoH: 12, headR: 4.6, legH: 7, stoop: 3, drop: 5, shoulder: 6 };
    const colors = { skin: (0, Palette_1.mix)(Palette_1.MATERIAL.skin, Palette_1.MATERIAL.skinPale, 0.5), hair: '#c9c4bb', garb: coat, trim: accent, legs: Palette_1.MATERIAL.leatherDark };
    const a = drawBase(c, build, colors, k, { skirt: true });
    // Long heavy coat, hanging in a slightly hunched line to mid-shin.
    c.polygon([
        [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 3],
        [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 3],
        [a.cx + build.torsoHalf + k.sway, c.height - 7],
        [a.cx - build.torsoHalf - 1 + k.sway, c.height - 7],
    ], coat, { shape: 'cylinder-y', height: 7, curve: 0.82 });
    // Coat collar and a lighter panel down the front for the buttoned seam.
    c.rect(a.cx - 1 + a.leanX, a.torsoTop + 3, 2, build.torsoH + 6, (0, Palette_1.shift)(coat, -0.08), { shape: 'flat', height: 6, shade: 0.82 });
    // Walking staff planted forward, both the near hand and a bent posture leaning
    // on it. The staff plus the stoop is the silhouette.
    const staffX = a.cx + build.torsoHalf + 2;
    c.rect(staffX, a.baseY + 2, 2, c.height - a.baseY - 6, Palette_1.MATERIAL.wood, { shape: 'cylinder-y', height: 10 });
    c.ellipse(staffX + 1, a.baseY + 2, 1.8, 1.5, Palette_1.MATERIAL.woodPale, { shape: 'round', height: 11 }); // knob top
    // Near hand gripping the staff.
    c.ellipse(staffX + 1, a.torsoTop + 6, 2, 1.9, colors.skin, { shape: 'round', height: 12 });
    // Lantern hanging from the far hand, low and slightly swaying. A faint warm
    // emissive core marks it as the lamplighter's tool.
    const lx = a.cx - build.torsoHalf - 1 + Math.round(k.sway * 0.5);
    const ly = a.torsoTop + build.torsoH + 2;
    c.ellipse(lx, a.torsoTop + 7, 2, 1.9, colors.skin, { shape: 'round', height: 11 }); // hand
    c.line(lx, a.torsoTop + 7, lx, ly - 2, Palette_1.MATERIAL.iron, 1, { height: 10 }); // handle wire
    c.rect(lx - 2, ly - 2, 5, 6, Palette_1.MATERIAL.iron, { shape: 'cylinder-y', height: 9, curve: 0.7 }); // lantern frame
    c.rect(lx - 1, ly, 3, 3, '#f4b85b', { shape: 'flat', emissive: true }); // warm glass
    c.rect(lx, ly + 0.5, 1, 2, '#fff0a8', { emissive: true }); // flame core
    // Bald pate + long white beard framing a lined face.
    c.ellipse(a.headCx, a.headCy - build.headR + 2, build.headR - 0.4, 2, (0, Palette_1.shift)(colors.skin, 0.05), { shape: 'dome', height: 17 }); // pate
    drawFace(c, a, build.headR, talk, frame);
    // Beard: a pale wedge under the chin.
    c.polygon([
        [a.headCx - build.headR + 1, a.headCy + 1],
        [a.headCx + build.headR - 1, a.headCy + 1],
        [a.headCx + 1.5, a.headCy + build.headR + 3],
        [a.headCx - 1.5, a.headCy + build.headR + 3],
    ], colors.hair, { shape: 'round', height: 15, curve: 0.7 });
}
/**
 * 3. VESNA — hunter. The read is *lean readiness*: a slight hooded figure in
 * light leathers, a tall longbow held vertically in one hand, and a quiver of
 * fletched arrows jutting over the shoulder. Not bulky — quick.
 */
function drawVesna(c, k, frame, talk) {
    const accent = accentOf(3);
    const leathers = (0, Palette_1.mix)(accent, Palette_1.MATERIAL.leather, 0.55);
    const build = { torsoHalf: 5, torsoH: 13, headR: 4.6, legH: 11, stoop: 0, drop: 0, shoulder: 5.5 };
    const colors = { skin: Palette_1.MATERIAL.skin, hair: '#5a4030', garb: leathers, trim: accent, legs: Palette_1.MATERIAL.leatherDark };
    // Quiver + arrows drawn FIRST so they sit behind the shoulder.
    const qx = c.width / 2 + 5;
    const qBaseY = 6 + 4;
    c.rect(qx, qBaseY, 3, 10, Palette_1.MATERIAL.leatherDark, { shape: 'cylinder-y', height: 6, curve: 0.8 }); // quiver tube
    for (let i = 0; i < 3; i += 1) {
        const ax = qx + 0.5 + i;
        c.line(ax, qBaseY - 4, ax, qBaseY + 2, Palette_1.MATERIAL.woodPale, 1, { height: 7 }); // shaft
        c.rect(ax - 0.5, qBaseY - 5, 2, 2, accent, { shape: 'flat', height: 8 }); // fletching
    }
    const a = drawBase(c, build, colors, k);
    const hands = drawArms(c, a, build, leathers, colors.skin, k, talk ? -1 : 0);
    // A light jerkin cinched with an accent belt.
    c.rect(a.cx - build.torsoHalf + a.leanX, a.torsoTop + build.torsoH - 6, build.torsoHalf * 2, 2, accent, { shape: 'cylinder-y', height: 9, shade: 0.95 });
    // Cross-strap for the quiver.
    c.line(a.cx - build.torsoHalf + 1, a.torsoTop + 1, a.cx + build.torsoHalf, a.torsoTop + 6, Palette_1.MATERIAL.leatherDark, 1, { height: 10 });
    // Hood pulled up — a soft cowl, less severe than Mora's, framing a visible face.
    const hx = a.headCx;
    const hy = a.headCy;
    c.ellipse(hx, hy - 0.5, build.headR + 1, build.headR + 1.5, (0, Palette_1.shift)(leathers, -0.04), { shape: 'dome', height: 16, curve: 0.9 });
    // Cut out the face opening.
    c.ellipse(hx, hy + 1.5, build.headR - 0.8, build.headR - 0.5, colors.skin, { shape: 'dome', height: 15 });
    drawFace(c, a, build.headR - 0.8, talk, frame);
    // Longbow: a tall, gently curved stave held vertically in the right hand, with
    // a bowstring. The vertical bow is the hunter's unmistakable read.
    const [bx, by] = hands.right;
    const bowTop = a.baseY - 3;
    const bowBot = c.height - 6;
    const bowMid = (bowTop + bowBot) / 2;
    // Stave as two arcs bulging outward from the hand.
    c.line(bx + 1, bowTop, bx + 3, bowMid, Palette_1.MATERIAL.wood, 2, { height: 10 });
    c.line(bx + 3, bowMid, bx + 1, bowBot, Palette_1.MATERIAL.wood, 2, { height: 10 });
    c.line(bx + 2, bowTop + 1, bx + 3.5, bowMid, Palette_1.MATERIAL.woodPale, 1, { height: 11 }); // lit belly
    // Bowstring: a straight taut line tip to tip.
    c.line(bx + 1, bowTop, bx + 1, bowBot, (0, Palette_1.mix)(Palette_1.MATERIAL.bone, '#ffffff', 0.3), 1, { height: 11, shade: 0.9 });
}
/**
 * 4. ELIRA — a young widow. The read is *quiet slightness*: the narrowest frame,
 * a plain long dress, a shawl over the shoulders, and long loose hair that sways.
 * No profession props — she is defined by softness and hair.
 */
function drawElira(c, k, frame, talk) {
    const accent = accentOf(4);
    const dress = (0, Palette_1.mix)(accent, '#5b4650', 0.45); // dusty rose, muted
    const build = { torsoHalf: 4.5, torsoH: 13, headR: 4.6, legH: 9, stoop: 0, drop: 1, shoulder: 5 };
    const colors = { skin: Palette_1.MATERIAL.skinPale, hair: '#3d2b26', garb: dress, trim: accent, legs: Palette_1.MATERIAL.leatherDark };
    // Long hair behind the shoulders, drawn first so it falls behind the body.
    const cx = c.width / 2;
    const hairTop = 6 + build.drop + build.headR - 1;
    c.polygon([
        [cx - build.headR - 1, hairTop],
        [cx + build.headR + 1, hairTop],
        [cx + build.headR + k.sway, hairTop + 16],
        [cx - build.headR - 1 + k.sway, hairTop + 16],
    ], colors.hair, { shape: 'cylinder-y', height: 6, curve: 0.85 });
    const a = drawBase(c, build, colors, k, { skirt: true });
    const hands = drawArms(c, a, build, dress, colors.skin, k, talk ? 1 : 0);
    // Long simple dress skirt.
    c.polygon([
        [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 6],
        [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 6],
        [a.cx + build.torsoHalf + 2 + k.sway, c.height - 6],
        [a.cx - build.torsoHalf - 2 + k.sway, c.height - 6],
    ], dress, { shape: 'cylinder-y', height: 6, curve: 0.8 });
    // Shawl: a triangular wrap over both shoulders, a slightly lighter tone.
    c.polygon([
        [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop - 1],
        [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop - 1],
        [a.cx + a.leanX, a.torsoTop + 6],
    ], (0, Palette_1.shift)(dress, 0.1, 6), { shape: 'cylinder-x', height: 10, curve: 0.85 });
    // Hair framing the face at the front too.
    [-1, 1].forEach((side) => {
        c.ellipse(a.headCx + side * (build.headR - 0.5), a.headCy + 1, 1.4, build.headR, colors.hair, { shape: 'cylinder-y', height: 15, shade: side < 0 ? 0.85 : 1 });
    });
    c.ellipse(a.headCx, a.headCy - build.headR + 1.5, build.headR, 2.4, colors.hair, { shape: 'dome', height: 17 }); // crown/parting
    drawFace(c, a, build.headR, talk, frame);
    // Hands clasped softly in front.
    const [, hyl] = hands.left;
    c.ellipse(a.cx - 1, hyl - 1, 1.8, 1.6, colors.skin, { shape: 'round', height: 11, shade: 0.9 });
}
/**
 * 5. ORRIN — merchant. The read is *prosperity*: a round, well-fed body (widest
 * torso, short legs), a fine long coat with a fur collar, a heavy coin pouch on
 * the belt, and a ledger tucked under one arm. Combed hair, content.
 */
function drawOrrin(c, k, frame, talk) {
    const accent = accentOf(5);
    // Rich coat kept lighter and warmer than a peasant's brown, so the gold trim
    // and fur read as *fine* rather than muddy.
    const coat = (0, Palette_1.mix)(accent, '#6a5232', 0.3);
    // Portly: widest torso in town, short legs, low drop.
    const build = { torsoHalf: 9, torsoH: 13, headR: 5, legH: 6, stoop: -1, drop: 3, shoulder: 8 };
    const colors = { skin: (0, Palette_1.mix)(Palette_1.MATERIAL.skin, Palette_1.MATERIAL.skinPale, 0.5), hair: '#4a3728', garb: coat, trim: Palette_1.MATERIAL.gold, legs: Palette_1.MATERIAL.leatherDark };
    const a = drawBase(c, build, colors, k);
    // Round belly: a big ellipse bulging the lower torso well past the shoulders —
    // the well-fed read.
    c.ellipse(a.cx + a.leanX, a.torsoTop + build.torsoH - 3, build.torsoHalf + 0.5, 6, coat, { shape: 'round', height: 10, curve: 0.95 });
    // Buttoned waistcoat panel over the belly in a contrasting deep tone.
    c.ellipse(a.cx + a.leanX, a.torsoTop + build.torsoH - 3, build.torsoHalf - 2, 5, (0, Palette_1.shift)(coat, -0.12, 6), { shape: 'round', height: 10, shade: 0.9 });
    const hands = drawArms(c, a, build, coat, colors.skin, k, talk ? 1 : 0);
    // Fine coat: broad gold-trimmed lapels flaring open over the waistcoat.
    c.polygon([
        [a.cx - 4 + a.leanX, a.torsoTop],
        [a.cx + a.leanX, a.torsoTop + 4],
        [a.cx + 4 + a.leanX, a.torsoTop],
        [a.cx + 3 + a.leanX, a.torsoTop + build.torsoH - 2],
        [a.cx - 3 + a.leanX, a.torsoTop + build.torsoH - 2],
    ], (0, Palette_1.shift)(coat, 0.06), { shape: 'flat', height: 9, shade: 0.95 });
    // Gold lapel edges — thicker (2px) so they actually catch the eye.
    c.line(a.cx - 3 + a.leanX, a.torsoTop + 1, a.cx - 1 + a.leanX, a.torsoTop + build.torsoH - 2, Palette_1.MATERIAL.gold, 1, { height: 11 });
    c.line(a.cx + 3 + a.leanX, a.torsoTop + 1, a.cx + 1 + a.leanX, a.torsoTop + build.torsoH - 2, Palette_1.MATERIAL.gold, 1, { height: 11 });
    // Three gold buttons down the waistcoat.
    for (let i = 0; i < 3; i += 1)
        c.circle(a.cx + a.leanX, a.torsoTop + 6 + i * 3, 0.9, Palette_1.MATERIAL.gold, { shape: 'round', height: 11 });
    // Fur collar: a fat pale fuzzy band across the shoulders and up the neck.
    c.rect(a.cx - build.torsoHalf + 1 + a.leanX, a.torsoTop - 1, build.torsoHalf * 2 - 2, 3, (0, Palette_1.mix)(coat, Palette_1.MATERIAL.bone, 0.5), { shape: 'cylinder-x', height: 12, curve: 0.7 });
    // Heavy coin pouch on the belt with a gold tie, and a gold coin catching light
    // beside it — an unmistakable "money" cue for the merchant.
    c.ellipse(a.cx + build.torsoHalf - 1, a.torsoTop + build.torsoH, 2.6, 3, Palette_1.MATERIAL.leather, { shape: 'round', height: 11 });
    c.rect(a.cx + build.torsoHalf - 2.5, a.torsoTop + build.torsoH - 2.5, 4, 1, Palette_1.MATERIAL.gold, { shape: 'flat', height: 12 });
    c.circle(a.cx + build.torsoHalf + 1.5, a.torsoTop + build.torsoH - 2, 1.3, Palette_1.MATERIAL.gold, { shape: 'round', height: 12 });
    c.rect(a.cx + build.torsoHalf + 1, a.torsoTop + build.torsoH - 2.5, 1, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.gold, 0.2), { shape: 'flat', height: 13 }); // coin glint
    // Big ledger held in the near hand: a fat book with a gold clasp and pages.
    const [lx, ly] = hands.left;
    c.rect(lx - 4, ly - 5, 6, 8, (0, Palette_1.mix)(Palette_1.MATERIAL.leatherDark, accent, 0.15), { shape: 'bevel', height: 11, curve: 0.6 });
    c.rect(lx + 1, ly - 5, 1.5, 8, (0, Palette_1.mix)(Palette_1.MATERIAL.bone, Palette_1.MATERIAL.woodPale, 0.4), { shape: 'flat', height: 12 }); // page block
    c.rect(lx - 4, ly - 5, 6, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.leatherDark, 0.08), { shape: 'flat', height: 12 }); // cover top
    c.rect(lx + 1, ly - 1, 2, 1.5, Palette_1.MATERIAL.gold, { shape: 'flat', height: 12 }); // clasp
    // Combed hair, receding, over a round content face with jowls.
    c.ellipse(a.headCx, a.headCy - build.headR + 1.5, build.headR - 0.5, 2.4, colors.hair, { shape: 'dome', height: 17 });
    c.ellipse(a.headCx, a.headCy + 2, build.headR - 0.5, build.headR - 1.5, (0, Palette_1.shift)(colors.skin, -0.04), { shape: 'round', height: 15, shade: 0.95 }); // round cheeks
    drawFace(c, a, build.headR, talk, frame);
    // Bushy mustache to sell the well-fed merchant.
    c.rect(a.headCx - 2, a.headCy + build.headR - 2, 4, 1.5, colors.hair, { shape: 'cylinder-x', height: 16, shade: 0.9 });
}
/**
 * 6. FERRYMAN — silent guide. The read is *tall and shrouded*: a wide flat brim
 * hat that hides the face, a long oilskin cloak falling straight, and a tall
 * pole/oar held vertically that rises above the hat. Gaunt and still.
 */
function drawFerryman(c, k, frame, talk) {
    const accent = accentOf(6);
    const oilskin = (0, Palette_1.mix)(accent, '#2c3540', 0.55); // dark wet slate cloak
    const build = { torsoHalf: 6, torsoH: 15, headR: 4.4, legH: 9, stoop: 0, drop: 0, shoulder: 6 };
    const colors = { skin: Palette_1.MATERIAL.skinDead, hair: '#2b2a2e', garb: oilskin, trim: accent, legs: '#20242a' };
    // Tall pole/oar drawn first, behind the body, rising above the hat.
    const px = c.width / 2 + build.torsoHalf + 3;
    c.rect(px, 2, 2, c.height - 6, Palette_1.MATERIAL.wood, { shape: 'cylinder-y', height: 8 });
    c.ellipse(px + 1, 2, 1.6, 2.4, Palette_1.MATERIAL.woodPale, { shape: 'dome', height: 9 }); // pole tip
    // Oar blade near the bottom.
    c.ellipse(px + 1, c.height - 8, 2.6, 4, (0, Palette_1.mix)(Palette_1.MATERIAL.wood, Palette_1.MATERIAL.woodPale, 0.4), { shape: 'round', height: 7 });
    const a = drawBase(c, build, colors, k, { skirt: true });
    drawArms(c, a, build, oilskin, colors.skin, k, 0);
    // Long straight oilskin cloak — a heavy column with a wet sheen highlight.
    c.polygon([
        [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 1],
        [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 1],
        [a.cx + build.torsoHalf + Math.round(k.sway * 0.5), c.height - 5],
        [a.cx - build.torsoHalf - 1 + Math.round(k.sway * 0.5), c.height - 5],
    ], oilskin, { shape: 'cylinder-y', height: 7, curve: 0.85 });
    // Wet sheen: a bright thin vertical highlight, marks the oilskin as slick.
    c.rect(a.cx - 2 + a.leanX, a.torsoTop + 2, 1, build.torsoH + 6, (0, Palette_1.shift)(oilskin, 0.16, -6), { shape: 'flat', height: 8 });
    // Hand gripping the pole.
    c.ellipse(px, a.torsoTop + 5, 2, 1.9, colors.skin, { shape: 'round', height: 11 });
    // ----- Wide-brimmed hat: a flat disc over a low crown, hiding the face in a
    // band of shadow. Only two faint eye-glints beneath. The hat is the read.
    const hx = a.headCx;
    const hy = a.headCy;
    // Face left mostly in shadow under the brim.
    c.ellipse(hx, hy + 1.5, build.headR - 1, build.headR - 0.5, (0, Palette_1.shift)(colors.skin, -0.2), { shape: 'flat', height: 15, shade: 0.6 });
    // Two cold eye-glints in the dark.
    [-1.4, 1.4].forEach((ox) => c.rect(hx + ox, hy + 1, 1, 1, '#c7d6e0', { emissive: true, alpha: 0.8 }));
    // Low crown.
    c.ellipse(hx, hy - build.headR + 1, build.headR - 0.5, 2.6, (0, Palette_1.shift)(oilskin, -0.06), { shape: 'dome', height: 18, curve: 0.9 });
    // Wide flat brim.
    c.ellipse(hx, hy - build.headR + 2.5, build.headR + 3.5, 2, (0, Palette_1.mix)(oilskin, '#1c2228', 0.4), { shape: 'flat', height: 17 });
    c.ellipse(hx, hy - build.headR + 2, build.headR + 3.5, 1, (0, Palette_1.shift)(oilskin, 0.08), { shape: 'flat', height: 18 }); // lit brim edge
}
/**
 * 7. IVA — bog witch / herbalist. The read is *wild and stooped*: a mass of
 * unkempt hair, ragged layered robes in bog green, a woven herb basket carried
 * at the hip, and gnarled posture. A little unsettling, a little maternal.
 */
function drawIva(c, k, frame, talk) {
    const accent = accentOf(7);
    const robe = (0, Palette_1.mix)(accent, '#33463a', 0.5); // murky bog green
    const build = { torsoHalf: 6, torsoH: 13, headR: 4.8, legH: 8, stoop: 2, drop: 2, shoulder: 6 };
    const colors = { skin: (0, Palette_1.mix)(Palette_1.MATERIAL.skinPale, Palette_1.MATERIAL.toxic, 0.15), hair: '#5a5546', garb: robe, trim: accent, legs: Palette_1.MATERIAL.leatherDark };
    // Wild hair mass behind the head, drawn first — big and irregular.
    const cx = c.width / 2;
    const hairTop = 6 + build.drop + 1;
    c.ellipse(cx, hairTop + build.headR, build.headR + 2.5, build.headR + 3, colors.hair, { shape: 'dome', height: 14, curve: 0.9 });
    // Straggly locks hanging down.
    [-1, 0, 1].forEach((s) => {
        c.rect(cx + s * (build.headR) - 0.5 + k.sway, hairTop + build.headR, 1.5, 8 + Math.abs(s) * 2, colors.hair, { shape: 'cylinder-y', height: 8, shade: 0.85 });
    });
    const a = drawBase(c, build, colors, k, { skirt: true });
    const hands = drawArms(c, a, build, robe, colors.skin, k, talk ? 1 : 0);
    // Layered ragged robe: an outer skirt with a torn, uneven hem.
    c.polygon([
        [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 4],
        [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 4],
        [a.cx + build.torsoHalf + 1 + k.sway, c.height - 6],
        [a.cx + 2 + k.sway, c.height - 8],
        [a.cx + k.sway, c.height - 5],
        [a.cx - 2 + k.sway, c.height - 8],
        [a.cx - build.torsoHalf - 1 + k.sway, c.height - 6],
    ], robe, { shape: 'cylinder-y', height: 6, curve: 0.8 });
    // A lighter under-layer showing at the collar.
    c.rect(a.cx - build.torsoHalf + 1 + a.leanX, a.torsoTop, build.torsoHalf * 2 - 2, 2, (0, Palette_1.shift)(robe, 0.1, 8), { shape: 'cylinder-x', height: 9 });
    // Herb basket at the hip: a woven bowl with a few sprigs poking out.
    const [bx, by] = hands.left;
    c.ellipse(bx - 1, by + 1, 3.4, 2.4, Palette_1.MATERIAL.woodPale, { shape: 'round', height: 9 });
    c.ellipse(bx - 1, by, 3, 1.4, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, 0.05), { shape: 'flat', height: 10 }); // basket mouth
    // Weave lines.
    c.line(bx - 4, by + 1, bx + 2, by + 1, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.1), 1, { height: 10, shade: 0.8 });
    // Herb sprigs.
    [-2, 0, 1.5].forEach((ox, i) => {
        c.line(bx + ox - 1, by, bx + ox - 1, by - 3 - (i % 2), Palette_1.MATERIAL.foliageLit, 1, { height: 11 });
        c.circle(bx + ox - 1, by - 3 - (i % 2), 1, i === 1 ? accent : Palette_1.MATERIAL.moss, { shape: 'round', height: 12 });
    });
    // Face peering out of the hair — a little sharp, with faint green cast.
    drawFace(c, a, build.headR, talk, frame);
    // A crooked nose shadow for character.
    c.rect(a.headCx, a.headCy + 1, 1, 2, (0, Palette_1.shift)(colors.skin, -0.16, -6), { shape: 'flat', height: 16 });
}
/**
 * 8. BRAM — the last miner. The read is *the lamp*: a round helmet with a
 * bright emissive lamp on the brow, a stocky dust-caked body, and a pickaxe
 * shouldered. The helmet light is the one warm point on a grimy grey figure.
 */
function drawBram(c, k, frame, talk) {
    const accent = accentOf(8);
    const garb = (0, Palette_1.mix)(accent, '#4a4238', 0.5); // dust-caked work clothes
    const build = { torsoHalf: 7, torsoH: 13, headR: 4.8, legH: 8, stoop: 1, drop: 1, shoulder: 7 };
    // Grime-greyed skin.
    const skin = (0, Palette_1.mix)(Palette_1.MATERIAL.skin, Palette_1.MATERIAL.stone, 0.28);
    const colors = { skin, hair: '#3a3128', garb, trim: accent, legs: '#33302a' };
    // Pickaxe drawn first, shouldered behind: a long haft with a curved twin head
    // rising over the shoulder. Reads instantly as mining.
    const cx = c.width / 2;
    const px = cx - build.torsoHalf - 2;
    c.line(px + 4, c.height - 10, px - 1, 5, Palette_1.MATERIAL.wood, 2, { height: 8 }); // haft, angled over shoulder
    // Pick head: two curved spikes at the top.
    c.polygon([[px - 4, 4], [px - 1, 3], [px + 2, 6], [px - 1, 6]], Palette_1.MATERIAL.iron, { shape: 'bevel', height: 12, curve: 0.7 });
    c.polygon([[px + 2, 3], [px + 5, 4], [px + 2, 7], [px, 6]], (0, Palette_1.shift)(Palette_1.MATERIAL.iron, -0.08), { shape: 'bevel', height: 11, curve: 0.7 });
    c.line(px - 3, 4.5, px + 4, 4.5, (0, Palette_1.shift)(Palette_1.MATERIAL.steel, 0.16), 1, { height: 13 }); // metal highlight along the pick
    const a = drawBase(c, build, colors, k);
    drawArms(c, a, build, garb, skin, k, talk ? 1 : 0);
    // Sturdy work tunic with a wide belt; dust smudges on the chest.
    c.rect(a.cx - build.torsoHalf + a.leanX, a.torsoTop + build.torsoH - 5, build.torsoHalf * 2, 2, Palette_1.MATERIAL.leatherDark, { shape: 'cylinder-y', height: 9 });
    c.rect(a.cx - 2, a.torsoTop + 4, 3, 2, (0, Palette_1.shift)(garb, 0.12), { shape: 'flat', height: 9, shade: 0.9 }); // dust smear
    c.rect(a.cx + 1, a.torsoTop + 8, 2, 2, (0, Palette_1.shift)(garb, 0.1), { shape: 'flat', height: 9, shade: 0.9 });
    // ----- Helmet: a rounded steel dome low over the brow, with the lamp bracket
    // and a bright emissive beam at the front. The glowing lamp is the silhouette.
    const hx = a.headCx;
    const hy = a.headCy;
    // Shadowed face under the helmet.
    drawFace(c, a, build.headR, talk, frame);
    // Helmet dome.
    c.ellipse(hx, hy - build.headR + 2.5, build.headR + 0.6, build.headR - 1, Palette_1.MATERIAL.iron, { shape: 'dome', height: 18, curve: 1 });
    c.rect(hx - build.headR - 0.5, hy - build.headR + 3.5, build.headR * 2 + 1, 1.5, (0, Palette_1.shift)(Palette_1.MATERIAL.iron, -0.14), { shape: 'cylinder-x', height: 17, shade: 0.85 }); // brim
    // Lamp bracket + emissive lamp on the brow.
    c.rect(hx - 1.5, hy - build.headR + 2, 3, 2, Palette_1.MATERIAL.bronze, { shape: 'bevel', height: 19, curve: 0.7 });
    c.circle(hx, hy - build.headR + 3, 1.6, '#ffe08a', { shape: 'round', emissive: true }); // lamp glass
    c.circle(hx, hy - build.headR + 3, 0.9, '#fff6d6', { emissive: true }); // hot core
    // Faint cast beam downward from the lamp.
    c.polygon([[hx - 1, hy - build.headR + 4], [hx + 1, hy - build.headR + 4], [hx + 3, hy + build.headR + 2], [hx - 3, hy + build.headR + 2]], '#ffe9a8', { alpha: 0.14, emissive: true });
}
/**
 * 9. SERAH — citadel deserter. The read is *broken soldier*: dented plate on one
 * shoulder and the chest, a long red scarf trailing in the wind, and a sword
 * sheathed at the hip. Proud posture gone weary. The red scarf is the accent.
 */
function drawSerah(c, k, frame, talk) {
    const accent = accentOf(9);
    const cloth = (0, Palette_1.mix)(Palette_1.MATERIAL.clothCold, '#3a3340', 0.4);
    const steel = Palette_1.MATERIAL.steel;
    const build = { torsoHalf: 6.5, torsoH: 14, headR: 4.8, legH: 10, stoop: 0, drop: 0, shoulder: 7 };
    const colors = { skin: Palette_1.MATERIAL.skin, hair: '#2f2622', garb: cloth, trim: accent, legs: Palette_1.MATERIAL.leatherDark };
    // Red scarf trailing behind, drawn first so it flows out from the neck.
    const cx = c.width / 2;
    const scarfBase = 6 + build.headR * 2;
    c.polygon([
        [cx - 1, scarfBase],
        [cx + 2, scarfBase],
        [cx + 6 + k.sway * 2, scarfBase + 8],
        [cx + 9 + k.sway * 2, scarfBase + 14],
        [cx + 5 + k.sway * 2, scarfBase + 13],
        [cx + 2, scarfBase + 8],
    ], accent, { shape: 'cylinder-y', height: 5, curve: 0.7 });
    const a = drawBase(c, build, colors, k);
    const hands = drawArms(c, a, build, cloth, colors.skin, k, talk ? 1 : 0);
    // Dented breastplate over the chest — steel with battle scars.
    c.rect(a.cx - build.torsoHalf + 1 + a.leanX, a.torsoTop, build.torsoHalf * 2 - 2, build.torsoH - 4, steel, { shape: 'cylinder-y', height: 9, curve: 0.9 });
    // Scratches and a dent (darker gouges).
    c.line(a.cx - 3 + a.leanX, a.torsoTop + 3, a.cx + 1 + a.leanX, a.torsoTop + 6, (0, Palette_1.shift)(steel, -0.22), 1, { height: 10, shade: 0.7 });
    c.rect(a.cx + 1 + a.leanX, a.torsoTop + 8, 2, 2, (0, Palette_1.shift)(steel, -0.26), { shape: 'flat', height: 9, shade: 0.65 }); // dent
    // Central ridge highlight sells the curved plate.
    c.rect(a.cx - 0.5 + a.leanX, a.torsoTop + 1, 1, build.torsoH - 6, (0, Palette_1.shift)(steel, 0.16), { shape: 'flat', height: 10 });
    // One intact steel pauldron (left), one broken/bare shoulder (right) — the
    // asymmetry is the "broken armour" read.
    c.ellipse(a.cx - build.shoulder + a.leanX, a.torsoTop + 1, 3.4, 2.8, steel, { shape: 'round', height: 13, curve: 1 });
    c.rect(a.cx - build.shoulder - 1.5 + a.leanX, a.torsoTop + 2.5, 4, 1, (0, Palette_1.shift)(steel, -0.18), { shape: 'flat', height: 12 });
    // Broken shoulder: just a torn cloth strap, no plate.
    c.rect(a.cx + build.shoulder - 2 + a.leanX, a.torsoTop, 3, 3, (0, Palette_1.shift)(cloth, -0.08), { shape: 'bevel', height: 11, curve: 0.6 });
    // Sword sheathed at the hip (near/left side), angled back. Pulled slightly
    // inward and drawn with a lighter scabbard + a prominent hilt so the "armed
    // deserter" read survives the dark keyline and the small display size.
    const sx = a.cx - build.torsoHalf + 1;
    const sy = a.torsoTop + build.torsoH - 4;
    // Scabbard: a browner leather so it separates from the outline.
    c.line(sx, sy, sx - 4, c.height - 5, (0, Palette_1.mix)(Palette_1.MATERIAL.leather, Palette_1.MATERIAL.leatherDark, 0.4), 3, { shape: 'cylinder-x', height: 6 });
    c.line(sx - 3.5, c.height - 6, sx - 4, c.height - 4, steel, 2, { height: 7 }); // steel chape tip
    // Hilt above the belt: a tall wrapped grip, a wide bronze crossguard and a
    // round pommel — the parts that actually say "sword".
    c.rect(sx + 0.5, sy - 5, 1.5, 5, (0, Palette_1.mix)(accent, Palette_1.MATERIAL.leather, 0.5), { shape: 'cylinder-y', height: 11 }); // grip
    c.line(sx - 1.5, sy - 0.5, sx + 3.5, sy - 0.5, Palette_1.MATERIAL.bronze, 2, { shape: 'cylinder-x', height: 11 }); // crossguard
    c.circle(sx + 1.2, sy - 6, 1.3, (0, Palette_1.shift)(Palette_1.MATERIAL.bronze, 0.08), { shape: 'round', height: 12 }); // pommel
    // Weary face under short-cropped soldier's hair.
    c.ellipse(a.headCx, a.headCy - build.headR + 1.5, build.headR, 2.4, colors.hair, { shape: 'dome', height: 17 });
    drawFace(c, a, build.headR, talk, frame);
    // Scar across one eye — a pale diagonal line.
    c.line(a.headCx - 2, a.headCy - 1, a.headCx - 0.5, a.headCy + 2, (0, Palette_1.shift)(colors.skin, 0.16), 1, { height: 17 });
}
/** Dispatch table: index → draw function. */
const DRAWERS = [
    drawMora, drawRuna, drawGran, drawVesna, drawElira, drawOrrin, drawFerryman, drawIva, drawBram, drawSerah,
];
/**
 * Texture key for a generated NPC frame.
 *
 * CRITICAL COMPAT: the resting frame (idle, frame 0) must key to plain
 * `npc-{index}`, because existing scene code (WorldScene / InteriorScene) loads
 * villagers by that exact key. Every other frame gets a fully-qualified key so
 * animation systems can address them without colliding with the legacy one.
 */
function npcKey(index, pose, frame) {
    if (pose === 'idle' && frame === 0)
        return `npc-${index}`;
    return `npc-${index}-${pose}-${frame}`;
}
/** Render a single NPC frame into a fresh canvas. */
function renderNpcFrame(index, pose, frame) {
    var _a;
    const canvas = new PixelCanvas_1.PixelCanvas(exports.NPC_W, exports.NPC_H);
    const draw = (_a = DRAWERS[index]) !== null && _a !== void 0 ? _a : DRAWERS[0];
    const k = kinematics(pose, frame);
    draw(canvas, k, frame, pose === 'talk');
    finish(canvas);
    return canvas;
}
/**
 * Lighting profile for the villagers. Matches the hero's (HERO_SHADE) so the
 * whole cast is lit by the same key light and reads as one scene — just a hair
 * softer rim, since townsfolk stand in lit interiors rather than the dark wild.
 */
exports.NPC_SHADE = {
    lightX: -0.5,
    lightY: -0.76,
    lightZ: 0.4,
    intensity: 0.66,
    ambient: 0.52,
    ambientColor: '#4f5f8c',
    occlusion: 0.4,
    rim: 0.18,
    rimColor: '#9fb0dc',
    bands: 5,
    dither: 0.42,
};
/** Every NPC frame the game needs, as (key, canvas) pairs. */
function buildNpcFrames() {
    const frames = [];
    for (let index = 0; index < DRAWERS.length; index += 1) {
        for (const pose of Object.keys(exports.NPC_POSE_FRAMES)) {
            for (let frame = 0; frame < exports.NPC_POSE_FRAMES[pose]; frame += 1) {
                frames.push({ key: npcKey(index, pose, frame), canvas: renderNpcFrame(index, pose, frame) });
            }
        }
    }
    return frames;
}

});
__define("src/systems/sprites/props.ts", function(exports, module, __req){
"use strict";
/**
 * World props and item sprites for Trupy.
 *
 * Every prop is sculpted the same way the hero is: a `groundShadow` goes down
 * first to anchor the object to the world, volume is built from *shaped*
 * primitives (domes for canopies and stone, cylinders for trunks and posts,
 * cones for pines and roofs), light emitters are flagged `emissive` so the
 * lighting pass leaves them glowing, and a dark keyline is traced last so the
 * silhouette reads against the valley's near-black ground.
 *
 * The world is viewed in a top-down-ish 3/4. Tall things (trees, obelisks,
 * statues) show a front face plus a hint of their top; flat things (puddles,
 * ash, cracked ground) lie on the ground plane with almost no height so the
 * light rakes across them instead of lifting them off the floor.
 *
 * Props are keyed by string. `renderProp(key, variant)` returns a fresh canvas;
 * the game references props by the same keys the old flat TextureFactory used,
 * so those all keep working (plus a pile of new ones and per-key variants).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROP_KEYS = exports.PROP_SHADE = void 0;
exports.renderProp = renderProp;
exports.buildPropFrames = buildPropFrames;
const PixelCanvas_1 = __req("src/systems/render/PixelCanvas.ts");
const Palette_1 = __req("src/systems/render/Palette.ts");
const OUTLINE = '#14151d';
const RIM = '#8f9bc4';
/** Shared soft keyline pass — dark line, faint cool lit edge upper-left. */
function finish(c) {
    c.outline(OUTLINE, { lightEdge: (0, Palette_1.mix)(OUTLINE, RIM, 0.5), alpha: 0.92 });
}
/**
 * Shading config for props. Slightly stronger occlusion than the hero so
 * clustered geometry (bark ridges, stone facets, chest slats) reads its
 * crevices, and a touch more rim so props separate from the dark ground.
 */
exports.PROP_SHADE = {
    lightX: -0.5,
    lightY: -0.76,
    lightZ: 0.42,
    intensity: 0.64,
    ambient: 0.5,
    ambientColor: '#4f5f8c',
    occlusion: 0.46,
    rim: 0.24,
    rimColor: '#9fb0dc',
    bands: 5,
    dither: 0.44,
};
// ---------------------------------------------------------------------------
// Foliage
// ---------------------------------------------------------------------------
/**
 * A broadleaf tree. Canopy is a cluster of overlapping `dome` blobs — lit tops,
 * shadowed undersides — so it reads as a mass of leaves with real volume rather
 * than one flat disc. The trunk is a cylinder with a couple of bark ridges.
 * Variants shift the crown silhouette, lean and colour so a forest of them
 * doesn't look stamped.
 */
function tree(v) {
    const c = new PixelCanvas_1.PixelCanvas(44, 60);
    const cx = 22;
    const foliage = (0, PixelCanvas_1.vary)(Palette_1.MATERIAL.foliage, v + 1, 0.06);
    const deep = (0, Palette_1.shift)(foliage, -0.12, 6);
    const lit = (0, Palette_1.shift)(foliage, 0.16, -6);
    c.groundShadow(cx, 55, 15, 4.5, 0.4);
    // Trunk: a cylinder so light wraps around it; a root flare at the base.
    // Variant 2 is a windswept tree, so its trunk leans and the crown sits off-axis.
    const trunkLean = v === 2 ? 2 : 0;
    const trunk = Palette_1.MATERIAL.wood;
    c.rect(cx - 3 + trunkLean, 30, 7, 26, trunk, { shape: 'cylinder-y', height: 4, curve: 0.95 });
    c.rect(cx - 5, 52, 11, 4, (0, Palette_1.shift)(trunk, -0.06), { shape: 'dome', height: 3, curve: 0.7 });
    c.rect(cx - 2 + trunkLean, 32, 1, 22, (0, Palette_1.shift)(trunk, -0.14), { shape: 'flat', height: 5, shade: 0.85 });
    c.rect(cx + 2 + trunkLean, 34, 1, 18, (0, Palette_1.shift)(trunk, 0.1), { shape: 'flat', height: 5 });
    // Each variant gets a hand-authored canopy silhouette rather than the same
    // blob cluster nudged sideways — a full round crown, a tall spire, and a
    // broad windswept crown read as genuinely different trees in a forest.
    // Columns: cx-offset, y, rx, ry, tint(0=deep 1=mid 2=lit).
    const crowns = [
        // 0 — full, round, generous
        [
            [-9, 21, 9, 8, 0], [9, 20, 9, 8, 0], [0, 27, 11, 8, 0],
            [-7, 14, 9, 8, 1], [7, 13, 9, 8, 1], [0, 16, 9, 8, 1],
            [0, 9, 10, 8, 2], [-4, 12, 6, 5, 2],
        ],
        // 1 — tall, narrow spire
        [
            [-6, 24, 8, 8, 0], [6, 23, 8, 8, 0], [0, 29, 8, 7, 0],
            [-5, 16, 7, 8, 1], [5, 15, 7, 8, 1],
            [0, 11, 8, 9, 1], [0, 5, 6, 8, 2], [-2, 9, 5, 6, 2],
        ],
        // 2 — broad, lopsided, windswept to the right
        [
            [-11, 22, 8, 7, 0], [8, 20, 11, 8, 0], [-2, 27, 11, 7, 0],
            [-8, 16, 8, 7, 1], [9, 13, 10, 8, 1], [2, 15, 9, 7, 1],
            [6, 9, 9, 7, 2], [-3, 13, 6, 5, 2],
        ],
    ];
    const tints = [deep, foliage, lit];
    for (const [dx, y, rx, ry, t] of crowns[v % 3]) {
        c.ellipse(cx + dx, y, rx, ry, tints[t], { shape: 'dome', height: 16 + (y < 16 ? 6 : 0), curve: 0.95 });
    }
    // A couple of brightest clumps catching the top light, placed per silhouette.
    const topLit = [[-2, 8], [4, 11]];
    if (v === 1) {
        topLit[0] = [0, 4];
        topLit[1] = [-2, 8];
    }
    if (v === 2) {
        topLit[0] = [5, 8];
        topLit[1] = [-2, 12];
    }
    c.ellipse(cx + topLit[0][0], topLit[0][1], 4, 3, (0, Palette_1.shift)(lit, 0.12), { shape: 'dome', height: 24, curve: 0.9 });
    c.ellipse(cx + topLit[1][0], topLit[1][1], 3, 2.5, (0, Palette_1.shift)(lit, 0.08), { shape: 'dome', height: 22, curve: 0.9 });
    finish(c);
    return c;
}
/** Dead tree: bare, clawing branches, no canopy. Bleached grey-brown wood. */
function treeDead(v) {
    const c = new PixelCanvas_1.PixelCanvas(40, 58);
    const cx = 20;
    const wood = (0, PixelCanvas_1.vary)((0, Palette_1.shift)(Palette_1.MATERIAL.wood, 0.04, 20, -0.12), v + 3, 0.05);
    c.groundShadow(cx, 53, 11, 4, 0.36);
    c.rect(cx - 2, 24, 5, 30, wood, { shape: 'cylinder-y', height: 4, curve: 0.95 });
    c.rect(cx - 4, 50, 9, 4, (0, Palette_1.shift)(wood, -0.06), { shape: 'dome', height: 3, curve: 0.7 });
    // Branches as tapering lines forking upward — mirrored per variant.
    const dir = v % 2 === 0 ? 1 : -1;
    const limbs = [
        [cx, 30, cx - 11 * dir, 18, 3],
        [cx - 8 * dir, 22, cx - 13 * dir, 12, 2],
        [cx, 24, cx + 9 * dir, 12, 3],
        [cx + 6 * dir, 16, cx + 11 * dir, 8, 2],
        [cx, 20, cx - 3 * dir, 6, 2],
        [cx, 18, cx + 3, 5, 2],
    ];
    for (const [x0, y0, x1, y1, t] of limbs) {
        c.line(x0, y0, x1, y1, wood, t, { height: 5 });
    }
    finish(c);
    return c;
}
/** Conifer: stacked `cone` tiers of dark needles over a short trunk. */
function treePine(v) {
    const c = new PixelCanvas_1.PixelCanvas(38, 60);
    const cx = 19;
    const needle = (0, PixelCanvas_1.vary)((0, Palette_1.shift)(Palette_1.MATERIAL.foliageDeep, 0.02, -4), v + 2, 0.05);
    const lit = (0, Palette_1.shift)(needle, 0.14, -8);
    c.groundShadow(cx, 55, 12, 4, 0.38);
    c.rect(cx - 2, 46, 5, 10, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.06), { shape: 'cylinder-y', height: 3, curve: 0.9 });
    // Widening cones from top to bottom; each tier lit on its upper-left.
    // Variants differ in tier count and taper: a classic 3-tier fir, a squat
    // broad 3-tier, and a tall skinny 4-tier sapling-spire.
    const tierSets = [
        // 0 — classic
        [[6, 8, 22], [16, 12, 30], [26, 15, 38]].map(([t, w, b]) => [t, w, b]),
        // 1 — squat & broad
        [[12, 10, 26], [22, 14, 34], [30, 17, 42]].map(([t, w, b]) => [t, w, b]),
        // 2 — tall skinny spire, 4 tiers
        [[3, 6, 16], [11, 8, 24], [19, 10, 32], [27, 13, 40]].map(([t, w, b]) => [t, w, b]),
    ];
    const tiers = tierSets[v % 3];
    for (const [top, halfW, base] of tiers) {
        c.polygon([
            [cx - halfW, base],
            [cx + halfW, base],
            [cx, top],
        ], needle, { shape: 'cone', height: 12, curve: 1 });
        // Lit sliver on the left face of each tier.
        c.polygon([
            [cx - halfW, base],
            [cx - halfW * 0.35, base],
            [cx, top],
        ], lit, { shape: 'cone', height: 13, curve: 1, shade: 1 });
    }
    finish(c);
    return c;
}
/** A cut stump with visible rings on top and a rounded, weathered side. */
function stump() {
    const c = new PixelCanvas_1.PixelCanvas(24, 20);
    const cx = 12;
    const wood = Palette_1.MATERIAL.woodPale;
    c.groundShadow(cx, 16, 10, 3.5, 0.34);
    // Side: a short cylinder.
    c.rect(cx - 8, 8, 16, 8, (0, Palette_1.shift)(wood, -0.08, 8), { shape: 'cylinder-y', height: 5, curve: 0.85 });
    // Top face: an ellipse of pale heartwood, catching the sky.
    c.ellipse(cx, 8, 8, 4, (0, Palette_1.shift)(wood, 0.06), { shape: 'flat', height: 8 });
    // Growth rings.
    c.ellipse(cx, 8, 5.5, 2.8, (0, Palette_1.shift)(wood, -0.05), { shape: 'flat', height: 8, alpha: 0.5 });
    c.ellipse(cx, 8, 3, 1.5, (0, Palette_1.shift)(wood, -0.12), { shape: 'flat', height: 8, alpha: 0.6 });
    finish(c);
    return c;
}
/** Low leafy bush — a cluster of small domes. Variants change bulk and hue. */
function bush(v) {
    const c = new PixelCanvas_1.PixelCanvas(30, 22);
    const cx = 15;
    const base = (0, PixelCanvas_1.vary)(Palette_1.MATERIAL.foliage, v + 5, 0.07);
    const lit = (0, Palette_1.shift)(base, 0.15, -6);
    const deep = (0, Palette_1.shift)(base, -0.12, 6);
    c.groundShadow(cx, 18, 12, 3.5, 0.32);
    // Distinct massing per variant: a broad low bush, a tall tight bush, and a
    // sparse two-lobe bush — same palette, different silhouette.
    const shapes = [
        // 0 — broad, low, five lobes
        [[-8, 14, 6, 5, 0], [8, 14, 6, 5, 0], [0, 13, 7, 6, 1], [-4, 10, 5, 5, 2], [4, 11, 5, 4, 2]],
        // 1 — tall, tight, taller crown
        [[-5, 15, 6, 5, 0], [5, 15, 6, 5, 0], [0, 12, 7, 7, 1], [0, 7, 6, 6, 2], [-3, 10, 4, 4, 2]],
        // 2 — sparse, two main lobes leaning
        [[-6, 14, 7, 5, 0], [6, 13, 6, 5, 1], [-3, 10, 5, 5, 2], [4, 11, 4, 4, 2]],
    ];
    const tints = [deep, base, lit];
    for (const [dx, by, rx, ry, t] of shapes[v % 3]) {
        c.ellipse(cx + dx, by, rx, ry, tints[t], { shape: 'dome', height: 8, curve: 0.9 });
    }
    finish(c);
    return c;
}
/** A fern: fronds fanning out from a central crown, drawn as tapered blades. */
function fern() {
    const c = new PixelCanvas_1.PixelCanvas(26, 22);
    const cx = 13;
    const base = Palette_1.MATERIAL.grass;
    c.groundShadow(cx, 19, 9, 2.6, 0.28);
    // Blades as thin triangles radiating up and out.
    const blades = [
        [-11, 14, 0.9], [-7, 6, 1], [-3, 3, 1], [3, 3, 1], [7, 6, 1], [11, 14, 0.9],
    ];
    for (const [dx, ty, l] of blades) {
        const col = (0, Palette_1.shift)(base, dx === 0 ? 0.1 : 0.02 - Math.abs(dx) * 0.006, 4);
        c.polygon([
            [cx - 1, 19],
            [cx + 1, 19],
            [cx + dx * l, ty],
        ], col, { shape: 'cylinder-y', height: 5, curve: 0.7 });
    }
    finish(c);
    return c;
}
/** Marsh reeds: tall thin blades with seed heads. Cool bog green. */
function reeds() {
    const c = new PixelCanvas_1.PixelCanvas(24, 30);
    const cx = 12;
    const base = (0, Palette_1.shift)(Palette_1.MATERIAL.toxic, -0.06, -6);
    c.groundShadow(cx, 27, 8, 2.4, 0.26);
    const stalks = [[-6, 12], [-2, 5], [2, 8], [6, 14], [0, 3]];
    for (const [dx, ty] of stalks) {
        const x = cx + dx;
        c.line(x, 27, x, ty, (0, Palette_1.shift)(base, -0.02), 2, { shape: 'cylinder-y', height: 4 });
        // Seed head.
        c.ellipse(x, ty, 1.6, 3, (0, Palette_1.shift)(Palette_1.MATERIAL.thatch, -0.04), { shape: 'cylinder-y', height: 5, curve: 0.8 });
    }
    finish(c);
    return c;
}
/** A cluster of small brown mushrooms of varied heights. */
function mushroomCluster() {
    const c = new PixelCanvas_1.PixelCanvas(24, 18);
    const cx = 12;
    const cap = Palette_1.MATERIAL.bronze;
    const stem = Palette_1.MATERIAL.bone;
    c.groundShadow(cx, 15, 9, 2.6, 0.3);
    const caps = [[-6, 11, 3.2], [0, 8, 4], [6, 12, 2.6], [3, 13, 2.2]];
    for (const [dx, cy, r] of caps) {
        const x = cx + dx;
        c.rect(x - 1, cy, 2, 15 - cy, (0, Palette_1.shift)(stem, -0.04), { shape: 'cylinder-y', height: 3, curve: 0.85 });
        c.ellipse(x, cy, r, r * 0.7, (0, Palette_1.shift)(cap, dx * 0.01, 4), { shape: 'dome', height: 6, curve: 0.95 });
        // Pale gills catching under-light on the cap rim.
        c.ellipse(x, cy + r * 0.4, r * 0.7, 1, (0, Palette_1.shift)(stem, 0.08), { shape: 'flat', height: 5, alpha: 0.6 });
    }
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Stone & terrain
// ---------------------------------------------------------------------------
/**
 * A boulder. A big `round` mass gives the core volume, then a couple of bevelled
 * facets and a lit crown plane break the sphere into rock. Variants reshape the
 * silhouette and re-colour between grey stone and warmer granite.
 */
function rock(v) {
    const c = new PixelCanvas_1.PixelCanvas(32, 26);
    const cx = 16;
    const stone = (0, PixelCanvas_1.vary)([Palette_1.MATERIAL.stone, Palette_1.MATERIAL.granite, Palette_1.MATERIAL.slate][v % 3], v + 7, 0.05);
    c.groundShadow(cx, 22, 14, 3.6, 0.36);
    // Core mass.
    const squash = [1, 0.85, 1.15][v % 3];
    c.ellipse(cx, 15, 13 * squash, 9, stone, { shape: 'round', height: 8, curve: 0.95 });
    // Facets: flatter bevelled planes that catch light differently.
    c.polygon([
        [cx - 11 * squash, 15], [cx - 2, 8], [cx + 3, 12], [cx - 4, 20],
    ], (0, Palette_1.shift)(stone, 0.1), { shape: 'bevel', height: 9, curve: 0.7 });
    c.polygon([
        [cx + 2, 9], [cx + 11 * squash, 14], [cx + 8, 21], [cx, 16],
    ], (0, Palette_1.shift)(stone, -0.1, 6), { shape: 'bevel', height: 8, curve: 0.7 });
    // A crack and a lit top edge.
    c.line(cx - 1, 10, cx + 2, 19, (0, Palette_1.shift)(stone, -0.22), 1, { height: 8, shade: 0.7 });
    c.ellipse(cx - 3, 9, 4, 2, (0, Palette_1.shift)(stone, 0.16), { shape: 'dome', height: 10, curve: 0.8 });
    finish(c);
    return c;
}
/** Scattered rubble: a few small broken stones. Variants rearrange them. */
function rubble(v) {
    const c = new PixelCanvas_1.PixelCanvas(28, 18);
    const cx = 14;
    const stone = (0, PixelCanvas_1.vary)(Palette_1.MATERIAL.stoneDark, v + 11, 0.06);
    c.groundShadow(cx, 15, 12, 3, 0.3);
    const layouts = [
        [[-8, 11, 4, 3], [-1, 9, 5, 4], [7, 12, 4, 3], [2, 13, 3, 2]],
        [[-7, 12, 3, 3], [0, 11, 6, 4], [8, 10, 3, 3], [-2, 8, 3, 2]],
        [[-9, 10, 4, 3], [-2, 12, 4, 3], [5, 11, 5, 4], [9, 13, 2, 2]],
    ];
    for (const [dx, cy, rx, ry] of layouts[v % 3]) {
        c.ellipse(cx + dx, cy, rx, ry, (0, Palette_1.shift)(stone, (dx % 2) * 0.06), { shape: 'round', height: 5, curve: 0.9 });
        c.ellipse(cx + dx - 1, cy - 1, rx * 0.5, ry * 0.5, (0, Palette_1.shift)(stone, 0.12), { shape: 'dome', height: 6, curve: 0.8 });
    }
    finish(c);
    return c;
}
/** A pile of fine ash — lies flat, faint warm embers salted through it. */
function ashPile() {
    const c = new PixelCanvas_1.PixelCanvas(28, 14);
    const cx = 14;
    const ash = Palette_1.MATERIAL.ash;
    // Very low mound: read as ground, not object. No ground shadow (it *is* on the floor).
    c.ellipse(cx, 9, 13, 4.5, (0, Palette_1.shift)(ash, -0.05), { shape: 'flat', height: 1 });
    c.ellipse(cx, 8, 9, 3, ash, { shape: 'dome', height: 2, curve: 0.4 });
    c.ellipse(cx - 2, 7, 4, 1.6, (0, Palette_1.shift)(ash, 0.1), { shape: 'dome', height: 2, curve: 0.4 });
    // A couple of dull embers, barely glowing.
    c.rect(cx - 4, 9, 1, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.ember, -0.1), { emissive: true });
    c.rect(cx + 3, 8, 1, 1, Palette_1.MATERIAL.emberCore, { emissive: true, alpha: 0.8 });
    finish(c);
    return c;
}
/** Cracked, dry ground — a flat decal of dark fissures on a scorched patch. */
function crackedGround() {
    const c = new PixelCanvas_1.PixelCanvas(30, 24);
    const cx = 15;
    const cy = 12;
    const dirt = (0, Palette_1.shift)(Palette_1.MATERIAL.soil, -0.02, 4);
    // Flat scorched disc.
    c.ellipse(cx, cy, 13, 10, dirt, { shape: 'flat', height: 0 });
    c.ellipse(cx, cy, 9, 7, (0, Palette_1.shift)(dirt, 0.05), { shape: 'flat', height: 0 });
    // Fissures radiating from centre.
    const crack = (0, Palette_1.shift)(dirt, -0.22);
    const rays = [[-11, -4], [-7, 7], [2, 9], [10, 3], [8, -6], [-2, -9], [12, -2]];
    for (const [dx, dy] of rays) {
        c.line(cx, cy, cx + dx, cy + dy, crack, 1, { height: 0, shade: 0.6 });
    }
    c.line(cx - 5, cy - 2, cx + 4, cy + 3, crack, 1, { height: 0, shade: 0.6 });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------
/** A shallow puddle: flat reflective water with a lit sky glint. */
function puddle() {
    const c = new PixelCanvas_1.PixelCanvas(28, 16);
    const cx = 14;
    const cy = 9;
    // Emissive so the water reads as reflecting sky rather than being lit as a solid.
    c.ellipse(cx, cy, 13, 6, (0, Palette_1.mix)(Palette_1.MATERIAL.water, '#0e1420', 0.35), { shape: 'flat', height: 0, emissive: true });
    c.ellipse(cx, cy, 10, 4.5, Palette_1.MATERIAL.water, { shape: 'flat', height: 0, emissive: true });
    c.ellipse(cx - 2, cy - 1, 6, 2.4, (0, Palette_1.mix)(Palette_1.MATERIAL.waterLit, '#0e1420', 0.15), { shape: 'flat', emissive: true });
    // Bright sky glint.
    c.ellipse(cx - 3, cy - 1, 3, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.waterLit, 0.16), { shape: 'flat', emissive: true, alpha: 0.85 });
    return c; // no outline — water edges should stay soft
}
/** A lilypad floating on dark water, with a small bud. */
function lilypad() {
    const c = new PixelCanvas_1.PixelCanvas(22, 16);
    const cx = 11;
    const cy = 9;
    const pad = (0, Palette_1.shift)(Palette_1.MATERIAL.moss, 0.02, -6);
    // Faint water halo around it.
    c.ellipse(cx, cy, 10, 5, (0, Palette_1.mix)(Palette_1.MATERIAL.water, '#0e1420', 0.4), { shape: 'flat', emissive: true, alpha: 0.7 });
    // The pad, a low dome with the classic wedge notch.
    c.ellipse(cx, cy, 8, 4.5, pad, { shape: 'dome', height: 2, curve: 0.5 });
    c.polygon([[cx, cy], [cx + 8, cy - 2], [cx + 8, cy + 2]], (0, Palette_1.mix)(Palette_1.MATERIAL.water, '#0e1420', 0.4), { shape: 'flat', emissive: true });
    c.ellipse(cx - 1, cy - 1, 4, 2, (0, Palette_1.shift)(pad, 0.1), { shape: 'dome', height: 3, curve: 0.5 });
    // Small pink bud.
    c.ellipse(cx - 3, cy, 1.6, 1.8, (0, Palette_1.shift)(Palette_1.MATERIAL.cloth, 0.2, 10), { shape: 'dome', height: 4, curve: 0.9 });
    finish(c);
    return c;
}
/** A bog bubble rising off the mire — a glassy dome catching a highlight. */
function bogBubble() {
    const c = new PixelCanvas_1.PixelCanvas(16, 16);
    const cx = 8;
    const cy = 9;
    const col = (0, Palette_1.mix)(Palette_1.MATERIAL.toxic, Palette_1.MATERIAL.water, 0.5);
    c.ellipse(cx, cy + 3, 6, 2, (0, Palette_1.mix)(col, '#0e1420', 0.4), { shape: 'flat', emissive: true, alpha: 0.6 });
    c.circle(cx, cy, 5, (0, Palette_1.mix)(col, '#0e1420', 0.2), { shape: 'round', height: 5, emissive: true, alpha: 0.55 });
    c.circle(cx, cy, 3.5, (0, Palette_1.shift)(col, 0.05), { shape: 'round', height: 6, emissive: true, alpha: 0.5 });
    // Specular highlight.
    c.ellipse(cx - 1.5, cy - 1.5, 1.4, 1.4, '#e6fff4', { shape: 'flat', emissive: true, alpha: 0.9 });
    return c;
}
// ---------------------------------------------------------------------------
// Bones & graves
// ---------------------------------------------------------------------------
/**
 * A weathered headstone. A rounded-top slab standing in disturbed soil, with a
 * carved cross recessed into the face. Variants change the top shape and lean.
 */
function grave(v) {
    const c = new PixelCanvas_1.PixelCanvas(22, 32);
    const cx = 11;
    const stone = (0, PixelCanvas_1.vary)(Palette_1.MATERIAL.stone, v + 13, 0.05);
    const lean = [0, -2, 2][v % 3];
    c.groundShadow(cx, 28, 10, 3, 0.34);
    // Mound of soil at the base.
    c.ellipse(cx, 27, 9, 3, (0, Palette_1.shift)(Palette_1.MATERIAL.soil, -0.02), { shape: 'dome', height: 2, curve: 0.5 });
    const topY = 4;
    const slabX = cx - 5 + Math.round(lean * 0.5);
    // Slab body as a rounded-top cylinder-x so it reads as a domed stele.
    c.rect(slabX, topY + 4, 10, 22, stone, { shape: 'cylinder-x', height: 6, curve: 0.8 });
    // Rounded / peaked cap depending on variant.
    if (v % 3 === 1) {
        c.ellipse(slabX + 5, topY + 4, 5, 4, stone, { shape: 'dome', height: 7, curve: 0.9 });
    }
    else {
        c.polygon([[slabX, topY + 5], [slabX + 5, topY], [slabX + 10, topY + 5]], stone, { shape: 'dome', height: 7, curve: 0.8 });
    }
    // Recessed cross, pre-shaded dark for a carved look.
    c.rect(slabX + 4, topY + 8, 2, 10, (0, Palette_1.shift)(stone, -0.24), { shape: 'flat', height: 5, shade: 0.65 });
    c.rect(slabX + 2, topY + 11, 6, 2, (0, Palette_1.shift)(stone, -0.24), { shape: 'flat', height: 5, shade: 0.65 });
    // Lit left edge.
    c.rect(slabX + 1, topY + 6, 1, 18, (0, Palette_1.shift)(stone, 0.14), { shape: 'flat', height: 6 });
    finish(c);
    return c;
}
/** A cross-shaped grave marker of lashed wood. */
function tombstoneCross() {
    const c = new PixelCanvas_1.PixelCanvas(20, 32);
    const cx = 10;
    const wood = (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.02, 6);
    c.groundShadow(cx, 28, 8, 2.6, 0.32);
    c.ellipse(cx, 27, 7, 2.5, (0, Palette_1.shift)(Palette_1.MATERIAL.soil, -0.02), { shape: 'dome', height: 2, curve: 0.5 });
    // Vertical and horizontal beams as cylinders.
    c.rect(cx - 2, 4, 4, 24, wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
    c.rect(cx - 7, 10, 14, 3, wood, { shape: 'cylinder-x', height: 5, curve: 0.9 });
    // Lashing at the joint.
    c.rect(cx - 3, 9, 6, 5, (0, Palette_1.shift)(Palette_1.MATERIAL.leatherDark, 0.04), { shape: 'cylinder-x', height: 6, curve: 0.8 });
    finish(c);
    return c;
}
/** A scatter of old bones on the ground. */
function bones() {
    const c = new PixelCanvas_1.PixelCanvas(26, 18);
    const cx = 13;
    const bone = Palette_1.MATERIAL.boneOld;
    c.groundShadow(cx, 14, 11, 3, 0.28);
    // Long bones as capsules (cylinder + knobbed ends).
    const draw = (x0, y0, x1, y1) => {
        c.line(x0, y0, x1, y1, bone, 2, { shape: 'cylinder-y', height: 3, curve: 0.8 });
        c.circle(x0, y0, 1.6, (0, Palette_1.shift)(bone, 0.06), { shape: 'round', height: 4, curve: 0.9 });
        c.circle(x1, y1, 1.6, (0, Palette_1.shift)(bone, 0.06), { shape: 'round', height: 4, curve: 0.9 });
    };
    draw(cx - 8, 8, cx + 2, 12);
    draw(cx - 3, 13, cx + 8, 9);
    // A curved rib.
    c.line(cx + 4, 6, cx + 9, 13, (0, Palette_1.shift)(bone, -0.05), 1, { height: 3 });
    finish(c);
    return c;
}
/** A single skull resting on the ground, eye sockets pooled with shadow. */
function skull() {
    const c = new PixelCanvas_1.PixelCanvas(18, 16);
    const cx = 9;
    const bone = Palette_1.MATERIAL.bone;
    c.groundShadow(cx, 13, 7, 2.4, 0.3);
    // Cranium dome + jaw block.
    c.ellipse(cx, 7, 6, 5.5, bone, { shape: 'round', height: 6, curve: 1 });
    c.rect(cx - 4, 10, 8, 3, (0, Palette_1.shift)(bone, -0.04), { shape: 'dome', height: 5, curve: 0.7 });
    // Sockets and nasal cavity, pre-darkened.
    c.ellipse(cx - 2.5, 7, 1.8, 2, '#1c1a1f', { shape: 'flat', height: 6, emissive: true });
    c.ellipse(cx + 2.5, 7, 1.8, 2, '#1c1a1f', { shape: 'flat', height: 6, emissive: true });
    c.polygon([[cx, 8], [cx - 1, 11], [cx + 1, 11]], '#1c1a1f', { shape: 'flat', height: 5, emissive: true });
    // Teeth hint.
    c.rect(cx - 3, 12, 6, 1, (0, Palette_1.shift)(bone, 0.08), { shape: 'flat', height: 5 });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Herbs & fungi (collectibles)
// ---------------------------------------------------------------------------
/** Moonwort: pale spirit-blue leaves around a stem, faint glow at the bud. */
function herbMoonwort() {
    const c = new PixelCanvas_1.PixelCanvas(16, 18);
    const cx = 8;
    const leaf = Palette_1.MATERIAL.spirit;
    c.groundShadow(cx, 15, 6, 2, 0.24);
    c.rect(cx - 1, 8, 2, 8, (0, Palette_1.shift)(Palette_1.MATERIAL.foliageDeep, 0.04), { shape: 'cylinder-y', height: 3, curve: 0.8 });
    const leaves = [[-5, 9, 4, 2.4], [4, 6, 4, 2.6], [3, 11, 3.5, 2], [-3, 6, 3.5, 2.2]];
    for (const [dx, cy, rx, ry] of leaves) {
        c.ellipse(cx + dx, cy, rx, ry, (0, Palette_1.shift)(leaf, dx * 0.01), { shape: 'dome', height: 5, curve: 0.85 });
    }
    // Luminous bud.
    c.circle(cx + 1, 5, 2, (0, Palette_1.shift)(leaf, 0.2), { shape: 'round', height: 6, emissive: true });
    c.circle(cx + 1, 5, 1, '#eafbff', { emissive: true });
    finish(c);
    return c;
}
/** Shadebloom: a violet flower with dark leaves and a glowing core. */
function herbShadebloom() {
    const c = new PixelCanvas_1.PixelCanvas(16, 18);
    const cx = 8;
    c.groundShadow(cx, 15, 6, 2, 0.24);
    c.rect(cx - 1, 8, 2, 8, Palette_1.MATERIAL.foliageDeep, { shape: 'cylinder-y', height: 3, curve: 0.8 });
    // Dark leaves low, petals up.
    c.ellipse(cx - 4, 11, 4, 2.2, Palette_1.MATERIAL.foliage, { shape: 'dome', height: 4, curve: 0.85 });
    c.ellipse(cx + 4, 11, 4, 2.2, Palette_1.MATERIAL.foliage, { shape: 'dome', height: 4, curve: 0.85 });
    const petals = [[-3, 5], [3, 5], [-2, 3], [2, 3], [0, 6]];
    for (const [dx, cy] of petals) {
        c.ellipse(cx + dx, cy, 2.4, 2.6, Palette_1.MATERIAL.voidPurple, { shape: 'dome', height: 6, curve: 0.9 });
    }
    c.circle(cx, 5, 1.6, Palette_1.MATERIAL.voidBright, { shape: 'round', height: 7, emissive: true });
    c.circle(cx, 5, 0.8, '#f4d9ff', { emissive: true });
    finish(c);
    return c;
}
/** Bog reed: a tall cattail with a brown seed spike. */
function herbBogReed() {
    const c = new PixelCanvas_1.PixelCanvas(18, 22);
    const cx = 9;
    const green = (0, Palette_1.shift)(Palette_1.MATERIAL.toxic, -0.04, -4);
    c.groundShadow(cx, 19, 6, 2, 0.24);
    // Blades.
    c.line(cx - 4, 19, cx - 6, 6, green, 2, { shape: 'cylinder-y', height: 3 });
    c.line(cx + 3, 19, cx + 6, 8, green, 2, { shape: 'cylinder-y', height: 3 });
    // Central stalk + cattail spike.
    c.rect(cx - 1, 6, 2, 13, (0, Palette_1.shift)(green, -0.04), { shape: 'cylinder-y', height: 4, curve: 0.85 });
    c.rect(cx - 1.5, 3, 3, 7, Palette_1.MATERIAL.bronze, { shape: 'cylinder-y', height: 6, curve: 0.95 });
    c.rect(cx - 1, 4, 1, 5, (0, Palette_1.shift)(Palette_1.MATERIAL.bronze, 0.12), { shape: 'flat', height: 7 });
    finish(c);
    return c;
}
/** Glowcap: a luminous teal mushroom, cap emissive so it reads as a light. */
function glowcap() {
    const c = new PixelCanvas_1.PixelCanvas(18, 18);
    const cx = 9;
    const glow = (0, Palette_1.mix)(Palette_1.MATERIAL.toxic, Palette_1.MATERIAL.spirit, 0.4);
    c.groundShadow(cx, 15, 7, 2.2, 0.24);
    // Faint pooled light on the ground beneath.
    c.ellipse(cx, 14, 7, 2.4, (0, Palette_1.shift)(glow, -0.1), { shape: 'flat', emissive: true, alpha: 0.35 });
    // Stem (lit, not shaded, since the cap illuminates it).
    c.rect(cx - 1.5, 8, 3, 7, (0, Palette_1.shift)(glow, 0.05), { shape: 'cylinder-y', height: 3, emissive: true, alpha: 0.85 });
    // Cap: emissive dome with a bright crown.
    c.ellipse(cx, 7, 7, 4, glow, { shape: 'dome', height: 6, emissive: true });
    c.ellipse(cx, 6, 4.5, 2.6, (0, Palette_1.shift)(glow, 0.18), { shape: 'dome', height: 7, emissive: true });
    c.ellipse(cx - 1, 5, 2, 1.2, '#dffff6', { shape: 'flat', emissive: true });
    // Under-gills darker.
    c.ellipse(cx, 9, 5, 1, (0, Palette_1.shift)(glow, -0.22), { shape: 'flat', height: 5, emissive: true, alpha: 0.7 });
    finish(c);
    return c;
}
/** Flower patch: a low spread of tiny multi-coloured blooms in grass. */
function flowerPatch() {
    const c = new PixelCanvas_1.PixelCanvas(26, 16);
    const cx = 13;
    c.groundShadow(cx, 13, 11, 2.6, 0.22);
    // Grass tuft base.
    c.ellipse(cx, 11, 11, 3, Palette_1.MATERIAL.grass, { shape: 'dome', height: 2, curve: 0.4 });
    const cols = ['#d8b25a', '#c77a9b', '#8fa8d8', '#e0c4ff'];
    const spots = [[-8, 9, 0], [-3, 7, 1], [2, 9, 2], [7, 8, 3], [0, 11, 0], [5, 11, 1]];
    for (const [dx, cy, ci] of spots) {
        const x = cx + dx;
        c.line(x, 12, x, cy + 1, (0, Palette_1.shift)(Palette_1.MATERIAL.grass, 0.06), 1, { height: 3 });
        c.circle(x, cy, 1.6, cols[ci], { shape: 'dome', height: 5, curve: 0.9 });
        c.rect(x, cy, 1, 1, (0, Palette_1.shift)(cols[ci], 0.2), { emissive: true, alpha: 0.7 });
    }
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Light sources & shrines
// ---------------------------------------------------------------------------
/** Base for both lantern states: iron cage on a hook post. */
function lanternBody(c, cx) {
    const iron = Palette_1.MATERIAL.iron;
    // Hook post.
    c.rect(cx - 1, 0, 2, 6, Palette_1.MATERIAL.steelDark, { shape: 'cylinder-y', height: 4, curve: 0.8 });
    c.rect(cx - 3, 4, 8, 2, iron, { shape: 'cylinder-x', height: 5, curve: 0.8 });
    // Cage top cap + frame.
    c.rect(cx - 4, 6, 10, 2, (0, Palette_1.shift)(iron, -0.04), { shape: 'dome', height: 7, curve: 0.7 });
    c.rect(cx - 1, 6, 2, 2, iron, { shape: 'flat', height: 8 });
    // Cage bars.
    c.rect(cx - 4, 8, 1, 9, (0, Palette_1.shift)(iron, -0.08), { shape: 'cylinder-y', height: 6 });
    c.rect(cx + 4, 8, 1, 9, (0, Palette_1.shift)(iron, -0.08), { shape: 'cylinder-y', height: 6 });
    c.rect(cx - 4, 16, 10, 2, iron, { shape: 'cylinder-x', height: 6, curve: 0.8 });
}
/** Unlit lantern: dark glass, no glow. */
function lanternOff() {
    const c = new PixelCanvas_1.PixelCanvas(16, 24);
    const cx = 7;
    c.groundShadow(cx, 20, 6, 2, 0.3);
    // Dead glass panel.
    c.rect(cx - 3, 8, 8, 8, (0, Palette_1.shift)(Palette_1.MATERIAL.slate, -0.06), { shape: 'round', height: 4, curve: 0.6 });
    lanternBody(c, cx);
    finish(c);
    return c;
}
/** Lit lantern: emissive flame + hot glass so it reads as a light emitter. */
function lanternOn() {
    const c = new PixelCanvas_1.PixelCanvas(16, 24);
    const cx = 7;
    c.groundShadow(cx, 20, 6, 2, 0.3);
    // Glow halo around the cage.
    c.ellipse(cx, 12, 9, 9, Palette_1.MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
    // Hot glass.
    c.rect(cx - 3, 8, 8, 8, (0, Palette_1.shift)(Palette_1.MATERIAL.flame, 0.06), { shape: 'round', height: 4, emissive: true, alpha: 0.9 });
    // Flame core.
    c.ellipse(cx + 1, 12, 2.4, 3.4, Palette_1.MATERIAL.emberCore, { shape: 'flat', emissive: true });
    c.ellipse(cx + 1, 12, 1.2, 2, '#fff0b0', { shape: 'flat', emissive: true });
    lanternBody(c, cx);
    finish(c);
    return c;
}
/** A stone altar with a glowing rune slab set into the top. */
function altar() {
    const c = new PixelCanvas_1.PixelCanvas(44, 36);
    const cx = 22;
    const stone = Palette_1.MATERIAL.granite;
    c.groundShadow(cx, 32, 20, 4, 0.38);
    // Base plinth (wider, receding) then the pillar body.
    c.rect(cx - 18, 22, 36, 10, (0, Palette_1.shift)(stone, -0.06, 6), { shape: 'cylinder-x', height: 6, curve: 0.7 });
    c.rect(cx - 14, 12, 28, 12, stone, { shape: 'cylinder-x', height: 9, curve: 0.75 });
    // Top slab.
    c.rect(cx - 15, 9, 30, 4, (0, Palette_1.shift)(stone, 0.08), { shape: 'bevel', height: 12, curve: 0.6 });
    c.ellipse(cx, 10, 13, 2.6, (0, Palette_1.shift)(stone, 0.12), { shape: 'flat', height: 12 });
    // Glowing void rune inset.
    c.rect(cx - 3, 10, 6, 9, (0, Palette_1.mix)(Palette_1.MATERIAL.voidPurple, '#1a1222', 0.3), { shape: 'flat', height: 11, shade: 0.7 });
    c.ellipse(cx, 13, 2.4, 4, Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true });
    c.ellipse(cx, 13, 1.2, 2.4, '#f0d0ff', { shape: 'flat', emissive: true });
    c.ellipse(cx, 13, 6, 7, Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.12 });
    finish(c);
    return c;
}
/** A lit brazier: iron bowl on legs, fire and coals glowing inside. */
function brazierLit() {
    const c = new PixelCanvas_1.PixelCanvas(26, 32);
    const cx = 13;
    const iron = Palette_1.MATERIAL.iron;
    c.groundShadow(cx, 29, 10, 3, 0.34);
    // Glow.
    c.ellipse(cx, 12, 12, 11, Palette_1.MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.14 });
    // Legs.
    c.line(cx - 6, 28, cx - 3, 18, iron, 2, { height: 4 });
    c.line(cx + 6, 28, cx + 3, 18, iron, 2, { height: 4 });
    c.line(cx, 29, cx, 18, (0, Palette_1.shift)(iron, -0.06), 2, { height: 4 });
    // Bowl (cylinder-x, open top).
    c.rect(cx - 8, 14, 16, 7, iron, { shape: 'cylinder-x', height: 8, curve: 0.85 });
    c.ellipse(cx, 14, 8, 2.6, (0, Palette_1.shift)(iron, -0.12), { shape: 'flat', height: 9, shade: 0.6 });
    // Coals + flames.
    c.ellipse(cx, 13, 6, 2, Palette_1.MATERIAL.ember, { shape: 'flat', emissive: true });
    c.ellipse(cx - 1, 10, 3, 4, Palette_1.MATERIAL.emberCore, { shape: 'cone', emissive: true });
    c.ellipse(cx + 2, 8, 2, 3.4, Palette_1.MATERIAL.flame, { shape: 'cone', emissive: true });
    c.ellipse(cx, 7, 1.2, 2.4, '#fff0b0', { shape: 'flat', emissive: true });
    finish(c);
    return c;
}
/** A cold brazier: same iron bowl, filled with grey ash, no fire. */
function brazierCold() {
    const c = new PixelCanvas_1.PixelCanvas(26, 32);
    const cx = 13;
    const iron = (0, Palette_1.shift)(Palette_1.MATERIAL.iron, -0.04);
    c.groundShadow(cx, 29, 10, 3, 0.34);
    c.line(cx - 6, 28, cx - 3, 18, iron, 2, { height: 4 });
    c.line(cx + 6, 28, cx + 3, 18, iron, 2, { height: 4 });
    c.line(cx, 29, cx, 18, (0, Palette_1.shift)(iron, -0.06), 2, { height: 4 });
    c.rect(cx - 8, 14, 16, 7, iron, { shape: 'cylinder-x', height: 8, curve: 0.85 });
    c.ellipse(cx, 14, 8, 2.6, (0, Palette_1.shift)(iron, -0.14), { shape: 'flat', height: 9, shade: 0.55 });
    // Cold ash.
    c.ellipse(cx, 13, 6, 2, (0, Palette_1.shift)(Palette_1.MATERIAL.ash, -0.04), { shape: 'dome', height: 6, curve: 0.5 });
    finish(c);
    return c;
}
/** A campfire: stacked logs with flames licking up, ring of stones. */
function campfire() {
    const c = new PixelCanvas_1.PixelCanvas(30, 24);
    const cx = 15;
    c.groundShadow(cx, 20, 13, 3.4, 0.3);
    // Glow pool.
    c.ellipse(cx, 15, 13, 8, Palette_1.MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
    // Ring stones.
    const ring = [[-11, 17], [-5, 19], [3, 19], [10, 17], [-9, 15], [11, 14]];
    for (const [dx, cy] of ring) {
        c.ellipse(cx + dx, cy, 3, 2, Palette_1.MATERIAL.stone, { shape: 'round', height: 4, curve: 0.9 });
    }
    // Crossed logs.
    c.line(cx - 6, 17, cx + 6, 13, Palette_1.MATERIAL.wood, 3, { shape: 'cylinder-y', height: 5 });
    c.line(cx - 5, 13, cx + 6, 17, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.05), 3, { shape: 'cylinder-y', height: 5 });
    // Charred tops.
    c.line(cx - 6, 17, cx + 6, 13, '#241d22', 1, { height: 6, shade: 0.6 });
    // Flames.
    c.ellipse(cx, 12, 4, 5, Palette_1.MATERIAL.ember, { shape: 'cone', emissive: true });
    c.ellipse(cx - 1, 9, 3, 5, Palette_1.MATERIAL.emberCore, { shape: 'cone', emissive: true });
    c.ellipse(cx + 2, 8, 2, 4, Palette_1.MATERIAL.flame, { shape: 'cone', emissive: true });
    c.ellipse(cx, 6, 1.4, 3, '#fff0b0', { shape: 'flat', emissive: true });
    finish(c);
    return c;
}
/** A wall torch: bracket holding a burning brand. Emissive flame. */
function torchWall() {
    const c = new PixelCanvas_1.PixelCanvas(16, 26);
    const cx = 8;
    const iron = Palette_1.MATERIAL.iron;
    // Glow.
    c.ellipse(cx + 1, 8, 8, 9, Palette_1.MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
    // Wall bracket.
    c.rect(cx - 5, 12, 3, 8, Palette_1.MATERIAL.steelDark, { shape: 'cylinder-y', height: 4, curve: 0.7 });
    c.line(cx - 4, 16, cx + 1, 13, iron, 2, { height: 5 });
    // Brand handle.
    c.rect(cx, 12, 2, 10, Palette_1.MATERIAL.wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
    // Wrapped head.
    c.ellipse(cx + 1, 11, 3, 3, Palette_1.MATERIAL.leatherDark, { shape: 'round', height: 6, curve: 0.9 });
    // Flame.
    c.ellipse(cx + 1, 8, 3, 4.5, Palette_1.MATERIAL.ember, { shape: 'cone', emissive: true });
    c.ellipse(cx, 6, 2.2, 4, Palette_1.MATERIAL.emberCore, { shape: 'cone', emissive: true });
    c.ellipse(cx + 1, 4, 1.4, 3, Palette_1.MATERIAL.flame, { shape: 'cone', emissive: true });
    c.ellipse(cx + 1, 3, 0.9, 1.8, '#fff0b0', { shape: 'flat', emissive: true });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Containers & camp
// ---------------------------------------------------------------------------
/** Ferryman cargo: a lashed bundle of crates/sacks under a tarp. */
function cargo() {
    const c = new PixelCanvas_1.PixelCanvas(26, 24);
    const cx = 13;
    c.groundShadow(cx, 21, 12, 3, 0.34);
    // Base crate.
    c.rect(cx - 10, 10, 20, 12, Palette_1.MATERIAL.wood, { shape: 'bevel', height: 7, curve: 0.5 });
    c.rect(cx - 10, 10, 20, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, 0.14), { shape: 'flat', height: 8 });
    // Sack on top.
    c.ellipse(cx + 2, 7, 6, 5, Palette_1.MATERIAL.thatch, { shape: 'round', height: 11, curve: 0.9 });
    // Rope lashing.
    c.rect(cx - 3, 10, 2, 12, (0, Palette_1.shift)(Palette_1.MATERIAL.rust, 0.02), { shape: 'cylinder-y', height: 8 });
    c.rect(cx - 10, 15, 20, 2, (0, Palette_1.shift)(Palette_1.MATERIAL.rust, -0.04), { shape: 'cylinder-x', height: 8, curve: 0.8 });
    // Cloth wrap on the corner + a pink ribbon (matches the old cargo accent).
    c.rect(cx + 4, 11, 5, 4, Palette_1.MATERIAL.clothCold, { shape: 'bevel', height: 8, curve: 0.5 });
    c.rect(cx + 5, 12, 2, 2, Palette_1.MATERIAL.cloth, { shape: 'flat', height: 9 });
    finish(c);
    return c;
}
/** Miner's tools: a pick crossed with a shovel leaning together. */
function minerTools() {
    const c = new PixelCanvas_1.PixelCanvas(24, 24);
    const cx = 12;
    c.groundShadow(cx, 21, 10, 3, 0.3);
    const handle = Palette_1.MATERIAL.woodPale;
    const metal = Palette_1.MATERIAL.steel;
    // Pick: handle bottom-left to top-right, head across the top.
    c.line(cx - 7, 21, cx + 4, 5, handle, 2, { shape: 'cylinder-y', height: 5 });
    c.polygon([[cx - 2, 4], [cx + 9, 7], [cx + 8, 9], [cx - 2, 7]], metal, { shape: 'cylinder-x', height: 8, curve: 0.8 });
    c.rect(cx - 3, 4, 3, 3, (0, Palette_1.shift)(metal, -0.1), { shape: 'bevel', height: 8, curve: 0.6 });
    // Shovel: handle bottom-right to top-left, blade at the base.
    c.line(cx + 7, 21, cx - 3, 6, (0, Palette_1.shift)(handle, -0.04), 2, { shape: 'cylinder-y', height: 4 });
    c.polygon([[cx + 4, 18], [cx + 10, 18], [cx + 9, 23], [cx + 5, 23]], metal, { shape: 'dome', height: 5, curve: 0.7 });
    finish(c);
    return c;
}
/** A wooden crate — bevelled box with plank seams and corner braces. */
function crate() {
    const c = new PixelCanvas_1.PixelCanvas(24, 24);
    const cx = 12;
    const wood = Palette_1.MATERIAL.woodPale;
    c.groundShadow(cx, 21, 11, 3, 0.34);
    // Body as a bevel so edges catch light like a box.
    c.rect(cx - 9, 5, 18, 17, wood, { shape: 'bevel', height: 8, curve: 0.5 });
    // Top face lighter (we see a sliver of the lid).
    c.rect(cx - 9, 5, 18, 3, (0, Palette_1.shift)(wood, 0.12), { shape: 'flat', height: 9 });
    // Plank seams.
    c.rect(cx - 9, 12, 18, 1, (0, Palette_1.shift)(wood, -0.16), { shape: 'flat', height: 8, shade: 0.8 });
    c.rect(cx - 1, 8, 1, 14, (0, Palette_1.shift)(wood, -0.14), { shape: 'flat', height: 8, shade: 0.8 });
    // Diagonal brace.
    c.line(cx - 8, 20, cx + 8, 9, (0, Palette_1.shift)(wood, -0.1), 1, { height: 9, shade: 0.85 });
    // Iron corner brackets.
    for (const dx of [-9, 8]) {
        c.rect(cx + dx, 5, 1, 3, Palette_1.MATERIAL.iron, { shape: 'flat', height: 9 });
        c.rect(cx + dx, 19, 1, 3, Palette_1.MATERIAL.iron, { shape: 'flat', height: 9 });
    }
    finish(c);
    return c;
}
/** A barrel — a bulged cylinder with hoop bands and a domed top. */
function barrel() {
    const c = new PixelCanvas_1.PixelCanvas(22, 26);
    const cx = 11;
    const wood = Palette_1.MATERIAL.wood;
    c.groundShadow(cx, 23, 9, 3, 0.34);
    // Staves: cylinder-y body, slightly barrel-shaped by stacking two widths.
    c.rect(cx - 8, 8, 16, 15, wood, { shape: 'cylinder-y', height: 7, curve: 1 });
    c.rect(cx - 9, 12, 18, 7, (0, Palette_1.shift)(wood, -0.02), { shape: 'cylinder-y', height: 8, curve: 1 });
    // Top lid.
    c.ellipse(cx, 8, 8, 3, (0, Palette_1.shift)(wood, 0.08), { shape: 'dome', height: 9, curve: 0.6 });
    c.ellipse(cx, 8, 5, 1.8, (0, Palette_1.shift)(wood, -0.06), { shape: 'flat', height: 9 });
    // Iron hoops.
    c.rect(cx - 9, 11, 18, 1.5, Palette_1.MATERIAL.iron, { shape: 'cylinder-x', height: 9, curve: 0.9 });
    c.rect(cx - 8, 19, 16, 1.5, Palette_1.MATERIAL.iron, { shape: 'cylinder-x', height: 8, curve: 0.9 });
    // Stave seams.
    c.rect(cx - 1, 9, 1, 14, (0, Palette_1.shift)(wood, -0.14), { shape: 'flat', height: 8, shade: 0.8 });
    c.rect(cx + 4, 10, 1, 12, (0, Palette_1.shift)(wood, -0.1), { shape: 'flat', height: 8, shade: 0.85 });
    finish(c);
    return c;
}
/** A slumped burlap sack, cinched at the neck. */
function sack() {
    const c = new PixelCanvas_1.PixelCanvas(20, 22);
    const cx = 10;
    const cloth = Palette_1.MATERIAL.thatch;
    c.groundShadow(cx, 19, 9, 3, 0.32);
    // Bulging body.
    c.ellipse(cx, 14, 8, 6, cloth, { shape: 'round', height: 6, curve: 1 });
    c.ellipse(cx - 2, 12, 4, 3.5, (0, Palette_1.shift)(cloth, 0.12), { shape: 'dome', height: 7, curve: 0.9 });
    // Cinched neck + gathered top.
    c.rect(cx - 2, 6, 4, 4, (0, Palette_1.shift)(cloth, -0.08), { shape: 'cylinder-y', height: 7, curve: 0.8 });
    c.rect(cx - 3, 8, 6, 1.5, (0, Palette_1.shift)(Palette_1.MATERIAL.leatherDark, 0.04), { shape: 'cylinder-x', height: 8, curve: 0.8 });
    c.ellipse(cx, 5, 3, 2, cloth, { shape: 'dome', height: 8, curve: 0.9 });
    // Fold shadows.
    c.line(cx - 3, 12, cx - 2, 18, (0, Palette_1.shift)(cloth, -0.14), 1, { height: 6, shade: 0.8 });
    c.line(cx + 3, 12, cx + 2, 18, (0, Palette_1.shift)(cloth, -0.12), 1, { height: 6, shade: 0.8 });
    finish(c);
    return c;
}
/** A hay bale — a round bound bale with straw texture. */
function hayBale() {
    const c = new PixelCanvas_1.PixelCanvas(28, 22);
    const cx = 14;
    const straw = Palette_1.MATERIAL.thatch;
    c.groundShadow(cx, 19, 13, 3.4, 0.34);
    // Cylinder lying on its side (cylinder-x).
    c.rect(cx - 12, 7, 24, 13, straw, { shape: 'cylinder-x', height: 7, curve: 0.95 });
    // Round end cap.
    c.ellipse(cx - 11, 13, 3.5, 6.5, (0, Palette_1.shift)(straw, -0.06), { shape: 'round', height: 8, curve: 0.9 });
    c.ellipse(cx - 11, 13, 2, 4, (0, Palette_1.shift)(straw, 0.06), { shape: 'flat', height: 9 });
    // Straw striations.
    for (let i = 0; i < 5; i += 1) {
        const y = 9 + i * 2.4;
        c.line(cx - 8, y, cx + 11, y, (0, Palette_1.shift)(straw, i % 2 ? -0.08 : 0.06), 1, { height: 7, shade: 0.9 });
    }
    // Binding twine.
    c.rect(cx - 2, 7, 1.5, 13, (0, Palette_1.shift)(Palette_1.MATERIAL.rust, 0.04), { shape: 'cylinder-y', height: 8 });
    c.rect(cx + 6, 7, 1.5, 13, (0, Palette_1.shift)(Palette_1.MATERIAL.rust, 0.02), { shape: 'cylinder-y', height: 8 });
    finish(c);
    return c;
}
/** A canvas tent: triangular ridge tent with a dark doorway. */
function tent() {
    const c = new PixelCanvas_1.PixelCanvas(40, 30);
    const cx = 20;
    const canvasCol = (0, Palette_1.shift)(Palette_1.MATERIAL.thatch, 0.02, 6);
    c.groundShadow(cx, 27, 18, 3.6, 0.36);
    // Main triangular body.
    c.polygon([[cx, 4], [cx - 16, 26], [cx + 16, 26]], canvasCol, { shape: 'cylinder-y', height: 8, curve: 0.9 });
    // Lit left slope / shadowed right slope.
    c.polygon([[cx, 4], [cx - 16, 26], [cx - 2, 26]], (0, Palette_1.shift)(canvasCol, 0.1), { shape: 'flat', height: 9 });
    c.polygon([[cx, 4], [cx + 4, 26], [cx + 16, 26]], (0, Palette_1.shift)(canvasCol, -0.12, 6), { shape: 'flat', height: 8 });
    // Ridge pole line.
    c.line(cx, 4, cx, 26, (0, Palette_1.shift)(canvasCol, -0.06), 1, { height: 10 });
    // Dark entrance flap.
    c.polygon([[cx, 12], [cx - 5, 26], [cx + 5, 26]], '#1a1720', { shape: 'flat', height: 9, emissive: true });
    c.polygon([[cx, 12], [cx - 5, 26], [cx - 1, 26]], (0, Palette_1.shift)(canvasCol, -0.14), { shape: 'flat', height: 9 });
    // Guy line + peg.
    c.line(cx + 16, 26, cx + 20, 28, Palette_1.MATERIAL.rust, 1, { height: 2 });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------
/** Closed chest — domed lid, iron bands, big lock plate. */
function chestClosed() {
    const c = new PixelCanvas_1.PixelCanvas(30, 24);
    const cx = 15;
    const wood = Palette_1.MATERIAL.wood;
    c.groundShadow(cx, 21, 14, 3.2, 0.36);
    // Body box.
    c.rect(cx - 12, 12, 24, 10, wood, { shape: 'bevel', height: 7, curve: 0.5 });
    // Domed lid as a strong cylinder-x arch — high curve so it reads as barrel-topped.
    c.rect(cx - 12, 4, 24, 8, (0, Palette_1.shift)(wood, 0.06), { shape: 'cylinder-x', height: 11, curve: 1 });
    // Lit crown of the dome and a shadow at the lid/body seam sell the curvature.
    c.rect(cx - 11, 4, 22, 2, (0, Palette_1.shift)(wood, 0.18), { shape: 'flat', height: 13 });
    c.rect(cx - 12, 11, 24, 1, (0, Palette_1.shift)(wood, -0.2), { shape: 'flat', height: 8, shade: 0.7 });
    // Iron bands over lid and body — brighter iron + a dark edge so they pop.
    for (const dx of [-9, 7]) {
        c.rect(cx + dx, 4, 2.5, 18, Palette_1.MATERIAL.iron, { shape: 'cylinder-y', height: 12, curve: 0.85 });
        c.rect(cx + dx, 4, 1, 18, (0, Palette_1.shift)(Palette_1.MATERIAL.iron, 0.16), { shape: 'flat', height: 13 });
    }
    c.rect(cx - 12, 12, 24, 2, (0, Palette_1.shift)(Palette_1.MATERIAL.iron, -0.04), { shape: 'flat', height: 12 });
    // Lock plate.
    c.rect(cx - 2, 11, 4, 5, Palette_1.MATERIAL.gold, { shape: 'bevel', height: 13, curve: 0.7 });
    c.rect(cx - 1, 13, 2, 2, (0, Palette_1.shift)(Palette_1.MATERIAL.gold, -0.26), { shape: 'flat', height: 13 });
    finish(c);
    return c;
}
/** Open chest — lid tilted back, glowing loot spilling light from inside. */
function chestOpen() {
    const c = new PixelCanvas_1.PixelCanvas(30, 28);
    const cx = 15;
    const wood = Palette_1.MATERIAL.wood;
    c.groundShadow(cx, 25, 14, 3.2, 0.36);
    // Body box.
    c.rect(cx - 12, 14, 24, 11, wood, { shape: 'bevel', height: 7, curve: 0.5 });
    // Open interior — dark, with warm loot glow.
    c.rect(cx - 10, 11, 20, 5, '#1c1620', { shape: 'flat', height: 8, emissive: true });
    c.ellipse(cx, 13, 9, 3, Palette_1.MATERIAL.gold, { shape: 'flat', emissive: true, alpha: 0.9 });
    c.ellipse(cx, 13, 5, 2, '#ffe9a8', { shape: 'flat', emissive: true });
    // Loot glints.
    c.rect(cx - 4, 12, 1, 1, '#fff6d8', { emissive: true });
    c.rect(cx + 3, 13, 1, 1, '#fff6d8', { emissive: true });
    // Tilted-back lid above.
    c.rect(cx - 12, 3, 24, 6, (0, Palette_1.shift)(wood, -0.04), { shape: 'cylinder-x', height: 12, curve: 0.95 });
    c.rect(cx - 12, 8, 24, 1.5, (0, Palette_1.shift)(Palette_1.MATERIAL.iron, -0.06), { shape: 'flat', height: 12 });
    for (const dx of [-8, 8]) {
        c.rect(cx + dx, 3, 2, 6, Palette_1.MATERIAL.iron, { shape: 'cylinder-y', height: 13, curve: 0.8 });
    }
    finish(c);
    return c;
}
/** A glowing void doorway — a stone frame around a shimmering purple portal. */
function doorGlow() {
    const c = new PixelCanvas_1.PixelCanvas(24, 32);
    const cx = 12;
    const stone = Palette_1.MATERIAL.stoneDark;
    c.groundShadow(cx, 29, 11, 3, 0.34);
    // Portal fill (emissive gradient feel via stacked ellipses).
    c.rect(cx - 6, 4, 12, 24, (0, Palette_1.mix)(Palette_1.MATERIAL.voidPurple, '#140a1e', 0.2), { shape: 'flat', height: 3, emissive: true });
    c.ellipse(cx, 16, 5, 11, Palette_1.MATERIAL.voidPurple, { shape: 'flat', emissive: true, alpha: 0.7 });
    c.ellipse(cx, 16, 3, 8, Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.6 });
    c.ellipse(cx, 14, 1.5, 5, '#f0d0ff', { shape: 'flat', emissive: true, alpha: 0.7 });
    // Stone frame: two jambs + a lintel, bevelled.
    c.rect(cx - 9, 2, 4, 27, stone, { shape: 'bevel', height: 8, curve: 0.6 });
    c.rect(cx + 5, 2, 4, 27, (0, Palette_1.shift)(stone, -0.06), { shape: 'bevel', height: 8, curve: 0.6 });
    c.rect(cx - 9, 0, 18, 5, (0, Palette_1.shift)(stone, 0.04), { shape: 'cylinder-x', height: 9, curve: 0.7 });
    // Rune marks on the lintel.
    c.rect(cx - 4, 2, 1, 1, Palette_1.MATERIAL.voidBright, { emissive: true });
    c.rect(cx + 3, 2, 1, 1, Palette_1.MATERIAL.voidBright, { emissive: true });
    finish(c);
    return c;
}
/** The mine lift: a timber cage on rails with a crank wheel. */
function mineLift() {
    const c = new PixelCanvas_1.PixelCanvas(42, 44);
    const cx = 21;
    const wood = Palette_1.MATERIAL.wood;
    const iron = Palette_1.MATERIAL.iron;
    c.groundShadow(cx, 40, 18, 4, 0.38);
    // Back panel / cage interior (dark).
    c.rect(cx - 15, 8, 30, 30, '#1b1620', { shape: 'flat', height: 3, emissive: true });
    // Four corner posts.
    for (const dx of [-15, 12]) {
        c.rect(cx + dx, 5, 3, 33, wood, { shape: 'cylinder-y', height: 9, curve: 0.9 });
    }
    // Top beam + roof.
    c.rect(cx - 17, 3, 34, 4, (0, Palette_1.shift)(wood, 0.04), { shape: 'cylinder-x', height: 11, curve: 0.8 });
    // Cross-braces (X on the back).
    c.line(cx - 13, 10, cx + 13, 34, (0, Palette_1.shift)(wood, -0.06), 2, { height: 5 });
    c.line(cx + 13, 10, cx - 13, 34, (0, Palette_1.shift)(wood, -0.06), 2, { height: 5 });
    // Horizontal rails.
    c.rect(cx - 13, 20, 26, 2, (0, Palette_1.shift)(iron, -0.04), { shape: 'cylinder-x', height: 6, curve: 0.8 });
    c.rect(cx - 13, 33, 26, 3, iron, { shape: 'cylinder-x', height: 6, curve: 0.8 });
    // Crank wheel on the side.
    c.circle(cx + 15, 16, 5, iron, { shape: 'round', height: 8, curve: 0.9 });
    c.circle(cx + 15, 16, 2.5, '#1b1620', { shape: 'flat', height: 9, emissive: true });
    c.rect(cx + 14, 12, 2, 8, (0, Palette_1.shift)(iron, 0.08), { shape: 'cylinder-y', height: 9 });
    finish(c);
    return c;
}
/** A stone well with a wooden roof and a bucket on a rope. */
function well() {
    const c = new PixelCanvas_1.PixelCanvas(32, 34);
    const cx = 16;
    const stone = Palette_1.MATERIAL.granite;
    c.groundShadow(cx, 31, 15, 3.6, 0.36);
    // Stone rim (cylinder-x drum).
    c.rect(cx - 11, 20, 22, 11, stone, { shape: 'cylinder-x', height: 6, curve: 0.85 });
    // Dark water hole at the top.
    c.ellipse(cx, 20, 10, 3.4, '#12161e', { shape: 'flat', height: 7, emissive: true });
    c.ellipse(cx, 21, 6, 2, (0, Palette_1.mix)(Palette_1.MATERIAL.water, '#0e1420', 0.4), { shape: 'flat', emissive: true, alpha: 0.7 });
    // Stone courses.
    c.rect(cx - 11, 25, 22, 1, (0, Palette_1.shift)(stone, -0.16), { shape: 'flat', height: 7, shade: 0.8 });
    // Roof posts.
    c.rect(cx - 9, 4, 2, 17, Palette_1.MATERIAL.wood, { shape: 'cylinder-y', height: 8, curve: 0.9 });
    c.rect(cx + 7, 4, 2, 17, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 8, curve: 0.9 });
    // Peaked roof (two slopes).
    c.polygon([[cx, 0], [cx - 12, 8], [cx - 8, 8]], Palette_1.MATERIAL.thatch, { shape: 'flat', height: 11 });
    c.polygon([[cx, 0], [cx + 12, 8], [cx + 8, 8]], (0, Palette_1.shift)(Palette_1.MATERIAL.thatch, -0.12, 6), { shape: 'flat', height: 11 });
    c.polygon([[cx, 0], [cx - 12, 8], [cx + 12, 8]], Palette_1.MATERIAL.thatch, { shape: 'cone', height: 10, curve: 0.6, alpha: 0.001 });
    c.rect(cx - 12, 7, 24, 2, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, 0.02), { shape: 'cylinder-x', height: 9, curve: 0.7 });
    // Bucket hanging under the roof.
    c.line(cx, 9, cx, 15, Palette_1.MATERIAL.rust, 1, { height: 6 });
    c.rect(cx - 2, 15, 4, 4, Palette_1.MATERIAL.woodPale, { shape: 'cylinder-y', height: 7, curve: 0.8 });
    finish(c);
    return c;
}
/** A hand cart: a wooden bed on a big spoked wheel with handles. */
function cart() {
    const c = new PixelCanvas_1.PixelCanvas(38, 26);
    const cx = 19;
    const wood = Palette_1.MATERIAL.wood;
    c.groundShadow(cx, 23, 17, 3.2, 0.34);
    // Big wheel.
    c.circle(9, 16, 7, Palette_1.MATERIAL.iron, { shape: 'round', height: 5, curve: 0.9 });
    c.circle(9, 16, 5, (0, Palette_1.shift)(wood, -0.04), { shape: 'round', height: 4, curve: 0.9 });
    c.circle(9, 16, 1.6, Palette_1.MATERIAL.iron, { shape: 'flat', height: 6 });
    // Spokes.
    for (let a = 0; a < 4; a += 1) {
        const ang = (a / 4) * Math.PI;
        c.line(9 - Math.cos(ang) * 5, 16 - Math.sin(ang) * 5, 9 + Math.cos(ang) * 5, 16 + Math.sin(ang) * 5, (0, Palette_1.shift)(wood, 0.08), 1, { height: 5 });
    }
    // Cart bed, tilted, with plank seams.
    c.polygon([[cx - 6, 6], [cx + 14, 8], [cx + 13, 15], [cx - 7, 13]], wood, { shape: 'bevel', height: 8, curve: 0.5 });
    c.line(cx - 6, 9, cx + 13, 11, (0, Palette_1.shift)(wood, -0.14), 1, { height: 9, shade: 0.8 });
    c.line(cx - 5, 6, cx + 13, 8, (0, Palette_1.shift)(wood, 0.12), 1, { height: 9 });
    // Handle shafts extending to the right.
    c.line(cx + 13, 10, cx + 19, 12, (0, Palette_1.shift)(wood, -0.02), 2, { shape: 'cylinder-y', height: 7 });
    c.line(cx + 13, 13, cx + 18, 15, (0, Palette_1.shift)(wood, -0.04), 2, { shape: 'cylinder-y', height: 7 });
    finish(c);
    return c;
}
/** A leaning fence post with a broken rail stub. */
function fencePost() {
    const c = new PixelCanvas_1.PixelCanvas(14, 28);
    const cx = 7;
    const wood = (0, Palette_1.shift)(Palette_1.MATERIAL.wood, 0.02, 8);
    c.groundShadow(cx, 25, 6, 2.4, 0.3);
    // Post, slightly leaning.
    c.polygon([[cx - 2, 25], [cx + 2, 25], [cx + 3, 4], [cx - 1, 4]], wood, { shape: 'cylinder-y', height: 6, curve: 0.9 });
    // Split top.
    c.polygon([[cx - 1, 4], [cx + 3, 4], [cx + 1, 1]], (0, Palette_1.shift)(wood, 0.08), { shape: 'cone', height: 7, curve: 0.7 });
    // Rail stub.
    c.rect(cx + 1, 12, 6, 3, (0, Palette_1.shift)(wood, -0.04), { shape: 'cylinder-x', height: 7, curve: 0.8 });
    // Grain lines.
    c.line(cx, 6, cx + 1, 24, (0, Palette_1.shift)(wood, -0.14), 1, { height: 6, shade: 0.85 });
    finish(c);
    return c;
}
/** A hanging banner on a crossbar — dark cloth with a void sigil. */
function banner() {
    const c = new PixelCanvas_1.PixelCanvas(20, 34);
    const cx = 10;
    const cloth = Palette_1.MATERIAL.cloth;
    c.groundShadow(cx, 31, 6, 2, 0.28);
    // Pole + crossbar.
    c.rect(cx - 1, 2, 2, 30, Palette_1.MATERIAL.wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
    c.rect(cx - 6, 4, 13, 2, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.04), { shape: 'cylinder-x', height: 6, curve: 0.8 });
    // Cloth hanging, with a swallowtail bottom.
    c.polygon([
        [cx - 5, 6], [cx + 6, 6], [cx + 6, 24], [cx + 3, 21], [cx + 0.5, 25], [cx - 2, 21], [cx - 5, 24],
    ], cloth, { shape: 'cylinder-y', height: 4, curve: 0.85 });
    // Lit left fold / shadow right.
    c.rect(cx - 5, 7, 3, 16, (0, Palette_1.shift)(cloth, 0.1), { shape: 'flat', height: 5 });
    c.rect(cx + 3, 7, 3, 15, (0, Palette_1.shift)(cloth, -0.12, 6), { shape: 'flat', height: 4 });
    // Void sigil.
    c.circle(cx, 13, 3, Palette_1.MATERIAL.voidPurple, { shape: 'flat', height: 5 });
    c.circle(cx, 13, 1.4, Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true });
    finish(c);
    return c;
}
/** A wooden signpost with an arrow board. */
function signpost() {
    const c = new PixelCanvas_1.PixelCanvas(24, 30);
    const cx = 9;
    const wood = Palette_1.MATERIAL.woodPale;
    c.groundShadow(cx, 27, 6, 2.2, 0.3);
    // Post.
    c.rect(cx - 1.5, 6, 3, 21, wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
    // Arrow board pointing right.
    c.polygon([[cx - 2, 8], [cx + 12, 8], [cx + 17, 12], [cx + 12, 16], [cx - 2, 16]], (0, Palette_1.shift)(wood, 0.02, 6), { shape: 'bevel', height: 7, curve: 0.5 });
    // Board plank line + a couple of carved marks.
    c.line(cx - 1, 12, cx + 13, 12, (0, Palette_1.shift)(wood, -0.14), 1, { height: 8, shade: 0.85 });
    c.rect(cx + 2, 10, 6, 1, (0, Palette_1.shift)(wood, -0.2), { shape: 'flat', height: 8, shade: 0.7 });
    c.rect(cx + 2, 13, 4, 1, (0, Palette_1.shift)(wood, -0.2), { shape: 'flat', height: 8, shade: 0.7 });
    finish(c);
    return c;
}
/** A single bridge plank segment with rope rails — tiles along a span. */
function bridgePlank() {
    const c = new PixelCanvas_1.PixelCanvas(30, 20);
    const cx = 15;
    const wood = Palette_1.MATERIAL.wood;
    c.groundShadow(cx, 16, 14, 3, 0.28);
    // Planks laid across (several short cylinders side by side).
    for (let i = 0; i < 5; i += 1) {
        const x = cx - 12 + i * 5;
        c.rect(x, 6, 4, 10, (0, Palette_1.shift)(wood, i % 2 ? -0.05 : 0.03, 4), { shape: 'cylinder-y', height: 4, curve: 0.85 });
    }
    // Side stringers.
    c.rect(cx - 13, 6, 26, 1.5, (0, Palette_1.shift)(wood, -0.14), { shape: 'flat', height: 5, shade: 0.85 });
    c.rect(cx - 13, 14, 26, 1.5, (0, Palette_1.shift)(wood, -0.16), { shape: 'flat', height: 5, shade: 0.85 });
    // Rope rail posts + line.
    c.rect(cx - 12, 2, 2, 5, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 7 });
    c.rect(cx + 10, 2, 2, 5, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 7 });
    c.line(cx - 11, 3, cx + 11, 3, Palette_1.MATERIAL.rust, 1, { height: 8 });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Monuments
// ---------------------------------------------------------------------------
/** A weathered stone statue of a hooded figure on a plinth. */
function statue() {
    const c = new PixelCanvas_1.PixelCanvas(28, 46);
    const cx = 14;
    const stone = (0, Palette_1.shift)(Palette_1.MATERIAL.granite, 0.02, 4);
    c.groundShadow(cx, 42, 13, 3.6, 0.38);
    // Plinth.
    c.rect(cx - 10, 36, 20, 7, (0, Palette_1.shift)(stone, -0.06, 6), { shape: 'bevel', height: 5, curve: 0.5 });
    c.rect(cx - 8, 33, 16, 4, stone, { shape: 'cylinder-x', height: 7, curve: 0.6 });
    // Robed body: a tapering cloak (wide base, narrow shoulders).
    c.polygon([[cx - 8, 33], [cx + 8, 33], [cx + 5, 14], [cx - 5, 14]], stone, { shape: 'cylinder-y', height: 10, curve: 0.9 });
    // Fold shadows down the robe.
    c.line(cx - 2, 15, cx - 4, 32, (0, Palette_1.shift)(stone, -0.14), 1, { height: 11, shade: 0.85 });
    c.line(cx + 2, 15, cx + 3, 32, (0, Palette_1.shift)(stone, -0.12), 1, { height: 11, shade: 0.85 });
    // Cowl shoulders + hooded head (empty dark hood face).
    c.ellipse(cx, 12, 7, 5, stone, { shape: 'dome', height: 13, curve: 0.9 });
    c.ellipse(cx, 8, 5, 5.5, (0, Palette_1.shift)(stone, 0.02), { shape: 'dome', height: 15, curve: 0.95 });
    c.ellipse(cx, 9, 3, 3.5, '#1b1a20', { shape: 'flat', height: 15, emissive: true });
    // Lit crown edge, weathered.
    c.ellipse(cx - 1, 5, 3, 2, (0, Palette_1.shift)(stone, 0.14), { shape: 'dome', height: 16, curve: 0.8 });
    // A crack down the plinth for age.
    c.line(cx + 3, 34, cx + 5, 42, (0, Palette_1.shift)(stone, -0.24), 1, { height: 5, shade: 0.7 });
    finish(c);
    return c;
}
/** A tall carved obelisk with glowing runes down its face. */
function obelisk() {
    const c = new PixelCanvas_1.PixelCanvas(22, 50);
    const cx = 11;
    const stone = Palette_1.MATERIAL.slate;
    c.groundShadow(cx, 46, 11, 3.4, 0.38);
    // Base.
    c.rect(cx - 8, 40, 16, 6, (0, Palette_1.shift)(stone, -0.06, 6), { shape: 'bevel', height: 5, curve: 0.5 });
    // Tapering shaft (four-sided, so we show a lit front face + darker side).
    c.polygon([[cx - 6, 42], [cx + 6, 42], [cx + 3, 6], [cx - 3, 6]], stone, { shape: 'cylinder-y', height: 9, curve: 0.7 });
    // Right side plane, darker (implies the corner).
    c.polygon([[cx + 2, 42], [cx + 6, 42], [cx + 3, 6], [cx + 1, 6]], (0, Palette_1.shift)(stone, -0.14, 6), { shape: 'flat', height: 8 });
    // Pyramidal cap.
    c.polygon([[cx - 3, 6], [cx + 3, 6], [cx, 0]], (0, Palette_1.shift)(stone, 0.04), { shape: 'cone', height: 11, curve: 0.9 });
    // Glowing runes running up the face.
    for (let i = 0; i < 4; i += 1) {
        const y = 34 - i * 8;
        c.rect(cx - 1.5, y, 3, 3, (0, Palette_1.mix)(Palette_1.MATERIAL.spirit, '#1a2030', 0.2), { shape: 'flat', height: 10, emissive: true, alpha: 0.85 });
        c.rect(cx - 0.5, y + 1, 1, 1, '#dfeaff', { emissive: true });
    }
    finish(c);
    return c;
}
/** A crypt entrance: a stone arch over a pitch-dark descending doorway. */
function cryptEntrance() {
    const c = new PixelCanvas_1.PixelCanvas(40, 34);
    const cx = 20;
    const stone = Palette_1.MATERIAL.stoneDark;
    c.groundShadow(cx, 31, 19, 3.6, 0.38);
    // Mound / façade behind.
    c.ellipse(cx, 20, 19, 13, (0, Palette_1.shift)(stone, -0.04, 4), { shape: 'dome', height: 8, curve: 0.85 });
    // Dark doorway (arched).
    c.rect(cx - 7, 14, 14, 18, '#0e0c12', { shape: 'flat', height: 3, emissive: true });
    c.ellipse(cx, 14, 7, 5, '#0e0c12', { shape: 'flat', height: 3, emissive: true });
    // Stone arch voussoirs framing it.
    c.rect(cx - 10, 12, 3, 20, stone, { shape: 'bevel', height: 9, curve: 0.6 });
    c.rect(cx + 7, 12, 3, 20, (0, Palette_1.shift)(stone, -0.06), { shape: 'bevel', height: 9, curve: 0.6 });
    // Keystone arch across the top.
    for (let i = 0; i < 7; i += 1) {
        const ang = Math.PI * (0.15 + (i / 6) * 0.7);
        const bx = cx - Math.cos(ang) * 10;
        const by = 14 - Math.sin(ang) * 7;
        c.rect(bx - 1.5, by - 1.5, 3.5, 3.5, (0, Palette_1.shift)(stone, i === 3 ? 0.1 : 0), { shape: 'bevel', height: 10, curve: 0.6 });
    }
    // A skull set above the keystone.
    c.ellipse(cx, 6, 2.6, 2.4, Palette_1.MATERIAL.boneOld, { shape: 'round', height: 11, curve: 0.9 });
    c.rect(cx - 1, 6, 1, 1, '#1c1a1f', { emissive: true });
    c.rect(cx + 0.5, 6, 1, 1, '#1c1a1f', { emissive: true });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Forge & mine
// ---------------------------------------------------------------------------
/** An anvil on a stump base — classic horned silhouette. */
function anvil() {
    const c = new PixelCanvas_1.PixelCanvas(32, 28);
    const cx = 15;
    const iron = Palette_1.MATERIAL.steelDark;
    c.groundShadow(cx, 25, 13, 3.2, 0.36);
    // Wooden stump base, wider at the foot.
    c.rect(cx - 6, 19, 13, 6, Palette_1.MATERIAL.wood, { shape: 'cylinder-y', height: 4, curve: 0.85 });
    c.rect(cx - 4, 16, 9, 4, (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 5, curve: 0.85 });
    // Narrow iron waist under the body.
    c.rect(cx - 3, 12, 7, 5, iron, { shape: 'cylinder-y', height: 7, curve: 0.85 });
    // Splayed foot flaring out from the waist for a stable stance.
    c.polygon([[cx - 6, 16], [cx + 7, 16], [cx + 4, 12], [cx - 3, 12]], (0, Palette_1.shift)(iron, -0.04), { shape: 'bevel', height: 7, curve: 0.6 });
    // Main body: a chunky block. The top face sits proud of it.
    c.rect(cx - 6, 7, 15, 5, iron, { shape: 'cylinder-x', height: 10, curve: 0.7 });
    // The pointed horn tapering left off the body.
    c.polygon([[cx - 6, 7], [cx - 14, 8.5], [cx - 6, 11]], (0, Palette_1.shift)(iron, 0.02), { shape: 'cone', height: 10, curve: 0.85 });
    // Squared heel/step on the right.
    c.rect(cx + 8, 8, 3, 4, (0, Palette_1.shift)(iron, -0.06), { shape: 'bevel', height: 10, curve: 0.6 });
    // Flat polished top face — a bright plane is the strongest anvil read.
    c.rect(cx - 7, 6, 17, 2, Palette_1.MATERIAL.steel, { shape: 'flat', height: 12 });
    c.rect(cx - 7, 6, 17, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.steel, 0.12), { shape: 'flat', height: 12 });
    // Shadow line where the face overhangs the waist.
    c.rect(cx - 5, 11, 12, 1, (0, Palette_1.shift)(iron, -0.18), { shape: 'flat', height: 8, shade: 0.7 });
    finish(c);
    return c;
}
/** A forge fire: a stone hearth with roaring emissive flames and a chimney hood. */
function forgeFire() {
    const c = new PixelCanvas_1.PixelCanvas(34, 32);
    const cx = 17;
    const stone = Palette_1.MATERIAL.stoneDark;
    c.groundShadow(cx, 29, 16, 3.4, 0.36);
    // Glow.
    c.ellipse(cx, 18, 15, 12, Palette_1.MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
    // Stone hearth box.
    c.rect(cx - 13, 16, 26, 12, stone, { shape: 'bevel', height: 7, curve: 0.55 });
    c.rect(cx - 13, 16, 26, 1.5, (0, Palette_1.shift)(stone, 0.12), { shape: 'flat', height: 8 });
    // Fire cavity (dark then hot).
    c.rect(cx - 8, 14, 16, 10, '#1a0f10', { shape: 'flat', height: 4, emissive: true });
    // Coal bed.
    c.ellipse(cx, 20, 8, 3, Palette_1.MATERIAL.ember, { shape: 'flat', emissive: true });
    c.ellipse(cx, 20, 5, 2, Palette_1.MATERIAL.emberCore, { shape: 'flat', emissive: true });
    // Flames.
    c.ellipse(cx - 3, 15, 3, 6, Palette_1.MATERIAL.ember, { shape: 'cone', emissive: true });
    c.ellipse(cx + 2, 14, 3.5, 7, Palette_1.MATERIAL.emberCore, { shape: 'cone', emissive: true });
    c.ellipse(cx, 11, 2.4, 6, Palette_1.MATERIAL.flame, { shape: 'cone', emissive: true });
    c.ellipse(cx + 1, 9, 1.4, 4, '#fff0b0', { shape: 'flat', emissive: true });
    // Chimney hood above.
    c.polygon([[cx - 11, 8], [cx + 11, 8], [cx + 6, 0], [cx - 6, 0]], (0, Palette_1.shift)(stone, -0.04, 6), { shape: 'cylinder-y', height: 10, curve: 0.7 });
    finish(c);
    return c;
}
/** An ore vein embedded in rock — dark stone shot through with glowing crystals. */
function oreVein() {
    const c = new PixelCanvas_1.PixelCanvas(28, 22);
    const cx = 14;
    const stone = Palette_1.MATERIAL.stoneDark;
    const gem = (0, Palette_1.mix)(Palette_1.MATERIAL.spirit, Palette_1.MATERIAL.voidBright, 0.3);
    c.groundShadow(cx, 19, 12, 3, 0.34);
    // Rock mass.
    c.ellipse(cx, 12, 13, 8, stone, { shape: 'round', height: 7, curve: 0.95 });
    c.polygon([[cx - 10, 12], [cx - 3, 6], [cx, 11], [cx - 5, 17]], (0, Palette_1.shift)(stone, 0.08), { shape: 'bevel', height: 8, curve: 0.6 });
    // Glowing crystal clusters set into the facets.
    const gems = [[-4, 9, 2], [3, 8, 2.4], [6, 13, 1.8], [-1, 14, 1.6], [-7, 12, 1.4]];
    for (const [dx, cy, r] of gems) {
        c.ellipse(cx + dx, cy, r, r * 1.2, gem, { shape: 'cone', height: 9, emissive: true });
        c.rect(cx + dx, cy - 1, 1, 1, '#eafbff', { emissive: true });
        // Faint bloom.
        c.ellipse(cx + dx, cy, r + 1.5, r + 1.5, gem, { shape: 'flat', emissive: true, alpha: 0.12 });
    }
    finish(c);
    return c;
}
/** A length of mine track — wooden ties and iron rails, seen along the run. */
function mineTrack() {
    const c = new PixelCanvas_1.PixelCanvas(30, 16);
    const cx = 15;
    const wood = (0, Palette_1.shift)(Palette_1.MATERIAL.wood, -0.02, 6);
    c.groundShadow(cx, 13, 14, 2.4, 0.24);
    // Ties across.
    for (let i = 0; i < 5; i += 1) {
        const x = cx - 12 + i * 6;
        c.rect(x, 5, 3, 8, (0, Palette_1.shift)(wood, i % 2 ? -0.04 : 0.04), { shape: 'cylinder-y', height: 3, curve: 0.8 });
    }
    // Two iron rails running the length.
    c.rect(cx - 13, 6, 26, 1.5, Palette_1.MATERIAL.iron, { shape: 'cylinder-x', height: 5, curve: 0.9 });
    c.rect(cx - 13, 11, 26, 1.5, (0, Palette_1.shift)(Palette_1.MATERIAL.iron, -0.04), { shape: 'cylinder-x', height: 5, curve: 0.9 });
    // Rail highlights.
    c.rect(cx - 13, 6, 26, 0.5, (0, Palette_1.shift)(Palette_1.MATERIAL.steel, 0.05), { shape: 'flat', height: 6 });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Chains, misc
// ---------------------------------------------------------------------------
/** A hanging chain — interlocked iron links. */
function chain() {
    const c = new PixelCanvas_1.PixelCanvas(12, 30);
    const cx = 6;
    const iron = Palette_1.MATERIAL.iron;
    // Links alternate orientation so they read as interlocked.
    for (let i = 0; i < 6; i += 1) {
        const y = 3 + i * 4.5;
        if (i % 2 === 0) {
            c.ellipse(cx, y, 2.6, 2, iron, { shape: 'round', height: 5, curve: 1 });
            c.ellipse(cx, y, 1.2, 1, '#1b1b22', { shape: 'flat', height: 6, emissive: true });
        }
        else {
            c.ellipse(cx, y, 1.8, 2.6, (0, Palette_1.shift)(iron, -0.06), { shape: 'round', height: 5, curve: 1 });
            c.ellipse(cx, y, 0.8, 1.4, '#1b1b22', { shape: 'flat', height: 6, emissive: true });
        }
    }
    finish(c);
    return c;
}
/** A protective charm — a gold amulet on a cord with a purple gem. */
function charm() {
    const c = new PixelCanvas_1.PixelCanvas(14, 18);
    const cx = 7;
    const gold = Palette_1.MATERIAL.gold;
    c.groundShadow(cx, 15, 5, 1.8, 0.24);
    // Cord loop.
    c.ellipse(cx, 4, 3, 3, Palette_1.MATERIAL.leatherDark, { shape: 'round', height: 4, curve: 1 });
    c.ellipse(cx, 4, 1.6, 1.6, '#161018', { shape: 'flat', height: 5, emissive: true });
    // Amulet disc.
    c.circle(cx, 11, 4, gold, { shape: 'round', height: 6, curve: 1 });
    c.circle(cx, 11, 2.6, (0, Palette_1.shift)(gold, -0.14, -6), { shape: 'flat', height: 6, shade: 0.85 });
    // Gem.
    c.circle(cx, 11, 1.6, Palette_1.MATERIAL.voidBright, { shape: 'round', height: 7, emissive: true });
    c.rect(cx - 1, 10, 1, 1, '#f4d9ff', { emissive: true });
    // Rim highlight.
    c.ellipse(cx - 1, 9, 1.6, 1, (0, Palette_1.shift)(gold, 0.2), { shape: 'flat', height: 7 });
    finish(c);
    return c;
}
// ---------------------------------------------------------------------------
// Effects & particles (small, mostly emissive)
// ---------------------------------------------------------------------------
/** The rift core: a jagged void crystal pouring purple light. */
function riftCore() {
    const c = new PixelCanvas_1.PixelCanvas(34, 44);
    const cx = 17;
    c.groundShadow(cx, 40, 15, 4, 0.3);
    // Outer glow bloom.
    c.ellipse(cx, 22, 16, 20, Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.12 });
    c.ellipse(cx, 22, 10, 16, Palette_1.MATERIAL.voidPurple, { shape: 'flat', emissive: true, alpha: 0.16 });
    // Dark crystal body (a tall shard).
    c.polygon([[cx, 3], [cx + 8, 20], [cx + 4, 40], [cx - 5, 38], [cx - 8, 18]], (0, Palette_1.mix)(Palette_1.MATERIAL.voidPurple, '#140a1e', 0.45), { shape: 'cone', height: 10, emissive: true });
    // Inner glowing cracks.
    c.polygon([[cx, 6], [cx + 4, 22], [cx, 37], [cx - 3, 20]], Palette_1.MATERIAL.voidPurple, { shape: 'cone', height: 11, emissive: true });
    c.polygon([[cx, 10], [cx + 2, 24], [cx, 34], [cx - 1, 22]], Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true });
    c.line(cx, 8, cx, 34, '#f0d0ff', 1, { emissive: true });
    // Floating shards around it.
    c.polygon([[cx - 11, 18], [cx - 8, 20], [cx - 10, 24]], Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.85 });
    c.polygon([[cx + 10, 26], [cx + 13, 24], [cx + 12, 30]], Palette_1.MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.85 });
    return c; // no dark outline — it's a light source, keep the bloom soft
}
/** A firefly mote — a tiny green-gold glow with a soft halo. */
function firefly() {
    const c = new PixelCanvas_1.PixelCanvas(6, 6);
    const cx = 3;
    const glow = (0, Palette_1.mix)(Palette_1.MATERIAL.toxic, '#d9ff9c', 0.6);
    c.circle(cx, 3, 3, glow, { shape: 'flat', emissive: true, alpha: 0.3 });
    c.circle(cx, 3, 1.4, '#eaffb0', { shape: 'flat', emissive: true });
    c.rect(cx - 0.5, 2.5, 1, 1, '#ffffff', { emissive: true });
    return c;
}
/** A rising ember — hot core with a cooling trail. */
function ember() {
    const c = new PixelCanvas_1.PixelCanvas(6, 8);
    const cx = 3;
    c.rect(cx - 1, 3, 2, 4, Palette_1.MATERIAL.ember, { shape: 'flat', emissive: true, alpha: 0.7 });
    c.rect(cx - 1, 1, 2, 3, Palette_1.MATERIAL.emberCore, { shape: 'flat', emissive: true });
    c.rect(cx - 0.5, 0.5, 1, 1.5, '#ffe9a8', { emissive: true });
    return c;
}
/** An arrow/bolt projectile — a shaft with a bright tip and fletching. */
function projectileBolt() {
    const c = new PixelCanvas_1.PixelCanvas(14, 4);
    // Shaft.
    c.rect(1, 1, 10, 2, Palette_1.MATERIAL.bone, { shape: 'cylinder-x', height: 3, curve: 0.9 });
    // Toxic-lit tip.
    c.polygon([[10, 0], [14, 2], [10, 4]], Palette_1.MATERIAL.toxic, { shape: 'cone', height: 4, emissive: true });
    // Fletching.
    c.polygon([[0, 0], [3, 2], [0, 4]], (0, Palette_1.shift)(Palette_1.MATERIAL.moss, 0.1), { shape: 'flat', height: 3 });
    return c;
}
/** A magic projectile — a glowing violet orb with a bright core. */
function projectileMagic() {
    const c = new PixelCanvas_1.PixelCanvas(10, 10);
    const cx = 5;
    c.circle(cx, 5, 5, Palette_1.MATERIAL.voidPurple, { shape: 'flat', emissive: true, alpha: 0.35 });
    c.circle(cx, 5, 3, Palette_1.MATERIAL.voidBright, { shape: 'round', height: 4, emissive: true });
    c.circle(cx, 5, 1.6, '#f4d9ff', { shape: 'flat', emissive: true });
    c.rect(cx - 0.5, 4, 1, 1, '#ffffff', { emissive: true });
    return c;
}
/** A four-point spark flash. */
function spark() {
    const c = new PixelCanvas_1.PixelCanvas(6, 6);
    const cx = 3;
    c.rect(cx - 0.5, 0, 1, 6, '#fff1a1', { emissive: true });
    c.rect(0, cx - 0.5, 6, 1, '#fff1a1', { emissive: true });
    c.rect(cx - 1, cx - 1, 2, 2, '#ffffff', { emissive: true });
    return c;
}
/** A soft ground shadow blob, kept as a standalone texture the game reuses. */
function shadowBlob() {
    const c = new PixelCanvas_1.PixelCanvas(18, 8);
    c.groundShadow(9, 4, 8, 3.4, 0.42);
    return c;
}
/** A single white pixel — used for tinted particles and fills. */
function pixel() {
    const c = new PixelCanvas_1.PixelCanvas(2, 2);
    c.rect(0, 0, 2, 2, '#ffffff', { emissive: true });
    return c;
}
// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
/** Props that come in 3 variants (variant-aware builders). */
const VARIANT_BUILDERS = {
    tree,
    'tree-dead': treeDead,
    'tree-pine': treePine,
    rock,
    rubble,
    bush,
    grave,
};
/** Single-shape builders. */
const SINGLE_BUILDERS = {
    stump,
    fern,
    reeds,
    'mushroom-cluster': mushroomCluster,
    'ash-pile': ashPile,
    'cracked-ground': crackedGround,
    puddle,
    lilypad,
    'bog-bubble': bogBubble,
    'tombstone-cross': tombstoneCross,
    bones,
    skull,
    'herb-moonwort': herbMoonwort,
    'herb-shadebloom': herbShadebloom,
    'herb-bog-reed': herbBogReed,
    glowcap,
    'flower-patch': flowerPatch,
    'lantern-off': lanternOff,
    'lantern-on': lanternOn,
    altar,
    'brazier-lit': brazierLit,
    'brazier-cold': brazierCold,
    campfire,
    'torch-wall': torchWall,
    cargo,
    'miner-tools': minerTools,
    crate,
    barrel,
    sack,
    'hay-bale': hayBale,
    tent,
    'chest-closed': chestClosed,
    'chest-open': chestOpen,
    'door-glow': doorGlow,
    'mine-lift': mineLift,
    well,
    cart,
    'fence-post': fencePost,
    banner,
    signpost,
    'bridge-plank': bridgePlank,
    statue,
    obelisk,
    'crypt-entrance': cryptEntrance,
    anvil,
    'forge-fire': forgeFire,
    'ore-vein': oreVein,
    'mine-track': mineTrack,
    chain,
    charm,
    'rift-core': riftCore,
    firefly,
    ember,
    'projectile-bolt': projectileBolt,
    'projectile-magic': projectileMagic,
    spark,
    shadow: shadowBlob,
    pixel,
};
/**
 * Render a prop by key.
 *
 * Variant keys work three ways so the game can reference whatever it has:
 *  - bare key (`tree`) → variant 0
 *  - suffixed key (`tree-2`) → that variant
 *  - explicit `variant` argument on the bare key → that variant
 * Variant indices wrap, so any integer is safe.
 */
function renderProp(key, variant = 0) {
    // Suffixed variant form, e.g. "tree-1" — but only when the prefix is a
    // registered variant builder (so "tree-dead" and "herb-bog-reed" are safe).
    const dash = key.lastIndexOf('-');
    if (dash > 0) {
        const prefix = key.slice(0, dash);
        const suffix = key.slice(dash + 1);
        if (VARIANT_BUILDERS[prefix] && /^\d+$/.test(suffix)) {
            return VARIANT_BUILDERS[prefix](Number(suffix) % 3);
        }
    }
    if (VARIANT_BUILDERS[key])
        return VARIANT_BUILDERS[key](((variant % 3) + 3) % 3);
    const single = SINGLE_BUILDERS[key];
    if (single)
        return single();
    // Unknown key: a small neutral placeholder rather than throwing, so a bad
    // reference in the game degrades to a visible marker instead of a crash.
    const c = new PixelCanvas_1.PixelCanvas(8, 8);
    c.rect(1, 1, 6, 6, Palette_1.MATERIAL.blood, { shape: 'bevel', height: 3 });
    finish(c);
    return c;
}
/** Every prop key the factory can produce (variant props expanded to -0/-1/-2). */
exports.PROP_KEYS = [
    ...Object.keys(VARIANT_BUILDERS).flatMap((k) => [k, `${k}-0`, `${k}-1`, `${k}-2`]),
    ...Object.keys(SINGLE_BUILDERS),
];
/**
 * Every prop frame as (key, canvas) pairs, for baking into the texture atlas.
 * Variant props emit their bare alias (variant 0) plus all three numbered
 * variants so the game can pick any of them by name.
 */
function buildPropFrames() {
    const frames = [];
    for (const key of Object.keys(VARIANT_BUILDERS)) {
        frames.push({ key, canvas: VARIANT_BUILDERS[key](0) }); // bare alias = variant 0
        for (let v = 0; v < 3; v += 1) {
            frames.push({ key: `${key}-${v}`, canvas: VARIANT_BUILDERS[key](v) });
        }
    }
    for (const key of Object.keys(SINGLE_BUILDERS)) {
        frames.push({ key, canvas: SINGLE_BUILDERS[key]() });
    }
    return frames;
}

});
__define("src/systems/sprites/weapons.ts", function(exports, module, __req){
"use strict";
/**
 * The armoury — Trupy's weapon sprite factory.
 *
 * Eight weapons, all generated at runtime and sculpted with the same
 * depth-aware renderer as the hero and the townsfolk (see ./hero.ts). Two views
 * are produced for each:
 *
 *   renderWeapon(id)      the held-in-hand view (~30x30), drawn on a diagonal
 *                         so it sits naturally in the exile's fist and swings
 *                         along the attack arc. This is the `held-{id}` texture
 *                         the scenes already pin to the player.
 *   renderWeaponIcon(id)  a larger, cleaner 3/4 presentation (~40x40) for the
 *                         inventory and shop, where the weapon is read at rest.
 *
 * Three things sell a weapon at small size, and every weapon here commits to all
 * three:
 *   1. A METALLIC EDGE — a single bright, thin highlight run down the blade/head.
 *      More than any amount of shading, that hot specular line is what makes a
 *      pixel blob read as *sharpened steel*.
 *   2. A DISTINCT GRIP — the handle uses a different material (wrapped leather,
 *      bone, carved wood, bound cloth) so the eye separates "the part you hold"
 *      from "the part that hurts".
 *   3. A GLOW — each weapon's `glow` colour, laid down emissive on its magical
 *      part (a fire crown, a void gem, a toxic ichor edge), so enchanted arms
 *      are legible in a dark world.
 *
 * Colours come from weaponVisuals.ts (primary / secondary / glow), inlined here
 * as a hex map to keep the sprite layer free of a data-layer import cycle — the
 * same pattern enemies.ts and npcs.ts use.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEAPON_SHADE = void 0;
exports.renderWeapon = renderWeapon;
exports.renderWeaponIcon = renderWeaponIcon;
exports.buildWeaponFrames = buildWeaponFrames;
const PixelCanvas_1 = __req("src/systems/render/PixelCanvas.ts");
const Palette_1 = __req("src/systems/render/Palette.ts");
const PALETTE = {
    rustblade: { primary: '#c5cbd3', secondary: '#79563a', glow: '#e7ebef' },
    graveaxe: { primary: '#d3a05d', secondary: '#6f4a31', glow: '#f4c77f' },
    witchbow: { primary: '#76c4a4', secondary: '#4e6f61', glow: '#b7ffe0' },
    ashstaff: { primary: '#e56a48', secondary: '#684031', glow: '#ffca72' },
    moonblade: { primary: '#a8b8ee', secondary: '#555d79', glow: '#e2e8ff' },
    reliquary: { primary: '#bf78e2', secondary: '#59406c', glow: '#f1bdff' },
    bogreaper: { primary: '#6fc79b', secondary: '#476a53', glow: '#b5ffd5' },
    cinderbrand: { primary: '#f2774c', secondary: '#713c31', glow: '#ffd07a' },
};
const FALLBACK = PALETTE.rustblade;
const paletteOf = (id) => { var _a; return (_a = PALETTE[id]) !== null && _a !== void 0 ? _a : FALLBACK; };
const OUTLINE = '#111019';
const RIM = '#9aa2bd';
/** Held-in-hand canvas footprint. */
const HELD = 30;
/** Inventory icon footprint — bigger, so the presentation view can breathe. */
const ICON = 40;
/**
 * Draw a bright, thin specular line down one long edge of a bladed shape. This
 * is the single most important flourish in the file — see the module note. It's
 * laid emissive so the lighting pass can't dim it away, and kept to one pixel
 * wide so it stays a *glint*, not a stripe.
 */
function edgeGlint(c, x0, y0, x1, y1, color, opts = {}) {
    c.line(x0, y0, x1, y1, color, 1, { emissive: true, ...opts });
}
/** A straight sword-like weapon: grip, guard, and a long tapering blade with a
 * hot edge. Used (with tweaks) by several of the melee weapons. */
function drawBladeWeapon(c, p, L, cfg) {
    var _a;
    const cx = c.width / 2;
    const cy = c.height / 2;
    const s = L.s;
    // Anchor the grip toward the lower-left and run the blade to the upper-right.
    const gripX = cx - 7 * s;
    const gripY = cy + 9 * s;
    const tipX = cx + 9 * s;
    const tipY = cy - 11 * s;
    // Guard sits between grip and blade.
    const guardX = gripX + (tipX - gripX) * 0.28;
    const guardY = gripY + (tipY - gripY) * 0.28;
    const grip = (_a = cfg.grip) !== null && _a !== void 0 ? _a : p.secondary;
    // ----- Grip: wrapped leather over a tang. Cross-hatched binding.
    c.line(gripX, gripY, guardX, guardY, grip, Math.max(2, Math.round(3 * s)), { shape: 'cylinder-x', height: 4 });
    // Binding rings across the grip so it reads as wrapped, not smooth.
    const wraps = 3;
    for (let i = 1; i <= wraps; i += 1) {
        const t = i / (wraps + 1);
        const wx = gripX + (guardX - gripX) * t;
        const wy = gripY + (guardY - gripY) * t;
        c.rect(wx - 1, wy - 0.5, 2, 1, (0, Palette_1.shift)(grip, -0.12), { shape: 'flat', height: 5, shade: 0.85 });
    }
    // Pommel knob at the very base.
    c.circle(gripX, gripY, 1.6 * s, (0, Palette_1.shift)(grip, 0.06), { shape: 'round', height: 5 });
    // ----- Guard / crossguard: a short bar of darker metal.
    const gnx = -(tipY - gripY);
    const gny = tipX - gripX;
    const glen = Math.hypot(gnx, gny) || 1;
    const perpX = (gnx / glen) * 3 * s;
    const perpY = (gny / glen) * 3 * s;
    c.line(guardX - perpX, guardY - perpY, guardX + perpX, guardY + perpY, (0, Palette_1.shift)(Palette_1.MATERIAL.bronze, -0.04), Math.max(2, Math.round(2 * s)), { shape: 'cylinder-y', height: 6 });
    // ----- Blade: a filled quad from the guard to the tip. Two edges: a spine
    // (dark) and a hot honed edge (bright). Curved weapons bow the far edge out.
    const bladeBaseHalf = 2.4 * s;
    // Unit direction along the blade.
    const bdx = (tipX - guardX) / (Math.hypot(tipX - guardX, tipY - guardY) || 1);
    const bdy = (tipY - guardY) / (Math.hypot(tipX - guardX, tipY - guardY) || 1);
    // Perpendicular (points toward the honed edge, upper-left).
    const pnx = -bdy;
    const pny = bdx;
    const bow = cfg.curved ? 2.2 * s : 0;
    const midX = (guardX + tipX) / 2 + pnx * bow;
    const midY = (guardY + tipY) / 2 + pny * bow;
    // Blade polygon: base corners → curved mid on the edge side → tip.
    c.polygon([
        [guardX + pnx * bladeBaseHalf, guardY + pny * bladeBaseHalf],
        [midX + pnx * bladeBaseHalf * 0.7, midY + pny * bladeBaseHalf * 0.7],
        [tipX, tipY],
        [midX - pnx * bladeBaseHalf * 0.5, midY - pny * bladeBaseHalf * 0.5],
        [guardX - pnx * bladeBaseHalf, guardY - pny * bladeBaseHalf],
    ], p.primary, { shape: 'cylinder-x', height: 7, curve: 0.9 });
    // Spine shadow down the back edge.
    c.line(guardX - pnx * bladeBaseHalf * 0.7, guardY - pny * bladeBaseHalf * 0.7, tipX, tipY, (0, Palette_1.shift)(p.primary, -0.2), Math.max(1, Math.round(1 * s)), { height: 6, shade: 0.7 });
    // Pitting for the rustblade: scatter dark flecks along the blade.
    if (cfg.pitted) {
        const rust = Palette_1.MATERIAL.rust;
        for (let i = 0; i < 6; i += 1) {
            const t = (i + 0.5) / 6;
            const bx = guardX + (tipX - guardX) * t + pnx * (Math.sin(i * 3.1) * 1.2);
            const by = guardY + (tipY - guardY) * t + pny * (Math.sin(i * 3.1) * 1.2);
            c.rect(bx - 0.5, by - 0.5, 1 + (i % 2), 1, (0, Palette_1.mix)(rust, p.primary, 0.3), { shape: 'flat', height: 6, shade: 0.8 });
        }
    }
    // ----- THE metallic honed edge: a bright glint down the leading edge.
    const eGlint = cfg.pitted ? (0, Palette_1.mix)(p.glow, Palette_1.MATERIAL.rust, 0.25) : p.glow;
    edgeGlint(c, guardX + pnx * bladeBaseHalf, guardY + pny * bladeBaseHalf, tipX, tipY, eGlint, { alpha: cfg.pitted ? 0.85 : 1 });
    // ----- Flame for the cinderbrand: emissive tongues licking off the blade.
    if (cfg.flaming) {
        for (let i = 0; i < 5; i += 1) {
            const t = 0.2 + (i / 5) * 0.8;
            const fx = guardX + (tipX - guardX) * t + pnx * (1.5 * s);
            const fy = guardY + (tipY - guardY) * t + pny * (1.5 * s);
            const flick = 2 + (i % 2) * 1.5;
            c.ellipse(fx, fy, 1.6 * s, flick, p.glow, { emissive: true, alpha: 0.6 });
            c.ellipse(fx, fy - 0.5, 0.9 * s, flick * 0.6, Palette_1.MATERIAL.flame, { emissive: true, alpha: 0.8 });
        }
        // Ember core hugging the blade.
        edgeGlint(c, guardX, guardY, tipX, tipY, Palette_1.MATERIAL.emberCore, { alpha: 0.5 });
    }
}
/** RUSTBLADE — a pitted, corroded arming sword. Straight, dull, honed only along
 * the very edge where the rust has been ground back. */
function drawRustblade(c, p, L) {
    drawBladeWeapon(c, p, L, { pitted: true, grip: (0, Palette_1.mix)(p.secondary, Palette_1.MATERIAL.leatherDark, 0.3) });
}
/** MOONBLADE — an elegant curved cleaver in pale moon-steel. Clean, bright, a
 * cold blue glint the whole length of the sweep. */
function drawMoonblade(c, p, L) {
    drawBladeWeapon(c, p, L, { curved: true, grip: (0, Palette_1.mix)(p.secondary, Palette_1.MATERIAL.cloth, 0.3) });
}
/** CINDERBRAND — a straight brand-sword wreathed in fire. The blade is dark iron
 * but flame runs its length and an ember edge burns hot. */
function drawCinderbrand(c, p, L) {
    drawBladeWeapon(c, p, { ...L }, { flaming: true, grip: (0, Palette_1.mix)(p.secondary, Palette_1.MATERIAL.leatherDark, 0.4) });
}
/** GRAVEAXE — a heavy bearded battle-axe: a thick wooden haft and a broad
 * single-bit head with a long "beard" hooking down, capped by a hot edge. */
function drawGraveaxe(c, p, L) {
    const cx = c.width / 2;
    const cy = c.height / 2;
    const s = L.s;
    // Haft runs bottom-left to upper-right.
    const buttX = cx - 8 * s;
    const buttY = cy + 10 * s;
    const topX = cx + 6 * s;
    const topY = cy - 10 * s;
    const haft = (0, Palette_1.mix)(Palette_1.MATERIAL.wood, p.secondary, 0.5);
    c.line(buttX, buttY, topX, topY, haft, Math.max(2, Math.round(2.4 * s)), { shape: 'cylinder-x', height: 5 });
    edgeGlint(c, buttX, buttY, topX, topY, (0, Palette_1.shift)(haft, 0.14), { alpha: 0.5, shade: 1 }); // lit side of the shaft
    // Grip binding near the butt.
    for (let i = 1; i <= 3; i += 1) {
        const t = i / 6;
        const wx = buttX + (topX - buttX) * t;
        const wy = buttY + (topY - buttY) * t;
        c.rect(wx - 1, wy - 0.5, 2, 1, Palette_1.MATERIAL.leatherDark, { shape: 'flat', height: 6 });
    }
    // Axe head: a broad single bit mounted on the upper-right of the haft. Built
    // for a clear BEARDED-AXE read — a compact socket, a near-straight top, and a
    // deep sweeping cutting edge whose lower "beard" hooks well below the socket.
    const headCx = cx + 3.5 * s;
    const headCy = cy - 6.5 * s;
    // Socket cheek: a squarish block hugging the haft — the mounting mass.
    c.rect(headCx - 2.5 * s, headCy - 2 * s, 3 * s, 6 * s, (0, Palette_1.shift)(p.primary, -0.14), { shape: 'cylinder-y', height: 8, shade: 0.82 });
    // The bit: a wedge fanning out to the cutting edge. Top edge nearly straight,
    // bottom edge plunges past the socket into a hooked beard.
    c.polygon([
        [headCx - 0.5 * s, headCy - 3 * s], // top, at the socket
        [headCx + 6.5 * s, headCy - 1.5 * s], // top corner of the edge
        [headCx + 6 * s, headCy + 4 * s], // edge belly
        [headCx + 2.5 * s, headCy + 8 * s], // beard tip, hooking down below the socket
        [headCx + 0.5 * s, headCy + 6 * s], // beard root
        [headCx - 0.5 * s, headCy + 3.5 * s], // back to socket bottom
    ], p.primary, { shape: 'dome', height: 9, curve: 0.7 });
    // Cheek bevel + fuller line, so the flat of the bit reads as forged, not flat.
    c.line(headCx + 0.5 * s, headCy - 1.5 * s, headCx + 3 * s, headCy + 5 * s, (0, Palette_1.shift)(p.primary, -0.16), 1, { height: 8, shade: 0.72 });
    c.ellipse(headCx + 1.5 * s, headCy + 1 * s, 1.2 * s, 2.4 * s, (0, Palette_1.shift)(p.primary, 0.12), { shape: 'round', height: 9, shade: 1 }); // struck-cheek highlight
    // THE metallic edge: a hot glint running the full curved cutting arc, top
    // corner down to the beard tip. This is what sells "sharpened".
    edgeGlint(c, headCx + 6.5 * s, headCy - 1.5 * s, headCx + 6 * s, headCy + 4 * s, p.glow);
    edgeGlint(c, headCx + 6 * s, headCy + 4 * s, headCx + 2.5 * s, headCy + 8 * s, p.glow);
    // A faint warm inner glow so the heavy grave-iron feels charged.
    c.ellipse(headCx + 3 * s, headCy + 2 * s, 1.4 * s, 2 * s, p.glow, { emissive: true, alpha: 0.14 });
}
/** WITCHBOW — a crossbow: a horizontal bow lath, a straight stock along the
 * diagonal, a nocked bolt, and a green-glowing enchantment at the lath centre. */
function drawWitchbow(c, p, L) {
    const cx = c.width / 2;
    const cy = c.height / 2;
    const s = L.s;
    // Stock runs bottom-left (grip) to upper-right (muzzle), like the blades.
    const gripX = cx - 7 * s;
    const gripY = cy + 8 * s;
    const noseX = cx + 8 * s;
    const noseY = cy - 8 * s;
    const wood = (0, Palette_1.mix)(Palette_1.MATERIAL.wood, p.secondary, 0.6);
    // Stock body.
    c.line(gripX, gripY, noseX, noseY, wood, Math.max(2, Math.round(3 * s)), { shape: 'cylinder-x', height: 5 });
    edgeGlint(c, gripX, gripY, noseX, noseY, (0, Palette_1.shift)(wood, 0.12), { alpha: 0.45 });
    // Grip wrap.
    c.circle(gripX, gripY, 1.6 * s, (0, Palette_1.shift)(wood, -0.1), { shape: 'round', height: 5 });
    // Bow lath: mounted across the muzzle, roughly perpendicular to the stock, its
    // two limbs curving back. Drawn as two arms of dark horn.
    const lath = p.primary;
    const dirx = (noseX - gripX) / (Math.hypot(noseX - gripX, noseY - gripY) || 1);
    const diry = (noseY - gripY) / (Math.hypot(noseX - gripX, noseY - gripY) || 1);
    const px = -diry;
    const py = dirx;
    const limb = 7 * s;
    const tip1x = noseX + px * limb - dirx * 1.5 * s;
    const tip1y = noseY + py * limb - diry * 1.5 * s;
    const tip2x = noseX - px * limb - dirx * 1.5 * s;
    const tip2y = noseY - py * limb - diry * 1.5 * s;
    c.line(noseX, noseY, tip1x, tip1y, lath, Math.max(1, Math.round(1.6 * s)), { shape: 'cylinder-y', height: 6 });
    c.line(noseX, noseY, tip2x, tip2y, lath, Math.max(1, Math.round(1.6 * s)), { shape: 'cylinder-y', height: 6 });
    // Bowstring between the limb tips.
    c.line(tip1x, tip1y, tip2x, tip2y, (0, Palette_1.mix)(Palette_1.MATERIAL.bone, '#ffffff', 0.3), 1, { height: 7, shade: 0.9 });
    // Nocked bolt lying down the stock, tip past the lath.
    c.line(cx, cy, noseX + dirx * 3 * s, noseY + diry * 3 * s, Palette_1.MATERIAL.woodPale, 1, { height: 7 });
    c.polygon([
        [noseX + dirx * 3 * s, noseY + diry * 3 * s],
        [noseX + dirx * 1.5 * s + px * 1.2 * s, noseY + diry * 1.5 * s + py * 1.2 * s],
        [noseX + dirx * 1.5 * s - px * 1.2 * s, noseY + diry * 1.5 * s - py * 1.2 * s],
    ], (0, Palette_1.shift)(p.primary, 0.1), { shape: 'flat', height: 8 }); // bolt head
    // Green enchantment glowing at the lath centre — the witch's mark.
    c.circle(noseX, noseY, 1.8 * s, p.glow, { shape: 'round', emissive: true });
    c.circle(noseX, noseY, 0.9 * s, (0, Palette_1.mix)(p.glow, '#ffffff', 0.5), { emissive: true });
    // Metallic glint on the bolt head.
    edgeGlint(c, noseX + dirx * 3 * s, noseY + diry * 3 * s, noseX + dirx * 1.5 * s + px * 1.2 * s, noseY + diry * 1.5 * s + py * 1.2 * s, Palette_1.MATERIAL.steel, { alpha: 0.8 });
}
/** A capped staff: a long shaft with a magical crown at the top. Shared by the
 * ashstaff (fire crown) and reliquary (void artifact). */
function drawStaffWeapon(c, p, L, variant) {
    const cx = c.width / 2;
    const cy = c.height / 2;
    const s = L.s;
    const buttX = cx - 7 * s;
    const buttY = cy + 10 * s;
    const topX = cx + 6 * s;
    const topY = cy - 9 * s;
    const wood = variant === 'void' ? (0, Palette_1.mix)(p.secondary, Palette_1.MATERIAL.wood, 0.4) : (0, Palette_1.mix)(Palette_1.MATERIAL.wood, p.secondary, 0.5);
    // Shaft.
    c.line(buttX, buttY, topX, topY, wood, Math.max(2, Math.round(2.2 * s)), { shape: 'cylinder-x', height: 5 });
    edgeGlint(c, buttX, buttY, topX, topY, (0, Palette_1.shift)(wood, 0.14), { alpha: 0.4 });
    // Wrapped grip in the middle.
    const dirx = (topX - buttX) / (Math.hypot(topX - buttX, topY - buttY) || 1);
    const diry = (topY - buttY) / (Math.hypot(topX - buttX, topY - buttY) || 1);
    for (let i = 0; i < 3; i += 1) {
        const t = 0.45 + i * 0.08;
        const wx = buttX + (topX - buttX) * t;
        const wy = buttY + (topY - buttY) * t;
        c.rect(wx - 1, wy - 0.5, 2, 1, Palette_1.MATERIAL.leatherDark, { shape: 'flat', height: 6 });
    }
    const headX = topX + dirx * 1.5 * s;
    const headY = topY + diry * 1.5 * s;
    if (variant === 'fire') {
        // Iron claw setting: a small cup with three clear upward prongs cradling a
        // molten core, and a tall braided flame rising above — a proper fire-staff.
        c.rect(headX - 2.4 * s, headY, 4.8 * s, 2.4 * s, Palette_1.MATERIAL.iron, { shape: 'cylinder-y', height: 8, curve: 0.7 }); // cup
        c.rect(headX - 2.4 * s, headY, 4.8 * s, 1, (0, Palette_1.shift)(Palette_1.MATERIAL.iron, 0.14), { shape: 'flat', height: 9 }); // cup rim highlight
        [-1, 0, 1].forEach((sd) => {
            c.line(headX + sd * 2 * s, headY, headX + sd * 1.6 * s, headY - 3 * s, Palette_1.MATERIAL.iron, Math.max(1, Math.round(1 * s)), { shape: 'cylinder-y', height: 9 }); // prong
        });
        // Molten core seated in the cup (emissive).
        c.circle(headX, headY, 1.5 * s, p.glow, { shape: 'round', emissive: true });
        c.circle(headX, headY - 0.3 * s, 0.8 * s, Palette_1.MATERIAL.flame, { emissive: true });
        // Tall layered flame: an outer glow body, an inner bright tongue, licking
        // higher than the prongs so the fire is the unmistakable read.
        c.polygon([
            [headX - 2.4 * s, headY - 1 * s],
            [headX - 1 * s, headY - 5 * s],
            [headX, headY - 3 * s],
            [headX + 1 * s, headY - 6.5 * s],
            [headX + 2.4 * s, headY - 1 * s],
        ], p.glow, { emissive: true, alpha: 0.55 });
        c.polygon([
            [headX - 1.2 * s, headY - 1.5 * s],
            [headX, headY - 5.5 * s],
            [headX + 1.2 * s, headY - 1.5 * s],
        ], Palette_1.MATERIAL.flame, { emissive: true, alpha: 0.9 });
        c.rect(headX - 0.5, headY - 4.5 * s, 1, 2 * s, Palette_1.MATERIAL.emberCore, { emissive: true }); // hot core streak
    }
    else {
        // Void reliquary: a forbidden artifact — a dark clawed reliquary box cradling
        // a purple void gem that bleeds light, with orbiting motes.
        c.rect(headX - 2.5 * s, headY - 3 * s, 5 * s, 6 * s, (0, Palette_1.mix)(Palette_1.MATERIAL.iron, p.secondary, 0.5), { shape: 'bevel', height: 8, curve: 0.7 });
        // Gold reliquary trim.
        c.rect(headX - 2.5 * s, headY - 3 * s, 5 * s, 1, Palette_1.MATERIAL.gold, { shape: 'flat', height: 9 });
        c.rect(headX - 2.5 * s, headY + 2 * s, 5 * s, 1, Palette_1.MATERIAL.gold, { shape: 'flat', height: 9 });
        // Void gem (emissive core with a bright pupil).
        c.ellipse(headX, headY, 1.8 * s, 2.4 * s, p.primary, { shape: 'round', height: 9, emissive: true });
        c.ellipse(headX, headY - 0.5 * s, 0.9 * s, 1.4 * s, p.glow, { emissive: true });
        c.rect(headX - 0.5, headY - 0.5, 1, 1, '#ffffff', { emissive: true, alpha: 0.9 }); // spark
        // Orbiting void motes.
        for (let i = 0; i < 3; i += 1) {
            const ang = (i / 3) * Math.PI * 2;
            c.circle(headX + Math.cos(ang) * 3.5 * s, headY + Math.sin(ang) * 3.5 * s, 0.8 * s, p.glow, { emissive: true, alpha: 0.6 });
        }
    }
}
/** ASHSTAFF — a fire-topped staff. */
function drawAshstaff(c, p, L) {
    drawStaffWeapon(c, p, L, 'fire');
}
/** RELIQUARY — a forbidden void artifact on a haft. */
function drawReliquary(c, p, L) {
    drawStaffWeapon(c, p, L, 'void');
}
/** BOGREAPER — a curved sickle/scythe. A wooden snath, a long inward-curving
 * blade, and a toxic-green ichor weeping along the edge. */
function drawBogreaper(c, p, L) {
    const cx = c.width / 2;
    const cy = c.height / 2;
    const s = L.s;
    const buttX = cx - 8 * s;
    const buttY = cy + 10 * s;
    const topX = cx + 5 * s;
    const topY = cy - 8 * s;
    const snath = (0, Palette_1.mix)(Palette_1.MATERIAL.wood, p.secondary, 0.55);
    // Snath (handle).
    c.line(buttX, buttY, topX, topY, snath, Math.max(2, Math.round(2.2 * s)), { shape: 'cylinder-x', height: 5 });
    edgeGlint(c, buttX, buttY, topX, topY, (0, Palette_1.shift)(snath, 0.12), { alpha: 0.4 });
    // Grip wraps.
    for (let i = 1; i <= 2; i += 1) {
        const t = i / 5;
        const wx = buttX + (topX - buttX) * t;
        const wy = buttY + (topY - buttY) * t;
        c.rect(wx - 1, wy - 0.5, 2, 1, Palette_1.MATERIAL.leatherDark, { shape: 'flat', height: 6 });
    }
    // Curved blade sweeping from the top of the snath, hooking left/up like a
    // scythe. Built from a chain of points so it reads as a smooth crescent.
    const bx = topX;
    const by = topY;
    const arc = [
        [bx, by + 1 * s],
        [bx + 2 * s, by - 2 * s],
        [bx + 1 * s, by - 6 * s],
        [bx - 3 * s, by - 8 * s],
        [bx - 7 * s, by - 7 * s],
    ];
    // Fill the blade body as a thick crescent (outer arc + inner arc back).
    c.polygon([
        ...arc,
        [bx - 6 * s, by - 5 * s],
        [bx - 2 * s, by - 5 * s],
        [bx, by - 3 * s],
        [bx - 1 * s, by],
    ], p.primary, { shape: 'cylinder-x', height: 7, curve: 0.85 });
    // Toxic ichor + THE edge glint along the concave cutting edge.
    edgeGlint(c, bx + 1 * s, by - 6 * s, bx - 7 * s, by - 7 * s, p.glow);
    // Ichor drips weeping off the blade.
    for (let i = 0; i < 3; i += 1) {
        const t = 0.3 + i * 0.25;
        const dx = bx + 1 * s + (-8 * s) * t;
        const dy = by - 6.5 * s + (Math.sin(t * 3) * 1);
        c.circle(dx, dy + 2 * s, 0.9 * s, p.glow, { emissive: true, alpha: 0.7 });
    }
    // Iron collar binding blade to snath.
    c.circle(topX, topY, 1.6 * s, Palette_1.MATERIAL.iron, { shape: 'round', height: 8 });
}
const DRAWERS = {
    rustblade: drawRustblade,
    graveaxe: drawGraveaxe,
    witchbow: drawWitchbow,
    ashstaff: drawAshstaff,
    moonblade: drawMoonblade,
    reliquary: drawReliquary,
    bogreaper: drawBogreaper,
    cinderbrand: drawCinderbrand,
};
/** Dark keyline + faint lit edge, applied once per weapon. Kept subtle so the
 * emissive glints and glows stay the brightest thing on the sprite. */
function finish(c) {
    c.outline(OUTLINE, { lightEdge: (0, Palette_1.mix)(OUTLINE, RIM, 0.5), alpha: 0.92 });
}
/** Held-in-hand view (~30x30). Keyed `held-{id}` by the frame builder. */
function renderWeapon(id) {
    var _a;
    const c = new PixelCanvas_1.PixelCanvas(HELD, HELD);
    const draw = (_a = DRAWERS[id]) !== null && _a !== void 0 ? _a : drawRustblade;
    draw(c, paletteOf(id), { size: HELD, s: 1, icon: false });
    finish(c);
    return c;
}
/** Larger, cleaner presentation view (~40x40) for inventory/shop UI. Same
 * geometry, scaled up so surface detail and the glow read at rest. */
function renderWeaponIcon(id) {
    var _a;
    const c = new PixelCanvas_1.PixelCanvas(ICON, ICON);
    const draw = (_a = DRAWERS[id]) !== null && _a !== void 0 ? _a : drawRustblade;
    // Scale geometry to the larger canvas; a touch under the size ratio so nothing
    // clips the padding.
    draw(c, paletteOf(id), { size: ICON, s: 1.28, icon: true });
    finish(c);
    return c;
}
/**
 * Lighting profile for weapons. Cooler and more specular than the character
 * shade — metal wants a harder key and a stronger rim so edges pop — while the
 * emissive glints/glows bypass lighting entirely.
 */
exports.WEAPON_SHADE = {
    lightX: -0.5,
    lightY: -0.72,
    lightZ: 0.46,
    intensity: 0.72,
    ambient: 0.46,
    ambientColor: '#54607f',
    occlusion: 0.34,
    rim: 0.32,
    rimColor: '#c9d2e8',
    bands: 6,
    dither: 0.4,
};
/**
 * Every weapon texture the game needs. Emits the legacy `held-{id}` keys the
 * scenes already pin to the player, plus a `wicon-{id}` for each UI icon.
 */
function buildWeaponFrames() {
    const frames = [];
    for (const id of Object.keys(DRAWERS)) {
        frames.push({ key: `held-${id}`, canvas: renderWeapon(id) });
        frames.push({ key: `wicon-${id}`, canvas: renderWeaponIcon(id) });
    }
    return frames;
}

});
__define("src/systems/render/TextureBridge.ts", function(exports, module, __req){
"use strict";
/**
 * Bridges PixelCanvas output into Phaser's texture manager.
 *
 * Sprite factories stay engine-agnostic — they only know how to paint pixels.
 * This module is the single place that talks to Phaser, so the art can be
 * previewed offline (see tools/preview.mjs) without pulling the engine in.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTexture = registerTexture;
exports.registerAll = registerAll;
exports.rawTexture = rawTexture;
/** Register a finished PixelCanvas as a Phaser texture. */
function registerTexture(scene, spec) {
    if (scene.textures.exists(spec.key))
        return;
    const { canvas, shade } = spec;
    const texture = scene.textures.createCanvas(spec.key, canvas.width, canvas.height);
    if (!texture)
        return;
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    const pixels = canvas.resolve(shade !== null && shade !== void 0 ? shade : {});
    const image = ctx.createImageData(canvas.width, canvas.height);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
    texture.refresh();
}
function registerAll(scene, specs, shade) {
    var _a;
    for (const spec of specs) {
        registerTexture(scene, { ...spec, shade: (_a = spec.shade) !== null && _a !== void 0 ? _a : shade });
    }
}
/**
 * Paint straight into a texture with a draw callback. Used for the few textures
 * that are simpler to express as direct canvas calls (noise, gradients, masks).
 */
function rawTexture(scene, key, width, height, draw) {
    if (scene.textures.exists(key))
        return;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture)
        return;
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    texture.refresh();
}

});
__define("src/systems/world/Lighting.ts", function(exports, module, __req){
"use strict";
/**
 * Dynamic lighting and the day/night cycle.
 *
 * A top-down pixel game can't afford per-pixel lighting, so this fakes it
 * convincingly and cheaply: a full-screen tint rectangle establishes the time of
 * day, and each light source is a radial-gradient sprite drawn additively on top.
 * Because the tint is a screen-space overlay and the lights are world-space, a
 * lantern genuinely carves a warm hole in the night as you walk past it.
 *
 * The cycle is also gameplay: night raises enemy aggression and spawns, so the
 * lighting isn't just decoration — it tells you when to be somewhere safe.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WINDOW_LIGHT = exports.FORGE_LIGHT = exports.ARCANE_LIGHT = exports.FLAME_LIGHT = exports.LightingSystem = void 0;
exports.sampleDaylight = sampleDaylight;
// Imported as a value, not just a type: BlendModes constants are needed at runtime.
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
const CYCLE = [
    // Cold blue pre-dawn, lifting into warm low sun.
    { at: 0.00, tint: 0x121a33, tintAlpha: 0.62, brightness: 0.18, danger: 1.55, phase: 'deepNight', label: 'ГЛУХАЯ НОЧЬ' },
    { at: 0.16, tint: 0x2a2947, tintAlpha: 0.46, brightness: 0.34, danger: 1.3, phase: 'night', label: 'НОЧЬ' },
    { at: 0.26, tint: 0x6b4a5c, tintAlpha: 0.3, brightness: 0.62, danger: 1.1, phase: 'dawn', label: 'РАССВЕТ' },
    { at: 0.36, tint: 0x8a6a54, tintAlpha: 0.14, brightness: 0.88, danger: 0.95, phase: 'dawn', label: 'УТРО' },
    { at: 0.5, tint: 0x9aa2b0, tintAlpha: 0.05, brightness: 1, danger: 0.85, phase: 'day', label: 'ДЕНЬ' },
    { at: 0.66, tint: 0x8f7c62, tintAlpha: 0.12, brightness: 0.9, danger: 0.9, phase: 'day', label: 'ПОСЛЕ ПОЛУДНЯ' },
    { at: 0.76, tint: 0x7a4a45, tintAlpha: 0.28, brightness: 0.6, danger: 1.05, phase: 'dusk', label: 'ЗАКАТ' },
    { at: 0.86, tint: 0x2f2b4a, tintAlpha: 0.46, brightness: 0.32, danger: 1.3, phase: 'night', label: 'СУМЕРКИ' },
    { at: 1.00, tint: 0x121a33, tintAlpha: 0.62, brightness: 0.18, danger: 1.55, phase: 'deepNight', label: 'ГЛУХАЯ НОЧЬ' },
];
/** Blend two packed RGB colours. */
function blendColor(a, b, t) {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}
/** Sample the cycle at a normalised time (0..1 = one full day). */
function sampleDaylight(dayProgress) {
    const t = ((dayProgress % 1) + 1) % 1;
    let previous = CYCLE[0];
    let next = CYCLE[CYCLE.length - 1];
    for (let i = 0; i < CYCLE.length - 1; i += 1) {
        if (t >= CYCLE[i].at && t <= CYCLE[i + 1].at) {
            previous = CYCLE[i];
            next = CYCLE[i + 1];
            break;
        }
    }
    const span = next.at - previous.at || 1;
    const local = (t - previous.at) / span;
    // Smoothstep so the light eases rather than ramping linearly.
    const eased = local * local * (3 - 2 * local);
    return {
        phase: eased < 0.5 ? previous.phase : next.phase,
        brightness: previous.brightness + (next.brightness - previous.brightness) * eased,
        tint: blendColor(previous.tint, next.tint, eased),
        tintAlpha: previous.tintAlpha + (next.tintAlpha - previous.tintAlpha) * eased,
        danger: previous.danger + (next.danger - previous.danger) * eased,
        label: eased < 0.5 ? previous.label : next.label,
    };
}
/**
 * Manages the night overlay and the additive light sprites.
 *
 * Lights are pooled Image objects using one shared radial-gradient texture and
 * tinted per source, so a hundred lanterns cost one texture and no per-frame
 * allocation.
 */
class LightingSystem {
    constructor(scene, textureKey = 'light-radial') {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: scene
        });
        Object.defineProperty(this, "textureKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: textureKey
        });
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lights", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "container", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dayProgress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.42
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sampleDaylight(0.42)
        });
        /** Real seconds for one in-game day. */
        Object.defineProperty(this, "dayLength", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 600
        });
        Object.defineProperty(this, "enabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "flickerTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    /** Build the shared radial gradient texture used by every light. */
    static createLightTexture(scene, key = 'light-radial', size = 256) {
        if (scene.textures.exists(key))
            return;
        const texture = scene.textures.createCanvas(key, size, size);
        if (!texture)
            return;
        const ctx = texture.context;
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        // A slightly convex falloff reads more like a real lamp than a linear ramp.
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.28, 'rgba(255,255,255,0.72)');
        gradient.addColorStop(0.55, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(0.8, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        texture.refresh();
    }
    /**
     * @param depth Render depth for the night overlay.
     * @param lightDepth Render depth for light sprites (below the overlay so the
     *        overlay darkens the world and lights punch back through it).
     */
    create(depth = 880, lightDepth = 879) {
        LightingSystem.createLightTexture(this.scene, this.textureKey);
        const { width, height } = this.scene.scale;
        this.overlay = this.scene.add
            .rectangle(0, 0, width, height, this.state.tint, this.state.tintAlpha)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(depth)
            .setBlendMode(phaser_1.default.BlendModes.MULTIPLY);
        this.container = this.scene.add.container(0, 0).setDepth(lightDepth);
        this.scene.scale.on('resize', this.handleResize, this);
    }
    handleResize() {
        var _a;
        const { width, height } = this.scene.scale;
        (_a = this.overlay) === null || _a === void 0 ? void 0 : _a.setSize(width, height);
    }
    /** Fixed starting time, e.g. restoring a save. */
    setDayProgress(progress) {
        this.dayProgress = ((progress % 1) + 1) % 1;
        this.state = sampleDaylight(this.dayProgress);
        this.applyState();
    }
    getDayProgress() { return this.dayProgress; }
    getState() { return this.state; }
    /** Seconds of real time per in-game day. */
    setDayLength(seconds) {
        this.dayLength = Math.max(60, seconds);
    }
    setEnabled(enabled) {
        var _a, _b;
        this.enabled = enabled;
        (_a = this.overlay) === null || _a === void 0 ? void 0 : _a.setVisible(enabled);
        (_b = this.container) === null || _b === void 0 ? void 0 : _b.setVisible(enabled);
    }
    addLight(source) {
        if (!this.container)
            return;
        const image = this.scene.add
            .image(source.x, source.y, this.textureKey)
            .setBlendMode(phaser_1.default.BlendModes.ADD)
            .setTint(source.color)
            .setDisplaySize(source.radius * 2, source.radius * 2);
        this.container.add(image);
        this.lights.push({ source, image, seed: Math.random() * 1000 });
    }
    /** Move an existing light — used for the player's own torch. */
    moveLight(index, x, y) {
        const light = this.lights[index];
        if (!light)
            return;
        light.source.x = x;
        light.source.y = y;
        light.image.setPosition(x, y);
    }
    clearLights() {
        for (const light of this.lights)
            light.image.destroy();
        this.lights = [];
    }
    /** Advance time and update every light. Call from the scene's update loop. */
    update(deltaMs) {
        if (!this.enabled)
            return;
        this.dayProgress = (this.dayProgress + deltaMs / 1000 / this.dayLength) % 1;
        this.flickerTime += deltaMs / 1000;
        this.state = sampleDaylight(this.dayProgress);
        this.applyState();
    }
    applyState() {
        if (!this.overlay)
            return;
        this.overlay.setFillStyle(this.state.tint, this.state.tintAlpha);
        // Lights fade out as daylight rises — a lantern at noon should barely show.
        const darkness = 1 - this.state.brightness;
        for (const light of this.lights) {
            const { source } = light;
            let alpha = source.intensity * (source.nightOnly ? darkness : 0.35 + darkness * 0.65);
            if (source.flicker) {
                // Two incommensurate sines give an irregular flame without randomness
                // that would strobe frame to frame.
                const flick = Math.sin(this.flickerTime * 11 + light.seed) * 0.6
                    + Math.sin(this.flickerTime * 23.3 + light.seed * 1.7) * 0.4;
                alpha *= 1 + flick * source.flicker;
                const scale = 1 + flick * source.flicker * 0.14;
                light.image.setDisplaySize(source.radius * 2 * scale, source.radius * 2 * scale);
            }
            light.image.setAlpha(Math.max(0, Math.min(1, alpha)));
        }
    }
    /** A one-off light flash — explosions, spell impacts, lightning. */
    flash(x, y, radius, color, duration = 260) {
        if (!this.container)
            return;
        const image = this.scene.add
            .image(x, y, this.textureKey)
            .setBlendMode(phaser_1.default.BlendModes.ADD)
            .setTint(color)
            .setDisplaySize(radius * 2, radius * 2);
        this.container.add(image);
        this.scene.tweens.add({
            targets: image,
            alpha: 0,
            displayWidth: radius * 3,
            displayHeight: radius * 3,
            duration,
            ease: 'Quad.easeOut',
            onComplete: () => image.destroy(),
        });
    }
    destroy() {
        var _a, _b;
        this.scene.scale.off('resize', this.handleResize, this);
        this.clearLights();
        (_a = this.overlay) === null || _a === void 0 ? void 0 : _a.destroy();
        (_b = this.container) === null || _b === void 0 ? void 0 : _b.destroy();
    }
}
exports.LightingSystem = LightingSystem;
/** Warm flame preset — lanterns, braziers, campfires. */
exports.FLAME_LIGHT = { color: 0xffb257, intensity: 0.78, flicker: 0.16, nightOnly: false };
/** Cold arcane preset — rifts, magic. */
exports.ARCANE_LIGHT = { color: 0xb86ce0, intensity: 0.62, flicker: 0.08, nightOnly: false };
/** Forge preset — hotter and steadier than a torch. */
exports.FORGE_LIGHT = { color: 0xff7a3c, intensity: 0.85, flicker: 0.1, nightOnly: false };
/** Window light from an inhabited building. */
exports.WINDOW_LIGHT = { color: 0xffd08a, intensity: 0.5, flicker: 0.03, nightOnly: true };

});
__define("src/data/world.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInterior = exports.getBuildingDoor = exports.INTERIORS = exports.BUILDINGS = exports.RIFT_POINTS = exports.REGION_ENTRANCES = exports.HIDDEN_FORD = exports.SHORTCUT_PORTALS = exports.SECRET_POINTS = exports.RIVER_BRIDGES = exports.MAP_RIVER = exports.MAP_ROADS = exports.MAP_SHAPES = exports.LOCATIONS = exports.WORLD_HEIGHT = exports.WORLD_WIDTH = void 0;
exports.WORLD_WIDTH = 4600;
exports.WORLD_HEIGHT = 3000;
exports.LOCATIONS = [
    { id: 'home', name: 'Дом изгнанника', x: 260, y: 250, w: 400, h: 500, color: 0x353745, danger: 0, ambience: 'home' },
    { id: 'village', name: 'Деревня Серый Холм', x: 690, y: 300, w: 760, h: 680, color: 0x3d4039, danger: 0, ambience: 'village' },
    { id: 'cemetery', name: 'Старое кладбище', x: 1500, y: 230, w: 820, h: 720, color: 0x30353a, danger: 1, ambience: 'cemetery' },
    { id: 'forest', name: 'Шепчущий лес', x: 650, y: 1050, w: 1400, h: 1050, color: 0x263b35, danger: 1, ambience: 'forest' },
    { id: 'ruins', name: 'Проклятые руины', x: 2120, y: 1050, w: 770, h: 900, color: 0x342a40, danger: 2, ambience: 'ruins' },
    { id: 'marsh', name: 'Чёрное болото', x: 2780, y: 180, w: 1050, h: 820, color: 0x263a38, danger: 2, ambience: 'marsh' },
    { id: 'mines', name: 'Старые шахты', x: 3240, y: 1130, w: 620, h: 700, color: 0x3a352f, danger: 2, ambience: 'mine' },
    { id: 'docks', name: 'Пристань перевозчика', x: 2700, y: 2020, w: 1050, h: 700, color: 0x303b42, danger: 1, ambience: 'docks' },
    { id: 'citadel', name: 'Пепельная цитадель', x: 3880, y: 1420, w: 620, h: 1280, color: 0x443138, danger: 3, ambience: 'citadel' },
];
exports.MAP_SHAPES = [
    { id: 'home', label: 'Дом', points: '260,250 620,250 660,310 650,700 280,750 240,520', labelX: 440, labelY: 485, danger: 0 },
    { id: 'village', label: 'Серый Холм', points: '700,300 1400,300 1450,480 1420,930 760,980 680,730', labelX: 1060, labelY: 625, danger: 0 },
    { id: 'cemetery', label: 'Кладбище', points: '1510,230 2250,230 2320,360 2300,900 1570,950 1500,760', labelX: 1900, labelY: 585, danger: 1 },
    { id: 'forest', label: 'Шепчущий лес', points: '650,1050 2000,1050 2050,1230 1980,2000 850,2100 650,1870', labelX: 1340, labelY: 1570, danger: 1 },
    { id: 'ruins', label: 'Проклятые руины', points: '2120,1050 2860,1050 2890,1200 2820,1900 2200,1950 2120,1720', labelX: 2490, labelY: 1495, danger: 2 },
    { id: 'marsh', label: 'Чёрное болото', points: '2780,180 3780,180 3830,350 3780,950 2920,1000 2780,820', labelX: 3300, labelY: 590, danger: 2 },
    { id: 'mines', label: 'Старые шахты', points: '3240,1130 3820,1130 3860,1290 3800,1800 3290,1830 3240,1550', labelX: 3545, labelY: 1480, danger: 2 },
    { id: 'docks', label: 'Пристань', points: '2700,2020 3700,2020 3750,2200 3670,2680 2800,2720 2700,2500', labelX: 3210, labelY: 2380, danger: 1 },
    { id: 'citadel', label: 'Пепельная цитадель', points: '3880,1420 4480,1420 4500,2650 3940,2700 3880,2480', labelX: 4190, labelY: 2080, danger: 3 },
];
exports.MAP_ROADS = [
    [[430, 590], [980, 650], [1770, 680], [2400, 1280], [3510, 1470], [4160, 1900]],
    [[980, 650], [1150, 1190], [1500, 1580], [2450, 1500]],
    [[2400, 1280], [3200, 650], [3480, 650]],
    [[2450, 1500], [3160, 2380], [4140, 2230]],
];
exports.MAP_RIVER = '2480,0 2740,0 2740,3000 2480,3000';
exports.RIVER_BRIDGES = [
    { id: 'north_bridge', name: 'Старый мост', x: 2630, y: 1316, gap: 78 },
    { id: 'south_bridge', name: 'Мост перевозчика', x: 2630, y: 1698, gap: 78 },
];
exports.SECRET_POINTS = [
    {
        id: 'forgotten_crypt', name: 'Забытый склеп', x: 2245, y: 300, kind: 'chest', texture: 'crypt-entrance',
        lore: 'За осевшими надгробиями зияет вход в забытый склеп. Внутри что-то ждало очень долго.',
    },
    {
        id: 'smuggler_cache', name: 'Тайник контрабандиста', x: 2775, y: 2635, kind: 'chest', texture: 'chest-closed',
        lore: 'Под гнилыми досками причала спрятан тюк — плата за молчание, так и не забранная.',
    },
    {
        id: 'hermit_camp', name: 'Лагерь отшельника', x: 790, y: 1980, kind: 'note', texture: 'campfire',
        lore: 'Остывший костёр отшельника. В дневнике строки: «Лес шепчет правду тем, кто уходит с троп».',
    },
    {
        id: 'sunken_shrine', name: 'Затонувшее святилище', x: 3705, y: 285, kind: 'shrine', texture: 'altar',
        lore: 'Полузатопленный алтарь древнее самой топи. Вода расступается, признавая идущего.',
    },
    {
        id: 'ashen_watch', name: 'Разбитый дозор', x: 3300, y: 1160, kind: 'note', texture: 'obelisk',
        lore: 'Обломки дозорной вышки. Обелиск хранит имена тех, кто первым спустился в шахты и не вернулся.',
    },
];
exports.SHORTCUT_PORTALS = [
    {
        id: 'mine_tunnel', name: 'Заброшенный штрек', texture: 'crypt-entrance',
        a: { x: 3300, y: 1780 }, b: { x: 2180, y: 1815 },
    },
    {
        id: 'marsh_causeway', name: 'Топяная гать', texture: 'bridge-plank',
        a: { x: 3720, y: 935 }, b: { x: 3640, y: 2075 },
    },
];
/**
 * A secret third river crossing, hidden by reeds to the far north. Unlike the
 * bridges it is a bare gap in the river collision (a shallow ford), so a player
 * who explores the northern shore finds they can cross without walking down to a
 * bridge. Kept in data so the collision builder and the map agree.
 */
exports.HIDDEN_FORD = { id: 'reed_ford', name: 'Тайный брод', x: 2630, y: 300, gap: 70 };
exports.REGION_ENTRANCES = [
    { id: 'home', x: 430, y: 620 }, { id: 'village', x: 900, y: 670 }, { id: 'cemetery', x: 1525, y: 650 },
    { id: 'forest', x: 1150, y: 1190 }, { id: 'ruins', x: 2280, y: 1080 }, { id: 'marsh', x: 3030, y: 650 },
    { id: 'mines', x: 3300, y: 1450 }, { id: 'docks', x: 3050, y: 2350 }, { id: 'citadel', x: 3915, y: 1860 },
];
exports.RIFT_POINTS = [
    { id: 'forest_rift', name: 'Лесной разлом', x: 1180, y: 1880, reward: 'moon_charm' },
    { id: 'marsh_rift', name: 'Разлом Чёрной топи', x: 3540, y: 820, reward: 'bogreaper' },
    { id: 'citadel_rift', name: 'Пепельный разлом', x: 4200, y: 2220, reward: 'ember_eye' },
];
exports.BUILDINGS = [
    { id: 'player_home', name: 'ДОМ ИЗГНАННИКА', x: 430, y: 420, w: 240, h: 170, wall: 0x4c4651, roof: 0x342d3b, doorX: 0, style: 'home', interior: 'player_home' },
    { id: 'inn', name: 'ПОСТОЯЛЫЙ ДВОР', x: 930, y: 465, w: 210, h: 145, wall: 0x5c5545, roof: 0x40382f, doorX: -28, style: 'inn', interior: 'inn' },
    { id: 'forge', name: 'КУЗНИЦА РУНЫ', x: 1210, y: 520, w: 220, h: 155, wall: 0x5a493c, roof: 0x522e2b, doorX: 28, style: 'forge', interior: 'forge' },
    { id: 'elira_house', name: 'ДОМ ЭЛИРЫ', x: 790, y: 820, w: 170, h: 120, wall: 0x504c43, roof: 0x35332f, doorX: 0, style: 'cottage', interior: 'elira_house' },
    { id: 'herbalist', name: 'ЛАВКА ТРАВНИЦЫ', x: 1100, y: 820, w: 190, h: 130, wall: 0x4b513f, roof: 0x313a2f, doorX: 12, style: 'cottage', interior: 'herbalist' },
    { id: 'chapel', name: 'ЧАСОВНЯ ПЕПЛА', x: 1820, y: 510, w: 220, h: 180, wall: 0x47484c, roof: 0x292a31, doorX: 0, style: 'chapel', interior: 'chapel' },
    { id: 'marsh_hut', name: 'ХИЖИНА ТОПИ', x: 3270, y: 530, w: 190, h: 135, wall: 0x3e4a43, roof: 0x28332f, doorX: -15, style: 'marsh', interior: 'marsh_hut' },
    { id: 'dock_house', name: 'СКЛАД ПРИСТАНИ', x: 3020, y: 2290, w: 250, h: 155, wall: 0x46515a, roof: 0x29323a, doorX: 34, style: 'warehouse', interior: 'dock_house' },
    { id: 'citadel_gatehouse', name: 'ВРАТА ЦИТАДЕЛИ', x: 4130, y: 1770, w: 320, h: 200, wall: 0x5a3e42, roof: 0x38252d, doorX: 0, style: 'citadel', interior: 'citadel_gatehouse' },
];
exports.INTERIORS = [
    { id: 'player_home', name: 'Дом изгнанника', width: 900, height: 620, floor: 0x4b4146, wall: 0x272431, accent: 0x9b5a72, ambience: 'home', chest: true },
    { id: 'inn', name: 'Постоялый двор', width: 980, height: 680, floor: 0x55483b, wall: 0x2b2524, accent: 0xd19a58, ambience: 'inn', chest: true },
    { id: 'forge', name: 'Кузница Руны', width: 900, height: 620, floor: 0x493c37, wall: 0x2b2223, accent: 0xee7654, ambience: 'forge', chest: true },
    { id: 'herbalist', name: 'Лавка травницы', width: 860, height: 600, floor: 0x3f493a, wall: 0x242d27, accent: 0x79bd75, ambience: 'herbalist', chest: true },
    { id: 'elira_house', name: 'Дом Элиры', width: 820, height: 570, floor: 0x494044, wall: 0x29242b, accent: 0xc98fa8, ambience: 'house', chest: true },
    { id: 'chapel', name: 'Часовня и склеп', width: 980, height: 760, floor: 0x3d3e43, wall: 0x202127, accent: 0x9b88be, ambience: 'chapel', chest: true },
    { id: 'marsh_hut', name: 'Хижина Чёрной топи', width: 880, height: 620, floor: 0x35473f, wall: 0x1f2b27, accent: 0x73c69d, ambience: 'marsh', chest: true },
    { id: 'dock_house', name: 'Склад пристани', width: 980, height: 650, floor: 0x3c4850, wall: 0x202931, accent: 0x7eabc5, ambience: 'warehouse', chest: true },
    { id: 'citadel_gatehouse', name: 'Караульня цитадели', width: 1040, height: 720, floor: 0x4a3337, wall: 0x251a1e, accent: 0xe16d54, ambience: 'citadel', chest: true },
];
const getBuildingDoor = (building) => ({
    x: building.x + building.doorX,
    y: building.y + building.h / 2 + 22,
});
exports.getBuildingDoor = getBuildingDoor;
const getInterior = (id) => exports.INTERIORS.find((interior) => interior.id === id);
exports.getInterior = getInterior;

});
__define("src/game/MenuScene.ts", function(exports, module, __req){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuScene = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
const events_1 = __req("src/game/events.ts");
const AudioManager_1 = __req("src/systems/AudioManager.ts");
const SaveSystem_1 = __req("src/systems/SaveSystem.ts");
const world_1 = __req("src/data/world.ts");
const hero_1 = __req("src/systems/sprites/hero.ts");
/**
 * Title screen.
 *
 * The menu is the first promise the game makes, so it shows what the game
 * actually looks like rather than plain text on a gradient: layered parallax
 * ridges, drifting fog, embers, a lit lantern, and the hero standing at the edge
 * of the valley rendered from the same sprite factory used in play.
 */
class MenuScene extends phaser_1.default.Scene {
    constructor() {
        super('MenuScene');
        Object.defineProperty(this, "fogBands", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    create() {
        var _a, _b;
        this.cameras.main.setBackgroundColor('#080a11');
        const { width, height } = this.scale;
        const compact = width < 620;
        const save = new SaveSystem_1.SaveSystem().get();
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
        if (!(0, SaveSystem_1.storageAvailable)()) {
            this.add.text(width / 2, height - (compact ? 42 : 56), 'ВНИМАНИЕ: браузер блокирует сохранения — прогресс не сохранится', {
                fontFamily: 'monospace', fontSize: compact ? '9px' : '11px', color: '#d08a6a',
            }).setOrigin(0.5);
        }
        (_a = this.input.keyboard) === null || _a === void 0 ? void 0 : _a.once('keydown-ENTER', () => this.startGame());
        (_b = this.input.keyboard) === null || _b === void 0 ? void 0 : _b.once('keydown-SPACE', () => this.startGame());
        this.cameras.main.fadeIn(600, 8, 10, 17);
    }
    /** Banded sky gradient, stars, a moon and slow fog. */
    drawSky(width, height) {
        const sky = this.add.graphics();
        // Painted as discrete bands so the gradient stays in the pixel palette.
        for (let i = 0; i < 26; i += 1) {
            const shade = phaser_1.default.Display.Color.Interpolate.ColorWithColor(phaser_1.default.Display.Color.ValueToColor(0x0b0d16), phaser_1.default.Display.Color.ValueToColor(0x241b33), 25, i);
            sky.fillStyle(phaser_1.default.Display.Color.GetColor(shade.r, shade.g, shade.b), 1);
            sky.fillRect(0, (height * 0.62 * i) / 26, width, height * 0.62 / 26 + 1);
        }
        for (let index = 0; index < Math.max(40, Math.floor(width / 18)); index += 1) {
            const star = this.add.rectangle(phaser_1.default.Math.Between(0, width), phaser_1.default.Math.Between(20, Math.floor(height * 0.6)), phaser_1.default.Math.Between(1, 2), phaser_1.default.Math.Between(1, 2), index % 5 === 0 ? 0xc9a4e0 : 0xd8dcea, phaser_1.default.Math.FloatBetween(0.18, 0.75));
            this.tweens.add({
                targets: star,
                alpha: phaser_1.default.Math.FloatBetween(0.05, 0.3),
                duration: phaser_1.default.Math.Between(1400, 3800),
                yoyo: true,
                repeat: -1,
                delay: phaser_1.default.Math.Between(0, 2000),
            });
        }
        // A pale moon gives the ridges a light direction to sit against.
        this.add.circle(width * 0.78, height * 0.17, Math.max(18, width * 0.028), 0xd9d2e8, 0.9);
        this.add.circle(width * 0.78, height * 0.17, Math.max(34, width * 0.05), 0x8f7fb4, 0.1);
        for (let band = 0; band < 3; band += 1) {
            const fog = this.add.rectangle(width / 2, height * (0.58 + band * 0.09), width * 1.6, height * (0.1 + band * 0.03), 0x2a2b40, 0.16 - band * 0.03);
            fog.setData('speed', 6 + band * 5);
            this.fogBands.push(fog);
        }
    }
    /** Three parallax ridge layers, back to front. */
    drawRidges(width, height) {
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
    drawHero(width, height, compact) {
        const key = 'menu-hero';
        if (!this.textures.exists(key)) {
            const canvas = (0, hero_1.renderHeroFrame)('down', 'idle', 0);
            const texture = this.textures.createCanvas(key, hero_1.HERO_W, hero_1.HERO_H);
            if (texture) {
                const ctx = texture.context;
                ctx.imageSmoothingEnabled = false;
                const image = ctx.createImageData(hero_1.HERO_W, hero_1.HERO_H);
                image.data.set(canvas.resolve(hero_1.HERO_SHADE));
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
        const hero = this.add.image(heroX, groundY - (hero_1.HERO_H * scale) / 2, key).setScale(scale);
        this.tweens.add({ targets: hero, y: hero.y - 2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (this.textures.exists('lantern-on')) {
            const lantern = this.add.image(heroX + 26 * scale / 2, groundY - 20 * scale / 2, 'lantern-on').setScale(scale * 0.8);
            this.tweens.add({ targets: lantern, alpha: 0.82, duration: 900, yoyo: true, repeat: -1 });
        }
        // Embers drifting up from the valley floor.
        if (this.textures.exists('ember')) {
            for (let index = 0; index < (compact ? 10 : 20); index += 1) {
                const ember = this.add.image(phaser_1.default.Math.Between(0, width), phaser_1.default.Math.Between(Math.floor(height * 0.7), Math.floor(height)), 'ember').setScale(phaser_1.default.Math.FloatBetween(0.8, 1.9)).setAlpha(phaser_1.default.Math.FloatBetween(0.2, 0.6));
                this.tweens.add({
                    targets: ember,
                    y: ember.y - phaser_1.default.Math.Between(120, 320),
                    x: ember.x + phaser_1.default.Math.Between(-50, 50),
                    alpha: 0,
                    duration: phaser_1.default.Math.Between(3200, 7000),
                    repeat: -1,
                    delay: phaser_1.default.Math.Between(0, 3000),
                });
            }
        }
    }
    createButton(x, y, compact, label) {
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
    update(_time, delta) {
        const { width } = this.scale;
        for (const fog of this.fogBands) {
            fog.x -= fog.getData('speed') * delta / 1000;
            if (fog.x < -width * 0.3)
                fog.x = width * 1.3;
        }
    }
    startGame() {
        void AudioManager_1.audio.unlock();
        events_1.GameEvents.emit('audio-unlock');
        this.cameras.main.flash(160, 168, 100, 141);
        this.cameras.main.fadeOut(420, 9, 11, 18);
        this.time.delayedCall(430, () => {
            var _a;
            const save = new SaveSystem_1.SaveSystem().get();
            if (save.currentScene !== 'world' && (0, world_1.getInterior)(save.currentScene)) {
                const point = (_a = save.playerPosition) !== null && _a !== void 0 ? _a : { x: 430, y: 585 };
                this.scene.start('InteriorScene', { interiorId: save.currentScene, returnX: point.x, returnY: point.y });
            }
            else
                this.scene.start('WorldScene');
        });
    }
}
exports.MenuScene = MenuScene;

});
__define("src/game/events.ts", function(exports, module, __req){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEvents = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
exports.GameEvents = new phaser_1.default.Events.EventEmitter();

});
__define("src/systems/AudioManager.ts", function(exports, module, __req){
"use strict";
/**
 * Trupy's audio manager.
 *
 * Owns the mixer graph and routes everything through it: adaptive music
 * (Music.ts), layered ambience (Ambience.ts) and material-aware sound effects
 * (Sfx.ts). Nothing here loads a file — every sample is synthesised at runtime.
 *
 * The mixer is a real bus layout rather than one gain node: separate music,
 * ambience and SFX buses feed a master chain of convolution reverb send →
 * compressor → limiter, so loud combat ducks cleanly instead of clipping.
 *
 * The public surface is deliberately backwards-compatible with the previous
 * version (`attack`, `hit`, `coin`, `step`, `setRegion`, …) so existing scenes
 * keep working while gaining the richer sound.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.audio = exports.AudioManager = void 0;
const Ambience_1 = __req("src/systems/audio/Ambience.ts");
const Music_1 = __req("src/systems/audio/Music.ts");
const Sfx_1 = __req("src/systems/audio/Sfx.ts");
const Synth_1 = __req("src/systems/audio/Synth.ts");
/** Maps enemy ids to the material they sound like when struck. */
const ENEMY_MATERIAL = {
    husk: 'flesh',
    boneguard: 'bone',
    direwolf: 'flesh',
    wraith: 'shadow',
    bogling: 'flesh',
    cavecrawler: 'chitin',
    ashborn: 'ember',
    nameless: 'shadow',
    cinderlord: 'armour',
};
class AudioManager {
    constructor() {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "master", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "limiter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "musicBus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sfxBus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ambienceBus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reverbSend", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "reverb", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "music", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ambience", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "sfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "musicTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ambienceTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastAmbienceUpdate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "region", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'home'
        });
        Object.defineProperty(this, "intensity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'calm'
        });
        Object.defineProperty(this, "combat", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "unlocked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "rain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { master: 0.85, music: 0.55, sfx: 0.8, ambience: 0.5, enabled: true }
        });
    }
    // ------------------------------------------------------------- lifecycle
    async unlock() {
        var _a;
        if (!this.context)
            this.createGraph();
        if (!this.context)
            return;
        if (this.context.state === 'suspended')
            await this.context.resume();
        this.unlocked = true;
        document.documentElement.dataset.audio = this.context.state;
        this.applyMix();
        (_a = this.ambience) === null || _a === void 0 ? void 0 : _a.start();
        this.startMusicClock();
        this.startAmbienceClock();
        this.ui();
    }
    isUnlocked() {
        var _a;
        return this.unlocked && ((_a = this.context) === null || _a === void 0 ? void 0 : _a.state) === 'running';
    }
    setMix(mix) {
        var _a;
        this.mix = { ...this.mix, ...mix };
        this.applyMix();
        if (this.mix.enabled && this.unlocked) {
            (_a = this.ambience) === null || _a === void 0 ? void 0 : _a.start();
            this.startMusicClock();
            this.startAmbienceClock();
        }
    }
    createGraph() {
        const AudioContextClass = window.AudioContext
            || window.webkitAudioContext;
        if (!AudioContextClass)
            return;
        const context = new AudioContextClass();
        this.context = context;
        this.master = context.createGain();
        this.musicBus = context.createGain();
        this.sfxBus = context.createGain();
        this.ambienceBus = context.createGain();
        this.reverbSend = context.createGain();
        // Convolution reverb gives the valley a sense of physical space. The impulse
        // is generated noise — a real hall response without shipping an audio file.
        this.reverb = context.createConvolver();
        this.reverb.buffer = (0, Synth_1.buildImpulse)(context, 2.6, 2.4, 0.62);
        this.reverbSend.connect(this.reverb);
        this.reverb.connect(this.master);
        // Glue compressor, then a fast limiter so peaks never clip.
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 22;
        compressor.ratio.value = 4.5;
        compressor.attack.value = 0.008;
        compressor.release.value = 0.24;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -2.5;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.06;
        this.limiter = limiter;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.ambienceBus.connect(this.master);
        this.master.connect(compressor);
        compressor.connect(limiter);
        limiter.connect(context.destination);
        // Shared noise buffers — generating these once saves a lot of allocation.
        const white = (0, Synth_1.buildNoise)(context, 2.2, 0);
        const brown = (0, Synth_1.buildNoise)(context, 3, 0.96);
        // Music layer buses, so the director can mix layers independently.
        const layerBus = () => {
            const gain = context.createGain();
            gain.connect(this.musicBus);
            return gain;
        };
        this.music = new Music_1.MusicDirector(context, {
            drone: layerBus(),
            harmony: layerBus(),
            melody: layerBus(),
            percussion: layerBus(),
            space: this.reverbSend,
        });
        this.music.setNoise(white);
        this.ambience = new Ambience_1.AmbienceEngine(context, this.ambienceBus, this.reverbSend, white, brown);
        this.sfx = new Sfx_1.SfxLibrary(context, { sfx: this.sfxBus, space: this.reverbSend }, white, brown);
        this.applyMix();
        document.addEventListener('visibilitychange', () => {
            if (!this.context)
                return;
            if (document.hidden)
                void this.context.suspend();
            else if (this.mix.enabled)
                void this.context.resume();
        });
    }
    applyMix() {
        if (!this.context || !this.master || !this.musicBus || !this.sfxBus || !this.ambienceBus || !this.reverbSend)
            return;
        const now = this.context.currentTime;
        const enabled = this.mix.enabled ? 1 : 0;
        this.master.gain.setTargetAtTime(this.mix.master * enabled, now, 0.03);
        this.musicBus.gain.setTargetAtTime(this.mix.music * 0.75, now, 0.08);
        this.sfxBus.gain.setTargetAtTime(this.mix.sfx * 0.85, now, 0.03);
        this.ambienceBus.gain.setTargetAtTime(this.mix.ambience * 0.6, now, 0.1);
        // Reverb rides with the music level so quiet settings stay dry.
        this.reverbSend.gain.setTargetAtTime(0.55 * Math.max(this.mix.music, this.mix.sfx), now, 0.12);
    }
    // ----------------------------------------------------------------- clocks
    /**
     * The music clock re-arms itself with the current tempo each tick, so tempo
     * changes (entering combat) take effect on the next sixteenth rather than
     * waiting for a restart.
     */
    startMusicClock() {
        if (!this.unlocked || this.musicTimer || !this.mix.enabled || !this.music)
            return;
        const tick = () => {
            if (!this.mix.enabled || !this.music) {
                this.musicTimer = undefined;
                return;
            }
            this.music.step();
            this.musicTimer = window.setTimeout(tick, this.music.stepDuration());
        };
        tick();
    }
    startAmbienceClock() {
        if (!this.unlocked || this.ambienceTimer || !this.mix.enabled)
            return;
        this.lastAmbienceUpdate = performance.now();
        this.ambienceTimer = window.setInterval(() => {
            if (!this.mix.enabled || !this.ambience)
                return;
            const now = performance.now();
            const delta = (now - this.lastAmbienceUpdate) / 1000;
            this.lastAmbienceUpdate = now;
            this.ambience.update(delta, now / 1000);
        }, 250);
    }
    // ------------------------------------------------------------------ state
    setRegion(region, combat = this.combat) {
        var _a, _b, _c;
        const changed = region !== this.region;
        this.region = region;
        this.combat = combat;
        if (changed) {
            (_a = this.music) === null || _a === void 0 ? void 0 : _a.setRegion(region);
            (_b = this.ambience) === null || _b === void 0 ? void 0 : _b.setRegion(region);
            (_c = this.music) === null || _c === void 0 ? void 0 : _c.regionStinger();
        }
        this.refreshIntensity();
    }
    setCombat(combat) {
        if (combat === this.combat)
            return;
        this.combat = combat;
        this.refreshIntensity();
    }
    /** Escalate to the boss score. */
    setBossFight(active) {
        var _a;
        this.intensity = active ? 'boss' : this.combat ? 'combat' : 'calm';
        (_a = this.music) === null || _a === void 0 ? void 0 : _a.setIntensity(this.intensity);
    }
    /** Nearby-danger tension without full combat. */
    setTension(tense) {
        var _a;
        if (this.intensity === 'boss' || this.combat)
            return;
        this.intensity = tense ? 'tense' : 'calm';
        (_a = this.music) === null || _a === void 0 ? void 0 : _a.setIntensity(this.intensity);
    }
    refreshIntensity() {
        var _a;
        if (this.intensity === 'boss')
            return;
        this.intensity = this.combat ? 'combat' : 'calm';
        (_a = this.music) === null || _a === void 0 ? void 0 : _a.setIntensity(this.intensity);
    }
    // ----------------------------------------------------------------- effects
    /** Weapon swing. Kept for API compatibility with the previous version. */
    attack(kind) {
        if (!this.ready())
            return;
        if (kind === 'melee')
            this.sfx.swing('melee');
        else if (kind === 'ranged')
            this.sfx.swing('ranged');
        else
            this.sfx.swing('magic');
    }
    /** Heavy weapon swing. */
    heavyAttack(kind) {
        if (!this.ready())
            return;
        this.sfx.swing(kind, true);
    }
    /** Generic hit, retained for compatibility. */
    hit() {
        if (!this.ready())
            return;
        this.sfx.impact('flesh');
    }
    /** Material-aware impact — the preferred call. */
    impact(enemyType, power = 1, critical = false) {
        var _a;
        if (!this.ready())
            return;
        this.sfx.impact((_a = ENEMY_MATERIAL[enemyType]) !== null && _a !== void 0 ? _a : 'flesh', power, critical);
    }
    parry() { if (this.ready())
        this.sfx.parry(); }
    enemyDeath(enemyType, boss = false) {
        var _a;
        if (!this.ready())
            return;
        if (boss)
            this.sfx.bossDeath();
        else
            this.sfx.death((_a = ENEMY_MATERIAL[enemyType]) !== null && _a !== void 0 ? _a : 'flesh');
    }
    playerHurt(severity = 1) { if (this.ready())
        this.sfx.playerHurt(severity); }
    playerDeath() {
        var _a;
        if (!this.ready())
            return;
        this.sfx.playerDeath();
        (_a = this.music) === null || _a === void 0 ? void 0 : _a.deathMotif();
    }
    dash() { if (this.ready())
        this.sfx.dash(); }
    special(kind) { if (this.ready())
        this.sfx.special(kind); }
    coin(count = 1) { if (this.ready())
        this.sfx.coin(count); }
    quest() { var _a; if (this.ready())
        (_a = this.music) === null || _a === void 0 ? void 0 : _a.fanfare(); }
    heal() { if (this.ready())
        this.sfx.potion(); }
    ui(kind = 'click') {
        if (this.ready())
            this.sfx.ui(kind);
    }
    pickup() { if (this.ready())
        this.sfx.pickup(); }
    chest() { if (this.ready())
        this.sfx.chest(); }
    door(opening = true) { if (this.ready())
        this.sfx.door(opening); }
    craft() { if (this.ready())
        this.sfx.craft(); }
    levelUp() { if (this.ready())
        this.sfx.levelUp(); }
    riftOpen() { if (this.ready())
        this.sfx.riftOpen(); }
    riftClose() { if (this.ready())
        this.sfx.riftClose(); }
    thunder() { if (this.ready())
        this.sfx.thunder(); }
    step(surface = 'grass') {
        if (this.ready())
            this.sfx.step(surface);
    }
    /** Fade a continuous rain bed in or out, 0..1. */
    setRain(amount) {
        if (!this.ready() || !this.context)
            return;
        if (amount <= 0.001) {
            if (this.rain) {
                this.rain.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.6);
                const handle = this.rain;
                this.rain = undefined;
                window.setTimeout(() => handle.stop(), 2200);
            }
            return;
        }
        if (!this.rain)
            this.rain = this.sfx.rainLayer();
        this.rain.gain.gain.setTargetAtTime(amount * 0.12, this.context.currentTime, 0.8);
    }
    /** Trigger a specific ambient one-shot (used for scripted moments). */
    ambientEvent(kind) {
        var _a;
        if (this.ready())
            (_a = this.ambience) === null || _a === void 0 ? void 0 : _a.fireEvent(kind);
    }
    ready() {
        return Boolean(this.unlocked && this.mix.enabled && this.context && this.sfx);
    }
    /** Current musical root — lets visual effects pulse in time with the score. */
    chordRoot() {
        var _a, _b;
        return (_b = (_a = this.music) === null || _a === void 0 ? void 0 : _a.currentChordRoot()) !== null && _b !== void 0 ? _b : 220;
    }
}
exports.AudioManager = AudioManager;
exports.audio = new AudioManager();

});
__define("src/systems/audio/Ambience.ts", function(exports, module, __req){
"use strict";
/**
 * Layered environmental ambience.
 *
 * A single filtered noise loop (what this replaced) sounds like tape hiss. Real
 * places are made of several independent sounds at different rates: a wind bed
 * that swells and fades, water that trickles, occasional distant events — a crow,
 * a dripping stone, a creaking rope. Each region mixes these differently, and the
 * random events are what make a place feel alive rather than looped.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmbienceEngine = exports.AMBIENCE = void 0;
const Synth_1 = __req("src/systems/audio/Synth.ts");
/**
 * Per-region character. The cemetery gets crows and whispers; the mine gets
 * dripping water, falling stone and chains; the docks get gulls and creaking
 * wood. These lists are the main reason each area feels like somewhere specific.
 */
exports.AMBIENCE = {
    home: {
        cutoff: 620, swell: 0.3, bed: 0.5, texture: 0.9, water: 0, space: 0.3, eventGap: 11,
        events: [{ kind: 'creak', weight: 3 }, { kind: 'rustle', weight: 2 }, { kind: 'wind-gust', weight: 2 }, { kind: 'insect', weight: 1 }],
    },
    village: {
        cutoff: 840, swell: 0.22, bed: 0.42, texture: 0.86, water: 0.1, space: 0.24, eventGap: 8,
        events: [{ kind: 'wood-groan', weight: 3 }, { kind: 'bell', weight: 1 }, { kind: 'rustle', weight: 2 }, { kind: 'insect', weight: 2 }, { kind: 'creak', weight: 2 }],
    },
    cemetery: {
        cutoff: 340, swell: 0.44, bed: 0.6, texture: 0.94, water: 0, space: 0.72, eventGap: 7,
        events: [{ kind: 'crow', weight: 4 }, { kind: 'whisper', weight: 3 }, { kind: 'wind-gust', weight: 3 }, { kind: 'stone-fall', weight: 1 }],
    },
    forest: {
        cutoff: 1150, swell: 0.36, bed: 0.52, texture: 0.82, water: 0.08, space: 0.42, eventGap: 6,
        events: [{ kind: 'rustle', weight: 5 }, { kind: 'insect', weight: 3 }, { kind: 'distant-howl', weight: 2 }, { kind: 'crow', weight: 2 }, { kind: 'wind-gust', weight: 2 }],
    },
    ruins: {
        cutoff: 300, swell: 0.4, bed: 0.58, texture: 0.95, water: 0.05, space: 0.74, eventGap: 8,
        events: [{ kind: 'whisper', weight: 4 }, { kind: 'stone-fall', weight: 3 }, { kind: 'chain', weight: 2 }, { kind: 'wind-gust', weight: 2 }],
    },
    marsh: {
        cutoff: 470, swell: 0.38, bed: 0.55, texture: 0.9, water: 0.42, space: 0.5, eventGap: 5,
        events: [{ kind: 'bubble', weight: 5 }, { kind: 'insect', weight: 4 }, { kind: 'drip', weight: 3 }, { kind: 'rustle', weight: 2 }],
    },
    mine: {
        cutoff: 210, swell: 0.3, bed: 0.62, texture: 0.97, water: 0.2, space: 0.88, eventGap: 6,
        events: [{ kind: 'drip', weight: 5 }, { kind: 'stone-fall', weight: 3 }, { kind: 'chain', weight: 3 }, { kind: 'wood-groan', weight: 2 }, { kind: 'whisper', weight: 1 }],
    },
    docks: {
        cutoff: 900, swell: 0.42, bed: 0.5, texture: 0.85, water: 0.55, space: 0.4, eventGap: 6,
        events: [{ kind: 'gull', weight: 4 }, { kind: 'wood-groan', weight: 4 }, { kind: 'creak', weight: 3 }, { kind: 'chain', weight: 2 }, { kind: 'wind-gust', weight: 2 }],
    },
    citadel: {
        cutoff: 260, swell: 0.34, bed: 0.6, texture: 0.93, water: 0, space: 0.7, eventGap: 6,
        events: [{ kind: 'ember-crack', weight: 5 }, { kind: 'chain', weight: 3 }, { kind: 'whisper', weight: 2 }, { kind: 'stone-fall', weight: 2 }, { kind: 'bell', weight: 1 }],
    },
    interior: {
        cutoff: 520, swell: 0.18, bed: 0.34, texture: 0.9, water: 0, space: 0.3, eventGap: 10,
        events: [{ kind: 'creak', weight: 4 }, { kind: 'wood-groan', weight: 3 }, { kind: 'ember-crack', weight: 2 }],
    },
};
/**
 * Runs the ambience beds and schedules random one-shots.
 *
 * The beds are looping buffer sources whose filters and gains are retargeted on
 * region change, so transitions crossfade instead of cutting.
 */
class AmbienceEngine {
    constructor(context, bus, spaceBus, noise, brownNoise) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: context
        });
        Object.defineProperty(this, "bus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: bus
        });
        Object.defineProperty(this, "spaceBus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: spaceBus
        });
        Object.defineProperty(this, "noise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: noise
        });
        Object.defineProperty(this, "brownNoise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: brownNoise
        });
        Object.defineProperty(this, "windSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "windFilter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "windGain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "waterSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "waterFilter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "waterGain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "swellPhase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "nextEventAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "region", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'home'
        });
    }
    start() {
        if (this.windSource)
            return;
        const layer = exports.AMBIENCE[this.region];
        // Wind/room bed: brown noise through a lowpass, slowly modulated.
        this.windGain = this.context.createGain();
        this.windFilter = this.context.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = layer.cutoff;
        this.windFilter.Q.value = 0.7;
        this.windSource = this.context.createBufferSource();
        this.windSource.buffer = this.brownNoise;
        this.windSource.loop = true;
        this.windGain.gain.value = layer.bed * 0.5;
        this.windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.bus);
        this.windSource.start();
        // Water bed: brighter, bandpassed noise for trickle and lapping.
        this.waterGain = this.context.createGain();
        this.waterFilter = this.context.createBiquadFilter();
        this.waterFilter.type = 'bandpass';
        this.waterFilter.frequency.value = 2400;
        this.waterFilter.Q.value = 0.9;
        this.waterSource = this.context.createBufferSource();
        this.waterSource.buffer = this.noise;
        this.waterSource.loop = true;
        this.waterGain.gain.value = layer.water * 0.16;
        this.waterSource.connect(this.waterFilter);
        this.waterFilter.connect(this.waterGain);
        this.waterGain.connect(this.bus);
        this.waterSource.start();
    }
    setRegion(region) {
        var _a, _b, _c;
        if (this.region === region)
            return;
        this.region = region;
        const layer = exports.AMBIENCE[region];
        const now = this.context.currentTime;
        // Long time-constants: the soundscape morphs rather than switching.
        (_a = this.windFilter) === null || _a === void 0 ? void 0 : _a.frequency.setTargetAtTime(layer.cutoff, now, 0.9);
        (_b = this.windGain) === null || _b === void 0 ? void 0 : _b.gain.setTargetAtTime(layer.bed * 0.5, now, 1.1);
        (_c = this.waterGain) === null || _c === void 0 ? void 0 : _c.gain.setTargetAtTime(layer.water * 0.16, now, 1.2);
        this.nextEventAt = 0;
    }
    /** Drive the slow swell and fire random events. Call a few times a second. */
    update(deltaSeconds, timeSeconds) {
        const layer = exports.AMBIENCE[this.region];
        if (this.windGain) {
            // Two out-of-phase sines make the wind breathe irregularly.
            this.swellPhase += deltaSeconds;
            const breath = Math.sin(this.swellPhase * 0.13) * 0.6 + Math.sin(this.swellPhase * 0.052) * 0.4;
            const target = layer.bed * 0.5 * (1 + breath * layer.swell);
            this.windGain.gain.setTargetAtTime(Math.max(0.001, target), this.context.currentTime, 0.6);
        }
        if (this.waterFilter && layer.water > 0) {
            const wobble = 2200 + Math.sin(this.swellPhase * 0.31) * 600;
            this.waterFilter.frequency.setTargetAtTime(wobble, this.context.currentTime, 0.4);
        }
        if (timeSeconds >= this.nextEventAt) {
            if (this.nextEventAt > 0)
                this.fireEvent(this.pickEvent(layer));
            // Jittered gap so events never fall into a rhythm.
            this.nextEventAt = timeSeconds + layer.eventGap * (0.55 + Math.random() * 0.9);
        }
    }
    pickEvent(layer) {
        const total = layer.events.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * total;
        for (const entry of layer.events) {
            roll -= entry.weight;
            if (roll <= 0)
                return entry.kind;
        }
        return layer.events[0].kind;
    }
    /** One-shot ambient sounds, each synthesised from its physical character. */
    fireEvent(kind) {
        const layer = exports.AMBIENCE[this.region];
        const pan = (Math.random() - 0.5) * 1.5;
        const send = layer.space;
        const wet = send > 0.4 ? this.spaceBus : this.bus;
        switch (kind) {
            case 'crow': {
                // Two harsh descending caws.
                const caws = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < caws; i += 1) {
                    (0, Synth_1.playVoice)(this.context, wet, {
                        frequency: 620 + Math.random() * 120,
                        glideTo: 300,
                        duration: 0.16,
                        gain: 0.05,
                        type: 'sawtooth',
                        env: Synth_1.ENV.stab,
                        cutoff: 2400,
                        cutoffTo: 900,
                        resonance: 3.2,
                        delay: i * 0.29,
                        pan,
                    });
                }
                break;
            }
            case 'gull':
                for (let i = 0; i < 3; i += 1) {
                    (0, Synth_1.playVoice)(this.context, wet, {
                        frequency: 900 - i * 60,
                        glideTo: 1250 - i * 80,
                        duration: 0.13,
                        gain: 0.035,
                        type: 'triangle',
                        env: Synth_1.ENV.stab,
                        cutoff: 4200,
                        delay: i * 0.19,
                        pan,
                    });
                }
                break;
            case 'drip':
                // Sharp attack, quick pitch rise: a droplet hitting standing water.
                (0, Synth_1.playVoice)(this.context, wet, {
                    frequency: 900 + Math.random() * 700,
                    glideTo: 2100,
                    duration: 0.05,
                    gain: 0.05,
                    type: 'sine',
                    env: Synth_1.ENV.perc,
                    pan,
                });
                (0, Synth_1.playNoise)(this.context, wet, {
                    buffer: this.noise, duration: 0.04, gain: 0.014,
                    cutoff: 5200, highpass: 1800, env: Synth_1.ENV.perc, delay: 0.005, pan,
                });
                break;
            case 'creak':
            case 'wood-groan': {
                const low = kind === 'wood-groan';
                (0, Synth_1.playVoice)(this.context, wet, {
                    frequency: low ? 78 : 190,
                    glideTo: low ? 62 : 240,
                    duration: low ? 0.9 : 0.42,
                    gain: 0.038,
                    type: 'sawtooth',
                    env: Synth_1.ENV.pad,
                    cutoff: low ? 340 : 700,
                    resonance: 5.5,
                    vibrato: 26,
                    vibratoRate: low ? 5.5 : 11,
                    pan,
                });
                break;
            }
            case 'rustle':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.42, gain: 0.03,
                    cutoff: 4200, cutoffTo: 1600, highpass: 900,
                    env: { attack: 0.09, decay: 0.16, sustain: 0.35, release: 0.28 }, pan,
                });
                break;
            case 'wind-gust':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.brownNoise, duration: 1.7, gain: 0.055,
                    cutoff: 900, cutoffTo: 320,
                    env: { attack: 0.7, decay: 0.5, sustain: 0.5, release: 1.1 }, pan,
                });
                break;
            case 'bubble': {
                // Rising pitch = a bubble surfacing. Cheap and instantly readable.
                const count = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i += 1) {
                    (0, Synth_1.playVoice)(this.context, this.bus, {
                        frequency: 150 + Math.random() * 160,
                        glideTo: 420 + Math.random() * 260,
                        duration: 0.11,
                        gain: 0.03,
                        type: 'sine',
                        env: Synth_1.ENV.perc,
                        delay: i * (0.1 + Math.random() * 0.14),
                        pan: pan + (Math.random() - 0.5) * 0.4,
                    });
                }
                break;
            }
            case 'insect':
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 3100 + Math.random() * 900,
                    duration: 0.5,
                    gain: 0.008,
                    type: 'square',
                    env: { attack: 0.12, decay: 0.1, sustain: 0.5, release: 0.24 },
                    cutoff: 5200,
                    vibrato: 55,
                    vibratoRate: 34,
                    pan,
                });
                break;
            case 'distant-howl':
                (0, Synth_1.playVoice)(this.context, wet, {
                    frequency: 240,
                    glideTo: 400,
                    duration: 1.1,
                    gain: 0.036,
                    type: 'triangle',
                    env: { attack: 0.3, decay: 0.35, sustain: 0.6, release: 0.9 },
                    cutoff: 1100,
                    cutoffTo: 600,
                    vibrato: 22,
                    vibratoRate: 4.4,
                    pan,
                });
                break;
            case 'stone-fall': {
                const hits = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < hits; i += 1) {
                    (0, Synth_1.playNoise)(this.context, wet, {
                        buffer: this.noise, duration: 0.09, gain: 0.04 / (1 + i * 0.5),
                        cutoff: 1400 - i * 200, highpass: 200,
                        env: Synth_1.ENV.perc, delay: i * (0.07 + Math.random() * 0.1), pan,
                    });
                }
                break;
            }
            case 'chain':
                // Rattling links: bright inharmonic noise clicks, irregularly spaced.
                for (let i = 0; i < 4; i += 1) {
                    (0, Synth_1.playNoise)(this.context, wet, {
                        buffer: this.noise,
                        duration: 0.06,
                        gain: 0.018,
                        cutoff: 7600,
                        highpass: 2400,
                        resonance: 4,
                        env: Synth_1.ENV.perc,
                        delay: i * (0.05 + Math.random() * 0.07),
                        pan: pan + (Math.random() - 0.5) * 0.3,
                    });
                    (0, Synth_1.playVoice)(this.context, wet, {
                        frequency: 2100 + Math.random() * 1500,
                        duration: 0.07,
                        gain: 0.01,
                        type: 'square',
                        env: Synth_1.ENV.perc,
                        cutoff: 8000,
                        delay: i * (0.05 + Math.random() * 0.07),
                        pan,
                    });
                }
                break;
            case 'bell':
                (0, Synth_1.playVoice)(this.context, wet, {
                    frequency: 320, duration: 1.9, gain: 0.03, type: 'sine', env: Synth_1.ENV.bell, pan,
                });
                (0, Synth_1.playVoice)(this.context, wet, {
                    frequency: 320 * 2.41, duration: 1.3, gain: 0.012, type: 'sine', env: Synth_1.ENV.bell, delay: 0.01, pan,
                });
                break;
            case 'whisper':
                // Formant-ish filtered noise: unintelligible voices, which is scarier.
                (0, Synth_1.playNoise)(this.context, wet, {
                    buffer: this.noise, duration: 0.85, gain: 0.026,
                    cutoff: 1500, cutoffTo: 700, highpass: 480, resonance: 7,
                    env: { attack: 0.24, decay: 0.2, sustain: 0.45, release: 0.5 }, pan,
                });
                break;
            case 'ember-crack':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.05, gain: 0.03,
                    cutoff: 4600, highpass: 1400, env: Synth_1.ENV.perc, pan,
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 190, glideTo: 90, duration: 0.09, gain: 0.02,
                    type: 'triangle', env: Synth_1.ENV.perc, delay: 0.01, pan,
                });
                break;
        }
    }
    stop() {
        var _a, _b;
        (_a = this.windSource) === null || _a === void 0 ? void 0 : _a.stop();
        (_b = this.waterSource) === null || _b === void 0 ? void 0 : _b.stop();
        this.windSource = undefined;
        this.waterSource = undefined;
    }
}
exports.AmbienceEngine = AmbienceEngine;

});
__define("src/systems/audio/Synth.ts", function(exports, module, __req){
"use strict";
/**
 * Synth primitives for Trupy's runtime audio.
 *
 * The old audio layer fired one bare oscillator per note, which is why it read as
 * a beeping test tone rather than music. Everything here exists to fix that:
 * proper ADSR envelopes so notes have shape, detuned multi-oscillator voices so
 * they have body, a convolution reverb so the valley has space, and filtered
 * noise voices for wind, water and impacts.
 *
 * No audio files — every sample is generated from maths at load time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
exports.applyEnvelope = applyEnvelope;
exports.note = note;
exports.buildImpulse = buildImpulse;
exports.buildNoise = buildNoise;
exports.playVoice = playVoice;
exports.playNoise = playNoise;
exports.playMetal = playMetal;
exports.ENV = {
    pluck: { attack: 0.004, decay: 0.09, sustain: 0.12, release: 0.22 },
    pad: { attack: 0.35, decay: 0.4, sustain: 0.65, release: 1.4 },
    bell: { attack: 0.002, decay: 0.55, sustain: 0.05, release: 1.1 },
    swell: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 2.2 },
    stab: { attack: 0.006, decay: 0.14, sustain: 0.2, release: 0.3 },
    perc: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.08 },
    bass: { attack: 0.02, decay: 0.2, sustain: 0.55, release: 0.5 },
};
/** Apply an ADSR contour to a gain node. Returns when the note fully ends. */
function applyEnvelope(gain, now, duration, peak, env) {
    const attackEnd = now + env.attack;
    const decayEnd = attackEnd + env.decay;
    const sustainLevel = Math.max(0.0001, peak * env.sustain);
    const releaseStart = Math.max(decayEnd, now + duration);
    const end = releaseStart + env.release;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), attackEnd);
    gain.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);
    gain.gain.setValueAtTime(sustainLevel, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    return end;
}
/** Semitone offset from a root frequency. */
function note(root, semitones) {
    return root * 2 ** (semitones / 12);
}
/**
 * Build an impulse response for the reverb: exponentially decaying noise, with
 * the highs rolling off faster than the lows the way a real stone room behaves.
 */
function buildImpulse(context, seconds, decay, damp = 0.55) {
    const rate = context.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = context.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel += 1) {
        const data = buffer.getChannelData(channel);
        let lowpass = 0;
        for (let i = 0; i < length; i += 1) {
            const t = i / length;
            const envelope = (1 - t) ** decay;
            const white = Math.random() * 2 - 1;
            // One-pole lowpass makes the tail darken over time.
            lowpass += (white - lowpass) * (1 - damp * t);
            data[i] = lowpass * envelope;
        }
    }
    return buffer;
}
/** Pre-rendered noise loop. Cheaper than generating noise per-voice. */
function buildNoise(context, seconds, brown = 0) {
    const rate = context.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        if (brown > 0) {
            last = last * brown + white * (1 - brown);
            data[i] = last * (1 / (1 - brown)) * 0.4;
        }
        else {
            data[i] = white;
        }
    }
    return buffer;
}
/**
 * A single synth voice: one or two detuned oscillators through an optional
 * filter, an ADSR gain stage and a panner. Self-cleaning — everything is
 * scheduled up front and torn down on end.
 */
function playVoice(context, destination, options) {
    const { frequency, duration, gain, type = 'triangle', env = exports.ENV.pluck, detune = 0, glideTo, cutoff, resonance = 1, cutoffTo, delay = 0, pan = 0, vibrato = 0, vibratoRate = 5.2, } = options;
    const now = context.currentTime + delay;
    const amp = context.createGain();
    let node = amp;
    if (cutoff !== undefined) {
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.max(60, cutoff), now);
        filter.Q.value = resonance;
        if (cutoffTo !== undefined) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffTo), now + duration + env.release * 0.5);
        }
        amp.connect(filter);
        node = filter;
    }
    if (pan !== 0 && typeof context.createStereoPanner === 'function') {
        const panner = context.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        node.connect(panner);
        node = panner;
    }
    node.connect(destination);
    const end = applyEnvelope(amp, now, duration, gain, env);
    const oscillators = [];
    const voices = detune !== 0 ? [0, detune] : [0];
    for (const cents of voices) {
        const osc = context.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, frequency), now);
        if (cents !== 0)
            osc.detune.setValueAtTime(cents, now);
        if (glideTo !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), now + duration);
        }
        if (vibrato > 0) {
            const lfo = context.createOscillator();
            const lfoGain = context.createGain();
            lfo.frequency.value = vibratoRate;
            lfoGain.gain.value = vibrato;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.detune);
            lfo.start(now);
            lfo.stop(end);
        }
        // Split gain across voices so detuning doesn't double the level.
        const voiceGain = context.createGain();
        voiceGain.gain.value = 1 / voices.length;
        osc.connect(voiceGain);
        voiceGain.connect(amp);
        osc.start(now);
        osc.stop(end + 0.02);
        oscillators.push(osc);
    }
    oscillators[oscillators.length - 1].onended = () => {
        amp.disconnect();
    };
}
/** A filtered noise burst — footsteps, impacts, wind gusts, water. */
function playNoise(context, destination, options) {
    const { buffer, duration, gain, cutoff = 2200, cutoffTo, resonance = 0.8, highpass, env = exports.ENV.perc, delay = 0, pan = 0, playbackRate = 1, } = options;
    const now = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    // Random start offset keeps repeated hits from sounding identical.
    const offset = Math.random() * Math.max(0, buffer.duration - duration - 0.05);
    const amp = context.createGain();
    let node = amp;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(60, cutoff), now);
    filter.Q.value = resonance;
    if (cutoffTo !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffTo), now + duration);
    }
    source.connect(amp);
    amp.connect(filter);
    node = filter;
    if (highpass !== undefined) {
        const hp = context.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = highpass;
        node.connect(hp);
        node = hp;
    }
    if (pan !== 0 && typeof context.createStereoPanner === 'function') {
        const panner = context.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        node.connect(panner);
        node = panner;
    }
    node.connect(destination);
    const end = applyEnvelope(amp, now, duration, gain, env);
    source.start(now, offset);
    source.stop(end + 0.02);
    source.onended = () => amp.disconnect();
}
/** Metallic ring built from inharmonic partials — swords, bells, chains. */
function playMetal(context, destination, frequency, gain, duration = 0.5, delay = 0) {
    // Inharmonic ratios are what separate "metal" from "musical note".
    const partials = [1, 2.41, 3.83, 5.17, 6.94];
    partials.forEach((ratio, index) => {
        playVoice(context, destination, {
            frequency: frequency * ratio,
            duration: duration * (1 - index * 0.13),
            gain: gain / (1.7 + index * 1.5),
            type: index === 0 ? 'triangle' : 'sine',
            env: exports.ENV.bell,
            delay,
            pan: (index % 2 ? 0.14 : -0.14),
        });
    });
}

});
__define("src/systems/audio/Music.ts", function(exports, module, __req){
"use strict";
/**
 * Adaptive music for the Valley of the Dead.
 *
 * The score is generated, not sequenced from a file, but it is written like a
 * score: every region has a mode, a chord progression and an instrument
 * character, and four independent layers (drone, harmony, melody, percussion)
 * fade in and out according to what the player is doing. Wandering the marsh
 * gives you a low reed drone; a boss fight stacks all four layers in a minor
 * mode at double tempo.
 *
 * The point is that the music should tell you where you are and how much trouble
 * you're in without you ever consciously noticing it changed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUSIC_REGIONS = exports.MusicDirector = void 0;
const Synth_1 = __req("src/systems/audio/Synth.ts");
/** Scale degrees as semitone offsets. Modes carry most of the emotional weight. */
const MODE = {
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};
/**
 * Region palettes. Deliberately distinct: the village is warm and modal, the
 * cemetery sits in phrygian half-steps, the citadel uses harmonic minor for that
 * unresolved dread, and the mine drops to locrian — the most unstable mode there
 * is — because nothing down there should feel safe.
 */
const SCORES = {
    home: { root: 174.61, mode: 'dorian', progression: [0, 5, 3, 4], lead: 'triangle', pad: 'sine', tempo: 62, space: 0.4, density: 0.5, brightness: 1500 },
    village: { root: 196, mode: 'mixolydian', progression: [0, 4, 5, 4], lead: 'triangle', pad: 'triangle', tempo: 78, space: 0.3, density: 0.68, brightness: 2100 },
    cemetery: { root: 146.83, mode: 'phrygian', progression: [0, 1, 0, 5], lead: 'sine', pad: 'sine', tempo: 52, space: 0.72, density: 0.34, brightness: 1050 },
    forest: { root: 164.81, mode: 'aeolian', progression: [0, 3, 5, 2], lead: 'triangle', pad: 'sine', tempo: 66, space: 0.5, density: 0.52, brightness: 1750 },
    ruins: { root: 138.59, mode: 'locrian', progression: [0, 4, 1, 5], lead: 'sawtooth', pad: 'sine', tempo: 58, space: 0.68, density: 0.42, brightness: 1250 },
    marsh: { root: 130.81, mode: 'phrygian', progression: [0, 5, 1, 3], lead: 'sine', pad: 'triangle', tempo: 48, space: 0.6, density: 0.3, brightness: 900 },
    mine: { root: 123.47, mode: 'locrian', progression: [0, 1, 4, 1], lead: 'square', pad: 'sine', tempo: 54, space: 0.85, density: 0.28, brightness: 780 },
    docks: { root: 155.56, mode: 'dorian', progression: [0, 5, 4, 2], lead: 'triangle', pad: 'triangle', tempo: 70, space: 0.45, density: 0.56, brightness: 1850 },
    citadel: { root: 116.54, mode: 'harmonicMinor', progression: [0, 5, 4, 6], lead: 'sawtooth', pad: 'sawtooth', tempo: 60, space: 0.7, density: 0.46, brightness: 1400 },
    interior: { root: 185, mode: 'dorian', progression: [0, 3, 4, 3], lead: 'triangle', pad: 'sine', tempo: 68, space: 0.35, density: 0.44, brightness: 1650 },
};
/** Intensity shapes tempo, layer mix and mode darkening. */
const INTENSITY = {
    calm: { tempoScale: 1, drone: 0.9, harmony: 0.6, melody: 0.7, percussion: 0, darken: false },
    tense: { tempoScale: 1.16, drone: 1, harmony: 0.8, melody: 0.5, percussion: 0.35, darken: false },
    combat: { tempoScale: 1.5, drone: 0.85, harmony: 0.95, melody: 0.9, percussion: 1, darken: true },
    boss: { tempoScale: 1.62, drone: 1, harmony: 1, melody: 1, percussion: 1.15, darken: true },
};
/**
 * Sequences the score. One `step()` call per sixteenth note; the caller drives
 * timing so music stays in sync with the game loop rather than a stray timer.
 */
class MusicDirector {
    constructor(context, buses) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: context
        });
        Object.defineProperty(this, "buses", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: buses
        });
        Object.defineProperty(this, "region", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'home'
        });
        Object.defineProperty(this, "intensity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'calm'
        });
        Object.defineProperty(this, "step16", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "bar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Melody contour memory, so phrases feel intentional rather than random. */
        Object.defineProperty(this, "melodyIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 3
        });
        Object.defineProperty(this, "melodyDirection", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "phraseCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastNoteAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        /** Noise buffer, injected by the manager (shared to avoid re-allocating). */
        Object.defineProperty(this, "noise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    setRegion(region) {
        if (this.region === region)
            return;
        this.region = region;
        // Reset the phrase so a new area starts on a downbeat.
        this.step16 = 0;
        this.bar = 0;
        this.melodyIndex = 3;
        this.phraseCounter = 0;
    }
    setIntensity(intensity) {
        this.intensity = intensity;
    }
    getRegion() { return this.region; }
    getIntensity() { return this.intensity; }
    /** Milliseconds per sixteenth note at the current tempo. */
    stepDuration() {
        const score = SCORES[this.region];
        const bpm = score.tempo * INTENSITY[this.intensity].tempoScale;
        return (60 / bpm / 4) * 1000;
    }
    /** Current chord root frequency — used by SFX so hits sit in key. */
    currentChordRoot() {
        const score = SCORES[this.region];
        const degrees = MODE[score.mode];
        const chordDegree = score.progression[this.bar % score.progression.length];
        return (0, Synth_1.note)(score.root, degrees[chordDegree % degrees.length]);
    }
    /** Advance the sequencer by one sixteenth. */
    step() {
        const score = SCORES[this.region];
        const mix = INTENSITY[this.intensity];
        const degrees = MODE[score.mode];
        const beat = Math.floor(this.step16 / 4) % 4;
        const sixteenth = this.step16 % 16;
        const chordDegree = score.progression[this.bar % score.progression.length];
        const chordRoot = (0, Synth_1.note)(score.root, degrees[chordDegree % degrees.length]);
        const stepSeconds = this.stepDuration() / 1000;
        const reverbSend = score.space;
        // ---- Drone: the floor of the mix. One long low note per bar.
        if (sixteenth === 0 && mix.drone > 0) {
            const droneGain = 0.05 * mix.drone;
            (0, Synth_1.playVoice)(this.context, this.buses.drone, {
                frequency: chordRoot / 2,
                duration: stepSeconds * 15,
                gain: droneGain,
                type: score.pad,
                env: Synth_1.ENV.swell,
                detune: 7,
                cutoff: 420 + score.brightness * 0.1,
            });
            // Fifth above, quieter — gives the drone weight without muddying it.
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: (chordRoot / 2) * 1.5,
                duration: stepSeconds * 14,
                gain: droneGain * 0.4 * reverbSend,
                type: 'sine',
                env: Synth_1.ENV.swell,
            });
        }
        // ---- Harmony: arpeggiated chord tones on the off-beats.
        if (mix.harmony > 0 && sixteenth % 4 === 2) {
            const chordTones = [0, 2, 4, 6];
            const tone = chordTones[(Math.floor(this.step16 / 4) + this.bar) % chordTones.length];
            const degree = (chordDegree + tone) % degrees.length;
            const octave = tone >= 4 ? 1 : 0;
            (0, Synth_1.playVoice)(this.context, this.buses.harmony, {
                frequency: (0, Synth_1.note)(score.root, degrees[degree]) * (1 + octave),
                duration: stepSeconds * 2.6,
                gain: 0.028 * mix.harmony,
                type: score.pad,
                env: Synth_1.ENV.pad,
                detune: 5,
                cutoff: score.brightness * 0.7,
                pan: (tone % 2 ? 0.22 : -0.22),
            });
        }
        // ---- Melody: a wandering line with real contour. It steps through the mode,
        // turns around at the edges of its range, and rests between phrases so it
        // breathes instead of noodling forever.
        const melodyChance = score.density * mix.melody;
        const onMelodyGrid = sixteenth % 2 === 0;
        if (onMelodyGrid && this.step16 !== this.lastNoteAt) {
            // Deterministic-ish pseudo random keeps phrasing musical but varied.
            const roll = pseudoRandom(this.step16 * 7 + this.bar * 31 + score.root);
            if (roll < melodyChance) {
                this.melodyIndex += this.melodyDirection * (roll < melodyChance * 0.3 ? 2 : 1);
                if (this.melodyIndex > 9) {
                    this.melodyIndex = 9;
                    this.melodyDirection = -1;
                }
                if (this.melodyIndex < 0) {
                    this.melodyIndex = 0;
                    this.melodyDirection = 1;
                }
                // Occasionally reverse direction mid-phrase for interest.
                if (roll > melodyChance * 0.86)
                    this.melodyDirection *= -1;
                const degreeIndex = this.melodyIndex % degrees.length;
                const octaveShift = Math.floor(this.melodyIndex / degrees.length);
                let semitone = degrees[degreeIndex] + octaveShift * 12;
                if (mix.darken && degreeIndex === 1)
                    semitone -= 1;
                const isAccent = beat === 0 && sixteenth % 8 === 0;
                (0, Synth_1.playVoice)(this.context, this.buses.melody, {
                    frequency: (0, Synth_1.note)(score.root * 2, semitone),
                    duration: stepSeconds * (isAccent ? 3.4 : 1.9),
                    gain: (isAccent ? 0.05 : 0.034) * mix.melody,
                    type: score.lead,
                    env: this.intensity === 'calm' ? Synth_1.ENV.bell : Synth_1.ENV.pluck,
                    cutoff: score.brightness,
                    cutoffTo: score.brightness * 0.55,
                    resonance: 1.6,
                    vibrato: this.intensity === 'boss' ? 12 : 5,
                    pan: 0.1,
                });
                // Reverb tail on the melody makes the space audible.
                (0, Synth_1.playVoice)(this.context, this.buses.space, {
                    frequency: (0, Synth_1.note)(score.root * 2, semitone),
                    duration: stepSeconds * 2,
                    gain: 0.02 * reverbSend * mix.melody,
                    type: 'sine',
                    env: Synth_1.ENV.bell,
                    delay: 0.03,
                });
                this.phraseCounter += 1;
                this.lastNoteAt = this.step16;
            }
        }
        // ---- Percussion: only appears when things get dangerous, which is what
        // makes combat feel different rather than just louder.
        if (mix.percussion > 0) {
            const kickPattern = this.intensity === 'boss' ? [0, 6, 8, 14] : [0, 8];
            const snarePattern = this.intensity === 'boss' ? [4, 12] : [12];
            if (kickPattern.includes(sixteenth)) {
                (0, Synth_1.playVoice)(this.context, this.buses.percussion, {
                    frequency: 82,
                    duration: 0.1,
                    gain: 0.1 * mix.percussion,
                    type: 'sine',
                    env: Synth_1.ENV.perc,
                    glideTo: 40,
                });
            }
            if (snarePattern.includes(sixteenth)) {
                (0, Synth_1.playNoise)(this.context, this.buses.percussion, {
                    buffer: this.noise,
                    duration: 0.09,
                    gain: 0.05 * mix.percussion,
                    cutoff: 3400,
                    highpass: 900,
                    env: Synth_1.ENV.perc,
                });
            }
            // Hi-hat ticks at boss intensity add urgency.
            if (this.intensity === 'boss' && sixteenth % 2 === 0) {
                (0, Synth_1.playNoise)(this.context, this.buses.percussion, {
                    buffer: this.noise,
                    duration: 0.03,
                    gain: 0.016 * mix.percussion,
                    cutoff: 9000,
                    highpass: 5200,
                    env: Synth_1.ENV.perc,
                });
            }
        }
        this.step16 += 1;
        if (this.step16 % 16 === 0) {
            this.bar += 1;
            // Rest for a bar every four phrases so the melody has punctuation.
            if (this.phraseCounter > 14)
                this.phraseCounter = 0;
        }
    }
    setNoise(buffer) { this.noise = buffer; }
    /** A short stinger when the player enters a new region. */
    regionStinger() {
        const score = SCORES[this.region];
        const degrees = MODE[score.mode];
        [0, 4, 2].forEach((degree, index) => {
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: (0, Synth_1.note)(score.root * 2, degrees[degree % degrees.length]),
                duration: 0.9,
                gain: 0.036,
                type: 'sine',
                env: Synth_1.ENV.bell,
                delay: index * 0.075,
            });
        });
    }
    /** Triumphant flourish — quest turn-in, tier unlock. */
    fanfare() {
        const score = SCORES[this.region];
        [0, 4, 7, 12].forEach((semitone, index) => {
            (0, Synth_1.playVoice)(this.context, this.buses.melody, {
                frequency: (0, Synth_1.note)(score.root * 2, semitone),
                duration: 0.5,
                gain: 0.045,
                type: 'triangle',
                env: Synth_1.ENV.bell,
                delay: index * 0.085,
                detune: 6,
            });
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: (0, Synth_1.note)(score.root * 2, semitone),
                duration: 1.3,
                gain: 0.03,
                type: 'sine',
                env: Synth_1.ENV.bell,
                delay: index * 0.085 + 0.02,
            });
        });
    }
    /** Descending figure for death — the score giving up. */
    deathMotif() {
        const score = SCORES[this.region];
        [0, -2, -5, -9, -12].forEach((semitone, index) => {
            (0, Synth_1.playVoice)(this.context, this.buses.melody, {
                frequency: (0, Synth_1.note)(score.root, semitone),
                duration: 0.8,
                gain: 0.05,
                type: 'sine',
                env: Synth_1.ENV.pad,
                delay: index * 0.18,
                cutoff: 900,
                cutoffTo: 300,
            });
        });
    }
}
exports.MusicDirector = MusicDirector;
/** Cheap deterministic hash to 0..1 — musical decisions need repeatability. */
function pseudoRandom(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}
exports.MUSIC_REGIONS = Object.keys(SCORES);

});
__define("src/systems/audio/Sfx.ts", function(exports, module, __req){
"use strict";
/**
 * Combat and interaction sound effects.
 *
 * Every sound is designed from what physically happens: a sword hitting bone is a
 * hard transient plus a short woody body; hitting armour adds a metallic ring;
 * hitting a wraith is mostly filtered air. Material-aware impacts are the single
 * biggest upgrade to combat feel here — the player hears what they hit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SfxLibrary = void 0;
const Synth_1 = __req("src/systems/audio/Synth.ts");
class SfxLibrary {
    constructor(context, buses, noise, brownNoise) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: context
        });
        Object.defineProperty(this, "buses", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: buses
        });
        Object.defineProperty(this, "noise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: noise
        });
        Object.defineProperty(this, "brownNoise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: brownNoise
        });
        Object.defineProperty(this, "footstepAlternate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    get bus() { return this.buses.sfx; }
    // ---------------------------------------------------------------- attacks
    /** Weapon swing — a whoosh whose pitch and body follow the weapon class. */
    swing(kind, heavy = false) {
        if (kind === 'melee') {
            // Air being displaced: a fast downward filter sweep on noise.
            (0, Synth_1.playNoise)(this.context, this.bus, {
                buffer: this.noise,
                duration: heavy ? 0.2 : 0.13,
                gain: heavy ? 0.09 : 0.062,
                cutoff: heavy ? 2600 : 4200,
                cutoffTo: heavy ? 420 : 700,
                highpass: 320,
                resonance: 2.4,
                env: { attack: 0.008, decay: 0.06, sustain: 0.3, release: 0.1 },
            });
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: heavy ? 170 : 260,
                glideTo: heavy ? 62 : 96,
                duration: heavy ? 0.17 : 0.11,
                gain: 0.035,
                type: 'triangle',
                env: Synth_1.ENV.perc,
            });
        }
        else if (kind === 'ranged') {
            // Bowstring release: sharp click plus a short taut thrum.
            (0, Synth_1.playNoise)(this.context, this.bus, {
                buffer: this.noise, duration: 0.05, gain: 0.055,
                cutoff: 5200, highpass: 1400, env: Synth_1.ENV.perc,
            });
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: 420, glideTo: 210, duration: 0.1, gain: 0.04,
                type: 'square', env: Synth_1.ENV.perc, cutoff: 2400,
            });
        }
        else {
            // Spellcast: rising detuned tone with a shimmer above it.
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: 220, glideTo: 880, duration: 0.28, gain: 0.05,
                type: 'triangle', env: Synth_1.ENV.stab, detune: 14, cutoff: 900, cutoffTo: 4200, resonance: 3,
            });
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: 1760, duration: 0.5, gain: 0.026, type: 'sine', env: Synth_1.ENV.bell, delay: 0.06,
            });
        }
    }
    /**
     * Impact. Material choice changes the whole character, which is what makes
     * different enemies feel physically different to fight.
     */
    impact(material, power = 1, critical = false) {
        const gain = 0.06 * Math.min(1.6, power);
        switch (material) {
            case 'bone':
                // Hard, dry, hollow: high transient + short woody resonance.
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.06, gain: gain * 1.1,
                    cutoff: 3800, cutoffTo: 900, highpass: 400, env: Synth_1.ENV.perc,
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 380, glideTo: 150, duration: 0.11, gain: gain * 0.7,
                    type: 'triangle', env: Synth_1.ENV.perc, cutoff: 1800,
                });
                break;
            case 'armour':
                // Metal on metal: inharmonic ring over a heavy thud.
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.05, gain: gain,
                    cutoff: 6200, highpass: 1200, env: Synth_1.ENV.perc,
                });
                (0, Synth_1.playMetal)(this.context, this.buses.space, 620, gain * 0.5, 0.44);
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 96, glideTo: 52, duration: 0.13, gain: gain * 0.8,
                    type: 'sine', env: Synth_1.ENV.perc,
                });
                break;
            case 'shadow':
                // Barely physical: a soft filtered gust with a dissonant tail.
                (0, Synth_1.playNoise)(this.context, this.buses.space, {
                    buffer: this.brownNoise, duration: 0.3, gain: gain * 0.9,
                    cutoff: 1500, cutoffTo: 420, resonance: 3,
                    env: { attack: 0.01, decay: 0.12, sustain: 0.3, release: 0.24 },
                });
                (0, Synth_1.playVoice)(this.context, this.buses.space, {
                    frequency: 300, glideTo: 190, duration: 0.28, gain: gain * 0.45,
                    type: 'sine', env: Synth_1.ENV.pad, detune: 30,
                });
                break;
            case 'chitin':
                // Brittle shell: bright crack with a hollow click under it.
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.05, gain: gain * 1.15,
                    cutoff: 7200, highpass: 2200, resonance: 3, env: Synth_1.ENV.perc,
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 720, glideTo: 260, duration: 0.07, gain: gain * 0.6,
                    type: 'square', env: Synth_1.ENV.perc, cutoff: 3400,
                });
                break;
            case 'stone':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.08, gain: gain,
                    cutoff: 1700, cutoffTo: 380, highpass: 180, env: Synth_1.ENV.perc,
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 120, glideTo: 58, duration: 0.13, gain: gain * 0.7,
                    type: 'sine', env: Synth_1.ENV.perc,
                });
                break;
            case 'ember':
                // Wet-hot: a hiss plus a low roar.
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.22, gain: gain * 0.85,
                    cutoff: 5400, cutoffTo: 1800, highpass: 900,
                    env: { attack: 0.004, decay: 0.1, sustain: 0.3, release: 0.16 },
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 150, glideTo: 70, duration: 0.2, gain: gain * 0.7,
                    type: 'sawtooth', env: Synth_1.ENV.perc, cutoff: 700,
                });
                break;
            case 'flesh':
            default:
                // Soft, damped, low: no ring at all.
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.brownNoise, duration: 0.09, gain: gain * 1.2,
                    cutoff: 900, cutoffTo: 260, env: Synth_1.ENV.perc,
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 130, glideTo: 62, duration: 0.12, gain: gain * 0.75,
                    type: 'sine', env: Synth_1.ENV.perc,
                });
                break;
        }
        if (critical) {
            // Crits get a bright metallic accent so they're unmistakable.
            (0, Synth_1.playMetal)(this.context, this.buses.space, 1180, 0.05, 0.6, 0.02);
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: 1600, glideTo: 2600, duration: 0.09, gain: 0.036,
                type: 'square', env: Synth_1.ENV.perc, delay: 0.015,
            });
        }
    }
    /** Parry / block — a bright metallic clang with a fast decay. */
    parry() {
        (0, Synth_1.playMetal)(this.context, this.buses.space, 900, 0.075, 0.55);
        (0, Synth_1.playNoise)(this.context, this.bus, {
            buffer: this.noise, duration: 0.04, gain: 0.06,
            cutoff: 8000, highpass: 2600, env: Synth_1.ENV.perc,
        });
    }
    /** Enemy death — a descending groan whose character follows the material. */
    death(material) {
        if (material === 'bone' || material === 'chitin') {
            // Clatter: a scatter of dry hits.
            for (let i = 0; i < 5; i += 1) {
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.06, gain: 0.038 / (1 + i * 0.4),
                    cutoff: 3200 - i * 380, highpass: 500, env: Synth_1.ENV.perc,
                    delay: i * (0.055 + Math.random() * 0.05),
                    pan: (Math.random() - 0.5),
                });
            }
        }
        else if (material === 'shadow') {
            (0, Synth_1.playNoise)(this.context, this.buses.space, {
                buffer: this.brownNoise, duration: 0.8, gain: 0.055,
                cutoff: 1400, cutoffTo: 200,
                env: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
            });
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: 340, glideTo: 90, duration: 0.75, gain: 0.04,
                type: 'sine', env: Synth_1.ENV.pad, detune: 24,
            });
        }
        else if (material === 'ember') {
            (0, Synth_1.playNoise)(this.context, this.bus, {
                buffer: this.noise, duration: 0.7, gain: 0.06,
                cutoff: 3600, cutoffTo: 400, highpass: 300,
                env: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.5 },
            });
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: 180, glideTo: 48, duration: 0.6, gain: 0.05,
                type: 'sawtooth', env: Synth_1.ENV.pad, cutoff: 800, cutoffTo: 200,
            });
        }
        else {
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: 260, glideTo: 70, duration: 0.5, gain: 0.055,
                type: 'triangle', env: Synth_1.ENV.pad, cutoff: 1100, cutoffTo: 300, vibrato: 18,
            });
            (0, Synth_1.playNoise)(this.context, this.bus, {
                buffer: this.brownNoise, duration: 0.3, gain: 0.03,
                cutoff: 700, cutoffTo: 200, env: Synth_1.ENV.perc, delay: 0.05,
            });
        }
    }
    /** Boss death — a long, heavy collapse worth stopping to hear. */
    bossDeath() {
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 210, glideTo: 42, duration: 1.6, gain: 0.075,
            type: 'sawtooth', env: { attack: 0.02, decay: 0.5, sustain: 0.5, release: 1.4 },
            cutoff: 1400, cutoffTo: 160, vibrato: 30, vibratoRate: 3.2,
        });
        for (let i = 0; i < 7; i += 1) {
            (0, Synth_1.playNoise)(this.context, this.buses.space, {
                buffer: this.brownNoise, duration: 0.3, gain: 0.05 / (1 + i * 0.3),
                cutoff: 1200 - i * 120, env: Synth_1.ENV.perc,
                delay: 0.1 + i * 0.13, pan: (Math.random() - 0.5) * 1.2,
            });
        }
        (0, Synth_1.playMetal)(this.context, this.buses.space, 260, 0.05, 2.4, 0.2);
    }
    // ------------------------------------------------------------- the player
    /** Player takes damage — a dull impact plus a brief tinnitus ring. */
    playerHurt(severity = 1) {
        (0, Synth_1.playNoise)(this.context, this.bus, {
            buffer: this.brownNoise, duration: 0.14, gain: 0.075 * severity,
            cutoff: 620, cutoffTo: 190, env: Synth_1.ENV.perc,
        });
        (0, Synth_1.playVoice)(this.context, this.bus, {
            frequency: 110, glideTo: 48, duration: 0.18, gain: 0.06 * severity,
            type: 'sine', env: Synth_1.ENV.perc,
        });
        if (severity > 1.1) {
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: 3400, duration: 0.7, gain: 0.014,
                type: 'sine', env: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.5 },
            });
        }
    }
    playerDeath() {
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 180, glideTo: 40, duration: 1.4, gain: 0.07,
            type: 'triangle', env: { attack: 0.01, decay: 0.4, sustain: 0.5, release: 1.2 },
            cutoff: 900, cutoffTo: 120,
        });
        (0, Synth_1.playNoise)(this.context, this.buses.space, {
            buffer: this.brownNoise, duration: 1.2, gain: 0.05,
            cutoff: 500, cutoffTo: 120,
            env: { attack: 0.02, decay: 0.4, sustain: 0.4, release: 0.9 },
        });
    }
    dash() {
        (0, Synth_1.playNoise)(this.context, this.bus, {
            buffer: this.noise, duration: 0.22, gain: 0.055,
            cutoff: 3600, cutoffTo: 600, highpass: 500, resonance: 2.6,
            env: { attack: 0.006, decay: 0.08, sustain: 0.3, release: 0.14 },
        });
        (0, Synth_1.playVoice)(this.context, this.bus, {
            frequency: 520, glideTo: 140, duration: 0.18, gain: 0.03,
            type: 'triangle', env: Synth_1.ENV.perc,
        });
    }
    /** Ability activation — a charged, rising swell. */
    special(kind) {
        const base = kind === 'magic' ? 180 : kind === 'ranged' ? 240 : 150;
        (0, Synth_1.playVoice)(this.context, this.bus, {
            frequency: base, glideTo: base * 5, duration: 0.34, gain: 0.06,
            type: kind === 'magic' ? 'sawtooth' : 'triangle',
            env: Synth_1.ENV.stab, detune: 18, cutoff: 700, cutoffTo: 5200, resonance: 4,
        });
        (0, Synth_1.playMetal)(this.context, this.buses.space, base * 6, 0.045, 0.9, 0.05);
        (0, Synth_1.playNoise)(this.context, this.bus, {
            buffer: this.noise, duration: 0.3, gain: 0.04,
            cutoff: 1200, cutoffTo: 6000, highpass: 400,
            env: { attack: 0.12, decay: 0.1, sustain: 0.4, release: 0.18 },
        });
    }
    step(surface = 'grass') {
        this.footstepAlternate = 1 - this.footstepAlternate;
        // Alternating pitch makes a stride read as left/right rather than a tick.
        const pitch = 1 + (this.footstepAlternate ? 0.09 : -0.06);
        switch (surface) {
            case 'stone':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.05, gain: 0.03,
                    cutoff: 2400 * pitch, highpass: 400, env: Synth_1.ENV.perc,
                });
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 150 * pitch, glideTo: 80, duration: 0.06, gain: 0.018, type: 'sine', env: Synth_1.ENV.perc,
                });
                break;
            case 'wood':
                // Hollow: a resonant low thump with a knock on top.
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 190 * pitch, glideTo: 110, duration: 0.09, gain: 0.026,
                    type: 'triangle', env: Synth_1.ENV.perc, cutoff: 1200, resonance: 3.5,
                });
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.035, gain: 0.016,
                    cutoff: 3200, highpass: 800, env: Synth_1.ENV.perc,
                });
                break;
            case 'water':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.16, gain: 0.03,
                    cutoff: 3600 * pitch, cutoffTo: 1200, highpass: 700,
                    env: { attack: 0.005, decay: 0.07, sustain: 0.3, release: 0.1 },
                });
                break;
            case 'mud':
                // Suction: brown noise with a slow-ish attack.
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.brownNoise, duration: 0.14, gain: 0.032,
                    cutoff: 700 * pitch, cutoffTo: 240,
                    env: { attack: 0.012, decay: 0.06, sustain: 0.35, release: 0.1 },
                });
                break;
            case 'gravel':
                for (let i = 0; i < 3; i += 1) {
                    (0, Synth_1.playNoise)(this.context, this.bus, {
                        buffer: this.noise, duration: 0.03, gain: 0.014,
                        cutoff: 4200, highpass: 1200, env: Synth_1.ENV.perc, delay: i * 0.014,
                    });
                }
                break;
            case 'snow':
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.09, gain: 0.02,
                    cutoff: 1400, highpass: 300, env: Synth_1.ENV.perc,
                });
                break;
            case 'grass':
            default:
                (0, Synth_1.playNoise)(this.context, this.bus, {
                    buffer: this.noise, duration: 0.07, gain: 0.022,
                    cutoff: 2000 * pitch, cutoffTo: 700, highpass: 350, env: Synth_1.ENV.perc,
                });
                break;
        }
    }
    // ------------------------------------------------------------- interface
    coin(count = 1) {
        for (let i = 0; i < Math.min(4, count); i += 1) {
            (0, Synth_1.playMetal)(this.context, this.bus, 1500 + Math.random() * 700, 0.03, 0.3, i * 0.045);
        }
    }
    pickup() {
        (0, Synth_1.playVoice)(this.context, this.bus, {
            frequency: 620, glideTo: 940, duration: 0.09, gain: 0.036,
            type: 'triangle', env: Synth_1.ENV.pluck,
        });
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 1240, duration: 0.3, gain: 0.018, type: 'sine', env: Synth_1.ENV.bell, delay: 0.03,
        });
    }
    potion() {
        // Glass clink, then a warm rising swell for the healing itself.
        (0, Synth_1.playMetal)(this.context, this.bus, 2100, 0.03, 0.22);
        (0, Synth_1.playVoice)(this.context, this.bus, {
            frequency: 380, glideTo: 880, duration: 0.42, gain: 0.045,
            type: 'sine', env: Synth_1.ENV.pad, detune: 8,
        });
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 1320, duration: 0.7, gain: 0.022, type: 'sine', env: Synth_1.ENV.bell, delay: 0.1,
        });
    }
    ui(kind = 'click') {
        switch (kind) {
            case 'open':
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 420, glideTo: 620, duration: 0.07, gain: 0.026, type: 'triangle', env: Synth_1.ENV.pluck,
                });
                break;
            case 'close':
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 560, glideTo: 340, duration: 0.07, gain: 0.024, type: 'triangle', env: Synth_1.ENV.pluck,
                });
                break;
            case 'error':
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 200, glideTo: 150, duration: 0.16, gain: 0.038, type: 'square', env: Synth_1.ENV.stab, cutoff: 900,
                });
                break;
            case 'click':
            default:
                (0, Synth_1.playVoice)(this.context, this.bus, {
                    frequency: 520, duration: 0.03, gain: 0.02, type: 'square', env: Synth_1.ENV.perc, cutoff: 2600,
                });
                break;
        }
    }
    door(opening = true) {
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: opening ? 90 : 110,
            glideTo: opening ? 130 : 70,
            duration: 0.6, gain: 0.045, type: 'sawtooth',
            env: Synth_1.ENV.pad, cutoff: 420, resonance: 6, vibrato: 20, vibratoRate: 7,
        });
        (0, Synth_1.playNoise)(this.context, this.bus, {
            buffer: this.brownNoise, duration: 0.3, gain: 0.03,
            cutoff: 600, cutoffTo: 200, env: Synth_1.ENV.perc, delay: 0.24,
        });
    }
    chest() {
        // Latch, hinge, then a bright reveal chord.
        (0, Synth_1.playMetal)(this.context, this.bus, 780, 0.045, 0.3);
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 120, glideTo: 170, duration: 0.4, gain: 0.035,
            type: 'sawtooth', env: Synth_1.ENV.pad, cutoff: 500, resonance: 5, delay: 0.06,
        });
        [0, 4, 7].forEach((semi, i) => {
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: 660 * 2 ** (semi / 12), duration: 0.7, gain: 0.024,
                type: 'sine', env: Synth_1.ENV.bell, delay: 0.2 + i * 0.06,
            });
        });
    }
    craft() {
        // Hammer on anvil, three times, then a metallic ring.
        for (let i = 0; i < 3; i += 1) {
            (0, Synth_1.playNoise)(this.context, this.bus, {
                buffer: this.noise, duration: 0.05, gain: 0.06,
                cutoff: 5200, highpass: 900, env: Synth_1.ENV.perc, delay: i * 0.16,
            });
            (0, Synth_1.playMetal)(this.context, this.buses.space, 540 + i * 90, 0.045, 0.5, i * 0.16);
        }
        (0, Synth_1.playMetal)(this.context, this.buses.space, 1320, 0.04, 1.4, 0.52);
    }
    levelUp() {
        [0, 4, 7, 12, 16].forEach((semi, i) => {
            (0, Synth_1.playVoice)(this.context, this.bus, {
                frequency: 330 * 2 ** (semi / 12), duration: 0.5, gain: 0.04,
                type: 'triangle', env: Synth_1.ENV.bell, delay: i * 0.075, detune: 7,
            });
            (0, Synth_1.playVoice)(this.context, this.buses.space, {
                frequency: 330 * 2 ** (semi / 12) * 2, duration: 0.9, gain: 0.02,
                type: 'sine', env: Synth_1.ENV.bell, delay: i * 0.075 + 0.03,
            });
        });
    }
    riftOpen() {
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 60, glideTo: 240, duration: 1.5, gain: 0.07,
            type: 'sawtooth', env: { attack: 0.5, decay: 0.4, sustain: 0.6, release: 0.9 },
            cutoff: 300, cutoffTo: 2600, resonance: 5, detune: 26,
        });
        (0, Synth_1.playNoise)(this.context, this.buses.space, {
            buffer: this.brownNoise, duration: 1.4, gain: 0.05,
            cutoff: 400, cutoffTo: 3200,
            env: { attack: 0.6, decay: 0.3, sustain: 0.6, release: 0.7 },
        });
    }
    riftClose() {
        (0, Synth_1.playVoice)(this.context, this.buses.space, {
            frequency: 320, glideTo: 50, duration: 1.1, gain: 0.06,
            type: 'sawtooth', env: Synth_1.ENV.pad, cutoff: 2400, cutoffTo: 200, detune: 22,
        });
    }
    thunder() {
        // Distant storm: layered brown-noise rumbles with slow, irregular spacing.
        for (let i = 0; i < 4; i += 1) {
            (0, Synth_1.playNoise)(this.context, this.buses.space, {
                buffer: this.brownNoise,
                duration: 1.2 + Math.random() * 0.9,
                gain: 0.06 / (1 + i * 0.35),
                cutoff: 380 - i * 50, cutoffTo: 110,
                env: { attack: 0.03 + i * 0.05, decay: 0.5, sustain: 0.45, release: 1.1 },
                delay: i * (0.18 + Math.random() * 0.3),
                pan: (Math.random() - 0.5) * 1.4,
            });
        }
    }
    rainLayer() {
        // Continuous rain bed the weather system fades in and out.
        const source = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const highpass = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        source.buffer = this.noise;
        source.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 6200;
        highpass.type = 'highpass';
        highpass.frequency.value = 700;
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(highpass);
        highpass.connect(gain);
        gain.connect(this.bus);
        source.start();
        return { gain, stop: () => { try {
                source.stop();
            }
            catch { /* already stopped */ } } };
    }
}
exports.SfxLibrary = SfxLibrary;

});
__define("src/systems/SaveSystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveSystem = exports.DEFAULT_SAVE = exports.SAVE_VERSION = void 0;
exports.storageAvailable = storageAvailable;
const STORAGE_KEY = 'trupy-save-v1';
/**
 * localStorage is not always reachable: private browsing, strict cookie
 * policies, sandboxed iframes and quota-exceeded all throw on access — and a
 * throw here used to take the whole game down before the first frame.
 *
 * Storage is a convenience, not a requirement, so every access is guarded and
 * falls back to an in-memory map. The player can still play a full session; only
 * persistence between sessions is lost, and `storageAvailable` lets the UI say so.
 */
const memoryFallback = new Map();
let storageWarned = false;
function storageGet(key) {
    var _a;
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        if (!storageWarned) {
            storageWarned = true;
            console.warn('Trupy: localStorage unavailable — progress will not persist between sessions.');
        }
        return (_a = memoryFallback.get(key)) !== null && _a !== void 0 ? _a : null;
    }
}
function storageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    }
    catch {
        if (!storageWarned) {
            storageWarned = true;
            console.warn('Trupy: localStorage unavailable — progress will not persist between sessions.');
        }
        memoryFallback.set(key, value);
    }
}
/** True when progress will actually survive a reload. */
function storageAvailable() {
    try {
        const probe = '__trupy_probe__';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return true;
    }
    catch {
        return false;
    }
}
// Save schema version. Bumped to 3 when crafting/bestiary/achievement state was
// added. v1 and v2 saves upgrade in-place via load() below; every new field is
// backfilled from a default so no existing data is lost.
exports.SAVE_VERSION = 3;
exports.DEFAULT_SAVE = {
    version: exports.SAVE_VERSION,
    coins: 35,
    xp: 0,
    level: 1,
    reputation: 0,
    health: 100,
    maxHealth: 100,
    potions: 2,
    ownedWeapons: ['rustblade'],
    equippedWeapon: 'rustblade',
    inventory: [
        { itemId: 'blood_vial', quantity: 2 },
        { itemId: 'traveler_coat', quantity: 1 },
    ],
    chest: [
        { itemId: 'bone_shard', quantity: 3 },
        { itemId: 'smoke_bomb', quantity: 1 },
    ],
    equipment: { weapon: 'rustblade', armor: 'traveler_coat', quick: ['blood_vial', null, null] },
    discoveredLocations: ['home', 'village'],
    currentScene: 'world',
    playerPosition: { x: 430, y: 585 },
    questProgress: {},
    claimedTiers: [],
    flags: {},
    tutorialDone: false,
    playtime: 0,
    // v3 additions — empty by default so a brand-new game starts with no upgrades,
    // no discovered lore and no achievements.
    weaponUpgrades: {},
    bestiary: {},
    achievements: [],
    stats: {
        totalKills: 0,
        bossKills: 0,
        flawlessBossKills: 0,
        bestCombo: 0,
        itemsCrafted: 0,
        weaponsUpgraded: 0,
        coinsEarned: 0,
        questsCompleted: 0,
    },
    // Start mid-morning: a new player should see the world clearly before night.
    dayProgress: 0.34,
    settings: {
        sound: true,
        masterVolume: 0.85,
        musicVolume: 0.55,
        sfxVolume: 0.8,
        ambienceVolume: 0.5,
        reducedMotion: false,
        quality: 'auto',
    },
};
class SaveSystem {
    constructor() {
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "timer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.data = this.load();
    }
    load() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        try {
            const stored = storageGet(STORAGE_KEY);
            if (!stored)
                return structuredClone(exports.DEFAULT_SAVE);
            const parsed = JSON.parse(stored);
            const migratedInventory = ((_a = parsed.inventory) === null || _a === void 0 ? void 0 : _a.length)
                ? parsed.inventory.map((stack) => ({ ...stack }))
                : [
                    { itemId: 'blood_vial', quantity: (_b = parsed.potions) !== null && _b !== void 0 ? _b : 2 },
                    { itemId: 'traveler_coat', quantity: 1 },
                ];
            const equippedWeapon = (_e = (_c = parsed.equippedWeapon) !== null && _c !== void 0 ? _c : (_d = parsed.equipment) === null || _d === void 0 ? void 0 : _d.weapon) !== null && _e !== void 0 ? _e : 'rustblade';
            return {
                ...structuredClone(exports.DEFAULT_SAVE),
                ...parsed,
                // Always normalise to the current schema version regardless of the
                // stored value (covers v1 and v2 -> v3).
                version: exports.SAVE_VERSION,
                potions: (_g = (_f = migratedInventory.find((stack) => stack.itemId === 'blood_vial')) === null || _f === void 0 ? void 0 : _f.quantity) !== null && _g !== void 0 ? _g : 0,
                inventory: migratedInventory,
                chest: (_j = (_h = parsed.chest) === null || _h === void 0 ? void 0 : _h.map((stack) => ({ ...stack }))) !== null && _j !== void 0 ? _j : structuredClone(exports.DEFAULT_SAVE.chest),
                equipment: {
                    ...exports.DEFAULT_SAVE.equipment,
                    ...parsed.equipment,
                    weapon: equippedWeapon,
                    quick: [...((_l = (_k = parsed.equipment) === null || _k === void 0 ? void 0 : _k.quick) !== null && _l !== void 0 ? _l : exports.DEFAULT_SAVE.equipment.quick)],
                },
                settings: { ...exports.DEFAULT_SAVE.settings, ...parsed.settings },
                flags: { ...parsed.flags },
                questProgress: { ...parsed.questProgress },
                discoveredLocations: [...((_m = parsed.discoveredLocations) !== null && _m !== void 0 ? _m : exports.DEFAULT_SAVE.discoveredLocations)],
                playerPosition: parsed.playerPosition ? { ...parsed.playerPosition } : { ...exports.DEFAULT_SAVE.playerPosition },
                ownedWeapons: ((_o = parsed.ownedWeapons) === null || _o === void 0 ? void 0 : _o.length) ? [...parsed.ownedWeapons] : ['rustblade'],
                equippedWeapon,
                claimedTiers: [...((_p = parsed.claimedTiers) !== null && _p !== void 0 ? _p : [])],
                // --- v3 fields. Each falls back to a fresh default so pre-v3 saves,
                // which lack these keys entirely, load cleanly. Records/arrays are
                // shallow-copied to avoid sharing references with the parsed object. ---
                weaponUpgrades: { ...((_q = parsed.weaponUpgrades) !== null && _q !== void 0 ? _q : {}) },
                bestiary: { ...((_r = parsed.bestiary) !== null && _r !== void 0 ? _r : {}) },
                achievements: [...((_s = parsed.achievements) !== null && _s !== void 0 ? _s : [])],
                stats: { ...exports.DEFAULT_SAVE.stats, ...parsed.stats },
                // Clamp to 0..1: a corrupted or out-of-range value would otherwise leave
                // the day/night cycle stuck outside its keyframe table.
                dayProgress: typeof parsed.dayProgress === 'number' && Number.isFinite(parsed.dayProgress)
                    ? ((parsed.dayProgress % 1) + 1) % 1
                    : exports.DEFAULT_SAVE.dayProgress,
            };
        }
        catch {
            return structuredClone(exports.DEFAULT_SAVE);
        }
    }
    get() {
        return this.data;
    }
    patch(update, immediate = false) {
        this.data = { ...this.data, ...update };
        if (immediate)
            this.flush();
        else
            this.queueSave();
        return this.data;
    }
    mutate(callback, immediate = false) {
        callback(this.data);
        if (immediate)
            this.flush();
        else
            this.queueSave();
        return this.data;
    }
    flush() {
        window.clearTimeout(this.timer);
        storageSet(STORAGE_KEY, JSON.stringify(this.data));
    }
    reset() {
        this.data = structuredClone(exports.DEFAULT_SAVE);
        this.flush();
        return this.data;
    }
    queueSave() {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.flush(), 180);
    }
}
exports.SaveSystem = SaveSystem;

});
__define("src/game/WorldScene.ts", function(exports, module, __req){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldScene = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
const content_1 = __req("src/data/content.ts");
const items_1 = __req("src/data/items.ts");
const weaponVisuals_1 = __req("src/data/weaponVisuals.ts");
const world_1 = __req("src/data/world.ts");
const GameUI_1 = __req("src/ui/GameUI.ts");
const AudioManager_1 = __req("src/systems/AudioManager.ts");
const InventorySystem_1 = __req("src/systems/InventorySystem.ts");
const QuestSystem_1 = __req("src/systems/QuestSystem.ts");
const SaveSystem_1 = __req("src/systems/SaveSystem.ts");
const WeaponShopSystem_1 = __req("src/systems/WeaponShopSystem.ts");
const CraftingSystem_1 = __req("src/systems/CraftingSystem.ts");
const BestiarySystem_1 = __req("src/systems/BestiarySystem.ts");
const AchievementSystem_1 = __req("src/systems/AchievementSystem.ts");
const Lighting_1 = __req("src/systems/world/Lighting.ts");
const Weather_1 = __req("src/systems/world/Weather.ts");
const hero_1 = __req("src/systems/sprites/hero.ts");
const buildings_1 = __req("src/systems/sprites/buildings.ts");
const EnemyAI_1 = __req("src/systems/combat/EnemyAI.ts");
const BossFight_1 = __req("src/systems/combat/BossFight.ts");
const SmokeBomb_1 = __req("src/systems/combat/SmokeBomb.ts");
const events_1 = __req("src/game/events.ts");
const PLAYER_START = { x: 430, y: 585 };
class WorldScene extends phaser_1.default.Scene {
    constructor() {
        super('WorldScene');
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "quests", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "inventory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "crafting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bestiary", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "achievements", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lighting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "weather", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Index of the player's own carried light in the lighting system. */
        Object.defineProperty(this, "playerLightIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        Object.defineProperty(this, "heroDir", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'down'
        });
        Object.defineProperty(this, "heroPose", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'idle'
        });
        Object.defineProperty(this, "heroPoseUntil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Timestamps used to detect a flawless boss kill. */
        Object.defineProperty(this, "bossFightStartedAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastPlayerHurtAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        /** Last labels pushed to the HUD, so the event only fires on change. */
        Object.defineProperty(this, "lastTimeLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "lastWeatherLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "sfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: AudioManager_1.audio
        });
        Object.defineProperty(this, "ui", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "player", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "heldWeapon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastWeaponId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "tacticalBonusUntil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "solids", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enemies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "projectiles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cursors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "keys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mobileMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new phaser_1.default.Math.Vector2()
        });
        Object.defineProperty(this, "facing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new phaser_1.default.Math.Vector2(0, 1)
        });
        Object.defineProperty(this, "interactables", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "npcMarkers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "uiLocked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "attackReadyAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "hurtReadyAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "movedDistance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "nearest", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastLocation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "objectiveMarker", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "regionTint", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastHudSignature", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "eventDisposers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "boss", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cinderBoss", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "namelessFight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cinderFight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enemyProjectiles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activeRift", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "playtimeAccumulator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastStepAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "currentCombat", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "comboHits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "comboExpires", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "dashReadyAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "specialReadyAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "isDashing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "lastSlowTickAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "requestedSpawn", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    init(data) {
        this.requestedSpawn = (data === null || data === void 0 ? void 0 : data.spawnX) !== undefined && (data === null || data === void 0 ? void 0 : data.spawnY) !== undefined ? { x: data.spawnX, y: data.spawnY } : undefined;
    }
    create() {
        this.interactables = [];
        this.npcMarkers.clear();
        this.nearest = undefined;
        this.objectiveMarker = undefined;
        this.regionTint = undefined;
        this.boss = undefined;
        this.cinderBoss = undefined;
        this.activeRift = undefined;
        this.lastLocation = '';
        this.lastHudSignature = '';
        this.saves = new SaveSystem_1.SaveSystem();
        this.quests = new QuestSystem_1.QuestSystem(this.saves);
        this.inventory = new InventorySystem_1.InventorySystem(this.saves);
        this.shop = new WeaponShopSystem_1.WeaponShopSystem(this.saves);
        this.crafting = new CraftingSystem_1.CraftingSystem(this.saves, this.inventory);
        this.bestiary = new BestiarySystem_1.BestiarySystem(this.saves);
        this.achievements = new AchievementSystem_1.AchievementSystem(this.saves);
        this.saves.mutate((save) => { save.currentScene = 'world'; }, true);
        this.sfx.setMix(this.audioMix(this.saves.get()));
        if (!this.sfx.isUnlocked())
            void this.sfx.unlock();
        document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
        document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low');
        this.solids = this.physics.add.staticGroup();
        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group({ maxSize: 40 });
        this.enemyProjectiles = this.physics.add.group({ maxSize: 60 });
        this.physics.world.setBounds(0, 0, world_1.WORLD_WIDTH, world_1.WORLD_HEIGHT);
        this.drawWorld();
        this.createPlayer();
        this.createNpcs();
        this.createInteractables();
        this.createEnemies();
        this.createAtmosphere();
        this.createLighting();
        this.createWeather();
        this.createObjectiveMarker();
        this.setupPhysics();
        this.setupInput();
        this.setupUi();
        this.setupEvents();
        this.cameras.main.setBounds(0, 0, world_1.WORLD_WIDTH, world_1.WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
        this.cameras.main.setDeadzone(this.scale.width < 700 ? 55 : 110, this.scale.width < 700 ? 85 : 70);
        this.cameras.main.setZoom(this.scale.width < 700 ? 1.05 : 1.22);
        this.cameras.main.fadeIn(500, 9, 11, 18);
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (!this.uiLocked)
                    this.saves.mutate((save) => { save.playtime += 1; });
            },
        });
        this.emitTutorial();
        this.emitHud(true);
        events_1.GameEvents.emit('toast', 'Прогресс сохраняется автоматически');
        this.events.once(phaser_1.default.Scenes.Events.SHUTDOWN, () => this.cleanup());
    }
    update(time, delta) {
        if (this.comboHits > 0 && time > this.comboExpires) {
            this.comboHits = 0;
            events_1.GameEvents.emit('combo', { hits: 0, multiplier: 1 });
        }
        this.updatePlayer(time, delta);
        this.updateProjectiles(delta);
        if (time > this.lastSlowTickAt + 72) {
            this.updateEnemies(time, time - this.lastSlowTickAt);
            this.updateInteractions();
            this.updateSecretVisibility();
            this.updateLocation();
            this.updateObjectiveMarker();
            this.updateEnemyBars();
            this.syncBoss();
            events_1.GameEvents.emit('ability-cooldown', { dash: Math.max(0, (this.dashReadyAt - time) / 1000), special: Math.max(0, (this.specialReadyAt - time) / 1000) });
            this.ui.updateWorldPosition(this.player.x, this.player.y);
            this.lastSlowTickAt = time;
        }
        this.player.setDepth(this.player.y / 10 + 20);
        this.syncHeldWeapon();
        // Environment. The player's lantern tracks them so night has a moving pool
        // of light rather than a uniformly dark screen.
        this.lighting.update(delta);
        this.lighting.moveLight(this.playerLightIndex, this.player.x, this.player.y);
        this.weather.update(delta, this.currentRegionId());
        this.sfx.setRain(this.weather.profile().rainVolume);
        // Surface time-of-day and weather in the HUD, but only when the label
        // actually changes — this fires every frame otherwise.
        const timeLabel = this.lighting.getState().label;
        const weatherLabel = this.weather.profile().label;
        if (timeLabel !== this.lastTimeLabel || weatherLabel !== this.lastWeatherLabel) {
            this.lastTimeLabel = timeLabel;
            this.lastWeatherLabel = weatherLabel;
            events_1.GameEvents.emit('environment', { time: timeLabel, weather: weatherLabel });
        }
        this.playtimeAccumulator += delta;
        if (this.playtimeAccumulator > 450) {
            this.playtimeAccumulator = 0;
            this.saves.mutate((save) => {
                save.playerPosition = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
                save.dayProgress = this.lighting.getDayProgress();
            });
            this.emitHud();
        }
    }
    /**
     * Crafting a recipe. The panel gates its buttons on the same rules, but the
     * system is re-checked here because it owns the truth.
     */
    craftRecipe(recipeId) {
        const result = this.crafting.craft(recipeId);
        if (result.ok) {
            this.sfx.craft();
            // CraftingSystem.craft already increments stats.itemsCrafted — counting it
            // again here would double every craft.
            for (const achievement of this.achievements.check('craft', {})) {
                events_1.GameEvents.emit('toast', `Достижение: ${achievement.name}`);
            }
        }
        else {
            this.sfx.ui('error');
        }
        events_1.GameEvents.emit('toast', result.message);
        this.emitHud(true);
    }
    upgradeWeapon(weaponId) {
        const result = this.crafting.upgradeWeapon(weaponId);
        if (result.ok) {
            this.sfx.craft();
            const level = this.crafting.upgradeLevel(weaponId);
            // Same as crafting: the system already bumped stats.weaponsUpgraded.
            for (const achievement of this.achievements.check('upgrade', { level })) {
                events_1.GameEvents.emit('toast', `Достижение: ${achievement.name}`);
            }
            // The held-weapon sprite reflects the equipped weapon, so refresh it.
            this.syncHeldWeapon();
        }
        else {
            this.sfx.ui('error');
        }
        events_1.GameEvents.emit('toast', result.message);
        this.emitHud(true);
    }
    /** Region id under the player, used by weather and ambience. */
    currentRegionId() {
        for (const location of world_1.LOCATIONS) {
            if (this.player.x >= location.x && this.player.x <= location.x + location.w
                && this.player.y >= location.y && this.player.y <= location.y + location.h) {
                return location.ambience;
            }
        }
        return 'village';
    }
    drawWorld() {
        var _a;
        const ground = this.add.graphics().setDepth(0);
        ground.fillStyle(0x172421, 1).fillRect(0, 0, world_1.WORLD_WIDTH, world_1.WORLD_HEIGHT);
        for (let y = 0; y < world_1.WORLD_HEIGHT; y += 48) {
            ground.lineStyle(1, 0x567064, .045).lineBetween(0, y, world_1.WORLD_WIDTH, y);
        }
        // Region polygons are cached as Phaser points so both the fill pass and the
        // terrain-detail pass can reuse them without re-parsing the shape strings.
        const regionPolys = new Map();
        for (const location of world_1.LOCATIONS) {
            const shape = world_1.MAP_SHAPES.find((entry) => entry.id === location.id);
            const points = (_a = shape === null || shape === void 0 ? void 0 : shape.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return new phaser_1.default.Geom.Point(x, y); })) !== null && _a !== void 0 ? _a : [
                new phaser_1.default.Geom.Point(location.x, location.y), new phaser_1.default.Geom.Point(location.x + location.w, location.y),
                new phaser_1.default.Geom.Point(location.x + location.w, location.y + location.h), new phaser_1.default.Geom.Point(location.x, location.y + location.h),
            ];
            regionPolys.set(location.id, points);
            ground.fillStyle(location.color, 1).fillPoints(points, true);
        }
        // Soft biome blending: before the crisp borders go down, feather each region's
        // colour a short way past its own outline so neighbours bleed into each other
        // instead of meeting at a hard polygon cut.
        this.blendRegionEdges(ground, regionPolys);
        // Per-region ground texture (patches, mottling, a light directional gradient)
        // so no biome reads as one flat fill.
        for (const location of world_1.LOCATIONS)
            this.drawTerrainDetail(ground, location, regionPolys.get(location.id));
        // Crisp lit border on top of the blend, so regions still read as distinct.
        for (const location of world_1.LOCATIONS) {
            const points = regionPolys.get(location.id);
            ground.lineStyle(location.danger >= 2 ? 6 : 4, phaser_1.default.Display.Color.IntegerToColor(location.color).brighten(18).color, .4).strokePoints(points, true);
        }
        const road = (points, width = 74, color = 0x574f43) => {
            ground.lineStyle(width, color, 1).beginPath().moveTo(points[0][0], points[0][1]);
            points.slice(1).forEach(([x, y]) => ground.lineTo(x, y));
            ground.strokePath();
            ground.lineStyle(8, 0x383937, .7).beginPath().moveTo(points[0][0], points[0][1]);
            points.slice(1).forEach(([x, y]) => ground.lineTo(x, y));
            ground.strokePath();
        };
        // The two river-crossing roads are routed through the bridge decks so the
        // path visibly meets each span.
        road([[410, 620], [900, 670], [1350, 620], [1820, 720], [2350, 1120], [2630, 1316], [3250, 1450], [4120, 1860]], 78);
        road([[900, 670], [1080, 1100], [1500, 1380], [2140, 1460], [2630, 1698], [3050, 2350]], 42, 0x665d4d);
        road([[2330, 1100], [3030, 650], [3470, 620]], 48, 0x4d5045);
        road([[3300, 1450], [3180, 2240], [3050, 2350]], 46, 0x4f514b);
        // Elevation shading for the raised, rocky biomes, drawn under the river so a
        // plateau edge never paints over water.
        this.drawElevation(ground, regionPolys);
        this.drawRiver(ground);
        this.drawBridges();
        this.drawBuildings();
        this.drawCemetery();
        this.drawRuins();
        this.drawMarsh();
        this.drawMines();
        this.drawDocks();
        this.drawCitadel();
        this.scatterDecorations();
        world_1.LOCATIONS.forEach((location) => {
            var _a, _b;
            const shape = world_1.MAP_SHAPES.find((entry) => entry.id === location.id);
            this.add.text((_a = shape === null || shape === void 0 ? void 0 : shape.labelX) !== null && _a !== void 0 ? _a : location.x + location.w / 2, ((_b = shape === null || shape === void 0 ? void 0 : shape.labelY) !== null && _b !== void 0 ? _b : location.y) - Math.min(250, location.h * .28), location.name.toUpperCase(), {
                fontFamily: 'monospace', fontSize: location.id === 'citadel' ? '20px' : '18px', fontStyle: 'bold', color: '#d3cdd6',
                stroke: '#11131a', strokeThickness: 6, letterSpacing: 4,
            }).setOrigin(0.5).setAlpha(location.danger >= 2 ? .34 : .24).setDepth(2);
        });
    }
    /**
     * A tiny deterministic PRNG. Terrain detail must look scattered but be
     * identical every run (it's baked once), so we avoid Math.random here.
     */
    seededRandom(seed) {
        let state = seed >>> 0;
        return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    }
    /** Point-in-polygon test against a cached region outline. */
    pointInPoly(points, x, y) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y, xj = points[j].x, yj = points[j].y;
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
                inside = !inside;
        }
        return inside;
    }
    /**
     * Softens biome borders. For each region we scatter translucent blobs of the
     * region's own colour just *outside* its outline, so the transition into the
     * neighbour is a gradient of overlapping patches rather than a knife-edge.
     */
    blendRegionEdges(ground, polys) {
        for (const location of world_1.LOCATIONS) {
            const points = polys.get(location.id);
            const random = this.seededRandom(0x9e37 ^ location.id.length * 2654435761);
            const colour = phaser_1.default.Display.Color.IntegerToColor(location.color);
            const soft = colour.color;
            // Walk each edge and drop feather blobs straddling it.
            for (let i = 0; i < points.length; i += 1) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                const steps = Math.max(3, Math.round(phaser_1.default.Math.Distance.Between(a.x, a.y, b.x, b.y) / 120));
                for (let s = 0; s <= steps; s += 1) {
                    const t = s / steps;
                    const px = a.x + (b.x - a.x) * t;
                    const py = a.y + (b.y - a.y) * t;
                    const jitterX = (random() - 0.5) * 90;
                    const jitterY = (random() - 0.5) * 90;
                    const r = 46 + random() * 46;
                    ground.fillStyle(soft, 0.16 + random() * 0.12).fillCircle(px + jitterX, py + jitterY, r);
                }
            }
        }
    }
    /**
     * Per-region ground texture: a faint directional light gradient, scattered
     * darker/lighter patches, and a few biome-flavoured accents (moss, scorch,
     * puddles). All clipped to the region polygon so nothing bleeds onto roads or
     * neighbours, and all deterministic so it bakes identically each run.
     */
    drawTerrainDetail(ground, location, points) {
        const random = this.seededRandom(0x51ed ^ (location.id.charCodeAt(0) * 40503 + location.h));
        const base = phaser_1.default.Display.Color.IntegerToColor(location.color);
        const dark = base.clone().darken(20).color;
        const light = base.clone().brighten(16).color;
        // A soft top-left-to-bottom-right light gradient, faked with a few large,
        // very translucent lit and shadowed lobes.
        ground.fillStyle(light, 0.05).fillEllipse(location.x + location.w * 0.32, location.y + location.h * 0.3, location.w * 0.7, location.h * 0.6);
        ground.fillStyle(dark, 0.06).fillEllipse(location.x + location.w * 0.72, location.y + location.h * 0.74, location.w * 0.6, location.h * 0.55);
        // Mottled patches — try points, keep the ones that fall inside the polygon.
        const accent = this.terrainAccent(location.id);
        const patchCount = Math.round((location.w * location.h) / 26000);
        let placed = 0;
        let attempts = 0;
        while (placed < patchCount && attempts < patchCount * 4) {
            attempts += 1;
            const x = location.x + random() * location.w;
            const y = location.y + random() * location.h;
            if (!this.pointInPoly(points, x, y))
                continue;
            placed += 1;
            const roll = random();
            const rx = 22 + random() * 46;
            const ry = rx * (0.5 + random() * 0.35);
            if (roll < 0.4)
                ground.fillStyle(dark, 0.12 + random() * 0.1).fillEllipse(x, y, rx, ry);
            else if (roll < 0.72)
                ground.fillStyle(light, 0.08 + random() * 0.08).fillEllipse(x, y, rx * 0.8, ry * 0.8);
            else
                ground.fillStyle(accent.color, accent.alpha * (0.6 + random() * 0.5)).fillEllipse(x, y, rx * 0.7, ry * 0.7);
        }
    }
    /** Biome-specific ground accent colour used to tint scattered patches. */
    terrainAccent(id) {
        switch (id) {
            case 'forest': return { color: 0x3f6b48, alpha: 0.18 };
            case 'marsh': return { color: 0x2f6f5e, alpha: 0.2 };
            case 'cemetery': return { color: 0x4a5560, alpha: 0.16 };
            case 'ruins': return { color: 0x6a4d76, alpha: 0.18 };
            case 'mines': return { color: 0x6b4f36, alpha: 0.2 };
            case 'docks': return { color: 0x38637a, alpha: 0.2 };
            case 'citadel': return { color: 0x7a3b34, alpha: 0.2 };
            case 'village': return { color: 0x6d6142, alpha: 0.16 };
            default: return { color: 0x4a5a48, alpha: 0.14 };
        }
    }
    /**
     * Elevation cues for the two raised, rocky biomes. A dark cast-shadow band
     * hugs the *lower* edges of the mines and the citadel (reading as a cliff face
     * dropping away), while a thin lit rim traces their *upper* edges (a plateau
     * catching the sky). Cheap, but it lifts both regions off the flat plane.
     */
    drawElevation(ground, polys) {
        for (const id of ['mines', 'citadel']) {
            const points = polys.get(id);
            if (!points)
                continue;
            // Draw each polygon edge: south/east-facing edges get a thick dark drop,
            // north/west-facing edges get a lit rim.
            for (let i = 0; i < points.length; i += 1) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                // Outward normal sign via the edge direction; if the edge trends
                // rightward/downward it's a lit top edge, else a shadowed underside.
                const facingDown = b.x < a.x || (Math.abs(b.x - a.x) < 4 && b.y < a.y);
                if (facingDown) {
                    ground.lineStyle(26, 0x0c0d12, 0.5).lineBetween(a.x, a.y + 10, b.x, b.y + 10);
                }
                else {
                    ground.lineStyle(6, id === 'citadel' ? 0x8a4a44 : 0x9a7a50, 0.5).lineBetween(a.x, a.y - 4, b.x, b.y - 4);
                }
            }
            // A couple of internal cliff-shelf lines for the mines to imply terraces.
            if (id === 'mines') {
                ground.lineStyle(10, 0x0c0d12, 0.35).lineBetween(3260, 1600, 3800, 1600);
                ground.lineStyle(4, 0x9a7a50, 0.4).lineBetween(3260, 1592, 3800, 1592);
            }
        }
    }
    /**
     * The river. Rather than a flat rectangle it now has: wet-earth banks, a
     * lighter shallow margin, a darker deep channel, and a set of pale current
     * streaks along the flow so the water reads as moving. Drawn once into the
     * ground graphics.
     */
    drawRiver(ground) {
        const left = 2500;
        const right = 2760;
        const width = right - left;
        // Muddy banks a little wider than the water.
        ground.fillStyle(0x2c3428, 1).fillRect(left - 26, 0, width + 52, world_1.WORLD_HEIGHT);
        // Deep channel.
        ground.fillStyle(0x18333f, 1).fillRect(left, 0, width, world_1.WORLD_HEIGHT);
        // Shallows: lighter strips hugging each bank.
        ground.fillStyle(0x2c5566, 0.7).fillRect(left, 0, 34, world_1.WORLD_HEIGHT);
        ground.fillStyle(0x2c5566, 0.7).fillRect(right - 34, 0, 34, world_1.WORLD_HEIGHT);
        // Deepest core line.
        ground.fillStyle(0x102730, 0.6).fillRect(left + width * 0.4, 0, width * 0.2, world_1.WORLD_HEIGHT);
        // Current: pale streaks that meander down the channel. Deterministic.
        const random = this.seededRandom(0x1005cafe);
        ground.fillStyle(0x3f6f80, 0.5);
        for (let y = 20; y < world_1.WORLD_HEIGHT; y += 46) {
            const x = left + 30 + (Math.sin(y * 0.02) * 0.5 + 0.5) * (width - 90) + (random() - 0.5) * 20;
            ground.fillRect(x, y, 60 + random() * 60, 4);
        }
        // Faint foam glints near the shallows.
        ground.fillStyle(0x8fb6c2, 0.16);
        for (let y = 40; y < world_1.WORLD_HEIGHT; y += 120) {
            ground.fillRect(left + 8 + random() * 16, y + random() * 40, 10, 3);
            ground.fillRect(right - 24 + random() * 12, y + 60 + random() * 40, 10, 3);
        }
    }
    /**
     * The bridge decks and their collision. The river carries a solid wall along
     * its whole length *except* the vertical gap each bridge (and the secret ford)
     * leaves, so the only ways across are the crossings — which makes them matter.
     */
    drawBridges() {
        const left = 2492;
        const right = 2768;
        // Build the set of walkable gaps (bridges + the hidden ford).
        const gaps = [
            ...world_1.RIVER_BRIDGES.map((bridge) => ({ y: bridge.y, gap: bridge.gap })),
            { y: world_1.HIDDEN_FORD.y, gap: world_1.HIDDEN_FORD.gap },
        ].sort((a, b) => a.y - b.y);
        // River collision: stack solid segments over the gaps.
        let cursor = 0;
        for (const { y, gap } of gaps) {
            const top = y - gap;
            if (top > cursor)
                this.addSolidRect((left + right) / 2, (cursor + top) / 2, right - left, top - cursor);
            cursor = y + gap;
        }
        if (cursor < world_1.WORLD_HEIGHT)
            this.addSolidRect((left + right) / 2, (cursor + world_1.WORLD_HEIGHT) / 2, right - left, world_1.WORLD_HEIGHT - cursor);
        // Bridge decks: sculpted plank tiles across the span, with stone abutments
        // and rope-rail posts. Depth keyed just above the ground so the player walks
        // on top of them.
        for (const bridge of world_1.RIVER_BRIDGES) {
            const deck = this.add.graphics().setDepth(bridge.y / 10 + 1);
            // Stone abutments on each bank.
            deck.fillStyle(0x4a4640, 1).fillRect(left - 20, bridge.y - bridge.gap - 6, 44, bridge.gap * 2 + 12);
            deck.fillStyle(0x4a4640, 1).fillRect(right - 24, bridge.y - bridge.gap - 6, 44, bridge.gap * 2 + 12);
            // Deck planks.
            deck.fillStyle(0x6b5137, 1).fillRect(left, bridge.y - bridge.gap + 4, right - left, bridge.gap * 2 - 8);
            for (let x = left + 4; x < right; x += 26) {
                deck.fillStyle((x / 26) % 2 < 1 ? 0x745941 : 0x654b38, 1).fillRect(x, bridge.y - bridge.gap + 6, 20, bridge.gap * 2 - 12);
            }
            // Plank seams and rail shadow.
            deck.lineStyle(3, 0x2c2620, 0.7);
            for (let x = left; x <= right; x += 26)
                deck.lineBetween(x, bridge.y - bridge.gap + 6, x, bridge.y + bridge.gap - 6);
            // Rope rails.
            deck.fillStyle(0x3a3029, 1).fillRect(left, bridge.y - bridge.gap - 2, right - left, 8).fillRect(left, bridge.y + bridge.gap - 6, right - left, 8);
            const name = this.add.text(bridge.x, bridge.y - bridge.gap - 22, bridge.name, {
                fontFamily: 'monospace', fontSize: '10px', color: '#d9cdbe', backgroundColor: '#11131acc', padding: { x: 5, y: 2 },
            }).setOrigin(0.5).setDepth(bridge.y / 10 + 2).setAlpha(0.8);
            name.setData('bridgeLabel', bridge.id);
        }
        // Stepping stones marking the secret ford (hidden by reeds in scatter pass).
        const fordGraphics = this.add.graphics().setDepth(world_1.HIDDEN_FORD.y / 10 + 1);
        for (let x = left + 20; x < right; x += 46) {
            fordGraphics.fillStyle(0x54514a, 1).fillEllipse(x, world_1.HIDDEN_FORD.y + (x % 92 === 0 ? 14 : -10), 26, 16);
            fordGraphics.fillStyle(0x6a675e, 1).fillEllipse(x - 3, world_1.HIDDEN_FORD.y + (x % 92 === 0 ? 11 : -13), 14, 8);
        }
    }
    /**
     * Places the sculpted building sprites and their collision.
     *
     * The art is baked as one texture per building by the sprites/buildings
     * factory, with the wall body centred in the canvas — so drawing the image at
     * the building's own (x, y) lands the walls exactly on the collision boxes
     * below, while roofs and eaves overhang into the surrounding margin.
     *
     * The collision layout is deliberately unchanged from the previous flat
     * version: an upper solid block plus two lower blocks that leave a walkable
     * doorway gap, so every door stays enterable.
     */
    drawBuildings() {
        world_1.BUILDINGS.forEach((building) => {
            const { x, y, w, h, name, doorX } = building;
            const top = y - h / 2;
            const bottom = y + h / 2;
            const left = x - w / 2;
            const doorCenter = x + doorX;
            const key = (0, buildings_1.buildingKey)(building.id);
            if (this.textures.exists(key)) {
                // Depth keyed off the building's foot so the player passes in front of
                // the wall but behind the roof overhang.
                this.add.image(x, y, key).setDepth(bottom / 10 + 5);
            }
            this.add.text(x, top - 34, name, {
                fontFamily: 'monospace', fontSize: '10px', color: '#ded8e1',
                backgroundColor: '#11131acc', padding: { x: 6, y: 3 },
            }).setOrigin(.5).setDepth(bottom / 10 + 7);
            const doorwayWidth = 64;
            const lowerHeight = 52;
            const upperHeight = h - lowerHeight;
            this.addSolidRect(x, top + upperHeight / 2, w, upperHeight);
            const leftWidth = Math.max(0, doorCenter - doorwayWidth / 2 - left);
            const rightWidth = Math.max(0, left + w - (doorCenter + doorwayWidth / 2));
            if (leftWidth > 4)
                this.addSolidRect(left + leftWidth / 2, bottom - lowerHeight / 2, leftWidth, lowerHeight);
            if (rightWidth > 4)
                this.addSolidRect(doorCenter + doorwayWidth / 2 + rightWidth / 2, bottom - lowerHeight / 2, rightWidth, lowerHeight);
        });
        // The village well, now a sculpted prop rather than stacked ellipses.
        if (this.textures.exists('well')) {
            this.add.image(920, 680, 'well').setScale(1.6).setDepth(74);
        }
        this.addSolidRect(920, 683, 66, 34);
    }
    drawCemetery() {
        const graphics = this.add.graphics().setDepth(4);
        graphics.lineStyle(8, 0x4c4f55, 1);
        graphics.lineBetween(1495, 295, 2180, 295);
        graphics.lineBetween(1495, 295, 1495, 870);
        graphics.lineBetween(2180, 295, 2180, 870);
        graphics.lineBetween(1495, 870, 1740, 870);
        graphics.lineBetween(1880, 870, 2180, 870);
        for (let x = 1510; x < 2180; x += 36) {
            graphics.lineBetween(x, 285, x, 310);
            graphics.lineBetween(x, 855, x, 880);
        }
        graphics.fillStyle(0x30353a, 1).fillRect(1486, 595, 22, 115);
        graphics.fillStyle(0x676b70, 1).fillRect(1488, 580, 14, 24).fillRect(1488, 700, 14, 24);
        this.addSolidRect(1838, 295, 686, 12);
        this.addSolidRect(1495, 442, 12, 294);
        this.addSolidRect(1495, 790, 12, 160);
        this.addSolidRect(2180, 582, 12, 575);
        this.addSolidRect(1615, 870, 240, 12);
        this.addSolidRect(2030, 870, 300, 12);
        const graves = [
            [1600, 410], [1720, 390], [1880, 420], [2040, 400], [1640, 535], [1780, 560], [1940, 520], [2080, 570], [1590, 700], [1760, 720], [1920, 690], [2070, 735],
        ];
        graves.forEach(([x, y], index) => this.add.image(x, y, 'grave').setScale(index % 3 === 0 ? 2.2 : 1.9).setDepth(y / 10 + 3));
    }
    drawRuins() {
        const graphics = this.add.graphics().setDepth(4);
        graphics.fillStyle(0x3e3445, 1);
        graphics.fillRect(2110, 1030, 340, 34);
        graphics.fillRect(2110, 1030, 34, 240);
        graphics.fillRect(2416, 1030, 34, 240);
        graphics.fillRect(2000, 1430, 520, 38);
        graphics.fillRect(2000, 1290, 34, 178);
        graphics.fillRect(2486, 1290, 34, 178);
        graphics.lineStyle(5, 0x796180, .8).strokeRect(2110, 1030, 340, 34).strokeRect(2000, 1430, 520, 38);
        graphics.fillStyle(0x342a40, 1).fillRect(2215, 1024, 130, 48);
        graphics.fillStyle(0x8d6b92, 1).fillRect(2210, 1026, 12, 42).fillRect(2338, 1026, 12, 42);
        this.addSolidRect(2162, 1047, 104, 34);
        this.addSolidRect(2398, 1047, 104, 34);
        this.addSolidRect(2127, 1130, 34, 200);
        this.addSolidRect(2433, 1130, 34, 200);
        this.addSolidRect(2255, 1449, 520, 38);
        this.addSolidRect(2017, 1375, 34, 150);
        this.addSolidRect(2503, 1375, 34, 150);
        const sigil = graphics;
        sigil.lineStyle(5, 0x9e6db4, .6).strokeCircle(2270, 1330, 86);
        sigil.lineBetween(2210, 1390, 2330, 1270);
        sigil.lineBetween(2210, 1270, 2330, 1390);
        for (const [x, y] of [[2050, 1120], [2530, 1080], [2070, 1510], [2480, 1540], [2320, 980]]) {
            this.add.image(x, y, 'rock').setScale(2.5).setTint(0x6c5972).setDepth(y / 10 + 2);
        }
    }
    drawMarsh() {
        const graphics = this.add.graphics().setDepth(3);
        for (let index = 0; index < 18; index += 1) {
            const x = 2870 + (index * 173) % 820;
            const y = 300 + (index * 241) % 650;
            const w = 90 + (index % 4) * 28;
            const h = 42 + (index % 3) * 17;
            graphics.fillStyle(0x183c3c, .9).fillEllipse(x, y, w, h);
            graphics.lineStyle(3, 0x477a68, .38).strokeEllipse(x, y, w, h);
            graphics.fillStyle(0x78a76d, .45).fillCircle(x - w * .18, y, 5 + index % 4);
        }
        for (let index = 0; index < 22; index += 1) {
            const x = 2830 + (index * 113) % 930;
            const y = 240 + (index * 197) % 780;
            this.add.image(x, y, 'tree').setScale(1.6 + index % 3 * .18).setTint(0x718f7b).setAlpha(.78).setDepth(y / 10 + 7);
        }
    }
    drawMines() {
        const graphics = this.add.graphics().setDepth(4);
        graphics.fillStyle(0x211e1c, 1).fillRoundedRect(3400, 1260, 390, 330, 30);
        graphics.lineStyle(18, 0x615343, 1).strokeRoundedRect(3400, 1260, 390, 330, 30);
        graphics.fillStyle(0x0b0c10, 1).fillEllipse(3595, 1435, 190, 165);
        graphics.lineStyle(7, 0x9a754d, .8).strokeEllipse(3595, 1435, 190, 165);
        for (let rail = 0; rail < 7; rail += 1) {
            graphics.fillStyle(0x7d6245, 1).fillRect(3450 + rail * 46, 1570 + rail * 28, 34, 12);
        }
        graphics.lineStyle(5, 0x42434a, 1).lineBetween(3450, 1580, 3790, 1790).lineBetween(3480, 1550, 3820, 1760);
        this.addSolidRect(3400, 1275, 360, 28);
    }
    drawDocks() {
        const graphics = this.add.graphics().setDepth(4);
        graphics.fillStyle(0x1f3945, 1).fillRect(2740, 2460, 910, 210);
        graphics.fillStyle(0x6b513b, 1);
        for (let pier = 0; pier < 4; pier += 1) {
            const x = 2840 + pier * 210;
            graphics.fillRect(x, 2240, 74, 330);
            for (let plank = 0; plank < 11; plank += 1)
                graphics.fillStyle(plank % 2 ? 0x745941 : 0x654b38, 1).fillRect(x + 4, 2248 + plank * 28, 66, 22);
        }
        graphics.fillStyle(0x826346, 1).fillRect(2780, 2360, 820, 92);
        for (let x = 2790; x < 3590; x += 52)
            graphics.lineStyle(3, 0x3a3029, .8).lineBetween(x, 2365, x, 2445);
        graphics.fillStyle(0x332c27, 1).fillEllipse(3270, 2585, 125, 45);
        graphics.lineStyle(4, 0xa17950, .8).strokeEllipse(3270, 2585, 125, 45);
    }
    drawCitadel() {
        const graphics = this.add.graphics().setDepth(5);
        graphics.fillStyle(0x2a1d22, 1).fillRect(3880, 1570, 570, 1030);
        graphics.lineStyle(24, 0x73444a, 1).strokeRect(3880, 1570, 570, 1030);
        for (let y = 1640; y < 2550; y += 145) {
            graphics.fillStyle(0x4b3035, 1).fillRect(3894, y, 542, 22);
        }
        for (const x of [3940, 4380]) {
            graphics.fillStyle(0x171217, 1).fillCircle(x, 1740, 54);
            graphics.fillStyle(0xd84f37, .85).fillCircle(x, 1752, 34);
            graphics.fillStyle(0xffc55e, .9).fillCircle(x, 1760, 17);
        }
        graphics.fillStyle(0x171217, 1).fillRoundedRect(4060, 2350, 210, 230, 24);
        graphics.lineStyle(8, 0xc35a43, .7).strokeRoundedRect(4060, 2350, 210, 230, 24);
        graphics.fillStyle(0x0c0d12, 1).fillRect(3868, 1800, 55, 120);
        graphics.lineStyle(5, 0xc45b49, .8).strokeRect(3868, 1800, 55, 120);
        this.addSolidRect(3880, 1685, 24, 190);
        this.addSolidRect(3880, 2260, 24, 680);
        this.addSolidRect(4450, 2090, 24, 1000);
        this.addSolidRect(4165, 1570, 570, 24);
        this.addSolidRect(3980, 2600, 200, 24);
        this.addSolidRect(4350, 2600, 200, 24);
    }
    scatterDecorations() {
        let seed = 918273;
        const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const distanceToSegment = (px, py, ax, ay, bx, by) => {
            const dx = bx - ax;
            const dy = by - ay;
            const lengthSq = dx * dx + dy * dy;
            const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
            return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        };
        const nearRoad = (x, y, margin = 125) => world_1.MAP_ROADS.some((road) => road.slice(1).some(([bx, by], index) => {
            const [ax, ay] = road[index];
            return distanceToSegment(x, y, ax, ay, bx, by) < margin;
        }));
        // Variant keys give visible silhouette variety; the sculpted art is already
        // shaded, so it must NOT be tinted — tinting flattens the light and shadow
        // the shading pass produced.
        const pick = (base, count) => `${base}-${Math.floor(random() * count)}`;
        const addTree = (x, y, scale = 2.1, kind = 'tree') => {
            const key = pick(kind, 3);
            const texture = this.textures.exists(key) ? key : kind;
            this.add.image(x, y, texture).setScale(scale).setDepth(y / 10 + 8);
            this.addSolidRect(x, y + 34 * scale / 2, 18 * scale, 15 * scale);
        };
        const addProp = (x, y, key, scale = 1.4, depthBias = 1) => {
            if (!this.textures.exists(key))
                return;
            this.add.image(x, y, key).setScale(scale).setDepth(y / 10 + depthBias);
        };
        // Whispering Forest: dense broadleaf.
        for (let index = 0; index < 50; index += 1) {
            const x = 790 + random() * 1020;
            const y = 950 + random() * 720;
            if (Math.abs(y - (1000 + (x - 800) * .4)) < 90 || nearRoad(x, y, 145))
                continue;
            addTree(x, y, 1.8 + random() * .55);
        }
        // Wilderness fill, with dead trees near the cursed regions so the biome
        // shifts as the player travels east.
        for (let index = 0; index < 60; index += 1) {
            const x = 90 + random() * (world_1.WORLD_WIDTH - 180);
            const y = 80 + random() * (world_1.WORLD_HEIGHT - 160);
            const inLocation = world_1.LOCATIONS.some((location) => x > location.x - 50 && x < location.x + location.w + 50 && y > location.y - 50 && y < location.y + location.h + 50);
            if (inLocation || nearRoad(x, y, 145))
                continue;
            const kind = x > 2700 ? 'tree-dead' : x > 1900 ? 'tree-pine' : 'tree';
            addTree(x, y, 1.7 + random() * .5, kind);
        }
        // Rocks and rubble.
        for (let index = 0; index < 70; index += 1) {
            const x = 100 + random() * (world_1.WORLD_WIDTH - 200);
            const y = 100 + random() * (world_1.WORLD_HEIGHT - 200);
            if (nearRoad(x, y, 105))
                continue;
            addProp(x, y, random() > .78 ? pick('rubble', 3) : pick('rock', 3), 1.3 + random() * .8);
        }
        // Ground cover, so open areas aren't bare.
        for (let index = 0; index < 90; index += 1) {
            const x = 120 + random() * (world_1.WORLD_WIDTH - 240);
            const y = 120 + random() * (world_1.WORLD_HEIGHT - 240);
            if (nearRoad(x, y, 60))
                continue;
            const roll = random();
            const key = roll > .72 ? pick('bush', 3) : roll > .5 ? 'fern' : roll > .34 ? 'flower-patch' : 'stump';
            addProp(x, y, key, 1.1 + random() * .5);
        }
        // Region-specific dressing. Each list is placed only inside its own biome so
        // the world tells you where you are without reading a label.
        const marshProps = ['reeds', 'lilypad', 'puddle', 'bog-bubble', 'mushroom-cluster'];
        for (let index = 0; index < 40; index += 1) {
            addProp(2800 + random() * 980, 200 + random() * 760, marshProps[Math.floor(random() * marshProps.length)], 1.2 + random() * .5);
        }
        const citadelProps = ['ash-pile', 'cracked-ground', 'bones', 'skull', 'rubble-1'];
        for (let index = 0; index < 34; index += 1) {
            addProp(3900 + random() * 560, 1460 + random() * 1180, citadelProps[Math.floor(random() * citadelProps.length)], 1.2 + random() * .5);
        }
        const mineProps = ['ore-vein', 'mine-track', 'rubble-2', 'crate', 'bones'];
        for (let index = 0; index < 26; index += 1) {
            addProp(3270 + random() * 560, 1170 + random() * 620, mineProps[Math.floor(random() * mineProps.length)], 1.2 + random() * .4);
        }
        const dockProps = ['crate', 'barrel', 'sack', 'chain', 'bridge-plank'];
        for (let index = 0; index < 28; index += 1) {
            addProp(2740 + random() * 960, 2060 + random() * 620, dockProps[Math.floor(random() * dockProps.length)], 1.2 + random() * .4);
        }
        const ruinProps = ['obelisk', 'statue', 'rubble-0', 'bones', 'cracked-ground'];
        for (let index = 0; index < 24; index += 1) {
            addProp(2160 + random() * 690, 1090 + random() * 820, ruinProps[Math.floor(random() * ruinProps.length)], 1.2 + random() * .4);
        }
        // Village life: fences, hay, a cart, a signpost.
        for (let index = 0; index < 22; index += 1) {
            addProp(720 + random() * 700, 340 + random() * 600, random() > .5 ? 'fence-post' : 'hay-bale', 1.2 + random() * .3);
        }
        addProp(1040, 700, 'cart', 1.5, 3);
        addProp(880, 600, 'signpost', 1.4, 3);
        addProp(1180, 470, 'anvil', 1.3, 3);
        addProp(1240, 470, 'forge-fire', 1.4, 4);
        // Camps along the roads give the world a sense of other travellers.
        for (const [x, y] of [[1500, 1330], [2400, 1290], [3180, 2240]]) {
            addProp(x, y, 'campfire', 1.5, 3);
            addProp(x + 42, y + 12, 'tent', 1.6, 2);
        }
    }
    addSolidRect(x, y, width, height) {
        const zone = this.add.zone(x, y, width, height);
        this.physics.add.existing(zone, true);
        this.solids.add(zone);
    }
    /** Small stable string hash, used to pick a deterministic secret-chest reward. */
    hashString(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1)
            hash = (hash * 31 + value.charCodeAt(i)) | 0;
        return hash;
    }
    /** Ids of hidden places the player has discovered, for the map overlay. */
    discoveredSecretIds() {
        const flags = this.saves.get().flags;
        const ids = [];
        for (const secret of world_1.SECRET_POINTS)
            if (flags[`secret-found:${secret.id}`])
                ids.push(secret.id);
        for (const shortcut of world_1.SHORTCUT_PORTALS) {
            if (flags[`secret-found:${shortcut.id}_a`])
                ids.push(`${shortcut.id}_a`);
            if (flags[`secret-found:${shortcut.id}_b`])
                ids.push(`${shortcut.id}_b`);
        }
        if (flags['secret-found:reed_ford'])
            ids.push('reed_ford');
        return ids;
    }
    createPlayer() {
        var _a, _b;
        const saved = (_b = (_a = this.requestedSpawn) !== null && _a !== void 0 ? _a : this.saves.get().playerPosition) !== null && _b !== void 0 ? _b : PLAYER_START;
        this.player = this.physics.add.sprite(saved.x, saved.y, 'hero-down-0').setScale(1.65);
        this.player.setCollideWorldBounds(true);
        this.player.setDrag(900, 900);
        const body = this.player.body;
        body.setSize(16, 12).setOffset(8, 26);
        this.lastWeaponId = this.saves.get().equippedWeapon;
        this.heldWeapon = this.add.image(saved.x, saved.y, `held-${this.lastWeaponId}`).setScale(1.45).setDepth(this.player.depth + 1);
        this.syncHeldWeapon();
    }
    syncHeldWeapon() {
        var _a, _b;
        if (!((_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.scene) || !((_b = this.player) === null || _b === void 0 ? void 0 : _b.active))
            return;
        const weaponId = this.saves.get().equippedWeapon;
        if (this.heldWeapon.texture.key !== `held-${weaponId}`)
            this.heldWeapon.setTexture(`held-${weaponId}`);
        document.documentElement.dataset.heldWeapon = weaponId;
        const angle = this.facing.angle();
        this.heldWeapon.setOrigin(.2, .5).setPosition(this.player.x + this.facing.x * 10, this.player.y + 5 + this.facing.y * 9).setRotation(angle).setAlpha(this.player.alpha);
        this.heldWeapon.setDepth(this.facing.y < -.35 ? this.player.depth - 1 : this.player.depth + 2);
    }
    createNpcs() {
        content_1.NPCS.forEach((npc, index) => {
            const sprite = this.add.sprite(npc.x, npc.y, `npc-${index}`).setScale(1.72).setDepth(npc.y / 10 + 10);
            sprite.setData('npcId', npc.id);
            const name = this.add.text(npc.x, npc.y - 48, npc.name, {
                fontFamily: 'monospace', fontSize: '10px', color: '#ded9e2', stroke: '#11131a', strokeThickness: 4,
            }).setOrigin(0.5).setDepth(npc.y / 10 + 20);
            name.setData('labelFor', npc.id);
            const marker = this.add.text(npc.x, npc.y - 78, '', {
                fontFamily: 'monospace', fontSize: '25px', fontStyle: 'bold', color: '#f0c36d', stroke: '#12131a', strokeThickness: 5,
            }).setOrigin(0.5).setDepth(npc.y / 10 + 22);
            this.tweens.add({ targets: marker, y: marker.y - 7, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.npcMarkers.set(npc.id, marker);
            this.interactables.push({ kind: 'npc', id: npc.id, uniqueId: `npc:${npc.id}`, label: `Говорить: ${npc.name}`, object: sprite });
        });
    }
    createInteractables() {
        const addItem = (kind, id, target, label, texture, x, y, index, objectiveType) => {
            const uniqueId = `${kind}:${target}:${index}`;
            const used = Boolean(this.saves.get().flags[uniqueId]);
            const activeTexture = used && kind === 'lantern' ? 'lantern-on' : texture;
            const image = this.add.image(x, y, activeTexture).setScale(kind === 'lantern' ? 2.3 : kind === 'lift' ? 2.4 : 2).setDepth(y / 10 + 4);
            if (used && kind !== 'lantern' && kind !== 'lift')
                image.setVisible(false);
            if (!used && kind !== 'lantern' && kind !== 'lift')
                this.tweens.add({ targets: image, y: y - 5, duration: 900 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.interactables.push({ kind, id, uniqueId, label, object: image, objectiveType, target });
        };
        [[660, 735], [760, 665], [620, 850]].forEach(([x, y], index) => addItem('collect', 'moonwort', 'moonwort', 'Собрать лунную полынь', 'herb-moonwort', x, y, index, 'collect'));
        [[1120, 1190], [1260, 1410], [1510, 1110], [1630, 1450]].forEach(([x, y], index) => addItem('collect', 'shadebloom', 'shadebloom', 'Собрать цветок тени', 'herb-shadebloom', x, y, index, 'collect'));
        addItem('collect', 'charm', 'charm', 'Поднять медальон Элиры', 'charm', 2030, 520, 0, 'collect');
        [[2940, 420], [3150, 870], [3440, 340], [3650, 760]].forEach(([x, y], index) => addItem('collect', 'bog_reed', 'bog_reed', 'Собрать болотный тростник', 'herb-bog-reed', x, y, index, 'collect'));
        [[2870, 640], [3050, 310], [3280, 930], [3540, 520], [3710, 870]].forEach(([x, y], index) => addItem('collect', 'glowcap', 'glowcap', 'Собрать светогриб', 'glowcap', x, y, index, 'collect'));
        [[2840, 2500], [3290, 2430], [3590, 2520]].forEach(([x, y], index) => addItem('collect', 'cargo', 'ferryman_cargo', 'Поднять запечатанный груз', 'cargo', x, y, index, 'collect'));
        addItem('collect', 'miner_tools', 'miner_tools', 'Забрать инструменты Брама', 'miner-tools', 3810, 1640, 0, 'collect');
        [[1330, 670], [1590, 820], [1930, 930]].forEach(([x, y], index) => addItem('lantern', 'lantern', 'lantern', 'Зажечь фонарь', 'lantern-off', x, y, index, 'interact'));
        addItem('altar', 'forest_altar', 'forest_altar', 'Провести ритуал', 'altar', 1660, 1580, 0, 'interact');
        addItem('lift', 'mine_lift', 'mine_lift', 'Запустить подъёмник', 'mine-lift', 3595, 1450, 0, 'interact');
        world_1.BUILDINGS.filter((building) => building.interior).forEach((building, index) => {
            const door = (0, world_1.getBuildingDoor)(building);
            const image = this.add.image(door.x, door.y, 'door-glow').setScale(1.8).setDepth(door.y / 10 + 6).setAlpha(.7);
            this.tweens.add({ targets: image, alpha: { from: .28, to: .92 }, duration: 1050 + index * 80, yoyo: true, repeat: -1 });
            this.interactables.push({ kind: 'door', id: building.id, uniqueId: `door:${building.id}`, label: `Войти: ${building.name.toLowerCase()}`, object: image, target: building.interior });
        });
        const chestPoints = [[2080, 1740], [3010, 960], [3460, 1740], [2890, 2600], [4300, 2450]];
        chestPoints.forEach(([x, y], index) => {
            const uniqueId = `world-chest:${index}`;
            const opened = Boolean(this.saves.get().flags[uniqueId]);
            const image = this.add.image(x, y, opened ? 'chest-open' : 'chest-closed').setScale(2).setDepth(y / 10 + 7);
            this.interactables.push({ kind: 'chest', id: String(index), uniqueId, label: opened ? 'Сундук пуст' : 'Открыть сундук', object: image });
        });
        [[850, 1960], [2880, 760], [3990, 2240]].forEach(([x, y], index) => {
            const uniqueId = `shrine:${index}`;
            const used = Boolean(this.saves.get().flags[uniqueId]);
            const image = this.add.image(x, y, 'altar').setScale(2.2).setTint(used ? 0x666570 : 0x9e76c2).setDepth(y / 10 + 6);
            this.interactables.push({ kind: 'shrine', id: String(index), uniqueId, label: used ? 'Святилище молчит' : 'Коснуться святилища', object: image });
        });
        world_1.RIFT_POINTS.forEach((rift, index) => {
            const complete = Boolean(this.saves.get().flags[`rift-complete:${rift.id}`]);
            const image = this.add.image(rift.x, rift.y, 'rift-core').setScale(2.2).setTint(complete ? 0x555866 : 0xbd6ed8).setAlpha(complete ? .55 : 1).setDepth(rift.y / 10 + 8);
            if (!complete)
                this.tweens.add({ targets: image, scale: { from: 1.9, to: 2.45 }, angle: 180, alpha: { from: .62, to: 1 }, duration: 1300 + index * 170, yoyo: true, repeat: -1 });
            this.interactables.push({ kind: 'rift', id: rift.id, uniqueId: `rift:${rift.id}`, label: complete ? 'Разлом очищен' : `Активировать: ${rift.name}`, object: image, target: rift.reward });
        });
        this.createSecrets();
        this.syncInteractables();
    }
    /**
     * Off-road discoveries. Each secret and shortcut mouth starts nearly invisible
     * and fades in only when the player is close (see updateSecretVisibility), so
     * they reward wandering off the paths rather than following the roads. Once
     * found, discovery persists in the save so the map can reveal them.
     */
    createSecrets() {
        world_1.SECRET_POINTS.forEach((secret) => {
            const uniqueId = `secret:${secret.id}`;
            const looted = Boolean(this.saves.get().flags[uniqueId]);
            const found = Boolean(this.saves.get().flags[`secret-found:${secret.id}`]);
            // Only actual chest props flip to the open texture once looted; a crypt or
            // obelisk keeps its own art (the loot came from "inside" it).
            const isChestProp = secret.texture === 'chest-closed';
            const texture = looted && isChestProp ? 'chest-open' : this.textures.exists(secret.texture) ? secret.texture : 'altar';
            const image = this.add.image(secret.x, secret.y, texture).setScale(secret.kind === 'note' ? 1.9 : 2.1).setDepth(secret.y / 10 + 5);
            image.setAlpha(found ? 1 : 0.05);
            if (secret.kind === 'shrine')
                image.setTint(looted ? 0x666570 : 0x9e76c2);
            const label = secret.kind === 'chest'
                ? (looted ? 'Тайник пуст' : 'Открыть тайник')
                : secret.kind === 'shrine'
                    ? (looted ? 'Святилище молчит' : 'Коснуться святилища')
                    : (looted ? 'Осмотрено' : 'Осмотреть');
            this.interactables.push({
                kind: 'secret', id: secret.id, uniqueId, label, object: image,
                secret: true, secretKind: secret.kind, lore: secret.lore,
            });
        });
        world_1.SHORTCUT_PORTALS.forEach((shortcut) => {
            const texture = this.textures.exists(shortcut.texture) ? shortcut.texture : 'crypt-entrance';
            ['a', 'b'].forEach((side) => {
                const foundKey = `secret-found:${shortcut.id}_${side}`;
                const found = Boolean(this.saves.get().flags[foundKey]);
                const here = shortcut[side];
                const there = side === 'a' ? shortcut.b : shortcut.a;
                const image = this.add.image(here.x, here.y, texture).setScale(2.1).setDepth(here.y / 10 + 5);
                image.setAlpha(found ? 1 : 0.05);
                this.interactables.push({
                    kind: 'passage', id: `${shortcut.id}_${side}`, uniqueId: `passage:${shortcut.id}_${side}`,
                    label: shortcut.name, object: image, secret: true, destination: { ...there },
                });
            });
        });
    }
    startRift(riftId) {
        const definition = world_1.RIFT_POINTS.find((rift) => rift.id === riftId);
        if (!definition)
            return;
        this.activeRift = { ...definition, wave: 0, remaining: 0 };
        this.sfx.quest();
        this.cameras.main.flash(260, 130, 55, 165);
        this.cameras.main.shake(420, .008);
        events_1.GameEvents.emit('toast', `${definition.name} пробуждается`);
        this.time.delayedCall(500, () => this.spawnRiftWave());
    }
    spawnRiftWave() {
        var _a;
        const rift = this.activeRift;
        if (!rift)
            return;
        rift.wave += 1;
        if (rift.wave > 3) {
            this.completeRift();
            return;
        }
        const pools = {
            forest_rift: ['direwolf', 'wraith', 'husk'],
            marsh_rift: ['bogling', 'wraith', 'direwolf'],
            citadel_rift: ['ashborn', 'boneguard', 'wraith'],
        };
        const pool = (_a = pools[rift.id]) !== null && _a !== void 0 ? _a : ['husk'];
        const count = 2 + rift.wave;
        rift.remaining = count;
        for (let index = 0; index < count; index += 1) {
            const angle = index / count * Math.PI * 2;
            const radius = 105 + rift.wave * 28;
            const type = pool[(index + rift.wave - 1) % pool.length];
            const enemy = this.spawnEnemy({ type, x: rift.x + Math.cos(angle) * radius, y: rift.y + Math.sin(angle) * radius, temporary: true, riftId: rift.id });
            enemy.setAlpha(0).setScale(enemy.scaleX * .35, enemy.scaleY * .35);
            this.tweens.add({ targets: enemy, alpha: 1, scaleX: enemy.scaleX / .35, scaleY: enemy.scaleY / .35, duration: 420 });
        }
        events_1.GameEvents.emit('rift-status', { name: rift.name, wave: rift.wave, remaining: rift.remaining });
        events_1.GameEvents.emit('toast', `Волна ${rift.wave}/3 • противников: ${count}`);
    }
    onRiftEnemyKilled(riftId) {
        const rift = this.activeRift;
        if (!rift || rift.id !== riftId)
            return;
        rift.remaining = Math.max(0, rift.remaining - 1);
        events_1.GameEvents.emit('rift-status', { name: rift.name, wave: rift.wave, remaining: rift.remaining });
        if (rift.remaining === 0)
            this.time.delayedCall(900, () => this.spawnRiftWave());
    }
    completeRift() {
        var _a;
        const rift = this.activeRift;
        if (!rift)
            return;
        this.saves.mutate((save) => { save.flags[`rift-complete:${rift.id}`] = true; save.coins += 280; save.xp += 160; }, true);
        this.inventory.add(rift.reward, 1, true);
        const item = (0, items_1.getItem)(rift.reward);
        if (item)
            events_1.GameEvents.emit('loot', { itemId: item.id, quantity: 1 });
        events_1.GameEvents.emit('toast', `${rift.name} очищен • +280 золота • редкая награда`);
        events_1.GameEvents.emit('rift-status', null);
        this.sfx.quest();
        const wave = this.add.circle(rift.x, rift.y, 45, 0xc56bde, .55).setStrokeStyle(8, 0xf0b8ff, .9).setDepth(900);
        this.tweens.add({ targets: wave, radius: 260, alpha: 0, duration: 1100, onComplete: () => wave.destroy() });
        (_a = this.interactables.find((entity) => entity.kind === 'rift' && entity.id === rift.id)) === null || _a === void 0 ? void 0 : _a.object.setTint(0x555866).setAlpha(.55);
        this.activeRift = undefined;
        this.emitHud(true);
    }
    createEnemies() {
        const spawns = [
            { type: 'husk', x: 1630, y: 450 }, { type: 'husk', x: 1810, y: 520 }, { type: 'husk', x: 1980, y: 650 }, { type: 'husk', x: 1720, y: 760 }, { type: 'husk', x: 2070, y: 780 },
            { type: 'direwolf', x: 1180, y: 1160 }, { type: 'direwolf', x: 1390, y: 1370 }, { type: 'direwolf', x: 1610, y: 1210 }, { type: 'direwolf', x: 1050, y: 1510 },
            { type: 'boneguard', x: 2040, y: 1100 }, { type: 'boneguard', x: 2240, y: 1110 }, { type: 'boneguard', x: 2440, y: 1210 },
            { type: 'wraith', x: 2140, y: 1380 }, { type: 'wraith', x: 2410, y: 1520 },
            { type: 'bogling', x: 2950, y: 380 }, { type: 'bogling', x: 3240, y: 430 }, { type: 'bogling', x: 3460, y: 760 }, { type: 'bogling', x: 3660, y: 890 }, { type: 'bogling', x: 3040, y: 880 },
            { type: 'cavecrawler', x: 3380, y: 1280 }, { type: 'cavecrawler', x: 3720, y: 1380 }, { type: 'cavecrawler', x: 3500, y: 1710 }, { type: 'cavecrawler', x: 3850, y: 1740 },
            { type: 'ashborn', x: 3950, y: 1650 }, { type: 'ashborn', x: 4310, y: 1780 }, { type: 'ashborn', x: 4020, y: 2110 }, { type: 'ashborn', x: 4380, y: 2320 }, { type: 'ashborn', x: 4080, y: 2510 },
            { type: 'nameless', x: 2280, y: 1330 }, { type: 'cinderlord', x: 4200, y: 2420 },
        ];
        spawns.forEach((spawn) => this.spawnEnemy(spawn));
    }
    spawnEnemy(spawn) {
        var _a, _b, _c;
        const definition = content_1.ENEMIES[spawn.type];
        const enemy = this.physics.add.sprite(spawn.x, spawn.y, `enemy-${spawn.type}`).setScale(((_a = definition.scale) !== null && _a !== void 0 ? _a : 1) * 1.62);
        enemy.setDepth(enemy.y / 10 + 12);
        enemy.setDataEnabled();
        enemy.setData({
            type: spawn.type,
            name: definition.name,
            health: definition.health,
            maxHealth: definition.health,
            damage: definition.damage,
            speed: definition.speed,
            aggro: definition.aggro,
            rewardCoins: definition.rewardCoins,
            homeX: spawn.x,
            homeY: spawn.y,
            lastAttack: 0,
            lastSpecial: 0,
            spawn,
        });
        // Elite roll happens before the health bar is created so the bar reads the
        // buffed maximum. Night raises the elite rate, which makes darkness matter.
        if (spawn.type !== 'nameless' && spawn.type !== 'cinderlord') {
            EnemyAI_1.EnemyAI.rollElite(enemy, { chanceMult: (_c = (_b = this.lighting) === null || _b === void 0 ? void 0 : _b.getState().danger) !== null && _c !== void 0 ? _c : 1 });
            const marker = EnemyAI_1.EnemyAI.createEliteMarker(this, enemy);
            if (marker)
                enemy.setData('eliteMarker', marker);
        }
        const body = enemy.body;
        body.setSize(enemy.width * .55, enemy.height * .52).setOffset(enemy.width * .22, enemy.height * .42);
        const bar = this.add.graphics().setDepth(enemy.depth + 2).setVisible(false);
        enemy.setData('healthBar', bar);
        this.enemies.add(enemy);
        if (spawn.type === 'nameless' || spawn.type === 'cinderlord') {
            if (spawn.type === 'nameless')
                this.boss = enemy;
            else
                this.cinderBoss = enemy;
            enemy.setVisible(false).setActive(false);
            body.enable = false;
        }
        return enemy;
    }
    createAtmosphere() {
        const overlay = this.add.graphics().setScrollFactor(0).setDepth(900);
        const { width, height } = this.scale;
        overlay.fillStyle(0x17132b, .1).fillRect(0, 0, width, height);
        overlay.fillStyle(0x05070d, .22).fillRect(0, 0, width, 55);
        overlay.fillStyle(0x05070d, .18).fillRect(0, height - 70, width, 70);
        this.regionTint = this.add.rectangle(0, 0, width, height, 0x332342, .06).setOrigin(0).setScrollFactor(0).setDepth(899).setBlendMode(phaser_1.default.BlendModes.ADD);
        const low = this.saves.get().settings.quality === 'low' || (this.saves.get().settings.quality === 'auto' && this.scale.width < 700);
        const moteCount = low ? 28 : 86;
        for (let index = 0; index < moteCount; index += 1) {
            const x = phaser_1.default.Math.Between(160, world_1.WORLD_WIDTH - 160);
            const y = phaser_1.default.Math.Between(180, world_1.WORLD_HEIGHT - 150);
            const inMarsh = x > 2780 && x < 3830 && y < 1100;
            const inCitadel = x > 3820 && y > 1420;
            const texture = inMarsh ? 'firefly' : inCitadel ? 'ember' : 'pixel';
            const tint = inMarsh ? 0xbaffb0 : inCitadel ? 0xff7c48 : index % 3 === 0 ? 0xb57ac9 : 0x91b69e;
            const mote = this.add.image(x, y, texture).setTint(tint).setAlpha(phaser_1.default.Math.FloatBetween(.12, .5)).setScale(phaser_1.default.Math.FloatBetween(.8, 2.1)).setDepth(3);
            this.tweens.add({ targets: mote, y: mote.y - phaser_1.default.Math.Between(inCitadel ? 60 : 18, inCitadel ? 140 : 65), x: mote.x + phaser_1.default.Math.Between(-28, 28), alpha: { from: mote.alpha, to: .03 }, duration: phaser_1.default.Math.Between(1500, 4300), yoyo: true, repeat: -1, delay: phaser_1.default.Math.Between(0, 1600) });
        }
        if (!low) {
            for (let index = 0; index < 28; index += 1) {
                const drop = this.add.rectangle(phaser_1.default.Math.Between(2800, 3780), phaser_1.default.Math.Between(180, 1050), 2, 18, 0x8eb2bd, .22).setRotation(-.2).setDepth(6);
                this.tweens.add({ targets: drop, y: drop.y + 260, x: drop.x - 55, duration: phaser_1.default.Math.Between(650, 1000), repeat: -1, delay: index * 65 });
            }
        }
    }
    /**
     * Places every light in the world. Lights are static apart from the player's
     * own lantern, which follows them so night travel has a readable bubble of
     * safety rather than being uniformly dark.
     */
    createLighting() {
        var _a;
        const save = this.saves.get();
        const low = save.settings.quality === 'low'
            || (save.settings.quality === 'auto' && this.scale.width < 700);
        this.lighting = new Lighting_1.LightingSystem(this);
        this.lighting.create();
        // A full cycle takes 12 minutes of play — long enough that night feels like
        // an event, short enough that a player sees several in one session.
        this.lighting.setDayLength(720);
        this.lighting.setDayProgress((_a = save.dayProgress) !== null && _a !== void 0 ? _a : 0.34);
        // The player's carried lantern.
        this.lighting.addLight({ x: this.player.x, y: this.player.y, radius: 150, ...Lighting_1.FLAME_LIGHT, intensity: 0.6 });
        this.playerLightIndex = 0;
        if (low) {
            // On weak hardware keep only the player light — the tint still sells night.
            return;
        }
        // Windows of inhabited buildings.
        for (const building of world_1.BUILDINGS) {
            if (!building.interior)
                continue;
            this.lighting.addLight({ x: building.x, y: building.y + 6, radius: 170, ...Lighting_1.WINDOW_LIGHT });
        }
        // The forge burns hotter and is visible from across the village.
        this.lighting.addLight({ x: 1210, y: 500, radius: 230, ...Lighting_1.FORGE_LIGHT });
        // Village lanterns and the well.
        for (const [x, y] of [[920, 690], [1010, 520], [860, 760], [1150, 700]]) {
            this.lighting.addLight({ x, y, radius: 130, ...Lighting_1.FLAME_LIGHT, intensity: 0.62, nightOnly: true });
        }
        // Rifts bleed arcane light whether or not it's night.
        for (const rift of world_1.RIFT_POINTS) {
            this.lighting.addLight({ x: rift.x, y: rift.y, radius: 200, ...Lighting_1.ARCANE_LIGHT });
        }
        // Citadel braziers.
        for (const [x, y] of [[4020, 1900], [4240, 1900], [4130, 2300]]) {
            this.lighting.addLight({ x, y, radius: 190, ...Lighting_1.FORGE_LIGHT, intensity: 0.7 });
        }
        // Cemetery grave candles — sparse and cold.
        for (const [x, y] of [[1600, 410], [1880, 420], [2070, 735]]) {
            this.lighting.addLight({ x, y, radius: 96, color: 0x9fb0dc, intensity: 0.4, flicker: 0.2, nightOnly: true });
        }
        // Dock and mine work lights.
        this.lighting.addLight({ x: 3020, y: 2270, radius: 175, ...Lighting_1.FLAME_LIGHT, intensity: 0.6 });
        this.lighting.addLight({ x: 3595, y: 1450, radius: 150, ...Lighting_1.FLAME_LIGHT, intensity: 0.55 });
    }
    createWeather() {
        const save = this.saves.get();
        const low = save.settings.quality === 'low'
            || (save.settings.quality === 'auto' && this.scale.width < 700);
        this.weather = new Weather_1.WeatherSystem(this);
        this.weather.create(885, low ? 'low' : 'high');
        this.weather.onThunderStrike(() => {
            this.sfx.thunder();
            // Lightning briefly lights the whole scene.
            this.lighting.flash(this.player.x, this.player.y, 520, 0xc8d4ee, 320);
        });
        this.weather.rollForRegion('village');
    }
    createObjectiveMarker() {
        const ring = this.add.ellipse(0, 0, 46, 22, 0xc26d90, .16).setStrokeStyle(3, 0xd79bb4, .8);
        const glyph = this.add.text(0, -34, '⌄', { fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color: '#f0b7ce', stroke: '#14151c', strokeThickness: 5 }).setOrigin(.5);
        this.objectiveMarker = this.add.container(0, 0, [ring, glyph]).setDepth(850).setVisible(false);
        this.tweens.add({ targets: glyph, y: -42, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: ring, scaleX: 1.3, scaleY: 1.3, alpha: .03, duration: 1000, repeat: -1 });
    }
    setupPhysics() {
        this.physics.add.collider(this.player, this.solids);
        this.physics.add.collider(this.enemies, this.solids);
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.collider(this.projectiles, this.solids, (object) => object.destroy());
        this.physics.add.overlap(this.projectiles, this.enemies, (projectileObject, enemyObject) => {
            var _a, _b;
            const projectile = projectileObject;
            const enemy = enemyObject;
            if (!projectile.active || !enemy.active)
                return;
            const weapon = (_a = content_1.WEAPONS.find((entry) => entry.id === projectile.getData('weaponId'))) !== null && _a !== void 0 ? _a : content_1.WEAPONS[0];
            this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, Number((_b = projectile.getData('damage')) !== null && _b !== void 0 ? _b : 0)));
            projectile.destroy();
        });
        // Enemy projectiles are their own group: they must not collide with other
        // enemies, and they hit the player instead.
        this.physics.add.collider(this.enemyProjectiles, this.solids, (object) => object.destroy());
        this.physics.add.overlap(this.enemyProjectiles, this.player, (projectileObject) => {
            var _a, _b;
            const projectile = projectileObject;
            if (!projectile.active || !this.player.active)
                return;
            this.hurtPlayer(Number((_a = projectile.getData('damage')) !== null && _a !== void 0 ? _a : 10));
            const kind = String((_b = projectile.getData('kind')) !== null && _b !== void 0 ? _b : 'fire');
            this.lighting.flash(projectile.x, projectile.y, 90, kind === 'fire' ? 0xff8a4c : 0xa06ce0, 200);
            projectile.destroy();
        });
    }
    /**
     * Spawns a projectile fired by an enemy. Shared by the ranged archetype and by
     * both boss fights so there is a single code path for enemy ordnance.
     */
    spawnEnemyProjectile(request) {
        const texture = request.kind === 'fire' ? 'projectile-magic' : 'projectile-bolt';
        const projectile = this.physics.add.sprite(request.x, request.y, texture);
        const direction = new phaser_1.default.Math.Vector2(request.targetX - request.x, request.targetY - request.y);
        if (direction.lengthSq() < 0.01)
            direction.set(0, 1);
        direction.normalize();
        projectile
            .setScale(request.kind === 'fire' ? 2 : 1.8)
            .setRotation(direction.angle())
            .setTint(request.kind === 'fire' ? 0xff9a52 : 0xb07ce8)
            .setDepth(projectile.y / 10 + 22);
        // Generous ttl: the projectile should cross the arena, then expire.
        projectile.setData({ damage: request.damage, kind: request.kind, ttl: 2600 });
        projectile.setVelocity(direction.x * request.speed, direction.y * request.speed);
        this.enemyProjectiles.add(projectile);
    }
    setupInput() {
        if (!this.input.keyboard)
            return;
        this.cursors = this.input.keyboard.createCursorKeys();
        // Z/X/V drive the three consumable quick slots. 4/5/6 would collide with the
        // weapon hotbar, which already owns 1-8.
        this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,Q,I,M,B,R,C,K,J,Z,X,V,SHIFT,ESC,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
        this.input.on('pointerdown', (pointer) => {
            if (!this.uiLocked && pointer.leftButtonDown())
                this.attack(pointer);
        });
        this.input.on('wheel', (_pointer, _objects, _deltaX, deltaY) => {
            if (!this.uiLocked)
                this.cycleWeapon(deltaY > 0 ? 1 : -1);
        });
    }
    setupUi() {
        this.ui = new GameUI_1.GameUI();
        this.ui.mount();
    }
    listen(event, callback) {
        events_1.GameEvents.on(event, callback);
        this.eventDisposers.push(() => events_1.GameEvents.off(event, callback));
    }
    setupEvents() {
        this.listen('ui-lock', (locked) => {
            this.uiLocked = locked;
            if (locked)
                this.player.setVelocity(0);
        });
        this.listen('ui-move', (vector) => this.mobileMove.set(vector.x, vector.y));
        this.listen('ui-attack', () => { if (!this.uiLocked)
            this.attack(); });
        this.listen('ui-dash', () => { if (!this.uiLocked)
            this.dash(); });
        this.listen('ui-special', () => { if (!this.uiLocked)
            this.specialAbility(); });
        this.listen('ui-interact', () => { if (!this.uiLocked)
            this.interact(); });
        this.listen('ui-heal', () => this.usePotion());
        this.listen('equip', (weaponId) => this.equipWeapon(weaponId));
        this.listen('craft-recipe', (recipeId) => this.craftRecipe(recipeId));
        this.listen('upgrade-weapon', (weaponId) => this.upgradeWeapon(weaponId));
        this.listen('use-quick-slot', (index) => this.useQuickSlot(index));
        this.listen('assign-quick-slot', ({ itemId, slot }) => {
            if (itemId && typeof slot === 'number' && this.inventory.setQuickSlot(slot, itemId)) {
                this.sfx.ui();
                this.emitHud(true);
            }
        });
        this.listen('clear-quick-slot', (slot) => {
            if (this.inventory.clearQuickSlot(slot)) {
                this.sfx.ui();
                this.emitHud(true);
            }
        });
        this.listen('equip-item', (itemId) => { if (this.inventory.equip(itemId)) {
            this.sfx.ui();
            this.emitHud(true);
        } });
        this.listen('use-item', (itemId) => this.useInventoryItem(itemId));
        this.listen('transfer-item', ({ itemId, direction }) => {
            if (itemId && direction && this.inventory.transfer(itemId, 1, direction)) {
                this.sfx.pickup();
                this.emitHud(true);
            }
        });
        this.listen('buy', (weaponId) => this.buyWeapon(weaponId));
        this.listen('claim-tier', (tier) => this.claimTier(tier));
        this.listen('quest-accept', (questId) => this.acceptQuest(questId));
        this.listen('quest-turnin', (questId) => this.turnInQuest(questId));
        this.listen('open-shop', () => events_1.GameEvents.emit('panel-open', 'shop'));
        this.listen('toggle-sound', () => {
            this.saves.mutate((save) => { save.settings.sound = !save.settings.sound; }, true);
            this.sfx.setMix(this.audioMix(this.saves.get()));
            if (this.saves.get().settings.sound)
                void this.sfx.unlock();
            this.emitHud(true);
        });
        this.listen('set-volume', ({ key, value }) => {
            if (!key || typeof value !== 'number' || !key.endsWith('Volume'))
                return;
            this.saves.mutate((save) => { save.settings[key] = value; }, true);
            this.sfx.setMix(this.audioMix(this.saves.get()));
        });
        this.listen('toggle-motion', () => {
            this.saves.mutate((save) => { save.settings.reducedMotion = !save.settings.reducedMotion; }, true);
            document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
            this.emitHud(true);
        });
        this.listen('toggle-quality', () => {
            const order = ['auto', 'high', 'low'];
            this.saves.mutate((save) => { save.settings.quality = order[(order.indexOf(save.settings.quality) + 1) % order.length]; }, true);
            document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low');
            this.emitHud(true);
        });
        this.listen('fullscreen', () => {
            if (this.scale.isFullscreen)
                this.scale.stopFullscreen();
            else
                this.scale.startFullscreen();
        });
        this.listen('reset-game', () => { this.saves.reset(); window.location.reload(); });
        this.listen('respawn', () => this.respawn());
    }
    updatePlayer(time, delta) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        if (!this.player.active)
            return;
        if (this.uiLocked) {
            this.player.setVelocity(0);
            this.player.anims.stop();
            return;
        }
        if (this.isDashing)
            return;
        const input = new phaser_1.default.Math.Vector2((((_b = (_a = this.keys) === null || _a === void 0 ? void 0 : _a.D) === null || _b === void 0 ? void 0 : _b.isDown) || ((_d = (_c = this.cursors) === null || _c === void 0 ? void 0 : _c.right) === null || _d === void 0 ? void 0 : _d.isDown) ? 1 : 0) - (((_f = (_e = this.keys) === null || _e === void 0 ? void 0 : _e.A) === null || _f === void 0 ? void 0 : _f.isDown) || ((_h = (_g = this.cursors) === null || _g === void 0 ? void 0 : _g.left) === null || _h === void 0 ? void 0 : _h.isDown) ? 1 : 0), (((_k = (_j = this.keys) === null || _j === void 0 ? void 0 : _j.S) === null || _k === void 0 ? void 0 : _k.isDown) || ((_m = (_l = this.cursors) === null || _l === void 0 ? void 0 : _l.down) === null || _m === void 0 ? void 0 : _m.isDown) ? 1 : 0) - (((_p = (_o = this.keys) === null || _o === void 0 ? void 0 : _o.W) === null || _p === void 0 ? void 0 : _p.isDown) || ((_r = (_q = this.cursors) === null || _q === void 0 ? void 0 : _q.up) === null || _r === void 0 ? void 0 : _r.isDown) ? 1 : 0));
        if (this.mobileMove.lengthSq() > .02)
            input.copy(this.mobileMove);
        if (input.lengthSq() > 1)
            input.normalize();
        const speed = 190 + this.inventory.speedBonus();
        this.player.setVelocity(input.x * speed, input.y * speed);
        if (input.lengthSq() > .02) {
            this.facing.copy(input).normalize();
            this.movedDistance += speed * delta / 1000;
            if (time > this.lastStepAt + 330) {
                const surface = this.lastLocation.includes('Пристан') || this.lastLocation.includes('Болото') ? 'water' : this.lastLocation.includes('Цитад') || this.lastLocation.includes('Кладбищ') ? 'stone' : 'grass';
                this.sfx.step(surface);
                this.lastStepAt = time;
            }
            if (!this.saves.get().tutorialDone && !this.saves.get().flags.tutorialMoved && this.movedDistance > 95) {
                this.saves.mutate((save) => { save.flags.tutorialMoved = true; }, true);
                this.emitTutorial();
                events_1.GameEvents.emit('toast', 'Движение освоено');
            }
            this.setHeroAnimation('walk', input.x, input.y);
        }
        else {
            this.player.setVelocity(0);
            this.setHeroAnimation('idle', this.facing.x, this.facing.y);
        }
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.E))
            this.interact();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.F))
            this.usePotion();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.SPACE))
            this.attack();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.SHIFT))
            this.dash();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.R))
            this.specialAbility();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.Q))
            events_1.GameEvents.emit('panel-open', 'journal');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.I))
            events_1.GameEvents.emit('panel-open', 'inventory');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.M))
            events_1.GameEvents.emit('panel-open', 'map');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.B))
            events_1.GameEvents.emit('panel-open', 'pass');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.C))
            events_1.GameEvents.emit('panel-open', 'craft');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.K))
            events_1.GameEvents.emit('panel-open', 'bestiary');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.J))
            events_1.GameEvents.emit('panel-open', 'achievements');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.ESC))
            events_1.GameEvents.emit('panel-open', 'pause');
        ['Z', 'X', 'V'].forEach((key, index) => {
            if (phaser_1.default.Input.Keyboard.JustDown(this.keys[key]))
                this.useQuickSlot(index);
        });
        const weaponKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
        weaponKeys.forEach((key, index) => {
            if (phaser_1.default.Input.Keyboard.JustDown(this.keys[key])) {
                const weapon = content_1.WEAPONS[index];
                if (weapon && this.saves.get().ownedWeapons.includes(weapon.id))
                    this.equipWeapon(weapon.id);
            }
        });
    }
    /**
     * Chooses the hero animation from a movement/facing vector.
     *
     * The art has five sculpted directions; the three that face right are mirrored
     * for left, which is why only x is flipped. Transient poses (attack, dash,
     * hurt) hold for a short window so a single frame isn't immediately overwritten
     * by the walk cycle on the next update.
     */
    setHeroAnimation(pose, dx, dy) {
        if (this.heroPose !== pose && this.time.now < this.heroPoseUntil)
            return;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        let dir;
        if (absX < 0.001 && absY < 0.001) {
            dir = this.heroDir;
        }
        else if (absX > absY * 2.2) {
            dir = 'side';
        }
        else if (absY > absX * 2.2) {
            dir = dy < 0 ? 'up' : 'down';
        }
        else {
            dir = dy < 0 ? 'up-side' : 'down-side';
        }
        this.heroDir = dir;
        this.heroPose = pose;
        const flip = dir !== 'up' && dir !== 'down' && dx < 0;
        const animKey = `hero-${dir}-${pose}`;
        if (this.anims.exists(animKey)) {
            this.player.play(animKey, true);
        }
        else {
            this.player.anims.stop();
            this.player.setTexture((0, hero_1.heroKey)(dir, pose, 0));
        }
        this.player.setFlipX(flip);
    }
    /** Play a one-shot pose (attack/dash/hurt) and lock it for `holdMs`. */
    playHeroPose(pose, holdMs) {
        this.heroPoseUntil = 0;
        this.setHeroAnimation(pose, this.facing.x, this.facing.y);
        this.heroPoseUntil = this.time.now + holdMs;
    }
    dash() {
        if (this.time.now < this.dashReadyAt || this.uiLocked || this.isDashing)
            return;
        const direction = this.mobileMove.lengthSq() > .05 ? this.mobileMove.clone().normalize() : this.facing.clone().normalize();
        if (direction.lengthSq() < .01)
            direction.set(0, 1);
        this.dashReadyAt = this.time.now + 1800;
        this.isDashing = true;
        this.hurtReadyAt = this.time.now + 420;
        this.sfx.dash();
        this.playHeroPose('dash', 240);
        if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialMoved && this.saves.get().flags.tutorialAttacked && !this.saves.get().flags.tutorialDashed) {
            this.saves.mutate((save) => { save.flags.tutorialDashed = true; }, true);
            this.emitTutorial();
            events_1.GameEvents.emit('toast', 'Рывок освоен');
        }
        this.player.setVelocity(direction.x * 620, direction.y * 620).setAlpha(.7);
        for (let index = 0; index < 5; index += 1) {
            this.time.delayedCall(index * 32, () => {
                const ghost = this.add.image(this.player.x, this.player.y, this.player.texture.key).setScale(this.player.scaleX, this.player.scaleY).setFlipX(this.player.flipX).setTint(0xb98bd1).setAlpha(.34).setDepth(this.player.depth - 1);
                this.tweens.add({ targets: ghost, alpha: 0, scaleX: ghost.scaleX * 1.08, scaleY: ghost.scaleY * 1.08, duration: 260, onComplete: () => ghost.destroy() });
            });
        }
        this.cameras.main.shake(110, .003);
        this.time.delayedCall(190, () => { this.isDashing = false; this.player.setAlpha(1).setVelocity(direction.x * 90, direction.y * 90); });
    }
    specialAbility() {
        var _a;
        if (this.time.now < this.specialReadyAt || this.uiLocked)
            return;
        const weapon = (_a = content_1.WEAPONS.find((item) => item.id === this.saves.get().equippedWeapon)) !== null && _a !== void 0 ? _a : content_1.WEAPONS[0];
        this.specialReadyAt = this.time.now + (weapon.kind === 'melee' ? 4800 : weapon.kind === 'ranged' ? 5200 : 6200);
        this.sfx.special(weapon.kind);
        this.playHeroPose('attack', 300);
        // The ability lights the area from the player outward.
        this.lighting.flash(this.player.x, this.player.y, weapon.kind === 'melee' ? 200 : 260, phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color, 480);
        if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialDashed && !this.saves.get().flags.tutorialSpecial) {
            this.saves.mutate((save) => { save.flags.tutorialSpecial = true; }, true);
            this.emitTutorial();
            events_1.GameEvents.emit('toast', 'Особая способность освоена');
        }
        if (weapon.kind === 'melee') {
            const ring = this.add.circle(this.player.x, this.player.y, 38, 0xb35a78, .22).setStrokeStyle(6, 0xf0a8c0, .9).setDepth(this.player.depth + 3);
            this.tweens.add({ targets: ring, radius: 150, alpha: 0, angle: 180, duration: 420, onComplete: () => ring.destroy() });
            this.enemies.children.each((child) => {
                const enemy = child;
                if (enemy.active && phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 165)
                    this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, Math.round((weapon.damage + this.inventory.damageBonus()) * 1.7)));
                return null;
            });
        }
        else if (weapon.kind === 'ranged') {
            const baseAngle = this.facing.angle();
            [-.34, -.17, 0, .17, .34].forEach((offset) => this.projectileAttack(weapon, new phaser_1.default.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset))));
        }
        else {
            const nova = this.add.circle(this.player.x, this.player.y, 28, phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color, .42).setStrokeStyle(5, 0xf4d7ff, .9).setDepth(this.player.depth + 3);
            this.tweens.add({ targets: nova, radius: 230, alpha: 0, duration: 650, onComplete: () => nova.destroy() });
            this.enemies.children.each((child) => {
                const enemy = child;
                const distance = phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                if (enemy.active && distance < 240) {
                    this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, Math.round((weapon.damage + this.inventory.damageBonus()) * 1.35)));
                    const push = new phaser_1.default.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
                    enemy.setVelocity(push.x * 280, push.y * 280);
                }
                return null;
            });
        }
        this.cameras.main.flash(90, 180, 105, 170);
        this.cameras.main.shake(180, .006);
    }
    attack(pointer) {
        var _a, _b;
        const save = this.saves.get();
        const weapon = (_a = content_1.WEAPONS.find((item) => item.id === save.equippedWeapon)) !== null && _a !== void 0 ? _a : content_1.WEAPONS[0];
        if (this.time.now < this.attackReadyAt)
            return;
        this.attackReadyAt = this.time.now + weapon.cooldown;
        let direction = this.facing.clone();
        if (pointer) {
            direction = new phaser_1.default.Math.Vector2(pointer.worldX - this.player.x, pointer.worldY - this.player.y);
            if (direction.lengthSq() > 16)
                direction.normalize();
            else
                direction.copy(this.facing);
            this.facing.copy(direction);
        }
        // Heavy weapons get the weightier swing sound; the threshold matches the
        // cooldown at which a swing reads as a commitment rather than a jab.
        if (weapon.cooldown >= 600)
            this.sfx.heavyAttack(weapon.kind);
        else
            this.sfx.attack(weapon.kind);
        this.playHeroPose('attack', Math.min(220, weapon.cooldown * 0.6));
        (_b = this.heldWeapon) === null || _b === void 0 ? void 0 : _b.setScale(1.8).setTint(phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color);
        this.time.delayedCall(130, () => { var _a; return (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setScale(1.45).clearTint(); });
        if (weapon.kind === 'melee')
            this.meleeAttack(weapon, direction);
        else
            this.projectileAttack(weapon, direction);
        this.cameras.main.shake(55, weapon.kind === 'melee' ? .0018 : .001);
        if (!save.tutorialDone && save.flags.tutorialMoved && !save.flags.tutorialAttacked) {
            this.saves.mutate((state) => { state.flags.tutorialAttacked = true; }, true);
            this.emitTutorial();
            events_1.GameEvents.emit('toast', 'Бой освоен — найдите Сестру Мору');
        }
    }
    meleeAttack(weapon, direction) {
        const x = this.player.x + direction.x * 42;
        const y = this.player.y + direction.y * 42;
        const slash = this.add.rectangle(x, y, 46, 11, phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color, .8)
            .setRotation(direction.angle()).setDepth(this.player.depth + 2);
        this.tweens.add({ targets: slash, scaleX: 1.6, scaleY: .35, alpha: 0, duration: 130, onComplete: () => slash.destroy() });
        this.enemies.children.each((child) => {
            const enemy = child;
            if (!enemy.active)
                return null;
            const toEnemy = new phaser_1.default.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
            const distance = toEnemy.length();
            if (distance > weapon.range + 26 || distance < 1)
                return null;
            toEnemy.normalize();
            if (toEnemy.dot(direction) > .12)
                this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, weapon.damage + this.inventory.damageBonus()));
            return null;
        });
    }
    projectileAttack(weapon, direction) {
        var _a, _b, _c;
        const texture = weapon.kind === 'magic' ? 'projectile-magic' : 'projectile-bolt';
        const projectile = this.physics.add.sprite(this.player.x + direction.x * 30, this.player.y + direction.y * 30, texture)
            .setScale(weapon.kind === 'magic' ? 1.7 : 2).setRotation(direction.angle()).setDepth(this.player.depth + 3);
        projectile.setData({ damage: weapon.damage + this.inventory.damageBonus(), weaponId: weapon.id, ttl: weapon.range / ((_a = weapon.projectileSpeed) !== null && _a !== void 0 ? _a : 350) * 1000 });
        projectile.setVelocity(direction.x * ((_b = weapon.projectileSpeed) !== null && _b !== void 0 ? _b : 350), direction.y * ((_c = weapon.projectileSpeed) !== null && _c !== void 0 ? _c : 350));
        this.projectiles.add(projectile);
        if (weapon.kind === 'magic')
            this.tweens.add({ targets: projectile, angle: projectile.angle + 180, duration: 450, repeat: -1 });
    }
    weaponDamageAgainst(enemy, weapon, baseDamage) {
        const type = enemy.getData('type');
        const visual = (0, weaponVisuals_1.getWeaponVisual)(weapon.id);
        let multiplier = visual.bonusVs.includes(type) ? (type === 'nameless' || type === 'cinderlord' ? 1.2 : 1.28) : 1;
        if (this.time.now < this.tacticalBonusUntil)
            multiplier *= 1.15;
        return Math.round(baseDamage * multiplier);
    }
    damageEnemy(enemy, damage) {
        var _a, _b, _c;
        if (!enemy.active)
            return;
        // A wraith mid-blink and a boss mid-phase-transition cannot be hurt — both
        // are deliberate windows the player has to wait out.
        if (EnemyAI_1.EnemyAI.isIntangible(enemy) || enemy.getData('bossInvulnerable'))
            return;
        // Shieldbearers soak frontal damage, so the player must flank them.
        damage = EnemyAI_1.EnemyAI.mitigateDamage(enemy, damage, this.player.x, this.player.y);
        if (this.time.now > this.comboExpires)
            this.comboHits = 0;
        this.comboHits += 1;
        this.comboExpires = this.time.now + 1900;
        const comboMultiplier = 1 + Math.min(10, this.comboHits - 1) * .025;
        // Crits are earned, not random: a long combo raises the chance, which rewards
        // pressing an advantage instead of trading single hits.
        const critChance = 0.06 + Math.min(0.22, this.comboHits * 0.02);
        const critical = Math.random() < critChance;
        const finalDamage = Math.round(damage * comboMultiplier * (critical ? 1.85 : 1));
        const health = Math.max(0, Number(enemy.getData('health')) - finalDamage);
        const type = String(enemy.getData('type'));
        enemy.setData('health', health);
        // Bosses need their own damage feed to drive phase transitions and the bar.
        if (type === 'nameless') {
            (_a = this.namelessFight) === null || _a === void 0 ? void 0 : _a.onDamaged(health);
            events_1.GameEvents.emit('boss-health', { health, phase: Number(enemy.getData('bossPhase')) || 1 });
        }
        else if (type === 'cinderlord') {
            (_b = this.cinderFight) === null || _b === void 0 ? void 0 : _b.onDamaged(health);
            events_1.GameEvents.emit('boss-health', { health, phase: Number(enemy.getData('bossPhase')) || 1 });
        }
        events_1.GameEvents.emit('combo', { hits: this.comboHits, multiplier: comboMultiplier });
        if (this.comboHits > ((_c = this.saves.get().stats.bestCombo) !== null && _c !== void 0 ? _c : 0)) {
            this.saves.mutate((save) => { save.stats.bestCombo = this.comboHits; });
            this.achievements.check('combo', { streak: this.comboHits });
        }
        // Hit flash plus a small knock-back nudge: the enemy visibly reacts.
        enemy.setTintFill(critical ? 0xfff0d0 : 0xf5d5df);
        this.time.delayedCall(critical ? 130 : 90, () => { if (enemy.active)
            enemy.clearTint(); });
        const knock = new phaser_1.default.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
        enemy.setVelocity(knock.x * (critical ? 190 : 110), knock.y * (critical ? 190 : 110));
        const number = this.add.text(enemy.x, enemy.y - 38, critical ? `${finalDamage}!` : `-${finalDamage}`, {
            fontFamily: 'monospace',
            fontSize: critical ? '17px' : '12px',
            fontStyle: 'bold',
            color: critical ? '#ffe9a8' : '#ffd2dc',
            stroke: '#15161d',
            strokeThickness: critical ? 5 : 4,
        }).setOrigin(.5).setDepth(900);
        this.tweens.add({
            targets: number,
            y: number.y - (critical ? 40 : 28),
            alpha: 0,
            scale: critical ? 1.35 : 1,
            duration: critical ? 720 : 580,
            ease: 'Quad.easeOut',
            onComplete: () => number.destroy(),
        });
        if (critical) {
            // Crits get their own light pop and a harder shake so they land.
            this.lighting.flash(enemy.x, enemy.y, 110, 0xffdca0, 220);
            this.cameras.main.shake(95, .004);
        }
        this.sfx.impact(type, critical ? 1.4 : 1, critical);
        if (health <= 0)
            this.killEnemy(enemy);
    }
    killEnemy(enemy) {
        var _a, _b, _c, _d;
        const type = enemy.getData('type');
        const definition = content_1.ENEMIES[type];
        const coins = Number(enemy.getData('rewardCoins'));
        const spawn = enemy.getData('spawn');
        const deathX = enemy.x;
        const deathY = enemy.y;
        const depth = enemy.depth;
        const bar = enemy.getData('healthBar');
        bar === null || bar === void 0 ? void 0 : bar.destroy();
        (_a = enemy.getData('eliteMarker')) === null || _a === void 0 ? void 0 : _a.destroy();
        // Elites drop more, which is the reward for the harder fight.
        const lootMultiplier = Number(enemy.getData('lootMult')) || 1;
        // Note: BestiarySystem.recordKill already increments totalKills and bossKills,
        // so only the coin counter is tracked here to avoid double-counting.
        this.saves.mutate((save) => {
            save.coins += coins;
            save.stats.coinsEarned += coins;
        });
        const update = this.quests.record('kill', type, 1);
        const isBoss = type === 'nameless' || type === 'cinderlord';
        // Bestiary and achievements. Recording the kill here (rather than in the UI)
        // keeps progression truthful even if a panel is never opened.
        const killCount = this.bestiary.recordKill(type);
        if (killCount === 1) {
            events_1.GameEvents.emit('toast', `Бестиарий: ${definition.name} изучен`);
        }
        if (isBoss) {
            // A flawless boss kill means no damage taken since the fight started.
            if (this.bossFightStartedAt > 0 && this.lastPlayerHurtAt < this.bossFightStartedAt) {
                this.saves.mutate((save) => { save.stats.flawlessBossKills += 1; });
                this.achievements.check('boss_flawless', { enemyId: type });
                events_1.GameEvents.emit('toast', 'Безупречная победа');
            }
            this.bossFightStartedAt = 0;
            this.sfx.setBossFight(false);
        }
        const unlocked = this.achievements.check('kill', { enemyId: type });
        for (const achievement of unlocked) {
            events_1.GameEvents.emit('toast', `Достижение: ${achievement.name}`);
        }
        this.achievements.check('coins', { total: this.saves.get().stats.coinsEarned });
        const color = type === 'nameless' ? 0xd77ac7 : type === 'cinderlord' || type === 'ashborn' ? 0xff7549 : type === 'bogling' ? 0x7bdaa7 : 0xc09a7b;
        for (let index = 0; index < 7; index += 1) {
            const puff = this.add.image(deathX + phaser_1.default.Math.Between(-18, 18), deathY + phaser_1.default.Math.Between(-12, 12), index % 2 ? 'spark' : 'pixel').setScale(phaser_1.default.Math.FloatBetween(2, 5)).setTint(color).setDepth(depth + 3);
            this.tweens.add({ targets: puff, x: puff.x + phaser_1.default.Math.Between(-55, 55), y: puff.y + phaser_1.default.Math.Between(-65, 15), scale: phaser_1.default.Math.FloatBetween(5, 10), alpha: 0, angle: phaser_1.default.Math.Between(-120, 120), duration: phaser_1.default.Math.Between(380, 720), onComplete: () => puff.destroy() });
        }
        enemy.destroy();
        for (const drop of (_b = definition.drops) !== null && _b !== void 0 ? _b : []) {
            if (Math.random() > drop.chance)
                continue;
            const quantity = phaser_1.default.Math.Between(drop.min, drop.max) * lootMultiplier;
            this.inventory.add(drop.itemId, quantity, true);
            this.sfx.pickup();
            events_1.GameEvents.emit('loot', { itemId: drop.itemId, quantity });
        }
        this.sfx.coin(isBoss ? 4 : 1);
        this.sfx.enemyDeath(type, isBoss);
        if (isBoss) {
            // A boss death is worth a moment: heavy shake and a big light bloom.
            this.cameras.main.shake(420, .009);
            this.lighting.flash(deathX, deathY, 420, type === 'cinderlord' ? 0xff8a4c : 0xd77ac7, 700);
        }
        events_1.GameEvents.emit('toast', `+${coins} золота • ${definition.name} повержен`);
        if (update.readyQuest)
            this.sfx.quest();
        if (spawn.riftId)
            this.onRiftEnemyKilled(spawn.riftId);
        else if (!spawn.temporary && type !== 'nameless' && type !== 'cinderlord')
            this.time.delayedCall(11000, () => this.spawnEnemy(spawn));
        else if (type === 'nameless')
            this.boss = undefined;
        else if (type === 'cinderlord')
            this.cinderBoss = undefined;
        if (isBoss) {
            // Tear the choreography down or its timers keep firing after the kill.
            if (type === 'nameless') {
                (_c = this.namelessFight) === null || _c === void 0 ? void 0 : _c.destroy();
                this.namelessFight = undefined;
            }
            else {
                (_d = this.cinderFight) === null || _d === void 0 ? void 0 : _d.destroy();
                this.cinderFight = undefined;
            }
            events_1.GameEvents.emit('boss-defeated');
        }
        this.onQuestProgress(update);
        this.emitHud(true);
    }
    updateEnemies(time, _delta) {
        var _a, _b;
        if (this.uiLocked || !this.player.active) {
            this.enemies.setVelocity(0, 0);
            this.sfx.setCombat(false);
            return;
        }
        let combat = false;
        // Context is built once per tick and reused for every enemy — the AI runs for
        // up to 30 sprites, so allocating per enemy here would be wasteful.
        const settings = this.saves.get().settings;
        const lowQuality = settings.quality === 'low' || (settings.quality === 'auto' && this.scale.width < 700);
        const context = {
            playerX: this.player.x,
            playerY: this.player.y,
            playerAlive: this.player.active,
            time,
            delta: _delta,
            // Fog genuinely hides the player, and night makes everything bolder.
            visibility: this.weather.profile().visibility,
            danger: this.lighting.getState().danger,
            reducedMotion: settings.reducedMotion,
            lowQuality,
            hurtPlayer: (amount) => this.hurtPlayer(amount),
            spawnProjectile: (request) => this.spawnEnemyProjectile(request),
            spawnAdd: (type, x, y) => {
                this.spawnEnemy({ type: type, x, y, temporary: true });
            },
            enemies: this.enemies.getChildren(),
        };
        const renderDistance = lowQuality ? 900 : 1450;
        this.enemies.children.each((child) => {
            const enemy = child;
            if (!enemy.active)
                return null;
            const distance = phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            const body = enemy.body;
            enemy.setVisible(distance < renderDistance);
            const healthBar = enemy.getData('healthBar');
            if (distance >= renderDistance) {
                body.setVelocity(0);
                healthBar === null || healthBar === void 0 ? void 0 : healthBar.setVisible(false);
                return null;
            }
            // Archetype behaviour lives in EnemyAI; bosses opt out and are driven by
            // their BossFight instead.
            if (EnemyAI_1.EnemyAI.update(enemy, context))
                combat = true;
            enemy.setDepth(enemy.y / 10 + 12);
            const marker = enemy.getData('eliteMarker');
            if (marker)
                marker.setPosition(enemy.x, enemy.y - enemy.displayHeight * 0.62).setDepth(enemy.depth + 3);
            return null;
        });
        // Boss choreography runs on the same cadence as the mook AI.
        (_a = this.namelessFight) === null || _a === void 0 ? void 0 : _a.update(time, _delta);
        (_b = this.cinderFight) === null || _b === void 0 ? void 0 : _b.update(time, _delta);
        if (combat !== this.currentCombat) {
            this.currentCombat = combat;
            this.sfx.setCombat(combat);
        }
    }
    tryEnemySpecial(enemy, time, distance) {
        const type = enemy.getData('type');
        const last = Number(enemy.getData('lastSpecial'));
        const boss = type === 'nameless' || type === 'cinderlord';
        const cooldown = boss ? 3600 : type === 'ashborn' ? 3000 : 2600;
        if (time < last + cooldown)
            return;
        const damage = Number(enemy.getData('damage'));
        if ((type === 'direwolf' || type === 'cavecrawler') && distance > 80 && distance < 280) {
            enemy.setData('lastSpecial', time);
            const line = this.add.line(0, 0, enemy.x, enemy.y, this.player.x, this.player.y, 0xe39a66, .75).setOrigin(0).setLineWidth(5).setDepth(890);
            this.tweens.add({ targets: line, alpha: 0, duration: 380, onComplete: () => line.destroy() });
            this.time.delayedCall(260, () => {
                if (!enemy.active)
                    return;
                this.physics.moveToObject(enemy, this.player, 430);
                if (phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 85)
                    this.hurtPlayer(Math.round(damage * 1.35));
            });
            return;
        }
        if ((type === 'bogling' || type === 'wraith') && distance < 340) {
            enemy.setData('lastSpecial', time);
            const target = { x: this.player.x, y: this.player.y };
            const warning = this.add.circle(target.x, target.y, 48, 0x6ec7a4, .12).setStrokeStyle(4, type === 'wraith' ? 0xb88cf0 : 0x83d6ad, .9).setDepth(880);
            this.tweens.add({ targets: warning, radius: 66, alpha: .35, duration: 480, onComplete: () => {
                    warning.destroy();
                    const burst = this.add.circle(target.x, target.y, 28, type === 'wraith' ? 0x8d63c4 : 0x4fa985, .7).setDepth(885);
                    this.tweens.add({ targets: burst, radius: 82, alpha: 0, duration: 350, onComplete: () => burst.destroy() });
                    if (phaser_1.default.Math.Distance.Between(target.x, target.y, this.player.x, this.player.y) < 70)
                        this.hurtPlayer(Math.round(damage * 1.25));
                } });
            return;
        }
        if (type === 'ashborn' && distance < 230) {
            enemy.setData('lastSpecial', time);
            const warning = this.add.circle(enemy.x, enemy.y, 45, 0xd95336, .14).setStrokeStyle(5, 0xff9d68, .9).setDepth(880);
            this.tweens.add({ targets: warning, radius: 112, alpha: .38, duration: 560, onComplete: () => {
                    warning.destroy();
                    if (enemy.active && phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 120)
                        this.hurtPlayer(Math.round(damage * 1.45));
                } });
            return;
        }
        if (boss && distance < 520) {
            enemy.setData('lastSpecial', time);
            const target = { x: this.player.x, y: this.player.y };
            const warning = this.add.circle(target.x, target.y, 75, 0x8b3d60, .1).setStrokeStyle(7, type === 'cinderlord' ? 0xff7247 : 0xd777bd, .95).setDepth(885);
            this.tweens.add({ targets: warning, scale: 1.25, alpha: .4, duration: 720, onComplete: () => {
                    warning.destroy();
                    const wave = this.add.circle(target.x, target.y, 30, type === 'cinderlord' ? 0xf05b39 : 0xa64d8c, .75).setDepth(890);
                    this.tweens.add({ targets: wave, radius: 135, alpha: 0, duration: 500, onComplete: () => wave.destroy() });
                    if (phaser_1.default.Math.Distance.Between(target.x, target.y, this.player.x, this.player.y) < 105)
                        this.hurtPlayer(Math.round(damage * 1.6));
                } });
        }
    }
    hurtPlayer(amount) {
        if (this.time.now < this.hurtReadyAt || !this.player.active)
            return;
        this.hurtReadyAt = this.time.now + 650;
        const reduced = Math.max(1, amount - this.inventory.armor());
        this.saves.mutate((save) => { save.health = Math.max(0, save.health - reduced); });
        this.lastPlayerHurtAt = this.time.now;
        // Combos break when you get hit — that's the risk that makes them meaningful.
        this.comboHits = 0;
        events_1.GameEvents.emit('combo', { hits: 0, multiplier: 1 });
        this.playHeroPose('hurt', 260);
        this.player.setTintFill(0xe45d78);
        this.time.delayedCall(110, () => this.player.clearTint());
        // Feedback scales with how dangerous the hit was relative to max health.
        const severity = reduced / Math.max(1, this.inventory.maxHealth(this.saves.get()));
        this.cameras.main.shake(130 + severity * 320, .006 + severity * 0.012);
        this.cameras.main.flash(70, 120, 16, 38);
        this.sfx.playerHurt(1 + Math.min(0.6, severity * 3));
        // Screen-edge vignette in the DOM layer, scaled by how bad the hit was.
        events_1.GameEvents.emit('player-hurt', { severity: Math.min(1, severity * 3.2) });
        if (this.saves.get().health <= 0)
            this.die();
        this.emitHud(true);
    }
    die() {
        this.player.setActive(false).setVelocity(0).setTint(0x6e5a67);
        this.physics.world.pause();
        this.sfx.playerDeath();
        this.sfx.setBossFight(false);
        this.bossFightStartedAt = 0;
        events_1.GameEvents.emit('death');
    }
    respawn() {
        this.physics.world.resume();
        this.saves.mutate((save) => {
            save.health = this.inventory.maxHealth(save);
            save.coins = Math.max(0, save.coins - Math.min(35, Math.floor(save.coins * .1)));
        }, true);
        this.player.setPosition(PLAYER_START.x, PLAYER_START.y).setActive(true).setVisible(true).clearTint().setVelocity(0);
        this.uiLocked = false;
        this.cameras.main.fadeIn(350, 30, 8, 16);
        events_1.GameEvents.emit('toast', 'Вы очнулись у дома. Потеряно немного золота.');
        this.emitHud(true);
    }
    usePotion() {
        this.useInventoryItem('blood_vial');
    }
    /** Fires whatever consumable sits in a quick slot, if anything does. */
    useQuickSlot(index) {
        const itemId = this.inventory.quickSlots()[index];
        if (!itemId) {
            this.sfx.ui('error');
            events_1.GameEvents.emit('toast', 'Слот пуст');
            return;
        }
        this.useInventoryItem(itemId);
    }
    useInventoryItem(itemId) {
        if (this.uiLocked && this.player.active && !document.querySelector('#screen-panel[aria-hidden="false"]'))
            return;
        const result = this.inventory.use(itemId);
        events_1.GameEvents.emit('toast', result.message);
        if (!result.used)
            return;
        if (result.effect === 'heal') {
            this.sfx.heal();
            const glow = this.add.circle(this.player.x, this.player.y, 22, 0xc95c78, .5).setDepth(this.player.depth - 1);
            this.tweens.add({ targets: glow, radius: 70, alpha: 0, duration: 620, onComplete: () => glow.destroy() });
        }
        else if (result.effect === 'smoke') {
            // The bomb now blinds as well as pushes: enemies inside the cloud lose
            // aggro and cannot re-acquire the player until it thins, which makes the
            // item a genuine escape tool rather than a small shove.
            const settings = this.saves.get().settings;
            const lowQuality = settings.quality === 'low'
                || (settings.quality === 'auto' && this.scale.width < 700);
            (0, SmokeBomb_1.detonateSmokeBomb)(this, {
                x: this.player.x,
                y: this.player.y,
                enemies: this.enemies.getChildren(),
                reducedMotion: settings.reducedMotion,
                lowQuality,
                depth: this.player.depth + 2,
            });
            this.sfx.special('magic');
            this.lighting.flash(this.player.x, this.player.y, 120, 0x8b8791, 320);
        }
        this.emitHud(true);
    }
    updateProjectiles(delta) {
        const tick = (child) => {
            const projectile = child;
            const ttl = Number(projectile.getData('ttl')) - delta;
            projectile.setData('ttl', ttl);
            if (ttl <= 0)
                projectile.destroy();
            return null;
        };
        this.projectiles.children.each(tick);
        this.enemyProjectiles.children.each(tick);
    }
    updateInteractions() {
        var _a;
        if (this.uiLocked || !this.player.active)
            return;
        this.syncInteractables();
        let nearest;
        let nearestDistance = 82;
        for (const entity of this.interactables) {
            if (!entity.object.active || !entity.object.visible || !this.isInteractiveAvailable(entity))
                continue;
            const distance = phaser_1.default.Math.Distance.Between(this.player.x, this.player.y, entity.object.x, entity.object.y);
            if (distance < nearestDistance) {
                nearest = entity;
                nearestDistance = distance;
            }
        }
        if ((nearest === null || nearest === void 0 ? void 0 : nearest.uniqueId) !== ((_a = this.nearest) === null || _a === void 0 ? void 0 : _a.uniqueId)) {
            this.nearest = nearest;
            events_1.GameEvents.emit('prompt', { text: nearest === null || nearest === void 0 ? void 0 : nearest.label });
        }
    }
    /**
     * Fades a hidden secret or shortcut mouth in once the player wanders within
     * reach of it, marking it discovered so it survives reloads and appears on the
     * map. Fog shrinks the reveal radius, so bad weather genuinely hides things.
     */
    updateSecretVisibility() {
        var _a, _b, _c, _d;
        if (!this.player.active)
            return;
        const reveal = 190 * ((_b = (_a = this.weather) === null || _a === void 0 ? void 0 : _a.profile().visibility) !== null && _b !== void 0 ? _b : 1);
        let discoveredAny = false;
        // The hidden ford has no prop — it's a bare gap in the river — so discovery is
        // a plain proximity check that just flips its map flag.
        if (!this.saves.get().flags['secret-found:reed_ford'] && phaser_1.default.Math.Distance.Between(this.player.x, this.player.y, world_1.HIDDEN_FORD.x, world_1.HIDDEN_FORD.y) < reveal) {
            this.saves.mutate((save) => { save.flags['secret-found:reed_ford'] = true; }, true);
            this.sfx.quest();
            events_1.GameEvents.emit('toast', `Найден ${world_1.HIDDEN_FORD.name}: реку можно перейти вброд`);
            discoveredAny = true;
        }
        for (const entity of this.interactables) {
            if (!entity.secret)
                continue;
            // Secrets and passage mouths are both keyed by their entity id.
            const foundKey = `secret-found:${entity.id}`;
            if (this.saves.get().flags[foundKey]) {
                entity.object.setAlpha(1);
                continue;
            }
            const distance = phaser_1.default.Math.Distance.Between(this.player.x, this.player.y, entity.object.x, entity.object.y);
            if (distance < reveal) {
                this.saves.mutate((save) => { save.flags[foundKey] = true; }, true);
                this.tweens.add({ targets: entity.object, alpha: 1, duration: 520, ease: 'Quad.easeOut' });
                const glow = this.add.circle(entity.object.x, entity.object.y, 24, 0xd7c07a, .4).setDepth(entity.object.depth + 1);
                this.tweens.add({ targets: glow, radius: 120, alpha: 0, duration: 900, onComplete: () => glow.destroy() });
                this.sfx.quest();
                const label = entity.kind === 'passage' ? 'Найден тайный проход' : 'Найдено скрытое место';
                events_1.GameEvents.emit('toast', `${label}: ${entity.kind === 'passage' ? entity.label : (_d = (_c = entity.lore) === null || _c === void 0 ? void 0 : _c.split('.')[0]) !== null && _d !== void 0 ? _d : entity.label}`);
                discoveredAny = true;
            }
        }
        if (discoveredAny)
            this.emitHud(true);
    }
    interact() {
        var _a, _b, _c;
        if (!this.nearest || this.uiLocked)
            return;
        const entity = this.nearest;
        if (entity.kind === 'npc') {
            if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialMoved && this.saves.get().flags.tutorialAttacked && this.saves.get().flags.tutorialDashed && this.saves.get().flags.tutorialSpecial && entity.id === 'mora') {
                this.saves.mutate((save) => { save.tutorialDone = true; }, true);
                this.emitTutorial();
                events_1.GameEvents.emit('toast', 'Обучение завершено • поговорите с Морой о первой клятве');
            }
            this.openNpcDialogue(entity.id);
            return;
        }
        if (entity.kind === 'door' && entity.target) {
            this.sfx.door();
            const building = world_1.BUILDINGS.find((entry) => entry.id === entity.id);
            const door = building ? (0, world_1.getBuildingDoor)(building) : { x: this.player.x, y: this.player.y };
            this.saves.mutate((save) => { save.currentScene = entity.target; save.playerPosition = { x: door.x, y: door.y + 45 }; }, true);
            this.cameras.main.fadeOut(300, 7, 8, 14);
            this.time.delayedCall(310, () => this.scene.start('InteriorScene', { interiorId: entity.target, returnX: door.x, returnY: door.y + 45 }));
            return;
        }
        if (entity.kind === 'chest') {
            if (this.saves.get().flags[entity.uniqueId]) {
                events_1.GameEvents.emit('toast', 'Сундук уже пуст');
                return;
            }
            this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
            entity.object.setTexture('chest-open');
            const rewards = ['bone_shard', 'greater_vial', 'mine_ore', 'smoke_bomb', 'ash_crystal'];
            const itemId = rewards[Number(entity.id) % rewards.length];
            const quantity = itemId === 'bone_shard' || itemId === 'mine_ore' ? 3 : 1;
            this.inventory.add(itemId, quantity, true);
            this.sfx.chest();
            events_1.GameEvents.emit('loot', { itemId, quantity });
            this.emitHud(true);
            return;
        }
        if (entity.kind === 'rift') {
            if (this.saves.get().flags[`rift-complete:${entity.id}`]) {
                events_1.GameEvents.emit('toast', 'Этот разлом уже очищен');
                return;
            }
            if (this.activeRift) {
                events_1.GameEvents.emit('toast', 'Сначала завершите активный разлом');
                return;
            }
            this.startRift(entity.id);
            return;
        }
        if (entity.kind === 'shrine') {
            if (this.saves.get().flags[entity.uniqueId]) {
                events_1.GameEvents.emit('toast', 'Святилище уже отдало силу');
                return;
            }
            this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; save.maxHealth += 10; save.health = this.inventory.maxHealth(save); }, true);
            entity.object.setTint(0x666570);
            this.sfx.quest();
            const ring = this.add.circle(entity.object.x, entity.object.y, 28, 0xb57ad1, .45).setDepth(entity.object.depth + 1);
            this.tweens.add({ targets: ring, radius: 130, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
            events_1.GameEvents.emit('toast', 'Святилище усилило жизненную силу +10');
            this.emitHud(true);
            return;
        }
        if (entity.kind === 'passage') {
            if (!entity.destination)
                return;
            this.sfx.door();
            this.cameras.main.fadeOut(240, 6, 8, 14);
            const target = entity.destination;
            this.time.delayedCall(250, () => {
                this.player.setPosition(target.x, target.y).setVelocity(0);
                this.cameras.main.fadeIn(260, 6, 8, 14);
                this.lighting.flash(target.x, target.y, 150, 0x8b7bc0, 400);
            });
            events_1.GameEvents.emit('toast', `${entity.label}: путь сокращён`);
            this.nearest = undefined;
            events_1.GameEvents.emit('prompt', {});
            return;
        }
        if (entity.kind === 'secret') {
            if (this.saves.get().flags[entity.uniqueId]) {
                events_1.GameEvents.emit('toast', entity.secretKind === 'note' ? 'Здесь больше нечего узнать' : 'Здесь уже пусто');
                return;
            }
            this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
            if (entity.secretKind === 'chest') {
                if (entity.object.texture.key === 'chest-closed')
                    entity.object.setTexture('chest-open');
                // Hidden caches pay better than roadside chests: a rarer item plus coins.
                const pool = ['ash_crystal', 'greater_vial', 'smoke_bomb', 'mine_ore', 'bone_shard'];
                const itemId = pool[Math.abs(this.hashString(entity.id)) % pool.length];
                const quantity = itemId === 'bone_shard' || itemId === 'mine_ore' ? 4 : 2;
                this.inventory.add(itemId, quantity, true);
                this.saves.mutate((save) => { save.coins += 120; }, true);
                this.sfx.chest();
                events_1.GameEvents.emit('loot', { itemId, quantity });
                events_1.GameEvents.emit('toast', `${(_a = entity.lore) !== null && _a !== void 0 ? _a : 'Тайник найден'} • +120 золота`);
            }
            else if (entity.secretKind === 'shrine') {
                // A distinct buff from the roadside shrines: a lasting damage blessing.
                entity.object.setTint(0x666570);
                this.saves.mutate((save) => { save.maxHealth += 15; save.health = this.inventory.maxHealth(save); }, true);
                this.sfx.quest();
                const ring = this.add.circle(entity.object.x, entity.object.y, 30, 0x7fd6c0, .5).setDepth(entity.object.depth + 1);
                this.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 950, onComplete: () => ring.destroy() });
                events_1.GameEvents.emit('toast', `${(_b = entity.lore) !== null && _b !== void 0 ? _b : 'Древнее святилище'} • жизненная сила +15`);
            }
            else {
                // Lore note: a snippet of story plus a small material reward.
                this.inventory.add('ash_crystal', 1, true);
                this.sfx.ui();
                events_1.GameEvents.emit('loot', { itemId: 'ash_crystal', quantity: 1 });
                events_1.GameEvents.emit('toast', (_c = entity.lore) !== null && _c !== void 0 ? _c : 'Найдена старая запись');
            }
            this.nearest = undefined;
            events_1.GameEvents.emit('prompt', {});
            this.emitHud(true);
            return;
        }
        if (!entity.object.visible || this.saves.get().flags[entity.uniqueId])
            return;
        this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
        if (entity.kind === 'lantern') {
            entity.object.setTexture('lantern-on');
            const glow = this.add.circle(entity.object.x, entity.object.y - 12, 38, 0xf2b65d, .22).setDepth(entity.object.depth - 1);
            this.tweens.add({ targets: glow, alpha: .09, scale: 1.15, duration: 1200, yoyo: true, repeat: -1 });
        }
        else if (entity.kind !== 'lift')
            entity.object.setVisible(false);
        const update = this.quests.record(entity.objectiveType, entity.target, 1);
        if (entity.kind === 'collect' && entity.target) {
            const itemMap = { charm: 'widow_charm', moonwort: 'moonwort', shadebloom: 'shadebloom', bog_reed: 'bog_reed', glowcap: 'glowcap', ferryman_cargo: 'ferryman_cargo', miner_tools: 'miner_tools' };
            const itemId = itemMap[entity.target];
            if (itemId) {
                this.inventory.add(itemId, 1, true);
                this.sfx.pickup();
                events_1.GameEvents.emit('loot', { itemId, quantity: 1 });
            }
        }
        else
            this.sfx.ui();
        events_1.GameEvents.emit('toast', entity.kind === 'collect' ? 'Предмет добавлен в инвентарь' : entity.kind === 'lantern' ? 'Фонарь зажжён' : entity.kind === 'lift' ? 'Подъёмник пробудился' : 'Ритуал проведён');
        this.onQuestProgress(update);
        this.nearest = undefined;
        events_1.GameEvents.emit('prompt', {});
        this.emitHud(true);
    }
    isInteractiveAvailable(entity) {
        if (entity.kind === 'npc' || entity.kind === 'door' || entity.kind === 'chest' || entity.kind === 'shrine' || entity.kind === 'rift')
            return true;
        // A passage only becomes usable once discovered; then it always is.
        if (entity.kind === 'passage')
            return Boolean(this.saves.get().flags[`secret-found:${entity.id}`]);
        // A secret is reachable once discovered and until it's been claimed.
        if (entity.kind === 'secret')
            return Boolean(this.saves.get().flags[`secret-found:${entity.id}`]) && !this.saves.get().flags[entity.uniqueId];
        if (entity.kind === 'lift' && this.saves.get().flags[entity.uniqueId])
            return true;
        if (this.saves.get().flags[entity.uniqueId])
            return false;
        return this.isObjectiveActive(entity.objectiveType, entity.target);
    }
    isObjectiveActive(type, target) {
        return this.quests.getActive().some(({ quest, progress }) => {
            if (progress.status !== 'active')
                return false;
            const objective = quest.objectives[progress.objectiveIndex];
            return objective.type === type && objective.target === target;
        });
    }
    syncInteractables() {
        this.interactables.forEach((entity) => {
            if (entity.kind === 'npc' || entity.kind === 'door')
                return;
            // Secrets and passages own their own reveal/alpha via updateSecretVisibility;
            // only refresh their claimed-state label here.
            if (entity.kind === 'passage')
                return;
            if (entity.kind === 'secret') {
                const claimed = Boolean(this.saves.get().flags[entity.uniqueId]);
                if (entity.secretKind === 'chest')
                    entity.label = claimed ? 'Тайник пуст' : 'Открыть тайник';
                else if (entity.secretKind === 'shrine') {
                    if (claimed)
                        entity.object.setTint(0x666570);
                    entity.label = claimed ? 'Святилище молчит' : 'Коснуться святилища';
                }
                else
                    entity.label = claimed ? 'Осмотрено' : 'Осмотреть';
                return;
            }
            const used = Boolean(this.saves.get().flags[entity.uniqueId]);
            if (entity.kind === 'lantern') {
                entity.object.setTexture(used ? 'lantern-on' : 'lantern-off').setAlpha(used ? .95 : this.isObjectiveActive('interact', 'lantern') ? 1 : .55);
            }
            else if (entity.kind === 'chest') {
                entity.object.setTexture(used ? 'chest-open' : 'chest-closed').setVisible(true).setAlpha(used ? .7 : 1);
                entity.label = used ? 'Сундук пуст' : 'Открыть сундук';
            }
            else if (entity.kind === 'shrine') {
                entity.object.setVisible(true).setTint(used ? 0x666570 : 0x9e76c2).setAlpha(used ? .65 : 1);
                entity.label = used ? 'Святилище молчит' : 'Коснуться святилища';
            }
            else if (entity.kind === 'rift') {
                const complete = Boolean(this.saves.get().flags[`rift-complete:${entity.id}`]);
                entity.object.setVisible(true).setTint(complete ? 0x555866 : 0xbd6ed8).setAlpha(complete ? .55 : 1);
                entity.label = complete ? 'Разлом очищен' : `Активировать разлом`;
            }
            else if (entity.kind === 'lift') {
                entity.object.setVisible(true).setAlpha(used ? 1 : this.isObjectiveActive('interact', 'mine_lift') ? 1 : .45);
            }
            else {
                entity.object.setVisible(!used).setAlpha(this.isObjectiveActive(entity.objectiveType, entity.target) ? 1 : .38);
            }
        });
    }
    openNpcDialogue(npcId) {
        const npc = content_1.NPCS.find((item) => item.id === npcId);
        if (!npc)
            return;
        const related = content_1.QUESTS.filter((quest) => quest.giver === npcId && !this.quests.isLocked(quest));
        const ready = related.find((quest) => { var _a; return ((_a = this.saves.get().questProgress[quest.id]) === null || _a === void 0 ? void 0 : _a.status) === 'ready'; });
        const offer = related.find((quest) => this.quests.status(quest) === 'available' && !this.saves.get().questProgress[quest.id]);
        const active = related.find((quest) => { var _a; return ((_a = this.saves.get().questProgress[quest.id]) === null || _a === void 0 ? void 0 : _a.status) === 'active'; });
        let text = this.generalNpcText(npcId);
        const actions = [];
        if (ready) {
            text = `Вы справились с заданием «${ready.title}». Долина помнит такие поступки. Заберите заслуженную награду.`;
            actions.push({ label: `Сдать • ◆ ${ready.reward.coins} • ✦ ${ready.reward.reputation}`, event: 'quest-turnin', payload: ready.id, primary: true });
        }
        else if (offer) {
            text = `${offer.description} Награда: ${offer.reward.coins} золота, ${offer.reward.xp} опыта и ${offer.reward.reputation} репутации.`;
            actions.push({ label: offer.category === 'main' ? 'Принять клятву' : 'Взять контракт', event: 'quest-accept', payload: offer.id, primary: true });
        }
        else if (active) {
            const progress = this.saves.get().questProgress[active.id];
            const objective = active.objectives[progress.objectiveIndex];
            text = `Задание «${active.title}» ещё не завершено. ${objective.label}: ${progress.amount}/${objective.amount}.`;
        }
        if (npcId === 'runa')
            actions.push({ label: 'Открыть магазин', event: 'open-shop', primary: !actions.length });
        actions.push({ label: 'Уйти', event: 'close' });
        const color = `#${npc.accent.toString(16).padStart(6, '0')}`;
        const payload = { speaker: npc.name, subtitle: npc.role.toUpperCase(), text, accent: color, actions };
        events_1.GameEvents.emit('dialogue', payload);
    }
    generalNpcText(npcId) {
        var _a;
        const lines = {
            mora: 'Ты вернулся. Пепел на сапогах говорит, что Долина ещё не забрала тебя. Значит, клятва продолжается.',
            runa: 'Хорошее оружие не делает героя. Но плохое оружие быстро делает покойника. Выбирай с умом.',
            gran: 'Могилы молчат только днём. Ночью они пересчитывают живых.',
            vesna: 'Каждое растение здесь либо лечит, либо запоминает твой последний вдох. Иногда — и то и другое.',
            elira: 'В Сером Холме все чего-то ждут. Рассвета, смерти или возвращения тех, кто уже не вернётся.',
            orrin: 'Следы в лесу идут в обе стороны. Звери научились охотиться на тех, кто охотится на них.',
            ferryman: 'Чёрная вода открыла путь на восток. Я перевезу любого, но обратно возвращаются не все.',
            iva: 'Топь не злая. Она просто хранит всё, что люди пытались забыть.',
            bram: 'Шахта стучит изнутри, будто под камнем бьётся огромное сердце.',
            serah: 'Я служила цитадели, пока не поняла: её огонь питается людьми, а не углём.',
        };
        return (_a = lines[npcId]) !== null && _a !== void 0 ? _a : 'Долина наблюдает.';
    }
    acceptQuest(questId) {
        if (!this.quests.accept(questId))
            return;
        const quest = this.quests.getDefinition(questId);
        events_1.GameEvents.emit('dialogue-close');
        events_1.GameEvents.emit('toast', `${quest.category === 'main' ? 'Новая клятва' : 'Новый контракт'}: ${quest.title}`);
        this.sfx.quest();
        const first = quest.objectives[0];
        if (first.type === 'purchase' && this.saves.get().ownedWeapons.includes(first.target))
            this.onQuestProgress(this.quests.record('purchase', first.target));
        this.syncInteractables();
        this.emitHud(true);
    }
    turnInQuest(questId) {
        var _a;
        const previousLevel = this.saves.get().level;
        const quest = this.quests.turnIn(questId);
        if (!quest)
            return;
        events_1.GameEvents.emit('dialogue-close');
        events_1.GameEvents.emit('toast', `Задание завершено: ${quest.title} • +${quest.reward.coins} золота`);
        this.sfx.quest();
        if (this.saves.get().level > previousLevel)
            events_1.GameEvents.emit('toast', `Новый уровень: ${this.saves.get().level}`);
        for (const reward of (_a = quest.reward.items) !== null && _a !== void 0 ? _a : []) {
            this.sfx.pickup();
            events_1.GameEvents.emit('loot', { itemId: reward.itemId, quantity: reward.quantity });
        }
        if (quest.id === 'ash_crown') {
            this.time.delayedCall(450, () => events_1.GameEvents.emit('ending', { playtime: this.saves.get().playtime, level: this.saves.get().level, reputation: this.saves.get().reputation }));
        }
        this.emitHud(true);
    }
    onQuestProgress(update) {
        if (!update.changed)
            return;
        if (update.readyQuest) {
            events_1.GameEvents.emit('toast', `Цель выполнена • вернитесь к заказчику «${update.readyQuest.title}»`);
            this.sfx.quest();
        }
        else if (update.completedObjective) {
            events_1.GameEvents.emit('toast', `Цель выполнена: ${update.completedObjective}`);
        }
        this.syncInteractables();
    }
    cycleWeapon(direction) {
        const owned = content_1.WEAPONS.filter((weapon) => this.saves.get().ownedWeapons.includes(weapon.id));
        if (owned.length < 2)
            return;
        const current = owned.findIndex((weapon) => weapon.id === this.saves.get().equippedWeapon);
        const next = owned[(current + direction + owned.length) % owned.length];
        this.equipWeapon(next.id);
    }
    equipWeapon(weaponId) {
        var _a;
        const weapon = content_1.WEAPONS.find((item) => item.id === weaponId);
        const previous = this.saves.get().equippedWeapon;
        if (!weapon || !this.inventory.equip(weaponId))
            return;
        if (previous !== weaponId) {
            this.lastWeaponId = previous;
            this.tacticalBonusUntil = this.time.now + 1800;
            (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setTexture(`held-${weaponId}`).setScale(1.9).setTint(phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color);
            this.time.delayedCall(180, () => { var _a; return (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setScale(1.45).clearTint(); });
        }
        this.sfx.ui();
        const visual = (0, weaponVisuals_1.getWeaponVisual)(weaponId);
        events_1.GameEvents.emit('toast', `Экипировано: ${weapon.name}${previous !== weaponId ? ` • тактическая смена +15%` : ''} • ${visual.bonusLabel}`);
        this.emitHud(true);
    }
    buyWeapon(weaponId) {
        var _a;
        const result = this.shop.purchase(weaponId);
        events_1.GameEvents.emit('toast', result.message);
        if (!result.ok || !result.weapon)
            return;
        this.onQuestProgress(this.quests.record('purchase', weaponId));
        (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setTexture(`held-${weaponId}`).setScale(1.95).setTint(phaser_1.default.Display.Color.HexStringToColor(result.weapon.accent).color);
        this.time.delayedCall(220, () => { var _a; return (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setScale(1.45).clearTint(); });
        this.sfx.coin();
        this.emitHud(true);
    }
    claimTier(tierNumber) {
        const tier = content_1.BATTLE_PASS.find((item) => item.tier === tierNumber);
        const save = this.saves.get();
        if (!tier || save.reputation < tier.reputation || save.claimedTiers.includes(tierNumber))
            return;
        this.saves.mutate((state) => {
            var _a;
            state.claimedTiers.push(tierNumber);
            state.coins += (_a = tier.coins) !== null && _a !== void 0 ? _a : 0;
            if (tier.weapon && !state.ownedWeapons.includes(tier.weapon))
                state.ownedWeapons.push(tier.weapon);
        }, true);
        if (tier.potions)
            this.inventory.add('blood_vial', tier.potions, true);
        this.sfx.quest();
        events_1.GameEvents.emit('toast', `Награда пропуска: ${tier.rewardLabel}`);
        this.emitHud(true);
    }
    updateLocation() {
        var _a, _b;
        const location = world_1.LOCATIONS.find((item) => {
            const shape = world_1.MAP_SHAPES.find((entry) => entry.id === item.id);
            if (!shape)
                return phaser_1.default.Geom.Rectangle.Contains(new phaser_1.default.Geom.Rectangle(item.x, item.y, item.w, item.h), this.player.x, this.player.y);
            const polygon = new phaser_1.default.Geom.Polygon(shape.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y }; }));
            return phaser_1.default.Geom.Polygon.Contains(polygon, this.player.x, this.player.y);
        });
        const name = (_a = location === null || location === void 0 ? void 0 : location.name) !== null && _a !== void 0 ? _a : 'Дороги Долины';
        if (name === this.lastLocation)
            return;
        this.lastLocation = name;
        events_1.GameEvents.emit('location', name);
        if (location) {
            this.sfx.setRegion(location.ambience, this.currentCombat);
            const tintByRegion = { home: 0x4b304f, village: 0x52472f, cemetery: 0x39475a, forest: 0x244f3f, ruins: 0x59345e, marsh: 0x285f58, mines: 0x59402b, docks: 0x2b5265, citadel: 0x762f2a };
            if (this.regionTint) {
                this.regionTint.setFillStyle((_b = tintByRegion[location.id]) !== null && _b !== void 0 ? _b : 0x332342, .04).setAlpha(.03);
                this.tweens.add({ targets: this.regionTint, alpha: location.danger >= 2 ? .11 : .065, duration: 900 });
            }
            const newlyDiscovered = !this.saves.get().discoveredLocations.includes(location.id);
            if (newlyDiscovered) {
                this.saves.mutate((save) => { save.discoveredLocations.push(location.id); }, true);
                events_1.GameEvents.emit('toast', `Открыт новый район: ${location.name}`);
                this.sfx.quest();
            }
            this.onQuestProgress(this.quests.record('visit', location.id));
        }
        else
            this.sfx.setRegion('forest', this.currentCombat);
        this.emitHud(true);
    }
    updateObjectiveMarker() {
        if (!this.objectiveMarker)
            return;
        const active = this.quests.activeObjective();
        if (!active)
            return void this.objectiveMarker.setVisible(false);
        if (active.progress.status === 'ready') {
            const npc = content_1.NPCS.find((item) => item.id === active.quest.giver);
            if (npc)
                this.objectiveMarker.setPosition(npc.x, npc.y + 6).setVisible(true);
            return;
        }
        const objective = active.quest.objectives[active.progress.objectiveIndex];
        const position = WorldScene.OBJECTIVE_POINTS[objective.target];
        if (position)
            this.objectiveMarker.setPosition(position.x, position.y).setVisible(true);
        else
            this.objectiveMarker.setVisible(false);
    }
    /** World anchor for the current quest objective, shared by the marker + map. */
    objectivePoint() {
        const active = this.quests.activeObjective();
        if (!active)
            return undefined;
        if (active.progress.status === 'ready') {
            const npc = content_1.NPCS.find((item) => item.id === active.quest.giver);
            return npc ? { x: npc.x, y: npc.y } : undefined;
        }
        const objective = active.quest.objectives[active.progress.objectiveIndex];
        return WorldScene.OBJECTIVE_POINTS[objective.target];
    }
    updateEnemyBars() {
        this.enemies.children.each((child) => {
            const enemy = child;
            if (!enemy.active)
                return null;
            const bar = enemy.getData('healthBar');
            if (!bar)
                return null;
            const health = Number(enemy.getData('health'));
            const max = Number(enemy.getData('maxHealth'));
            const close = phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 320;
            bar.setVisible(close && health < max);
            if (bar.visible) {
                const boss = enemy.getData('type') === 'nameless' || enemy.getData('type') === 'cinderlord';
                const width = boss ? 92 : 46;
                bar.clear().fillStyle(0x0b0c12, .9).fillRect(enemy.x - width / 2, enemy.y - enemy.displayHeight * .55, width, 7)
                    .fillStyle(enemy.getData('type') === 'cinderlord' ? 0xe46643 : enemy.getData('type') === 'nameless' ? 0xc85182 : 0xb64d5e, 1).fillRect(enemy.x - width / 2 + 1, enemy.y - enemy.displayHeight * .55 + 1, (width - 2) * health / max, 5);
                bar.setDepth(enemy.depth + 2);
            }
            return null;
        });
    }
    syncBoss() {
        const activate = (type, current, x, y, message, color) => {
            const objective = this.isObjectiveActive('kill', type);
            let enemy = current;
            if (objective && (!enemy || !enemy.scene))
                enemy = this.spawnEnemy({ type, x, y });
            if ((enemy === null || enemy === void 0 ? void 0 : enemy.scene) && objective && !enemy.active) {
                enemy.setActive(true).setVisible(true);
                enemy.body.enable = true;
                const flash = this.add.circle(enemy.x, enemy.y, 110, color, .4).setDepth(enemy.depth - 1);
                this.tweens.add({ targets: flash, scale: 2.1, alpha: 0, duration: 1050, onComplete: () => flash.destroy() });
                this.cameras.main.shake(500, .009);
                this.lighting.flash(enemy.x, enemy.y, 380, color, 900);
                events_1.GameEvents.emit('toast', message);
                this.sfx.setCombat(true);
                // Escalate the score to the boss theme and start the flawless-kill timer.
                this.sfx.setBossFight(true);
                this.bossFightStartedAt = this.time.now;
                const settings = this.saves.get().settings;
                const bossContext = {
                    hurtPlayer: (amount) => this.hurtPlayer(amount),
                    spawnAdd: (addType, x, y) => {
                        this.spawnEnemy({ type: addType, x, y, temporary: true });
                    },
                    spawnProjectile: (request) => this.spawnEnemyProjectile(request),
                    playerX: () => this.player.x,
                    playerY: () => this.player.y,
                    playerAlive: () => this.player.active,
                    reducedMotion: settings.reducedMotion,
                    lowQuality: settings.quality === 'low' || (settings.quality === 'auto' && this.scale.width < 700),
                    onPhase: (phase, total) => {
                        events_1.GameEvents.emit('boss-health', { health: Number(enemy === null || enemy === void 0 ? void 0 : enemy.getData('health')) || 0, phase });
                        events_1.GameEvents.emit('toast', `${content_1.ENEMIES[type].name} — фаза ${phase}/${total}`);
                    },
                    setInvulnerable: (value) => enemy === null || enemy === void 0 ? void 0 : enemy.setData('bossInvulnerable', value),
                };
                const fight = new BossFight_1.BossFight(this, enemy, type, bossContext);
                if (type === 'nameless')
                    this.namelessFight = fight;
                else
                    this.cinderFight = fight;
                // Tell the HUD to raise the boss bar.
                events_1.GameEvents.emit('boss-engage', {
                    name: content_1.ENEMIES[type].name,
                    maxHealth: Number(enemy.getData('maxHealth')) || content_1.ENEMIES[type].health,
                    phases: 3,
                });
            }
            return enemy;
        };
        this.boss = activate('nameless', this.boss, 2280, 1330, 'Безымянная пробудилась в сердце руин', 0xa65489);
        this.cinderBoss = activate('cinderlord', this.cinderBoss, 4200, 2420, 'Владыка углей выходит из Пепельного трона', 0xe25d3d);
    }
    emitTutorial() {
        const save = this.saves.get();
        if (save.tutorialDone) {
            events_1.GameEvents.emit('tutorial', null);
            return;
        }
        if (!save.flags.tutorialMoved) {
            events_1.GameEvents.emit('tutorial', { step: 1, title: 'Начните путь', text: 'Используйте WASD, стрелки или левый стик, чтобы двигаться.' });
            return;
        }
        if (!save.flags.tutorialAttacked) {
            events_1.GameEvents.emit('tutorial', { step: 2, title: 'Обнажите клинок', text: 'Нажмите пробел, левую кнопку мыши или кнопку атаки.' });
            return;
        }
        if (!save.flags.tutorialDashed) {
            events_1.GameEvents.emit('tutorial', { step: 3, title: 'Ускользните от удара', text: 'Нажмите Shift или голубую кнопку рывка. Во время рывка вы неуязвимы.' });
            return;
        }
        if (!save.flags.tutorialSpecial) {
            events_1.GameEvents.emit('tutorial', { step: 4, title: 'Высвободите силу оружия', text: 'Нажмите R или фиолетовую кнопку. Способность зависит от класса оружия.' });
            return;
        }
        events_1.GameEvents.emit('tutorial', { step: 5, title: 'Найдите клятву', text: 'Подойдите к Сестре Море и нажмите E или кнопку действия.' });
    }
    emitHud(force = false) {
        const save = this.saves.get();
        const active = this.quests.activeObjective();
        const objective = active ? active.quest.objectives[active.progress.objectiveIndex] : undefined;
        const snapshot = {
            health: save.health,
            maxHealth: this.inventory.maxHealth(),
            level: save.level,
            xp: save.xp,
            xpNext: (0, content_1.XP_FOR_LEVEL)(save.level),
            coins: save.coins,
            reputation: save.reputation,
            potions: this.inventory.quantity('blood_vial'),
            equippedWeapon: save.equippedWeapon,
            ownedWeapons: [...save.ownedWeapons],
            inventory: save.inventory.map((stack) => ({ ...stack })),
            chest: save.chest.map((stack) => ({ ...stack })),
            equipment: structuredClone(save.equipment),
            discoveredLocations: [...save.discoveredLocations],
            discoveredSecrets: this.discoveredSecretIds(),
            objectivePoint: this.objectivePoint(),
            currentScene: 'world',
            settings: { ...save.settings },
            activeQuest: active && objective ? {
                title: active.quest.title,
                objective: objective.label,
                amount: active.progress.amount,
                required: objective.amount,
                ready: active.progress.status === 'ready',
            } : undefined,
            quests: this.quests.snapshotQuests(),
            claimedTiers: [...save.claimedTiers],
            tutorialDone: save.tutorialDone,
        };
        const signature = JSON.stringify(snapshot);
        if (!force && signature === this.lastHudSignature)
            return;
        this.lastHudSignature = signature;
        events_1.GameEvents.emit('hud', { snapshot, save: structuredClone(save) });
        this.updateNpcMarkers();
    }
    updateNpcMarkers() {
        content_1.NPCS.forEach((npc) => {
            const marker = this.npcMarkers.get(npc.id);
            if (!marker)
                return;
            const quests = content_1.QUESTS.filter((quest) => quest.giver === npc.id && !this.quests.isLocked(quest));
            const ready = quests.some((quest) => { var _a; return ((_a = this.saves.get().questProgress[quest.id]) === null || _a === void 0 ? void 0 : _a.status) === 'ready'; });
            const available = quests.some((quest) => !this.saves.get().questProgress[quest.id] && this.quests.status(quest) === 'available');
            marker.setText(ready ? '?' : available ? '!' : '').setColor(ready ? '#e9c56e' : '#d98ca6');
        });
    }
    audioMix(save) {
        return { enabled: save.settings.sound, master: save.settings.masterVolume, music: save.settings.musicVolume, sfx: save.settings.sfxVolume, ambience: save.settings.ambienceVolume };
    }
    cleanup() {
        var _a, _b, _c, _d, _e, _f, _g;
        this.sfx.setCombat(false);
        this.sfx.setBossFight(false);
        // Stop the rain bed so it doesn't keep playing into the next scene.
        this.sfx.setRain(0);
        this.eventDisposers.forEach((dispose) => dispose());
        this.eventDisposers = [];
        // Both systems register scale-resize listeners, so they must be torn down
        // explicitly or they leak across scene restarts.
        (_a = this.lighting) === null || _a === void 0 ? void 0 : _a.destroy();
        (_b = this.weather) === null || _b === void 0 ? void 0 : _b.destroy();
        (_c = this.namelessFight) === null || _c === void 0 ? void 0 : _c.destroy();
        (_d = this.cinderFight) === null || _d === void 0 ? void 0 : _d.destroy();
        this.namelessFight = undefined;
        this.cinderFight = undefined;
        (_e = this.ui) === null || _e === void 0 ? void 0 : _e.destroy();
        // Persist the time of day so re-entering the world doesn't reset the cycle.
        (_f = this.saves) === null || _f === void 0 ? void 0 : _f.mutate((save) => { var _a, _b; save.dayProgress = (_b = (_a = this.lighting) === null || _a === void 0 ? void 0 : _a.getDayProgress()) !== null && _b !== void 0 ? _b : save.dayProgress; });
        (_g = this.saves) === null || _g === void 0 ? void 0 : _g.flush();
    }
}
exports.WorldScene = WorldScene;
/** World anchors for each quest-objective target (marker + map objective pin). */
Object.defineProperty(WorldScene, "OBJECTIVE_POINTS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        moonwort: { x: 690, y: 740 }, husk: { x: 1820, y: 590 }, witchbow: { x: 1155, y: 610 }, boneguard: { x: 2240, y: 1120 },
        shadebloom: { x: 1370, y: 1320 }, forest_altar: { x: 1660, y: 1580 }, ruins: { x: 2120, y: 1130 }, nameless: { x: 2280, y: 1330 },
        charm: { x: 2030, y: 520 }, direwolf: { x: 1390, y: 1370 }, lantern: { x: 1590, y: 820 },
        bog_reed: { x: 3250, y: 620 }, bogling: { x: 3280, y: 600 }, ferryman_cargo: { x: 3260, y: 2480 }, glowcap: { x: 3280, y: 700 },
        mines: { x: 3500, y: 1420 }, cavecrawler: { x: 3570, y: 1500 }, miner_tools: { x: 3810, y: 1640 }, mine_lift: { x: 3595, y: 1450 },
        citadel: { x: 4050, y: 1700 }, cinderlord: { x: 4200, y: 2420 },
    }
});

});
__define("src/data/content.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XP_FOR_LEVEL = exports.LOCATIONS = exports.NPCS = exports.ENEMIES = exports.BATTLE_PASS = exports.QUESTS = exports.WEAPONS = void 0;
exports.WEAPONS = [
    {
        id: 'rustblade',
        name: 'Ржавый клинок',
        description: 'Старый меч из дома героя. Надёжнее, чем выглядит.',
        kind: 'melee',
        price: 0,
        damage: 24,
        cooldown: 390,
        range: 54,
        requiredRep: 0,
        icon: '⚔',
        accent: '#a9b1bb',
    },
    {
        id: 'graveaxe',
        name: 'Могильный топор',
        description: 'Тяжёлый удар сбивает плоть и доспехи.',
        kind: 'melee',
        price: 90,
        damage: 38,
        cooldown: 650,
        range: 62,
        requiredRep: 1,
        icon: '◆',
        accent: '#d6a86c',
    },
    {
        id: 'witchbow',
        name: 'Ведьмин арбалет',
        description: 'Нужен, чтобы снимать костяные печати на расстоянии.',
        kind: 'ranged',
        price: 130,
        damage: 27,
        cooldown: 560,
        range: 360,
        projectileSpeed: 430,
        requiredRep: 2,
        icon: '➶',
        accent: '#8fd3b5',
    },
    {
        id: 'ashstaff',
        name: 'Посох пепла',
        description: 'Медленный сгусток огня наносит высокий урон.',
        kind: 'magic',
        price: 240,
        damage: 46,
        cooldown: 760,
        range: 420,
        projectileSpeed: 300,
        requiredRep: 4,
        icon: '✦',
        accent: '#ef7f58',
    },
    {
        id: 'moonblade',
        name: 'Лунный тесак',
        description: 'Быстрый клинок охотников из Серой Стражи.',
        kind: 'melee',
        price: 360,
        damage: 54,
        cooldown: 360,
        range: 68,
        requiredRep: 6,
        icon: '☾',
        accent: '#aebcff',
    },
    {
        id: 'reliquary',
        name: 'Реликварий Бездны',
        description: 'Запретное оружие, открываемое в боевом пропуске.',
        kind: 'magic',
        price: 0,
        damage: 72,
        cooldown: 640,
        range: 480,
        projectileSpeed: 360,
        requiredRep: 9,
        icon: '✺',
        accent: '#c982ff',
    },
    {
        id: 'bogreaper',
        name: 'Серп Чёрной топи',
        description: 'Изогнутое оружие болотных охотников быстро добивает раненых.',
        kind: 'melee',
        price: 520,
        damage: 68,
        cooldown: 330,
        range: 76,
        requiredRep: 11,
        icon: '◜',
        accent: '#72c7a0',
    },
    {
        id: 'cinderbrand',
        name: 'Пепельное клеймо',
        description: 'Клинок цитадели оставляет за ударом горящий след.',
        kind: 'magic',
        price: 720,
        damage: 86,
        cooldown: 560,
        range: 500,
        projectileSpeed: 420,
        requiredRep: 16,
        icon: '✹',
        accent: '#ff8a5c',
    },
];
exports.QUESTS = [
    {
        id: 'first_oath',
        title: 'Первая клятва',
        description: 'Сестра Мора просит вернуть три пучка лунной полыни с окраины деревни.',
        giver: 'mora',
        category: 'main',
        objectives: [
            { type: 'collect', target: 'moonwort', label: 'Соберите лунную полынь', amount: 3 },
        ],
        reward: { coins: 75, xp: 70, reputation: 1, potions: 1 },
    },
    {
        id: 'grave_silence',
        title: 'Тишина на кладбище',
        description: 'Мёртвые поднялись у старых ворот. Смотритель Гран не может покинуть пост.',
        giver: 'gran',
        category: 'main',
        prerequisite: 'first_oath',
        objectives: [
            { type: 'kill', target: 'husk', label: 'Уничтожьте одичалых мертвецов', amount: 4 },
        ],
        reward: { coins: 95, xp: 110, reputation: 1, potions: 1 },
    },
    {
        id: 'iron_answer',
        title: 'Железный ответ',
        description: 'Костяные печати нельзя разбить мечом. Руна продаст подходящий арбалет.',
        giver: 'runa',
        category: 'main',
        prerequisite: 'grave_silence',
        objectives: [
            { type: 'purchase', target: 'witchbow', label: 'Купите Ведьмин арбалет у Руны', amount: 1 },
            { type: 'kill', target: 'boneguard', label: 'Сразите костяных стражей', amount: 3 },
        ],
        reward: { coins: 140, xp: 150, reputation: 2 },
    },
    {
        id: 'witch_trail',
        title: 'След ведьмы',
        description: 'В лесу растут цветы тени. Их сок проявит след хозяйки руин.',
        giver: 'vesna',
        category: 'main',
        prerequisite: 'iron_answer',
        objectives: [
            { type: 'collect', target: 'shadebloom', label: 'Соберите цветы тени в лесу', amount: 4 },
            { type: 'interact', target: 'forest_altar', label: 'Проведите ритуал у лесного алтаря', amount: 1 },
        ],
        reward: { coins: 160, xp: 180, reputation: 2, potions: 1 },
    },
    {
        id: 'heart_of_ruin',
        title: 'Сердце руин',
        description: 'След ведёт к Безымянной, удерживающей проклятие над долиной.',
        giver: 'mora',
        category: 'main',
        prerequisite: 'witch_trail',
        objectives: [
            { type: 'visit', target: 'ruins', label: 'Доберитесь до проклятых руин', amount: 1 },
            { type: 'kill', target: 'nameless', label: 'Победите Безымянную', amount: 1 },
        ],
        reward: { coins: 320, xp: 350, reputation: 3, potions: 2 },
    },
    {
        id: 'lost_charm',
        title: 'Медальон вдовы',
        description: 'Элира потеряла медальон у северных могил.',
        giver: 'elira',
        category: 'side',
        objectives: [
            { type: 'collect', target: 'charm', label: 'Найдите медальон на кладбище', amount: 1 },
        ],
        reward: { coins: 70, xp: 55, reputation: 1 },
    },
    {
        id: 'wolf_debt',
        title: 'Волчий долг',
        description: 'Стая искажённых волков перекрыла дорогу травнице.',
        giver: 'vesna',
        category: 'side',
        prerequisite: 'first_oath',
        objectives: [
            { type: 'kill', target: 'direwolf', label: 'Убейте искажённых волков', amount: 3 },
        ],
        reward: { coins: 105, xp: 90, reputation: 1, potions: 1 },
    },
    {
        id: 'last_lights',
        title: 'Последние огни',
        description: 'Зажгите дорожные фонари, чтобы тьма не дошла до деревни.',
        giver: 'gran',
        category: 'side',
        prerequisite: 'grave_silence',
        objectives: [
            { type: 'interact', target: 'lantern', label: 'Зажгите погасшие фонари', amount: 3 },
        ],
        reward: { coins: 115, xp: 100, reputation: 1 },
    },
    {
        id: 'blackwater_call',
        title: 'Зов Чёрной воды',
        description: 'Перевозчик видел в топи огни, которых не должно быть. Соберите тростник и очистите путь.',
        giver: 'ferryman',
        category: 'main',
        prerequisite: 'heart_of_ruin',
        objectives: [
            { type: 'collect', target: 'bog_reed', label: 'Соберите болотный тростник', amount: 4 },
            { type: 'kill', target: 'bogling', label: 'Уничтожьте утопленников', amount: 4 },
        ],
        reward: { coins: 260, xp: 280, reputation: 2, items: [{ itemId: 'greater_vial', quantity: 1 }] },
    },
    {
        id: 'mine_echo',
        title: 'Эхо под камнем',
        description: 'Шахтёр Брам просит спуститься к старому подъёмнику и остановить то, что стучит из глубины.',
        giver: 'bram',
        category: 'main',
        prerequisite: 'blackwater_call',
        objectives: [
            { type: 'visit', target: 'mines', label: 'Доберитесь до Старых шахт', amount: 1 },
            { type: 'kill', target: 'cavecrawler', label: 'Уничтожьте пещерных тварей', amount: 4 },
            { type: 'interact', target: 'mine_lift', label: 'Запустите древний подъёмник', amount: 1 },
        ],
        reward: { coins: 310, xp: 340, reputation: 2, items: [{ itemId: 'grave_warden_mail', quantity: 1 }] },
    },
    {
        id: 'ash_crown',
        title: 'Корона из пепла',
        description: 'Открытые шахты ведут к Пепельной цитадели. Остановите Владыку углей до нового выброса.',
        giver: 'mora',
        category: 'main',
        prerequisite: 'mine_echo',
        objectives: [
            { type: 'visit', target: 'citadel', label: 'Войдите в Пепельную цитадель', amount: 1 },
            { type: 'kill', target: 'cinderlord', label: 'Победите Владыку углей', amount: 1 },
        ],
        reward: { coins: 520, xp: 520, reputation: 3, items: [{ itemId: 'ember_eye', quantity: 1 }] },
    },
    {
        id: 'ferryman_cargo',
        title: 'Груз без имени',
        description: 'Три запечатанных ящика унесло вдоль берега. Перевозчик не объясняет, что внутри.',
        giver: 'ferryman',
        category: 'side',
        prerequisite: 'heart_of_ruin',
        objectives: [
            { type: 'collect', target: 'ferryman_cargo', label: 'Верните запечатанные ящики', amount: 3 },
        ],
        reward: { coins: 180, xp: 160, reputation: 1, items: [{ itemId: 'smoke_bomb', quantity: 2 }] },
    },
    {
        id: 'lost_tools',
        title: 'Последняя смена',
        description: 'Брам оставил инструменты у обвалившегося штрека.',
        giver: 'bram',
        category: 'side',
        prerequisite: 'blackwater_call',
        objectives: [
            { type: 'collect', target: 'miner_tools', label: 'Найдите инструменты Брама', amount: 1 },
        ],
        reward: { coins: 190, xp: 170, reputation: 1, items: [{ itemId: 'mine_ore', quantity: 4 }] },
    },
    {
        id: 'bog_brew',
        title: 'Дыхание топи',
        description: 'Ведьма Ива варит средство от болотного яда и просит редкие светогрибы.',
        giver: 'iva',
        category: 'side',
        prerequisite: 'heart_of_ruin',
        objectives: [
            { type: 'collect', target: 'glowcap', label: 'Соберите светогрибы', amount: 5 },
        ],
        reward: { coins: 160, xp: 150, reputation: 1, items: [{ itemId: 'greater_vial', quantity: 2 }] },
    },
    // --- Orrin the hunter gets his own early side-quest chain entry. It funnels
    // wolf pelts (a crafting material) to the player and puts the otherwise
    // quest-less Teneviki (wraith) on a kill list. Gated behind the intro so it
    // slots into the same early window as wolf_debt. ---
    {
        id: 'hunters_bounty',
        title: 'Охотничья доля',
        description: 'Оррин промышляет в лесу и делит добычу с тем, кто расчистит его тропы от теневиков.',
        giver: 'orrin',
        category: 'side',
        prerequisite: 'first_oath',
        objectives: [
            { type: 'kill', target: 'wraith', label: 'Развейте теневиков на тропах Оррина', amount: 4 },
            { type: 'collect', target: 'wolf_pelt', label: 'Принесите волчьи шкуры для дележа', amount: 3 },
        ],
        reward: { coins: 130, xp: 120, reputation: 1, items: [{ itemId: 'wolf_pelt', quantity: 3 }, { itemId: 'bog_reed', quantity: 2 }] },
    },
    // --- Serah, the citadel deserter, opens post-game content. The main chain
    // ends at ash_crown; this picks up after it. It's the only quest that
    // consumes the citadel_seal item (previously unused). Narratively she knows a
    // second seal survived the fall and sends the player back into the ashes. ---
    {
        id: 'sealed_gate',
        title: 'Вторая печать',
        description: 'Капитан Сера бежала из цитадели не с пустыми руками. Она уверена: под пеплом уцелела вторая печать, и её нужно вынести, пока Пеплорождённые не собрались вновь.',
        giver: 'serah',
        category: 'side',
        prerequisite: 'ash_crown',
        objectives: [
            { type: 'kill', target: 'ashborn', label: 'Пробейтесь через Пеплорождённых', amount: 5 },
            { type: 'collect', target: 'citadel_seal', label: 'Вынесите уцелевшую печать цитадели', amount: 1 },
        ],
        reward: { coins: 300, xp: 320, reputation: 2, items: [{ itemId: 'ash_crystal', quantity: 3 }, { itemId: 'greater_vial', quantity: 2 }] },
    },
    {
        id: 'ashen_reckoning',
        title: 'Расплата пеплом',
        description: 'С печатью в руках Сера решается на то, ради чего дезертировала: закрыть разлом изнутри. Прикройте её последний рейд по выжженным залам.',
        giver: 'serah',
        category: 'side',
        prerequisite: 'sealed_gate',
        objectives: [
            { type: 'kill', target: 'ashborn', label: 'Сдержите Пеплорождённых у разлома', amount: 6 },
            { type: 'kill', target: 'wraith', label: 'Развейте теневиков в горящих залах', amount: 4 },
        ],
        reward: { coins: 380, xp: 420, reputation: 2, items: [{ itemId: 'cinder_plate', quantity: 1 }] },
    },
];
exports.BATTLE_PASS = [
    { tier: 1, reputation: 1, rewardLabel: '40 золота', coins: 40 },
    { tier: 2, reputation: 2, rewardLabel: 'Зелье крови', potions: 1 },
    { tier: 3, reputation: 3, rewardLabel: '80 золота', coins: 80 },
    { tier: 4, reputation: 5, rewardLabel: '2 зелья крови', potions: 2 },
    { tier: 5, reputation: 7, rewardLabel: '150 золота', coins: 150 },
    { tier: 6, reputation: 9, rewardLabel: 'Реликварий Бездны', weapon: 'reliquary' },
    { tier: 7, reputation: 11, rewardLabel: '250 золота', coins: 250 },
    { tier: 8, reputation: 12, rewardLabel: 'Печать Долины', coins: 400, potions: 3 },
    { tier: 9, reputation: 14, rewardLabel: 'Серп Чёрной топи', weapon: 'bogreaper' },
    { tier: 10, reputation: 16, rewardLabel: '350 золота', coins: 350 },
    { tier: 11, reputation: 19, rewardLabel: '5 зелий крови', potions: 5 },
    { tier: 12, reputation: 22, rewardLabel: 'Пепельное клеймо', weapon: 'cinderbrand' },
];
// Loot tables use a two-tier shape per enemy: a high-chance *common* material
// so materials flow reliably, plus a low-chance *rare* roll (a scarcer material
// or a consumable) so rare drops actually feel rare. Each drop is rolled
// independently. Every itemId here exists in items.ts (checked by data.test).
// Bosses keep their guaranteed signature drop and gain a small material bonus.
exports.ENEMIES = {
    husk: {
        id: 'husk', name: 'Одичалый', health: 62, damage: 10, speed: 58, aggro: 210, rewardCoins: 8, tint: 0x9ca87c,
        drops: [
            { itemId: 'bone_shard', chance: .72, min: 1, max: 2 },
            { itemId: 'glowcap', chance: .05, min: 1, max: 1 }, // rare forage off a wanderer
        ],
    },
    boneguard: {
        id: 'boneguard', name: 'Костяной страж', health: 90, damage: 14, speed: 48, aggro: 240, rewardCoins: 14, tint: 0xd7c9aa,
        drops: [
            { itemId: 'bone_shard', chance: .9, min: 1, max: 3 },
            { itemId: 'mine_ore', chance: .12, min: 1, max: 1 }, // shards of old armour
        ],
    },
    direwolf: {
        id: 'direwolf', name: 'Искажённый волк', health: 54, damage: 12, speed: 92, aggro: 260, rewardCoins: 11, tint: 0x7d708a,
        drops: [
            { itemId: 'wolf_pelt', chance: .62, min: 1, max: 1 },
            { itemId: 'bone_shard', chance: .3, min: 1, max: 1 },
        ],
    },
    wraith: {
        id: 'wraith', name: 'Теневик', health: 74, damage: 16, speed: 72, aggro: 280, rewardCoins: 18, tint: 0x796aab,
        drops: [
            { itemId: 'ash_crystal', chance: .28, min: 1, max: 1 },
            { itemId: 'glowcap', chance: .1, min: 1, max: 1 },
        ],
    },
    bogling: {
        id: 'bogling', name: 'Утопленник', health: 108, damage: 17, speed: 54, aggro: 300, rewardCoins: 22, tint: 0x4e8a75,
        drops: [
            { itemId: 'bog_reed', chance: .58, min: 1, max: 2 },
            { itemId: 'glowcap', chance: .18, min: 1, max: 1 },
        ],
    },
    cavecrawler: {
        id: 'cavecrawler', name: 'Пещерная тварь', health: 126, damage: 19, speed: 86, aggro: 310, rewardCoins: 26, tint: 0x8b7159,
        drops: [
            { itemId: 'mine_ore', chance: .68, min: 1, max: 2 },
            { itemId: 'ash_crystal', chance: .1, min: 1, max: 1 },
        ],
    },
    ashborn: {
        id: 'ashborn', name: 'Пеплорождённый', health: 154, damage: 23, speed: 66, aggro: 350, rewardCoins: 32, tint: 0xc35d47,
        drops: [
            { itemId: 'ash_crystal', chance: .7, min: 1, max: 2 },
            { itemId: 'glowcap', chance: .12, min: 1, max: 1 },
            { itemId: 'blood_vial', chance: .15, min: 1, max: 1 }, // rare heal off a hot kill
        ],
    },
    nameless: {
        id: 'nameless', name: 'Безымянная', health: 460, damage: 22, speed: 64, aggro: 420, rewardCoins: 100, tint: 0xb25987, scale: 1.45,
        drops: [
            { itemId: 'moon_charm', chance: 1, min: 1, max: 1 },
            { itemId: 'glowcap', chance: .5, min: 1, max: 2 }, // boss material bonus
        ],
    },
    cinderlord: {
        id: 'cinderlord', name: 'Владыка углей', health: 760, damage: 30, speed: 70, aggro: 500, rewardCoins: 180, tint: 0xe06143, scale: 1.65,
        drops: [
            { itemId: 'cinder_plate', chance: 1, min: 1, max: 1 },
            { itemId: 'ash_crystal', chance: .6, min: 2, max: 3 }, // boss material bonus
        ],
    },
};
exports.NPCS = [
    { id: 'mora', name: 'Сестра Мора', role: 'Хранительница клятвы', x: 660, y: 500, accent: 0xb78cff },
    { id: 'runa', name: 'Руна', role: 'Кузнец и оружейник', x: 1070, y: 640, accent: 0xe3a560 },
    { id: 'gran', name: 'Смотритель Гран', role: 'Страж кладбища', x: 1770, y: 690, accent: 0x9fc6b4 },
    { id: 'vesna', name: 'Весна', role: 'Травница', x: 980, y: 1080, accent: 0x81c784 },
    { id: 'elira', name: 'Элира', role: 'Вдова', x: 770, y: 760, accent: 0xd3a1b1 },
    { id: 'orrin', name: 'Оррин', role: 'Охотник', x: 1450, y: 1320, accent: 0xc5a47e },
    { id: 'ferryman', name: 'Перевозчик', role: 'Молчаливый проводник', x: 3000, y: 2380, accent: 0x88a7c2 },
    { id: 'iva', name: 'Ведьма Ива', role: 'Хозяйка Чёрной топи', x: 3190, y: 690, accent: 0x76c9a1 },
    { id: 'bram', name: 'Брам', role: 'Последний шахтёр', x: 3460, y: 1450, accent: 0xc6a26d },
    { id: 'serah', name: 'Капитан Сера', role: 'Дезертир цитадели', x: 3950, y: 2260, accent: 0xe47b68 },
];
var world_1 = __req("src/data/world.ts");
Object.defineProperty(exports, "LOCATIONS", { enumerable: true, get: function () { return world_1.LOCATIONS; } });
const XP_FOR_LEVEL = (level) => 100 + (level - 1) * 85;
exports.XP_FOR_LEVEL = XP_FOR_LEVEL;

});
__define("src/data/items.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getItem = exports.RARITY_COLOR = exports.RARITY_LABEL = exports.ITEMS = void 0;
exports.addStack = addStack;
exports.removeStack = removeStack;
exports.stackQuantity = stackQuantity;
exports.ITEMS = [
    { id: 'blood_vial', name: 'Зелье крови', description: 'Восстанавливает 48 здоровья.', category: 'consumable', rarity: 'common', icon: '♥', stackLimit: 9, value: 24, heal: 48 },
    { id: 'greater_vial', name: 'Большое зелье', description: 'Восстанавливает 90 здоровья.', category: 'consumable', rarity: 'rare', icon: '✚', stackLimit: 5, value: 68, heal: 90 },
    { id: 'smoke_bomb', name: 'Дымная сфера', description: 'Отталкивает ближайших врагов и даёт передышку.', category: 'consumable', rarity: 'uncommon', icon: '●', stackLimit: 6, value: 45 },
    { id: 'traveler_coat', name: 'Плащ странника', description: 'Плотная ткань смягчает слабые удары.', category: 'armor', rarity: 'common', icon: '♜', stackLimit: 1, value: 55, armor: 2 },
    { id: 'grave_warden_mail', name: 'Кольчуга смотрителя', description: 'Старая кольчуга с кладбищенскими печатями.', category: 'armor', rarity: 'rare', icon: '▦', stackLimit: 1, value: 180, armor: 5 },
    { id: 'cinder_plate', name: 'Пепельный панцирь', description: 'Тяжёлая броня павших стражей цитадели.', category: 'armor', rarity: 'epic', icon: '▣', stackLimit: 1, value: 390, armor: 8 },
    { id: 'wolf_fang', name: 'Клык искажённого волка', description: 'Ускоряет шаги владельца.', category: 'amulet', rarity: 'uncommon', icon: '⌁', stackLimit: 1, value: 90, speedBonus: 10 },
    { id: 'moon_charm', name: 'Лунный оберег', description: 'Добавляет силу атакам в темноте.', category: 'amulet', rarity: 'rare', icon: '☾', stackLimit: 1, value: 180, damageBonus: 5 },
    { id: 'ember_eye', name: 'Око углей', description: 'Редкая печать, усиливающая любое оружие.', category: 'amulet', rarity: 'legendary', icon: '◉', stackLimit: 1, value: 600, damageBonus: 11 },
    { id: 'bone_shard', name: 'Осколок кости', description: 'Материал для усиления оружия.', category: 'material', rarity: 'common', icon: '⌇', stackLimit: 30, value: 8 },
    { id: 'wolf_pelt', name: 'Шкура волка', description: 'Тёплая и всё ещё пахнет лесом.', category: 'material', rarity: 'common', icon: '≈', stackLimit: 20, value: 12 },
    { id: 'bog_reed', name: 'Болотный тростник', description: 'Ингредиент для сильных зелий.', category: 'material', rarity: 'uncommon', icon: '⌇', stackLimit: 20, value: 18 },
    { id: 'glowcap', name: 'Светогриб', description: 'Холодно светится даже в закрытой сумке.', category: 'material', rarity: 'rare', icon: '♠', stackLimit: 20, value: 28 },
    { id: 'ash_crystal', name: 'Пепельный кристалл', description: 'Горячий осколок из глубин цитадели.', category: 'material', rarity: 'rare', icon: '♦', stackLimit: 15, value: 38 },
    { id: 'mine_ore', name: 'Чёрная руда', description: 'Тяжёлый металл из Старых шахт.', category: 'material', rarity: 'uncommon', icon: '◆', stackLimit: 20, value: 24 },
    { id: 'moonwort', name: 'Лунная полынь', description: 'Светящаяся трава для ритуалов.', category: 'quest', rarity: 'uncommon', icon: '♧', stackLimit: 20, value: 0 },
    { id: 'shadebloom', name: 'Цветок тени', description: 'На лепестках выступает холодный иней.', category: 'quest', rarity: 'rare', icon: '✿', stackLimit: 20, value: 0 },
    { id: 'widow_charm', name: 'Медальон Элиры', description: 'Семейная реликвия с выцветшим портретом.', category: 'quest', rarity: 'rare', icon: '◈', stackLimit: 1, value: 0 },
    { id: 'ferryman_cargo', name: 'Запечатанный груз', description: 'Ящик перевозчика, который не стоит открывать.', category: 'quest', rarity: 'epic', icon: '▤', stackLimit: 3, value: 0 },
    { id: 'miner_tools', name: 'Инструменты шахтёра', description: 'Кирка и лампа, покрытые чёрной пылью.', category: 'quest', rarity: 'uncommon', icon: '⚒', stackLimit: 1, value: 0 },
    { id: 'citadel_seal', name: 'Печать цитадели', description: 'Открывает ворота Пепельной цитадели.', category: 'quest', rarity: 'epic', icon: '✹', stackLimit: 1, value: 0 },
];
exports.RARITY_LABEL = {
    common: 'Обычный',
    uncommon: 'Необычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
};
exports.RARITY_COLOR = {
    common: '#a9adb8',
    uncommon: '#78bf91',
    rare: '#72a5e8',
    epic: '#bc7ae8',
    legendary: '#e9b85e',
};
const getItem = (id) => exports.ITEMS.find((item) => item.id === id);
exports.getItem = getItem;
function addStack(stacks, itemId, quantity = 1) {
    if (quantity <= 0)
        return stacks;
    const item = (0, exports.getItem)(itemId);
    if (!item)
        return stacks;
    const result = stacks.map((stack) => ({ ...stack }));
    let remaining = quantity;
    for (const stack of result) {
        if (stack.itemId !== itemId || stack.quantity >= item.stackLimit)
            continue;
        const added = Math.min(remaining, item.stackLimit - stack.quantity);
        stack.quantity += added;
        remaining -= added;
        if (remaining <= 0)
            return result;
    }
    while (remaining > 0) {
        const added = Math.min(remaining, item.stackLimit);
        result.push({ itemId, quantity: added });
        remaining -= added;
    }
    return result;
}
function removeStack(stacks, itemId, quantity = 1) {
    let remaining = quantity;
    const result = [];
    for (const source of stacks) {
        const stack = { ...source };
        if (stack.itemId === itemId && remaining > 0) {
            const removed = Math.min(stack.quantity, remaining);
            stack.quantity -= removed;
            remaining -= removed;
        }
        if (stack.quantity > 0)
            result.push(stack);
    }
    return result;
}
function stackQuantity(stacks, itemId) {
    return stacks.filter((stack) => stack.itemId === itemId).reduce((sum, stack) => sum + stack.quantity, 0);
}

});
__define("src/data/weaponVisuals.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeaponVisual = exports.WEAPON_VISUALS = void 0;
exports.WEAPON_VISUALS = [
    { id: 'rustblade', primary: '#c5cbd3', secondary: '#79563a', glow: '#e7ebef', bonusVs: ['husk', 'bogling'], bonusLabel: 'Плоть +20%' },
    { id: 'graveaxe', primary: '#d3a05d', secondary: '#6f4a31', glow: '#f4c77f', bonusVs: ['boneguard', 'cavecrawler'], bonusLabel: 'Броня +25%' },
    { id: 'witchbow', primary: '#76c4a4', secondary: '#4e6f61', glow: '#b7ffe0', bonusVs: ['wraith', 'bogling'], bonusLabel: 'Тени +25%' },
    { id: 'ashstaff', primary: '#e56a48', secondary: '#684031', glow: '#ffca72', bonusVs: ['direwolf', 'cavecrawler'], bonusLabel: 'Звери +25%' },
    { id: 'moonblade', primary: '#a8b8ee', secondary: '#555d79', glow: '#e2e8ff', bonusVs: ['wraith', 'nameless'], bonusLabel: 'Нежить +30%' },
    { id: 'reliquary', primary: '#bf78e2', secondary: '#59406c', glow: '#f1bdff', bonusVs: ['nameless', 'cinderlord'], bonusLabel: 'Боссы +20%' },
    { id: 'bogreaper', primary: '#6fc79b', secondary: '#476a53', glow: '#b5ffd5', bonusVs: ['bogling', 'ashborn'], bonusLabel: 'Порча +30%' },
    { id: 'cinderbrand', primary: '#f2774c', secondary: '#713c31', glow: '#ffd07a', bonusVs: ['boneguard', 'cinderlord'], bonusLabel: 'Стражи +30%' },
];
const getWeaponVisual = (id) => { var _a; return (_a = exports.WEAPON_VISUALS.find((visual) => visual.id === id)) !== null && _a !== void 0 ? _a : exports.WEAPON_VISUALS[0]; };
exports.getWeaponVisual = getWeaponVisual;

});
__define("src/ui/GameUI.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameUI = void 0;
const content_1 = __req("src/data/content.ts");
const items_1 = __req("src/data/items.ts");
const weaponVisuals_1 = __req("src/data/weaponVisuals.ts");
const bestiary_1 = __req("src/data/bestiary.ts");
const achievements_1 = __req("src/data/achievements.ts");
const crafting_1 = __req("src/data/crafting.ts");
const world_1 = __req("src/data/world.ts");
const events_1 = __req("src/game/events.ts");
const questStatusLabel = {
    available: 'Доступно', active: 'В процессе', ready: 'Можно сдать', completed: 'Завершено',
};
// Key hints for the three quick-item slots. These MUST match the physical keys
// the scenes bind (Z / X / V) — see InteriorScene.setupInput and the WorldScene
// integration note in this file's footer. Kept here so the HUD labels and the
// binding stay in one place conceptually.
const QUICK_SLOT_KEYS = ['Z', 'X', 'V'];
// Progressive-reveal thresholds for the bestiary. Mirror BestiarySystem's
// constants (kept in sync by hand — the UI derives its view straight from the
// persisted kill map so it never needs a system instance).
const BESTIARY_APPEARANCE_AT = 1; // name + appearance
const BESTIARY_STATS_AT = 5; // health/damage numbers
const BESTIARY_WEAKNESS_AT = 15; // weakness hint
const achievementCategoryLabel = {
    kills: 'Сражения', exploration: 'Странствия', crafting: 'Ремесло', quests: 'Клятвы',
    economy: 'Богатство', skill: 'Мастерство', secret: 'Тайны',
};
const achievementCategoryOrder = ['kills', 'exploration', 'crafting', 'quests', 'economy', 'skill', 'secret'];
class GameUI {
    constructor() {
        Object.defineProperty(this, "root", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "snapshot", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "save", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activePanel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "toastTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lootTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hurtTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "joystickPointer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "joystickCenter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { x: 0, y: 0 }
        });
        Object.defineProperty(this, "worldPosition", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { x: 420, y: 520 }
        });
        Object.defineProperty(this, "reducedMotion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        // Boss fight state, retained so a `boss-health` update can redraw the same bar
        // without another `boss-engage` payload.
        Object.defineProperty(this, "bossPhases", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "bossMaxHealth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        // Latest environment labels, surfaced in the clock/weather widget.
        Object.defineProperty(this, "timeLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "weatherLabel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        // Pending in-panel confirmation (e.g. reset). Rendered by renderPanel so it
        // survives HUD-driven re-renders while a panel is open.
        Object.defineProperty(this, "pendingConfirm", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Track the largest cooldown seen per ability so the radial sweep has a stable
        // "full" reference even when the scene only sends the remaining seconds.
        Object.defineProperty(this, "dashCooldownMax", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "specialCooldownMax", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        const root = document.querySelector('#ui-root');
        if (!root)
            throw new Error('UI root not found');
        this.root = root;
    }
    mount() {
        this.root.innerHTML = `
      <div class="game-ui">
        <header class="hud-card player-card" aria-label="Состояние героя">
          <div class="portrait"><span>†</span></div>
          <div class="player-stats">
            <div class="stat-heading"><strong>ИЗГНАННИК</strong><span id="level-label">УР. 1</span></div>
            <div class="bar health-bar"><i id="health-fill"></i><span id="health-label">100 / 100</span></div>
            <div class="bar xp-bar"><i id="xp-fill"></i></div>
          </div>
        </header>

        <div class="currency-stack">
          <div class="currency"><span class="coin-glyph">◆</span><strong id="coins-label">0</strong></div>
          <div class="currency rep"><span>✦</span><strong id="rep-label">0</strong></div>
        </div>

        <section class="hud-card quest-tracker" id="quest-tracker" aria-live="polite">
          <span class="eyebrow">ТЕКУЩАЯ ЦЕЛЬ</span>
          <strong id="quest-title">Найдите свою клятву</strong>
          <p id="quest-objective">Поговорите с Сестрой Морой у дома.</p>
          <div class="quest-progress"><i id="quest-progress-fill"></i></div>
        </section>

        <aside class="minimap-wrap" aria-label="Мини-карта">
          <div class="minimap">
            ${this.mapSvg(true)}
            <span class="mini-player" id="mini-player"></span>
          </div>
          <span class="location-name" id="location-label">ДОМ ИЗГНАННИКА</span>
          <div class="env-widget" id="env-widget" aria-label="Время суток и погода" title="Время суток и погода">
            <span class="env-icon" id="env-icon">☾</span>
            <span class="env-labels"><b id="env-time">—</b><small id="env-weather">—</small></span>
          </div>
        </aside>

        <div class="boss-bar" id="boss-bar" aria-hidden="true" role="status">
          <div class="boss-heading"><span class="boss-eyebrow">ВЛАДЫКА ДОЛИНЫ</span><strong id="boss-name">Босс</strong></div>
          <div class="boss-track"><i id="boss-fill"></i><span class="boss-segments" id="boss-segments"></span></div>
        </div>

        <nav class="quick-nav" aria-label="Игровые меню">
          <button data-panel="journal"><span>Q</span>Задания</button>
          <button data-panel="inventory"><span>I</span>Инвентарь</button>
          <button data-panel="craft"><span>C</span>Ремесло</button>
          <button data-panel="bestiary"><span>K</span>Бестиарий</button>
          <button data-panel="achievements"><span>J</span>Награды</button>
          <button data-panel="map"><span>M</span>Карта</button>
          <button data-panel="pass"><span>B</span>Пропуск</button>
          <button data-panel="shop"><span>◆</span>Магазин</button>
          <button data-panel="pause"><span>Esc</span>Меню</button>
        </nav>

        <div class="weapon-slot" id="weapon-slot">
          <span id="weapon-icon">⚔</span>
          <div><small id="weapon-meta">MELEE • УРОН 24</small><strong id="weapon-name">Ржавый клинок</strong></div>
          <kbd id="weapon-key">1</kbd>
        </div>
        <div class="weapon-hotbar" id="weapon-hotbar" aria-label="Быстрый выбор оружия"></div>
        <button class="potion-slot" id="potion-button" aria-label="Использовать зелье"><span>♥</span><strong id="potion-count">2</strong><kbd>F</kbd></button>
        <div class="quick-slots" id="quick-slots" aria-label="Быстрые предметы"></div>
        <div class="ability-bar">
          <button class="ability-slot dash ready" data-ui-ability="dash" aria-label="Рывок"><span>➤</span><small>РЫВОК</small><kbd>SHIFT</kbd><b id="dash-cooldown"></b></button>
          <button class="ability-slot special ready" data-ui-ability="special" aria-label="Особая способность"><span>✦</span><small>ОСОБАЯ</small><kbd>R</kbd><b id="special-cooldown"></b></button>
        </div>

        <div class="interaction-prompt" id="interaction-prompt"><kbd>E</kbd><span id="interaction-text">Говорить</span></div>
        <div class="tutorial-tip" id="tutorial-tip"><span class="tutorial-step">ОБУЧЕНИЕ 1/5</span><strong>Начните путь</strong><p>Используйте WASD или левый стик, чтобы двигаться.</p></div>
        <div class="toast" id="toast" role="status"></div>
        <div class="loot-banner" id="loot-banner" role="status"><span id="loot-icon">◆</span><div><small>ПОЛУЧЕНО</small><strong id="loot-name">Предмет</strong></div><b id="loot-quantity">+1</b></div>
        <div class="combo-banner" id="combo-banner"><strong id="combo-hits">2</strong><div><span>СЕРИЯ</span><b id="combo-multiplier">×1.03</b></div></div>
        <div class="rift-banner" id="rift-banner"><span>✦</span><div><small>РАЗЛОМ ДОЛИНЫ</small><strong id="rift-name">Разлом</strong><p id="rift-progress">Волна 1 • осталось 3</p></div></div>

        <div class="mobile-controls" aria-label="Сенсорное управление">
          <div class="joystick" id="joystick"><span id="joystick-stick"></span></div>
          <div class="mobile-actions">
            <button class="mobile-button heal" data-mobile-action="heal" aria-label="Зелье">♥</button>
            <button class="mobile-button dash" data-mobile-action="dash" aria-label="Рывок">➤</button>
            <button class="mobile-button special" data-mobile-action="special" aria-label="Особая способность">✦</button>
            <button class="mobile-button interact" data-mobile-action="interact" aria-label="Взаимодействие">E</button>
            <button class="mobile-button attack" data-mobile-action="attack" aria-label="Атака">⚔</button>
          </div>
        </div>

        <div class="screen-panel" id="screen-panel" aria-hidden="true">
          <button class="panel-backdrop" data-close-panel aria-label="Закрыть меню"></button>
          <section class="panel-shell" role="dialog" aria-modal="true">
            <header><div><span class="eyebrow" id="panel-eyebrow">TRUPY</span><h2 id="panel-title">Меню</h2></div><button class="close-button" data-close-panel aria-label="Закрыть">×</button></header>
            <div class="panel-content" id="panel-content"></div>
          </section>
        </div>

        <div class="dialogue-layer" id="dialogue-layer" aria-hidden="true">
          <section class="dialogue-card">
            <div class="dialogue-portrait" id="dialogue-portrait">†</div>
            <div class="dialogue-copy"><span class="eyebrow" id="dialogue-subtitle">ЖИТЕЛЬ ДОЛИНЫ</span><h3 id="dialogue-speaker">Сестра Мора</h3><p id="dialogue-text"></p><div class="dialogue-actions" id="dialogue-actions"></div></div>
          </section>
        </div>

        <div class="hurt-vignette" id="hurt-vignette" aria-hidden="true"></div>
        <div class="death-screen" id="death-screen" aria-hidden="true"><div><span>ПОГИБЕЛЬ — НЕ КОНЕЦ</span><h2>Долина вернула вас домой</h2><p>Часть золота потеряна, но клятва остаётся.</p><button id="respawn-button">ВОЗРОДИТЬСЯ</button></div></div>
        <div class="ending-screen" id="ending-screen" aria-hidden="true"><div class="ending-sigil">✺</div><span>ГЛАВА II ЗАВЕРШЕНА</span><h2>Пепельная корона разбита</h2><p>Безымянная пала, Чёрная топь открыла свои тайны, а огонь цитадели больше не пожирает Долину.</p><div class="ending-stats" id="ending-stats"></div><button data-ending-close>ПРОДОЛЖИТЬ ИССЛЕДОВАНИЕ</button></div>
      </div>
    `;
        this.bindDomEvents();
        this.bindGameEvents();
    }
    destroy() {
        this.listeners.forEach((dispose) => dispose());
        this.listeners = [];
        this.root.innerHTML = '';
    }
    updateWorldPosition(x, y) {
        this.worldPosition = { x, y };
        const marker = this.root.querySelector('#mini-player');
        if (marker) {
            marker.style.left = `${Math.max(3, Math.min(97, x / world_1.WORLD_WIDTH * 100))}%`;
            marker.style.top = `${Math.max(4, Math.min(96, y / world_1.WORLD_HEIGHT * 100))}%`;
        }
        const mapMarker = this.root.querySelector('#map-player');
        if (mapMarker) {
            mapMarker.style.left = `${x / world_1.WORLD_WIDTH * 100}%`;
            mapMarker.style.top = `${y / world_1.WORLD_HEIGHT * 100}%`;
        }
    }
    setPrompt(text) {
        const prompt = this.root.querySelector('#interaction-prompt');
        const label = this.root.querySelector('#interaction-text');
        if (!prompt || !label)
            return;
        if (text) {
            label.textContent = text;
            this.positionPrompt();
            prompt.classList.add('visible');
        }
        else
            prompt.classList.remove('visible');
    }
    // Anchor the interaction prompt just above the actual weapon hotbar instead of
    // a hardcoded offset, so it tracks the hotbar across breakpoints and safe-area
    // insets. Falls back to the CSS default if the hotbar isn't laid out yet.
    positionPrompt() {
        const prompt = this.root.querySelector('#interaction-prompt');
        const hotbar = this.root.querySelector('#weapon-hotbar');
        if (!prompt || !hotbar)
            return;
        const hotbarRect = hotbar.getBoundingClientRect();
        if (hotbarRect.height === 0) {
            prompt.style.removeProperty('bottom');
            return;
        }
        const gap = 14;
        prompt.style.bottom = `${Math.round(window.innerHeight - hotbarRect.top + gap)}px`;
    }
    on(event, callback) {
        events_1.GameEvents.on(event, callback);
        this.listeners.push(() => events_1.GameEvents.off(event, callback));
    }
    bindGameEvents() {
        this.on('hud', ({ snapshot, save }) => {
            this.snapshot = snapshot;
            this.save = save;
            this.renderHud();
            if (this.activePanel)
                this.renderPanel(this.activePanel);
        });
        this.on('toast', (message) => this.showToast(message));
        this.on('loot', (loot) => this.showLoot(loot.itemId, loot.quantity));
        this.on('combo', ({ hits, multiplier }) => this.showCombo(hits, multiplier));
        this.on('ability-cooldown', (cd) => this.showAbilityCooldown(cd.dash, cd.special, cd.dashMax, cd.specialMax));
        this.on('rift-status', (status) => this.showRiftStatus(status));
        this.on('boss-engage', (payload) => this.showBossEngage(payload));
        this.on('boss-health', (payload) => this.showBossHealth(payload));
        this.on('boss-defeated', () => this.hideBoss());
        this.on('environment', (env) => this.showEnvironment(env));
        this.on('player-hurt', ({ severity }) => this.showHurt(severity !== null && severity !== void 0 ? severity : 1));
        this.on('location', (location) => {
            const label = this.root.querySelector('#location-label');
            if (label)
                label.textContent = location.toUpperCase();
        });
        this.on('tutorial', (tip) => this.showTutorial(tip));
        this.on('dialogue', (payload) => this.showDialogue(payload));
        this.on('dialogue-close', () => this.closeDialogue());
        this.on('panel-open', (panel) => this.openPanel(panel));
        this.on('death', () => this.showDeath());
        this.on('ending', (data) => this.showEnding(data));
        this.on('prompt', ({ text }) => this.setPrompt(text));
    }
    bindDomEvents() {
        var _a, _b, _c;
        this.root.querySelectorAll('[data-panel]').forEach((button) => {
            button.addEventListener('click', () => this.openPanel(button.dataset.panel));
        });
        this.root.querySelectorAll('[data-close-panel]').forEach((button) => button.addEventListener('click', () => this.closePanel()));
        (_a = this.root.querySelector('#potion-button')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => events_1.GameEvents.emit('ui-heal'));
        this.root.querySelectorAll('[data-ui-ability]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit(button.dataset.uiAbility === 'dash' ? 'ui-dash' : 'ui-special')));
        (_b = this.root.querySelector('#respawn-button')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            var _a;
            (_a = this.root.querySelector('#death-screen')) === null || _a === void 0 ? void 0 : _a.setAttribute('aria-hidden', 'true');
            events_1.GameEvents.emit('respawn');
        });
        (_c = this.root.querySelector('[data-ending-close]')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            var _a;
            (_a = this.root.querySelector('#ending-screen')) === null || _a === void 0 ? void 0 : _a.setAttribute('aria-hidden', 'true');
            events_1.GameEvents.emit('ui-lock', false);
        });
        this.root.querySelectorAll('[data-mobile-action]').forEach((button) => {
            const event = button.dataset.mobileAction;
            button.addEventListener('pointerdown', (pointer) => {
                pointer.preventDefault();
                if (event === 'attack')
                    events_1.GameEvents.emit('ui-attack');
                if (event === 'interact')
                    events_1.GameEvents.emit('ui-interact');
                if (event === 'heal')
                    events_1.GameEvents.emit('ui-heal');
                if (event === 'dash')
                    events_1.GameEvents.emit('ui-dash');
                if (event === 'special')
                    events_1.GameEvents.emit('ui-special');
            });
        });
        this.bindJoystick();
        // Keep the interaction prompt anchored to the hotbar across resizes and
        // orientation changes. Disposed on destroy alongside the game listeners.
        const onResize = () => { var _a; if ((_a = this.root.querySelector('#interaction-prompt')) === null || _a === void 0 ? void 0 : _a.classList.contains('visible'))
            this.positionPrompt(); };
        window.addEventListener('resize', onResize);
        this.listeners.push(() => window.removeEventListener('resize', onResize));
    }
    bindJoystick() {
        const joystick = this.root.querySelector('#joystick');
        const stick = this.root.querySelector('#joystick-stick');
        if (!joystick || !stick)
            return;
        const move = (event) => {
            if (event.pointerId !== this.joystickPointer)
                return;
            const dx = event.clientX - this.joystickCenter.x;
            const dy = event.clientY - this.joystickCenter.y;
            const length = Math.hypot(dx, dy);
            const max = 38;
            const scale = length > max ? max / length : 1;
            const x = dx * scale;
            const y = dy * scale;
            stick.style.transform = `translate(${x}px, ${y}px)`;
            events_1.GameEvents.emit('ui-move', { x: x / max, y: y / max });
        };
        const end = (event) => {
            if (event.pointerId !== this.joystickPointer)
                return;
            this.joystickPointer = undefined;
            stick.style.transform = 'translate(0, 0)';
            events_1.GameEvents.emit('ui-move', { x: 0, y: 0 });
        };
        joystick.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const rect = joystick.getBoundingClientRect();
            this.joystickPointer = event.pointerId;
            this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            joystick.setPointerCapture(event.pointerId);
            move(event);
        });
        joystick.addEventListener('pointermove', move);
        joystick.addEventListener('pointerup', end);
        joystick.addEventListener('pointercancel', end);
    }
    renderHud() {
        var _a;
        if (!this.snapshot || !this.save)
            return;
        const { snapshot } = this;
        this.text('#level-label', `УР. ${snapshot.level}`);
        this.text('#health-label', `${Math.ceil(snapshot.health)} / ${snapshot.maxHealth}`);
        this.width('#health-fill', snapshot.health / snapshot.maxHealth * 100);
        this.width('#xp-fill', snapshot.xp / snapshot.xpNext * 100);
        this.text('#coins-label', snapshot.coins.toString());
        this.text('#rep-label', snapshot.reputation.toString());
        this.text('#potion-count', snapshot.potions.toString());
        const weapon = (_a = content_1.WEAPONS.find((item) => item.id === snapshot.equippedWeapon)) !== null && _a !== void 0 ? _a : content_1.WEAPONS[0];
        this.text('#weapon-icon', weapon.icon);
        this.text('#weapon-name', weapon.name);
        this.text('#weapon-meta', `${weapon.kind.toUpperCase()} • УРОН ${weapon.damage}`);
        this.text('#weapon-key', String(Math.max(1, content_1.WEAPONS.findIndex((entry) => entry.id === weapon.id) + 1)));
        this.renderWeaponHotbar(snapshot);
        this.renderQuickSlots(snapshot);
        const weaponSlot = this.root.querySelector('#weapon-slot');
        if (weaponSlot)
            weaponSlot.style.setProperty('--weapon-accent', weapon.accent);
        const tracker = this.root.querySelector('#quest-tracker');
        if (snapshot.activeQuest) {
            this.text('#quest-title', snapshot.activeQuest.title);
            this.text('#quest-objective', snapshot.activeQuest.ready ? 'Вернитесь к заказчику за наградой' : `${snapshot.activeQuest.objective} — ${snapshot.activeQuest.amount}/${snapshot.activeQuest.required}`);
            this.width('#quest-progress-fill', snapshot.activeQuest.ready ? 100 : snapshot.activeQuest.amount / snapshot.activeQuest.required * 100);
            tracker === null || tracker === void 0 ? void 0 : tracker.classList.toggle('ready', snapshot.activeQuest.ready);
        }
        else {
            this.text('#quest-title', snapshot.tutorialDone ? 'Свободное исследование' : 'Найдите свою клятву');
            this.text('#quest-objective', snapshot.tutorialDone ? 'Поговорите с жителями Долины.' : 'Завершите короткое обучение у дома.');
            this.width('#quest-progress-fill', 0);
            tracker === null || tracker === void 0 ? void 0 : tracker.classList.remove('ready');
        }
    }
    renderWeaponHotbar(snapshot) {
        var _a;
        const hotbar = this.root.querySelector('#weapon-hotbar');
        if (!hotbar)
            return;
        hotbar.innerHTML = content_1.WEAPONS.map((weapon, index) => {
            const owned = snapshot.ownedWeapons.includes(weapon.id);
            const active = snapshot.equippedWeapon === weapon.id;
            const visual = (0, weaponVisuals_1.getWeaponVisual)(weapon.id);
            return `<button class="hotbar-weapon ${owned ? 'owned' : 'locked'} ${active ? 'active' : ''}" data-hotbar-weapon="${owned ? weapon.id : ''}" style="--weapon-color:${weapon.accent}" ${owned ? '' : 'disabled'} title="${weapon.name} • ${visual.bonusLabel}"><kbd>${index + 1}</kbd><span>${weapon.icon}</span><small>${owned ? weapon.damage : `◆${weapon.price}`}</small></button>`;
        }).join('');
        hotbar.querySelectorAll('[data-hotbar-weapon]').forEach((button) => {
            if (button.dataset.hotbarWeapon)
                button.addEventListener('click', () => events_1.GameEvents.emit('equip', button.dataset.hotbarWeapon));
        });
        (_a = hotbar.querySelector('.hotbar-weapon.active')) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
    /**
     * The quick-item bar: 3 slots bound to consumables via the inventory panel and
     * fired with Z / X / V (or a tap). Each slot shows the item's icon and how many
     * remain (from the live inventory), greys out when the item is exhausted, and
     * reads "empty" when nothing is bound. Clicking a filled slot uses it; clicking
     * an empty one opens the inventory so the player can assign something.
     */
    renderQuickSlots(snapshot) {
        var _a;
        const container = this.root.querySelector('#quick-slots');
        if (!container)
            return;
        const quick = (_a = snapshot.equipment.quick) !== null && _a !== void 0 ? _a : [];
        container.innerHTML = QUICK_SLOT_KEYS.map((key, index) => {
            var _a;
            const itemId = (_a = quick[index]) !== null && _a !== void 0 ? _a : null;
            const item = itemId ? (0, items_1.getItem)(itemId) : undefined;
            const count = item ? snapshot.inventory.filter((stack) => stack.itemId === item.id).reduce((sum, stack) => sum + stack.quantity, 0) : 0;
            const empty = !item;
            const exhausted = Boolean(item) && count <= 0;
            return `<button class="quick-slot ${empty ? 'empty' : ''} ${exhausted ? 'exhausted' : ''}" data-quick-slot="${index}" style="--rarity:${item ? items_1.RARITY_COLOR[item.rarity] : '#4a4d5a'}" title="${item ? `${item.name} • Z/X/V` : 'Пустая ячейка — назначьте расходник в инвентаре'}" aria-label="${item ? item.name : 'Пустая ячейка'}"><kbd>${key}</kbd><span>${item ? item.icon : '+'}</span><small>${empty ? '' : count}</small></button>`;
        }).join('');
        container.querySelectorAll('[data-quick-slot]').forEach((button) => {
            const index = Number(button.dataset.quickSlot);
            button.addEventListener('click', () => {
                var _a, _b;
                const bound = (_b = ((_a = snapshot.equipment.quick) !== null && _a !== void 0 ? _a : [])[index]) !== null && _b !== void 0 ? _b : null;
                if (bound)
                    events_1.GameEvents.emit('use-quick-slot', index);
                else
                    this.openPanel('inventory');
            });
        });
    }
    openPanel(panel) {
        if (this.activePanel === panel)
            return this.closePanel();
        this.closeDialogue();
        this.activePanel = panel;
        const layer = this.root.querySelector('#screen-panel');
        layer === null || layer === void 0 ? void 0 : layer.setAttribute('aria-hidden', 'false');
        this.renderPanel(panel);
        events_1.GameEvents.emit('ui-lock', true);
    }
    closePanel() {
        var _a;
        this.activePanel = undefined;
        this.pendingConfirm = undefined;
        (_a = this.root.querySelector('#screen-panel')) === null || _a === void 0 ? void 0 : _a.setAttribute('aria-hidden', 'true');
        events_1.GameEvents.emit('ui-lock', false);
    }
    renderPanel(panel) {
        var _a, _b;
        const title = this.root.querySelector('#panel-title');
        const eyebrow = this.root.querySelector('#panel-eyebrow');
        const content = this.root.querySelector('#panel-content');
        if (!title || !eyebrow || !content)
            return;
        const renderers = {
            journal: () => this.journalHtml(),
            inventory: () => this.inventoryHtml(),
            map: () => this.mapHtml(),
            pass: () => this.passHtml(),
            pause: () => this.pauseHtml(),
            shop: () => this.shopHtml(),
            chest: () => this.chestHtml(),
            craft: () => this.craftHtml(),
            bestiary: () => this.bestiaryHtml(),
            achievements: () => this.achievementsHtml(),
        };
        const labels = {
            journal: ['ЖУРНАЛ', 'Задания'], inventory: ['СУМКА ИЗГНАННИКА', 'Инвентарь'], map: ['ДОЛИНА МЁРТВЫХ', 'Карта'],
            pass: ['СЕЗОН II • БЕСПЛАТНО', 'Путь изгнанника'], pause: ['TRUPY', 'Пауза'], shop: ['КУЗНИЦА РУНЫ', 'Магазин оружия'], chest: ['ДОМ ИЗГНАННИКА', 'Домашний сундук'],
            craft: ['МАСТЕРСКАЯ И КУЗНИЦА', 'Ремесло'], bestiary: ['ЛЕТОПИСЬ ДОЛИНЫ', 'Бестиарий'], achievements: ['ПУТЬ ИЗГНАННИКА', 'Награды'],
        };
        [eyebrow.textContent, title.textContent] = (_a = labels[panel]) !== null && _a !== void 0 ? _a : ['TRUPY', 'Меню'];
        content.innerHTML = ((_b = renderers[panel]) !== null && _b !== void 0 ? _b : renderers.pause)() + this.confirmHtml();
        this.bindPanelActions();
        this.updateWorldPosition(this.worldPosition.x, this.worldPosition.y);
    }
    journalHtml() {
        var _a, _b;
        const quests = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.quests) !== null && _b !== void 0 ? _b : [];
        return `<div class="panel-intro"><p>Контракты меняют Долину. Основная цепочка отмечена алым, побочные поручения — серебром.</p></div><div class="quest-list">${quests.map((quest) => {
            var _a;
            return `
      <article class="quest-row ${quest.category} ${quest.status}">
        <div class="quest-emblem">${quest.category === 'main' ? '†' : '•'}</div><div><span>${quest.category === 'main' ? 'КЛЯТВА' : 'КОНТРАКТ'} • ${questStatusLabel[quest.status]}</span><h3>${quest.title}</h3>
        ${quest.objective ? `<p>${quest.objective}${quest.required ? ` — ${(_a = quest.amount) !== null && _a !== void 0 ? _a : 0}/${quest.required}` : ''}</p>` : '<p>Поговорите с заказчиком, чтобы узнать подробности.</p>'}</div>
      </article>`;
        }).join('') || '<div class="empty-state">Новые контракты появятся после обучения.</div>'}</div>`;
    }
    inventoryHtml() {
        var _a, _b, _c, _d, _e, _f;
        const snapshot = this.snapshot;
        if (!snapshot)
            return '<div class="empty-state">Инвентарь загружается…</div>';
        const equippedArmor = (0, items_1.getItem)((_a = snapshot.equipment.armor) !== null && _a !== void 0 ? _a : '');
        const equippedAmulet = (0, items_1.getItem)((_b = snapshot.equipment.amulet) !== null && _b !== void 0 ? _b : '');
        const equippedWeapon = (_c = content_1.WEAPONS.find((weapon) => weapon.id === snapshot.equippedWeapon)) !== null && _c !== void 0 ? _c : content_1.WEAPONS[0];
        const itemStacks = snapshot.inventory
            .map((stack) => ({ stack, item: (0, items_1.getItem)(stack.itemId) }))
            .filter((entry) => Boolean(entry.item));
        return `<div class="inventory-layout">
      <aside class="equipment-paperdoll">
        <span class="eyebrow">ЭКИПИРОВКА</span><div class="paperdoll-silhouette">†</div>
        <div class="equipment-slot weapon"><small>ОРУЖИЕ</small><b>${equippedWeapon.icon} ${equippedWeapon.name}</b></div>
        <div class="equipment-slot armor"><small>БРОНЯ</small><b>${equippedArmor ? `${equippedArmor.icon} ${equippedArmor.name}` : '— Пусто —'}</b></div>
        <div class="equipment-slot amulet"><small>АМУЛЕТ</small><b>${equippedAmulet ? `${equippedAmulet.icon} ${equippedAmulet.name}` : '— Пусто —'}</b></div>
        <div class="equipment-stats"><span>Защита <b>+${(_d = equippedArmor === null || equippedArmor === void 0 ? void 0 : equippedArmor.armor) !== null && _d !== void 0 ? _d : 0}</b></span><span>Урон <b>+${(_e = equippedAmulet === null || equippedAmulet === void 0 ? void 0 : equippedAmulet.damageBonus) !== null && _e !== void 0 ? _e : 0}</b></span><span>Скорость <b>+${(_f = equippedAmulet === null || equippedAmulet === void 0 ? void 0 : equippedAmulet.speedBonus) !== null && _f !== void 0 ? _f : 0}</b></span></div>
      </aside>
      <section class="inventory-bag">
        <div class="panel-intro split"><p>Экипируйте броню и амулеты, используйте расходники и собирайте материалы для будущих улучшений.</p><div class="bag-meta"><span>◆ ${snapshot.coins}</span><span>${snapshot.inventory.reduce((sum, stack) => sum + stack.quantity, 0)} предметов</span></div></div>
        <h3 class="inventory-section-title">Оружие</h3><div class="inventory-grid weapons">${content_1.WEAPONS.filter((weapon) => snapshot.ownedWeapons.includes(weapon.id)).map((weapon) => this.weaponInventoryCard(weapon.id)).join('')}</div>
        <h3 class="inventory-section-title">Содержимое сумки</h3><div class="inventory-grid">${itemStacks.map(({ stack, item }) => this.itemInventoryCard(item.id, stack.quantity)).join('') || '<div class="empty-state">Сумка пуста</div>'}</div>
      </section>
    </div>`;
    }
    weaponInventoryCard(weaponId) {
        var _a;
        const weapon = content_1.WEAPONS.find((entry) => entry.id === weaponId);
        const equipped = ((_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.equippedWeapon) === weapon.id;
        return `<article class="inventory-item weapon-item ${equipped ? 'equipped' : ''}" style="--rarity:${weapon.accent}"><div class="item-icon">${weapon.icon}</div><div class="item-copy"><small>${weapon.kind.toUpperCase()} • УРОН ${weapon.damage}</small><b>${weapon.name}</b><p>${weapon.description}</p></div><button data-equip="${weapon.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'НАДЕТО' : 'ЭКИПИРОВАТЬ'}</button></article>`;
    }
    itemInventoryCard(itemId, quantity, chest = false, allowStore = false) {
        var _a, _b;
        const item = (0, items_1.getItem)(itemId);
        if (!item)
            return '';
        const equipped = ((_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.equipment.armor) === itemId || ((_b = this.snapshot) === null || _b === void 0 ? void 0 : _b.equipment.amulet) === itemId;
        const primary = chest ? '' : item.category === 'consumable'
            ? `<button data-use-item="${itemId}">ИСПОЛЬЗОВАТЬ</button>`
            : item.category === 'armor' || item.category === 'amulet'
                ? `<button data-equip-item="${itemId}" ${equipped ? 'disabled' : ''}>${equipped ? 'НАДЕТО' : 'ЭКИПИРОВАТЬ'}</button>`
                : '';
        const transfer = chest
            ? `<button class="subtle" data-transfer-item="${itemId}" data-direction="toInventory">В СУМКУ</button>`
            : allowStore && item.category !== 'quest' ? `<button class="subtle" data-transfer-item="${itemId}" data-direction="toChest">В СУНДУК</button>` : '';
        // Consumables can be bound to the 3 quick slots (Z/X/V). A compact assign row
        // shows which slot (if any) currently holds this item and lets the player bind
        // it to any of the three. Only shown in the bag, not the chest view.
        const assign = !chest && item.category === 'consumable' ? this.quickAssignRow(itemId) : '';
        return `<article class="inventory-item ${equipped ? 'equipped' : ''}" style="--rarity:${items_1.RARITY_COLOR[item.rarity]}"><div class="item-icon">${item.icon}<em>${quantity > 1 ? quantity : ''}</em></div><div class="item-copy"><small>${items_1.RARITY_LABEL[item.rarity]} • ${this.categoryLabel(item.category)}</small><b>${item.name}</b><p>${item.description}</p>${assign}</div><div class="item-actions">${primary}${transfer}</div></article>`;
    }
    /**
     * The "bind to quick slot" control shown under a consumable in the bag. Renders
     * three tiny toggles (Z/X/V); the one currently holding this item is marked
     * active and, when clicked, clears the binding — so it doubles as unbind.
     */
    quickAssignRow(itemId) {
        var _a, _b;
        const quick = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.equipment.quick) !== null && _b !== void 0 ? _b : [];
        const buttons = QUICK_SLOT_KEYS.map((key, index) => {
            const active = quick[index] === itemId;
            return `<button class="quick-assign-btn ${active ? 'active' : ''}" data-quick-assign="${itemId}" data-slot="${index}" title="${active ? 'Убрать из ячейки' : `Назначить на ячейку ${key}`}" aria-pressed="${active}">${key}</button>`;
        }).join('');
        return `<div class="quick-assign"><small>Быстрая ячейка</small><div class="quick-assign-row">${buttons}</div></div>`;
    }
    chestHtml() {
        var _a, _b, _c, _d;
        const inventory = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.inventory) !== null && _b !== void 0 ? _b : [];
        const chest = (_d = (_c = this.snapshot) === null || _c === void 0 ? void 0 : _c.chest) !== null && _d !== void 0 ? _d : [];
        return `<div class="chest-layout"><section><span class="eyebrow">ВАША СУМКА</span><h3>Перенести в сундук</h3><div class="inventory-grid compact">${inventory.map((stack) => this.itemInventoryCard(stack.itemId, stack.quantity, false, true)).join('') || '<div class="empty-state">Сумка пуста</div>'}</div></section><div class="chest-divider">⇄</div><section><span class="eyebrow">ХРАНИЛИЩЕ</span><h3>Домашний сундук</h3><div class="inventory-grid compact">${chest.map((stack) => this.itemInventoryCard(stack.itemId, stack.quantity, true)).join('') || '<div class="empty-state">Сундук пуст</div>'}</div></section></div>`;
    }
    categoryLabel(category) {
        return { armor: 'Броня', amulet: 'Амулет', consumable: 'Расходник', material: 'Материал', quest: 'Задание' }[category];
    }
    shopHtml() {
        var _a, _b, _c, _d, _e;
        const owned = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.ownedWeapons) !== null && _b !== void 0 ? _b : [];
        const current = (_c = content_1.WEAPONS.find((weapon) => { var _a; return weapon.id === ((_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.equippedWeapon); })) !== null && _c !== void 0 ? _c : content_1.WEAPONS[0];
        return `<div class="shop-header"><div><span class="eyebrow">ОРУЖЕЙНАЯ РУНЫ</span><h3>Золото решает. Репутация открывает редкости.</h3><p>Сравните урон, скорость, дистанцию и преимущество против разных врагов.</p></div><div class="shop-wallet"><small>ВАШЕ ЗОЛОТО</small><strong>◆ ${(_e = (_d = this.snapshot) === null || _d === void 0 ? void 0 : _d.coins) !== null && _e !== void 0 ? _e : 0}</strong></div></div><div class="weapon-grid shop-grid">${content_1.WEAPONS.filter((weapon) => weapon.price > 0).map((weapon) => {
            var _a, _b, _c, _d, _e, _f;
            const isOwned = owned.includes(weapon.id);
            const locked = ((_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.reputation) !== null && _b !== void 0 ? _b : 0) < weapon.requiredRep;
            const affordable = ((_d = (_c = this.snapshot) === null || _c === void 0 ? void 0 : _c.coins) !== null && _d !== void 0 ? _d : 0) >= weapon.price;
            const visual = (0, weaponVisuals_1.getWeaponVisual)(weapon.id);
            const delta = weapon.damage - current.damage;
            return `<article class="weapon-card shop-weapon ${isOwned ? 'owned' : ''}" style="--accent:${weapon.accent}"><div class="weapon-art">${weapon.icon}</div><span>${weapon.kind.toUpperCase()} • ${visual.bonusLabel}</span><h3>${weapon.name}</h3><p>${weapon.description}</p><div class="compare-grid"><span>Урон <b>${weapon.damage}</b><em class="${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${delta}</em></span><span>Скорость <b>${(1000 / weapon.cooldown).toFixed(1)}/с</b></span><span>Дистанция <b>${weapon.range}</b></span><span>Требование <b>Реп. ${weapon.requiredRep}</b></span></div><div class="weapon-meta"><b>◆ ${weapon.price}</b><small>${isOwned ? 'В КОЛЛЕКЦИИ' : locked ? 'НЕДОСТАТОЧНО РЕПУТАЦИИ' : affordable ? 'ДОСТУПНО' : 'НЕ ХВАТАЕТ ЗОЛОТА'}</small></div><button data-buy="${weapon.id}" ${isOwned || locked || !affordable ? 'disabled' : ''}>${isOwned ? 'КУПЛЕНО' : locked ? `НУЖНА РЕП. ${weapon.requiredRep}` : !affordable ? `НУЖНО ◆ ${weapon.price}` : `КУПИТЬ ЗА ◆ ${weapon.price}`}</button>${isOwned ? `<button class="subtle-equip" data-equip="${weapon.id}" ${((_e = this.snapshot) === null || _e === void 0 ? void 0 : _e.equippedWeapon) === weapon.id ? 'disabled' : ''}>${((_f = this.snapshot) === null || _f === void 0 ? void 0 : _f.equippedWeapon) === weapon.id ? 'ЭКИПИРОВАНО' : 'ЭКИПИРОВАТЬ'}</button>` : ''}</article>`;
        }).join('')}</div>`;
    }
    passHtml() {
        var _a, _b, _c, _d;
        const reputation = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.reputation) !== null && _b !== void 0 ? _b : 0;
        const claimed = (_d = (_c = this.snapshot) === null || _c === void 0 ? void 0 : _c.claimedTiers) !== null && _d !== void 0 ? _d : [];
        return `<div class="pass-hero"><div><span>СЕЗОН I</span><h3>Путь изгнанника</h3><p>Все награды бесплатны. Выполняйте задания и повышайте репутацию.</p></div><div class="rep-orb"><strong>${reputation}</strong><small>РЕПУТАЦИЯ</small></div></div><div class="pass-track">${content_1.BATTLE_PASS.map((tier) => {
            const unlocked = reputation >= tier.reputation;
            const isClaimed = claimed.includes(tier.tier);
            return `<article class="pass-tier ${unlocked ? 'unlocked' : ''} ${isClaimed ? 'claimed' : ''}"><div class="tier-number">${tier.tier}</div><div class="tier-reward">${tier.weapon ? '✺' : tier.potions ? '♥' : '◆'}</div><h4>${tier.rewardLabel}</h4><small>${isClaimed ? 'ПОЛУЧЕНО' : `НУЖНО ${tier.reputation} РЕП.`}</small><button data-claim="${tier.tier}" ${!unlocked || isClaimed ? 'disabled' : ''}>${isClaimed ? '✓' : 'ЗАБРАТЬ'}</button></article>`;
        }).join('')}</div>`;
    }
    mapHtml() {
        const env = [this.timeLabel, this.weatherLabel].filter(Boolean).join(' • ') || '—';
        return `<div class="map-toolbar"><span class="eyebrow">КАРТА ДОЛИНЫ</span><span class="map-env" id="map-env">${env}</span></div><div class="world-map vector-map">${this.mapSvg(false)}<span class="map-player" id="map-player"><i></i>ВЫ</span></div><div class="map-legend"><span><i class="safe"></i> Безопасная зона</span><span><i class="danger"></i> Опасная зона</span><span><b>▤</b> Интерьер</span><span><b>✦</b> Разлом</span><span><b>╫</b> Мост</span><span><b>◈</b> Тайна</span><span><b>†</b> Цель</span></div>`;
    }
    /** Radial-gradient + texture defs, keyed by danger, so regions aren't flat. */
    mapDefs() {
        // One soft radial per danger tier (lit centre, darker rim) plus a faint
        // fractal-noise turbulence used as a ground-texture overlay on each region.
        const grads = [
            { id: 'mapg0', a: '#61684f', b: '#3f4436' },
            { id: 'mapg1', a: '#3f5f52', b: '#25382f' },
            { id: 'mapg2', a: '#5b4a62', b: '#332a3c' },
            { id: 'mapg3', a: '#74434b', b: '#3c2329' },
        ].map((g) => `<radialGradient id="${g.id}" cx="38%" cy="32%" r="80%"><stop offset="0%" stop-color="${g.a}"></stop><stop offset="100%" stop-color="${g.b}"></stop></radialGradient>`).join('');
        const texture = `<filter id="map-grain" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n"></feTurbulence><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"></feColorMatrix><feComposite operator="in" in2="SourceGraphic"></feComposite></filter>`;
        return `<defs>${grads}${texture}</defs>`;
    }
    mapSvg(mini) {
        var _a, _b, _c, _d, _e;
        const discovered = new Set((_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.discoveredLocations) !== null && _b !== void 0 ? _b : ['home', 'village']);
        const foundSecrets = new Set((_d = (_c = this.snapshot) === null || _c === void 0 ? void 0 : _c.discoveredSecrets) !== null && _d !== void 0 ? _d : []);
        const defs = mini ? '' : this.mapDefs();
        const river = `<polygon class="map-vector-river" points="${world_1.MAP_RIVER}"></polygon>`;
        const roads = world_1.MAP_ROADS.map((road) => `<polyline class="map-vector-road" points="${road.map(([x, y]) => `${x},${y}`).join(' ')}"></polyline>`).join('');
        const regions = world_1.MAP_SHAPES.map((shape) => {
            const known = discovered.has(shape.id);
            const classes = `map-zone map-region danger-${shape.danger} ${known ? 'discovered' : 'undiscovered'}`;
            // Discovered regions get a gradient fill + a grain texture overlay so the
            // terrain reads as shaded ground; undiscovered stay dark and flat.
            const fill = !mini && known ? ` style="fill:url(#mapg${shape.danger})"` : '';
            const grain = !mini && known ? `<polygon class="map-grain-layer" points="${shape.points}" filter="url(#map-grain)"></polygon>` : '';
            const label = mini ? '' : `<text x="${shape.labelX}" y="${shape.labelY}" class="map-label">${known ? shape.label : 'НЕИЗВЕДАННО'}</text>${known ? `<text x="${shape.labelX}" y="${shape.labelY + 78}" class="map-danger-label">${shape.danger ? `ОПАСНОСТЬ ${'◆'.repeat(shape.danger)}` : 'БЕЗОПАСНАЯ ЗОНА'}</text>` : ''}`;
            return `<g><polygon class="${classes}" data-region="${shape.id}" points="${shape.points}"${fill}></polygon>${grain}${label}</g>`;
        }).join('');
        // Bridges (and the ford, once found) drawn as short decks straddling the river.
        const crossings = mini ? '' : [
            ...world_1.RIVER_BRIDGES.map((bridge) => ({ x: bridge.x, y: bridge.y, glyph: '╫', shown: true, label: bridge.name })),
            { x: world_1.HIDDEN_FORD.x, y: world_1.HIDDEN_FORD.y, glyph: '≈', shown: foundSecrets.has('reed_ford'), label: world_1.HIDDEN_FORD.name },
        ].filter((c) => c.shown).map((c) => `<g class="map-bridge"><rect x="${c.x - 150}" y="${c.y - 34}" width="300" height="68" rx="8"></rect><text x="${c.x}" y="${c.y + 20}">${c.glyph}</text></g>`).join('');
        const interiors = mini ? '' : world_1.BUILDINGS.filter((building) => building.interior).map((building) => `<g class="map-poi"><rect x="${building.x - 28}" y="${building.y - 28}" width="56" height="56"></rect><text x="${building.x}" y="${building.y + 12}">▤</text><text x="${building.x}" y="${building.y - 40}" class="map-poi-name">${building.name}</text></g>`).join('');
        const rifts = world_1.RIFT_POINTS.map((rift) => `<g class="map-rift"><circle cx="${rift.x}" cy="${rift.y}" r="${mini ? 42 : 58}"></circle>${mini ? '' : `<text x="${rift.x}" y="${rift.y + 15}">✦</text>`}</g>`).join('');
        // Secrets only appear once discovered.
        const secrets = mini ? '' : world_1.SECRET_POINTS.filter((secret) => foundSecrets.has(secret.id)).map((secret) => `<g class="map-secret"><circle cx="${secret.x}" cy="${secret.y}" r="34"></circle><text x="${secret.x}" y="${secret.y + 14}">◈</text><text x="${secret.x}" y="${secret.y - 44}" class="map-secret-name">${secret.name}</text></g>`).join('');
        // Discovered shortcut mouths, with a dotted link between the two ends.
        const shortcuts = mini ? '' : world_1.SHORTCUT_PORTALS.map((shortcut) => {
            const aFound = foundSecrets.has(`${shortcut.id}_a`);
            const bFound = foundSecrets.has(`${shortcut.id}_b`);
            const link = aFound && bFound ? `<line class="map-shortcut-link" x1="${shortcut.a.x}" y1="${shortcut.a.y}" x2="${shortcut.b.x}" y2="${shortcut.b.y}"></line>` : '';
            const mouths = ([['a', shortcut.a], ['b', shortcut.b]]).filter(([side]) => foundSecrets.has(`${shortcut.id}_${side}`)).map(([, point]) => `<g class="map-secret"><circle cx="${point.x}" cy="${point.y}" r="32"></circle><text x="${point.x}" y="${point.y + 13}">⇲</text></g>`).join('');
            return `${link}${mouths}`;
        }).join('');
        // The current objective, pinned on the full map.
        const objective = (_e = this.snapshot) === null || _e === void 0 ? void 0 : _e.objectivePoint;
        const objectivePin = !mini && objective ? `<g class="map-objective"><circle cx="${objective.x}" cy="${objective.y}" r="46"></circle><text x="${objective.x}" y="${objective.y + 22}">†</text></g>` : '';
        // Minimap keeps `none` (its wrapper is fixed-size and the player marker is
        // positioned by container-percentage, which assumes an edge-to-edge fill).
        // The full world map preserves aspect ratio; its container is given the
        // world's 4600:3000 ratio in CSS so `meet` fills it exactly with no
        // letterboxing, keeping the #map-player percentage placement correct.
        const aspect = mini ? 'none' : 'xMidYMid meet';
        return `<svg class="${mini ? 'minimap-svg' : 'world-map-svg'}" viewBox="0 0 ${world_1.WORLD_WIDTH} ${world_1.WORLD_HEIGHT}" preserveAspectRatio="${aspect}" aria-hidden="true">${defs}<rect class="map-vector-bg" width="${world_1.WORLD_WIDTH}" height="${world_1.WORLD_HEIGHT}"></rect>${river}${roads}${regions}${crossings}${interiors}${rifts}${secrets}${shortcuts}${objectivePin}</svg>`;
    }
    pauseHtml() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const settings = (_a = this.save) === null || _a === void 0 ? void 0 : _a.settings;
        const slider = (key, label) => { var _a, _b; return `<label class="volume-row"><span>${label}<b>${Math.round(((_a = settings === null || settings === void 0 ? void 0 : settings[key]) !== null && _a !== void 0 ? _a : 0) * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${(_b = settings === null || settings === void 0 ? void 0 : settings[key]) !== null && _b !== void 0 ? _b : 0}" data-volume="${key}"></label>`; };
        return `<div class="pause-layout v2"><div class="pause-copy"><span class="eyebrow">ВЕРСИЯ 4 • ОРУЖЕЙНЫЙ РЫВОК</span><p>Прогресс сохраняется автоматически, включая инвентарь, экипировку, открытые районы и текущую сцену.</p><dl><div><dt>Уровень</dt><dd>${(_c = (_b = this.snapshot) === null || _b === void 0 ? void 0 : _b.level) !== null && _c !== void 0 ? _c : 1}</dd></div><div><dt>Репутация</dt><dd>${(_e = (_d = this.snapshot) === null || _d === void 0 ? void 0 : _d.reputation) !== null && _e !== void 0 ? _e : 0}</dd></div><div><dt>Открыто районов</dt><dd>${(_g = (_f = this.snapshot) === null || _f === void 0 ? void 0 : _f.discoveredLocations.length) !== null && _g !== void 0 ? _g : 0}/9</dd></div><div><dt>Заданий завершено</dt><dd>${(_j = (_h = this.snapshot) === null || _h === void 0 ? void 0 : _h.quests.filter((q) => q.status === 'completed').length) !== null && _j !== void 0 ? _j : 0}</dd></div></dl></div><div class="audio-settings"><h3>Звук</h3>${slider('masterVolume', 'Общая громкость')}${slider('musicVolume', 'Музыка')}${slider('sfxVolume', 'Эффекты')}${slider('ambienceVolume', 'Окружение')}<button data-toggle-sound>${(settings === null || settings === void 0 ? void 0 : settings.sound) ? 'ВЫКЛЮЧИТЬ ВЕСЬ ЗВУК' : 'ВКЛЮЧИТЬ ЗВУК'}</button></div><div class="pause-actions"><button data-resume>ПРОДОЛЖИТЬ</button><button data-toggle-motion>${(settings === null || settings === void 0 ? void 0 : settings.reducedMotion) ? 'АНИМАЦИИ: МИНИМУМ' : 'АНИМАЦИИ: ПОЛНЫЕ'}</button><button data-toggle-quality>КАЧЕСТВО: ${((_k = settings === null || settings === void 0 ? void 0 : settings.quality) !== null && _k !== void 0 ? _k : 'auto').toUpperCase()}</button><button data-fullscreen>ПОЛНЫЙ ЭКРАН</button><button class="danger" data-reset>НАЧАТЬ ЗАНОВО</button></div><div class="controls-card"><h3>Управление</h3><p><kbd>WASD</kbd> Движение</p><p><kbd>E</kbd> Действие / дверь</p><p><kbd>ЛКМ</kbd> / <kbd>Space</kbd> Атака</p><p><kbd>F</kbd> Быстрое зелье</p><p><kbd>Q I M B</kbd> Меню</p></div></div>`;
    }
    // --- Crafting + weapon reinforcement -----------------------------------
    materialCount(itemId) {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.inventory.find((stack) => stack.itemId === itemId)) === null || _b === void 0 ? void 0 : _b.quantity) !== null && _c !== void 0 ? _c : 0;
    }
    craftHtml() {
        const snapshot = this.snapshot;
        if (!snapshot || !this.save)
            return '<div class="empty-state">Мастерская загружается…</div>';
        const coins = snapshot.coins;
        const reputation = snapshot.reputation;
        const recipes = crafting_1.RECIPES.map((recipe) => {
            var _a;
            const item = (0, items_1.getItem)(recipe.output.itemId);
            const repLocked = Boolean(recipe.requiredRep && reputation < recipe.requiredRep);
            const coinsShort = Boolean(recipe.coins && coins < recipe.coins);
            const mats = recipe.materials.map((mat) => {
                var _a, _b;
                const material = (0, items_1.getItem)(mat.itemId);
                const have = this.materialCount(mat.itemId);
                const enough = have >= mat.quantity;
                return `<span class="ingredient ${enough ? '' : 'short'}"><em>${(_a = material === null || material === void 0 ? void 0 : material.icon) !== null && _a !== void 0 ? _a : '◆'}</em>${(_b = material === null || material === void 0 ? void 0 : material.name) !== null && _b !== void 0 ? _b : mat.itemId}<b>${have}/${mat.quantity}</b></span>`;
            }).join('');
            const canCraft = !repLocked && !coinsShort && recipe.materials.every((mat) => this.materialCount(mat.itemId) >= mat.quantity);
            const status = repLocked ? `НУЖНА РЕП. ${recipe.requiredRep}` : coinsShort ? `НУЖНО ◆ ${recipe.coins}` : canCraft ? 'ГОТОВО К СОЗДАНИЮ' : 'НЕ ХВАТАЕТ МАТЕРИАЛОВ';
            return `<article class="craft-recipe ${canCraft ? 'ready' : 'blocked'}" style="--rarity:${item ? items_1.RARITY_COLOR[item.rarity] : '#a9adb8'}">
        <div class="craft-icon">${(_a = item === null || item === void 0 ? void 0 : item.icon) !== null && _a !== void 0 ? _a : '⚗'}${recipe.output.quantity > 1 ? `<em>${recipe.output.quantity}</em>` : ''}</div>
        <div class="craft-copy"><small>${recipe.kind === 'consumable' ? 'РАСХОДНИК' : 'ЭКИПИРОВКА'} • ${status}</small><b>${recipe.name}</b><p>${recipe.description}</p>
          <div class="ingredient-row">${mats}${recipe.coins ? `<span class="ingredient ${coinsShort ? 'short' : ''}"><em>◆</em>Золото<b>${coins}/${recipe.coins}</b></span>` : ''}</div>
        </div>
        <button data-craft="${recipe.id}" ${canCraft ? '' : 'disabled'}>${canCraft ? 'СОЗДАТЬ' : '—'}</button>
      </article>`;
        }).join('');
        return `<div class="craft-layout">
      <section class="craft-section">
        <div class="panel-intro split"><p>Материалы, что копятся в сумке, превращаются в зелья и снаряжение. Красным отмечено то, чего не хватает.</p><div class="bag-meta"><span>◆ ${coins}</span><span>Реп. ${reputation}</span></div></div>
        <h3 class="inventory-section-title">Рецепты</h3>
        <div class="craft-list">${recipes || '<div class="empty-state">Рецепты недоступны.</div>'}</div>
      </section>
      <section class="upgrade-section">
        <span class="eyebrow">УСИЛЕНИЕ ОРУЖИЯ</span><h3 class="upgrade-title">Кузница Руны</h3>
        <p class="upgrade-hint">Реликтовые материалы усиливают клинки. Максимум +${crafting_1.MAX_WEAPON_UPGRADE}.</p>
        <div class="upgrade-list">${this.weaponUpgradeCards()}</div>
      </section>
    </div>`;
    }
    weaponUpgradeCards() {
        var _a, _b, _c, _d;
        const owned = (_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.ownedWeapons) !== null && _b !== void 0 ? _b : [];
        const coins = (_d = (_c = this.snapshot) === null || _c === void 0 ? void 0 : _c.coins) !== null && _d !== void 0 ? _d : 0;
        const list = content_1.WEAPONS.filter((weapon) => owned.includes(weapon.id));
        if (!list.length)
            return '<div class="empty-state">Сначала получите оружие.</div>';
        return list.map((weapon) => {
            var _a, _b;
            const level = (_b = (_a = this.save) === null || _a === void 0 ? void 0 : _a.weaponUpgrades[weapon.id]) !== null && _b !== void 0 ? _b : 0;
            const currentDamage = Math.round(weapon.damage * (1 + (0, crafting_1.upgradeDamagePct)(level) / 100));
            const pips = Array.from({ length: crafting_1.MAX_WEAPON_UPGRADE }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
            const nextTier = level < crafting_1.MAX_WEAPON_UPGRADE ? crafting_1.WEAPON_UPGRADE_TIERS.find((tier) => tier.level === level + 1) : undefined;
            let footer;
            let canUpgrade = false;
            if (!nextTier) {
                footer = '<div class="upgrade-max">УСИЛЕНО ДО ПРЕДЕЛА</div>';
            }
            else {
                const nextDamage = Math.round(weapon.damage * (1 + nextTier.damageBonusPct / 100));
                const delta = nextDamage - currentDamage;
                const coinsShort = coins < nextTier.coins;
                const mats = nextTier.materials.map((mat) => {
                    var _a, _b;
                    const material = (0, items_1.getItem)(mat.itemId);
                    const have = this.materialCount(mat.itemId);
                    const enough = have >= mat.quantity;
                    return `<span class="ingredient ${enough ? '' : 'short'}"><em>${(_a = material === null || material === void 0 ? void 0 : material.icon) !== null && _a !== void 0 ? _a : '◆'}</em>${(_b = material === null || material === void 0 ? void 0 : material.name) !== null && _b !== void 0 ? _b : mat.itemId}<b>${have}/${mat.quantity}</b></span>`;
                }).join('');
                canUpgrade = !coinsShort && nextTier.materials.every((mat) => this.materialCount(mat.itemId) >= mat.quantity);
                footer = `<div class="upgrade-cost">
            <div class="upgrade-delta">До +${nextTier.level}<b class="positive">Урон ${currentDamage} → ${nextDamage} (+${delta})</b></div>
            <div class="ingredient-row">${mats}<span class="ingredient ${coinsShort ? 'short' : ''}"><em>◆</em>Золото<b>${coins}/${nextTier.coins}</b></span></div>
          </div>`;
            }
            return `<article class="upgrade-card" style="--accent:${weapon.accent}">
        <div class="upgrade-head"><div class="upgrade-art">${weapon.icon}</div><div><small>${weapon.kind.toUpperCase()} • УРОН ${currentDamage}</small><b>${weapon.name} ${level > 0 ? `<span class="upgrade-level">+${level}</span>` : ''}</b><div class="upgrade-pips">${pips}</div></div></div>
        ${footer}
        ${nextTier ? `<button data-upgrade="${weapon.id}" ${canUpgrade ? '' : 'disabled'}>${canUpgrade ? `УСИЛИТЬ ЗА ◆ ${nextTier.coins}` : 'НЕ ХВАТАЕТ РЕСУРСОВ'}</button>` : ''}
      </article>`;
        }).join('');
    }
    // --- Bestiary ----------------------------------------------------------
    bestiaryHtml() {
        if (!this.save)
            return '<div class="empty-state">Бестиарий загружается…</div>';
        const ids = Object.keys(content_1.ENEMIES);
        const discovered = ids.filter((id) => { var _a, _b; return ((_b = (_a = this.save) === null || _a === void 0 ? void 0 : _a.bestiary[id]) !== null && _b !== void 0 ? _b : 0) >= BESTIARY_APPEARANCE_AT; }).length;
        const totalKills = Object.values(this.save.bestiary).reduce((sum, n) => sum + n, 0);
        const cards = ids.map((id) => this.bestiaryCard(id)).join('');
        return `<div class="bestiary-summary">
        <div><span class="eyebrow">ИЗУЧЕНО СУЩЕСТВ</span><strong>${discovered}<em>/${ids.length}</em></strong></div>
        <div class="discovery-meter" aria-label="Прогресс изучения"><i style="width:${discovered / ids.length * 100}%"></i></div>
        <div class="bestiary-kills"><small>ВСЕГО УБИТО</small><b>${totalKills}</b></div>
      </div>
      <div class="bestiary-grid">${cards}</div>`;
    }
    bestiaryCard(enemyId) {
        var _a, _b, _c, _d, _e;
        const enemy = content_1.ENEMIES[enemyId];
        const kills = (_b = (_a = this.save) === null || _a === void 0 ? void 0 : _a.bestiary[enemyId]) !== null && _b !== void 0 ? _b : 0;
        const appearance = kills >= BESTIARY_APPEARANCE_AT;
        const statsKnown = kills >= BESTIARY_STATS_AT;
        const weaknessKnown = kills >= BESTIARY_WEAKNESS_AT;
        const lore = (0, bestiary_1.getBestiaryLore)(enemyId);
        const isBoss = ((_c = enemy.scale) !== null && _c !== void 0 ? _c : 1) >= 1.4;
        const accent = `#${enemy.tint.toString(16).padStart(6, '0')}`;
        if (!appearance) {
            // Undiscovered: silhouette + "?" and the next threshold as a nudge.
            return `<article class="beast-card locked ${isBoss ? 'boss' : ''}">
        <div class="beast-portrait"><span class="beast-silhouette" style="--tint:${accent}">?</span></div>
        <div class="beast-body"><small>НЕ ИЗУЧЕНО</small><b>???</b><p>Сразите это существо, чтобы занести его в летопись.</p></div>
        <div class="beast-progress"><span class="reveal-step">Открытие при 1 победе</span></div>
      </article>`;
        }
        const stats = statsKnown
            ? `<div class="beast-stats"><span>❤ <b>${enemy.health}</b></span><span>⚔ <b>${enemy.damage}</b></span><span>➤ <b>${enemy.speed}</b></span></div>`
            : `<div class="beast-stats locked-stats"><span class="reveal-step">Характеристики при ${BESTIARY_STATS_AT} победах</span></div>`;
        const weakness = weaknessKnown
            ? `<div class="beast-weakness"><small>СЛАБОСТЬ</small><p>${(_d = lore === null || lore === void 0 ? void 0 : lore.weakness) !== null && _d !== void 0 ? _d : '—'}</p></div>`
            : `<div class="beast-weakness locked-weakness"><span class="reveal-step">Слабость при ${BESTIARY_WEAKNESS_AT} победах</span></div>`;
        return `<article class="beast-card ${isBoss ? 'boss' : ''}" style="--tint:${accent}">
      <div class="beast-portrait"><span class="beast-glyph">${isBoss ? '☠' : '◈'}</span><b class="beast-kills">×${kills}</b></div>
      <div class="beast-body"><small>${isBoss ? 'ВЛАДЫКА' : 'СУЩЕСТВО'}</small><b>${enemy.name}</b><p>${(_e = lore === null || lore === void 0 ? void 0 : lore.lore) !== null && _e !== void 0 ? _e : ''}</p></div>
      ${stats}
      ${weakness}
    </article>`;
    }
    // --- Achievements ------------------------------------------------------
    achievementsHtml() {
        if (!this.save)
            return '<div class="empty-state">Награды загружаются…</div>';
        const owned = new Set(this.save.achievements);
        const total = achievements_1.ACHIEVEMENTS.length;
        const unlocked = achievements_1.ACHIEVEMENTS.filter((achievement) => owned.has(achievement.id)).length;
        const groups = achievementCategoryOrder.map((category) => {
            const list = achievements_1.ACHIEVEMENTS.filter((achievement) => achievement.category === category);
            if (!list.length)
                return '';
            const gotInGroup = list.filter((achievement) => owned.has(achievement.id)).length;
            const cards = list.map((achievement) => {
                const isUnlocked = owned.has(achievement.id);
                const masked = Boolean(achievement.hidden) && !isUnlocked;
                const name = masked ? '???' : achievement.name;
                const description = masked ? 'Тайное свершение — раскроется, когда будет достигнуто.' : achievement.description;
                return `<article class="achievement ${isUnlocked ? 'unlocked' : 'locked'} ${masked ? 'masked' : ''}">
          <div class="achievement-icon">${masked ? '?' : achievement.icon}</div>
          <div class="achievement-copy"><b>${name}</b><p>${description}</p></div>
          <span class="achievement-state">${isUnlocked ? '✓' : masked ? '?' : '🔒'}</span>
        </article>`;
            }).join('');
            return `<section class="achievement-group"><header class="achievement-group-head"><h3>${achievementCategoryLabel[category]}</h3><span>${gotInGroup}/${list.length}</span></header><div class="achievement-grid">${cards}</div></section>`;
        }).join('');
        return `<div class="achievement-summary">
        <div><span class="eyebrow">СВЕРШЕНИЯ</span><strong>${unlocked}<em>/${total}</em></strong></div>
        <div class="discovery-meter" aria-label="Общий прогресс наград"><i style="width:${unlocked / total * 100}%"></i></div>
        <div class="bestiary-kills"><small>ЗАВЕРШЕНО</small><b>${Math.round(unlocked / total * 100)}%</b></div>
      </div>
      ${groups}`;
    }
    // --- Styled confirmation (replaces window.confirm) ---------------------
    confirmHtml() {
        if (!this.pendingConfirm)
            return '';
        const { message, confirmLabel } = this.pendingConfirm;
        return `<div class="confirm-overlay" role="alertdialog" aria-modal="true"><div class="confirm-box"><span class="eyebrow">ПОДТВЕРЖДЕНИЕ</span><p>${message}</p><div class="confirm-actions"><button class="subtle" data-confirm-cancel>ОТМЕНА</button><button class="danger" data-confirm-accept>${confirmLabel}</button></div></div></div>`;
    }
    bindPanelActions() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.root.querySelectorAll('[data-equip]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('equip', button.dataset.equip)));
        this.root.querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('buy', button.dataset.buy)));
        this.root.querySelectorAll('[data-claim]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('claim-tier', Number(button.dataset.claim))));
        this.root.querySelectorAll('[data-equip-item]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('equip-item', button.dataset.equipItem)));
        this.root.querySelectorAll('[data-use-item]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('use-item', button.dataset.useItem)));
        this.root.querySelectorAll('[data-quick-assign]').forEach((button) => button.addEventListener('click', () => {
            var _a, _b, _c;
            const itemId = button.dataset.quickAssign;
            const slot = Number(button.dataset.slot);
            // Clicking the slot this item already occupies clears it; otherwise bind.
            const current = (_c = ((_b = (_a = this.snapshot) === null || _a === void 0 ? void 0 : _a.equipment.quick) !== null && _b !== void 0 ? _b : [])[slot]) !== null && _c !== void 0 ? _c : null;
            if (current === itemId)
                events_1.GameEvents.emit('clear-quick-slot', slot);
            else
                events_1.GameEvents.emit('assign-quick-slot', { itemId, slot });
        }));
        this.root.querySelectorAll('[data-transfer-item]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('transfer-item', { itemId: button.dataset.transferItem, direction: button.dataset.direction })));
        this.root.querySelectorAll('[data-volume]').forEach((input) => input.addEventListener('input', () => {
            var _a;
            const value = Number(input.value);
            const label = (_a = input.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('b');
            if (label)
                label.textContent = `${Math.round(value * 100)}%`;
            events_1.GameEvents.emit('set-volume', { key: input.dataset.volume, value });
        }));
        (_a = this.root.querySelector('[data-resume]')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => this.closePanel());
        (_b = this.root.querySelector('[data-toggle-sound]')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => events_1.GameEvents.emit('toggle-sound'));
        (_c = this.root.querySelector('[data-toggle-motion]')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => events_1.GameEvents.emit('toggle-motion'));
        (_d = this.root.querySelector('[data-toggle-quality]')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => events_1.GameEvents.emit('toggle-quality'));
        (_e = this.root.querySelector('[data-fullscreen]')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => events_1.GameEvents.emit('fullscreen'));
        this.root.querySelectorAll('[data-craft]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('craft-recipe', button.dataset.craft)));
        this.root.querySelectorAll('[data-upgrade]').forEach((button) => button.addEventListener('click', () => events_1.GameEvents.emit('upgrade-weapon', button.dataset.upgrade)));
        (_f = this.root.querySelector('[data-reset]')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => this.requestConfirm('Удалить весь прогресс Trupy и начать заново? Это действие необратимо.', 'reset-game', 'НАЧАТЬ ЗАНОВО'));
        (_g = this.root.querySelector('[data-confirm-cancel]')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', () => this.dismissConfirm());
        (_h = this.root.querySelector('[data-confirm-accept]')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', () => {
            const confirm = this.pendingConfirm;
            this.pendingConfirm = undefined;
            // Drop the overlay before the action runs (harmless if the action, e.g.
            // reset-game, reloads the page immediately afterwards).
            if (this.activePanel)
                this.renderPanel(this.activePanel);
            if (confirm)
                events_1.GameEvents.emit(confirm.event);
        });
    }
    requestConfirm(message, event, confirmLabel) {
        this.pendingConfirm = { message, event, confirmLabel };
        if (this.activePanel)
            this.renderPanel(this.activePanel);
    }
    dismissConfirm() {
        this.pendingConfirm = undefined;
        if (this.activePanel)
            this.renderPanel(this.activePanel);
    }
    showDialogue(payload) {
        var _a, _b;
        this.closePanel();
        const layer = this.root.querySelector('#dialogue-layer');
        layer === null || layer === void 0 ? void 0 : layer.setAttribute('aria-hidden', 'false');
        this.text('#dialogue-speaker', payload.speaker);
        this.text('#dialogue-subtitle', (_a = payload.subtitle) !== null && _a !== void 0 ? _a : 'ЖИТЕЛЬ ДОЛИНЫ');
        this.text('#dialogue-text', payload.text);
        const portrait = this.root.querySelector('#dialogue-portrait');
        if (portrait) {
            portrait.textContent = payload.speaker.charAt(0);
            portrait.style.setProperty('--dialogue-accent', (_b = payload.accent) !== null && _b !== void 0 ? _b : '#b78cff');
        }
        const actions = this.root.querySelector('#dialogue-actions');
        if (actions) {
            actions.innerHTML = payload.actions.map((action, index) => `<button data-dialogue-index="${index}" class="${action.primary ? 'primary' : ''}">${action.label}</button>`).join('');
            actions.querySelectorAll('[data-dialogue-index]').forEach((button) => button.addEventListener('click', () => {
                const action = payload.actions[Number(button.dataset.dialogueIndex)];
                if (action.event === 'close')
                    this.closeDialogue();
                else
                    events_1.GameEvents.emit(action.event, action.payload);
            }));
        }
        events_1.GameEvents.emit('ui-lock', true);
    }
    closeDialogue() {
        const layer = this.root.querySelector('#dialogue-layer');
        if ((layer === null || layer === void 0 ? void 0 : layer.getAttribute('aria-hidden')) === 'false') {
            layer.setAttribute('aria-hidden', 'true');
            events_1.GameEvents.emit('ui-lock', false);
        }
    }
    showTutorial(tip) {
        const element = this.root.querySelector('#tutorial-tip');
        if (!element)
            return;
        if (!tip)
            return element.classList.add('hidden');
        element.classList.remove('hidden');
        const step = element.querySelector('.tutorial-step');
        const title = element.querySelector('strong');
        const text = element.querySelector('p');
        if (step)
            step.textContent = `ОБУЧЕНИЕ ${tip.step}/5`;
        if (title)
            title.textContent = tip.title;
        if (text)
            text.textContent = tip.text;
    }
    showRiftStatus(status) {
        const banner = this.root.querySelector('#rift-banner');
        if (!banner)
            return;
        if (!status) {
            banner.classList.remove('visible');
            return;
        }
        this.text('#rift-name', status.name);
        this.text('#rift-progress', `Волна ${status.wave}/3 • осталось ${status.remaining}`);
        banner.classList.add('visible');
    }
    showAbilityCooldown(dash, special, dashMax, specialMax) {
        const dashButton = this.root.querySelector('.ability-slot.dash');
        const specialButton = this.root.querySelector('.ability-slot.special');
        const mobileDash = this.root.querySelector('.mobile-button.dash');
        const mobileSpecial = this.root.querySelector('.mobile-button.special');
        // Remember the cooldown span so the sweep can read a fraction. If the scene
        // supplies a max use it; otherwise infer it from the highest remaining value.
        if (dashMax && dashMax > 0)
            this.dashCooldownMax = dashMax;
        else if (dash > this.dashCooldownMax)
            this.dashCooldownMax = dash;
        if (specialMax && specialMax > 0)
            this.specialCooldownMax = specialMax;
        else if (special > this.specialCooldownMax)
            this.specialCooldownMax = special;
        const dashFraction = dash > 0 && this.dashCooldownMax > 0 ? Math.max(0, Math.min(1, dash / this.dashCooldownMax)) : 0;
        const specialFraction = special > 0 && this.specialCooldownMax > 0 ? Math.max(0, Math.min(1, special / this.specialCooldownMax)) : 0;
        this.text('#dash-cooldown', dash > 0 ? dash.toFixed(1) : '');
        this.text('#special-cooldown', special > 0 ? special.toFixed(1) : '');
        [dashButton, mobileDash].forEach((button) => {
            button === null || button === void 0 ? void 0 : button.classList.toggle('ready', dash <= 0);
            // The sweep angle: 0 when ready, 360deg worth of "used" wiping away as it recovers.
            button === null || button === void 0 ? void 0 : button.style.setProperty('--cooldown', `${(1 - dashFraction) * 360}deg`);
            button === null || button === void 0 ? void 0 : button.classList.toggle('cooling', dashFraction > 0);
        });
        [specialButton, mobileSpecial].forEach((button) => {
            button === null || button === void 0 ? void 0 : button.classList.toggle('ready', special <= 0);
            button === null || button === void 0 ? void 0 : button.style.setProperty('--cooldown', `${(1 - specialFraction) * 360}deg`);
            button === null || button === void 0 ? void 0 : button.classList.toggle('cooling', specialFraction > 0);
        });
    }
    showCombo(hits, multiplier) {
        const banner = this.root.querySelector('#combo-banner');
        if (!banner)
            return;
        if (hits <= 0) {
            banner.classList.remove('visible');
            banner.removeAttribute('data-tier');
            return;
        }
        this.text('#combo-hits', hits.toString());
        this.text('#combo-multiplier', `×${multiplier.toFixed(2)}`);
        // Escalation tiers drive scale + colour heat via CSS. Tier grows with the
        // streak so a 12-hit run reads very differently from a 2-hit one. A capped
        // --combo-scale gives the number visible growth without breaking layout.
        const tier = hits >= 12 ? 4 : hits >= 9 ? 3 : hits >= 6 ? 2 : hits >= 3 ? 1 : 0;
        banner.dataset.tier = String(tier);
        banner.style.setProperty('--combo-scale', (1 + Math.min(hits, 15) * 0.035).toFixed(3));
        banner.classList.toggle('hot', hits >= 6);
        banner.classList.add('visible');
        // Re-trigger the shake at 6+ by toggling the animation class on each hit.
        if (hits >= 6 && !this.reducedMotion) {
            banner.classList.remove('shake');
            // Force reflow so the animation restarts even on consecutive hits.
            void banner.offsetWidth;
            banner.classList.add('shake');
        }
    }
    // --- Boss health bar ---------------------------------------------------
    showBossEngage(payload) {
        var _a;
        const bar = this.root.querySelector('#boss-bar');
        if (!bar)
            return;
        this.bossMaxHealth = Math.max(1, payload.maxHealth);
        this.bossPhases = Math.max(1, Math.floor((_a = payload.phases) !== null && _a !== void 0 ? _a : 1));
        this.text('#boss-name', payload.name);
        this.width('#boss-fill', 100);
        // Phase dividers: N phases means N-1 internal separators laid over the track.
        const segments = this.root.querySelector('#boss-segments');
        if (segments) {
            segments.innerHTML = this.bossPhases > 1
                ? Array.from({ length: this.bossPhases - 1 }, (_, i) => `<span style="left:${(i + 1) / this.bossPhases * 100}%"></span>`).join('')
                : '';
        }
        bar.classList.remove('phase-shift');
        bar.setAttribute('aria-hidden', 'false');
        bar.classList.add('engaged');
    }
    showBossHealth(payload) {
        const bar = this.root.querySelector('#boss-bar');
        if (!bar || bar.getAttribute('aria-hidden') === 'true')
            return;
        const fraction = Math.max(0, Math.min(1, payload.health / this.bossMaxHealth));
        this.width('#boss-fill', fraction * 100);
        if (typeof payload.phase === 'number') {
            bar.dataset.phase = String(payload.phase);
            // Brief flare when a phase boundary is crossed.
            bar.classList.remove('phase-shift');
            void bar.offsetWidth;
            bar.classList.add('phase-shift');
        }
    }
    hideBoss() {
        const bar = this.root.querySelector('#boss-bar');
        if (!bar)
            return;
        bar.classList.add('defeated');
        bar.classList.remove('engaged');
        window.setTimeout(() => {
            bar.setAttribute('aria-hidden', 'true');
            bar.classList.remove('defeated', 'phase-shift');
        }, this.reducedMotion ? 0 : 900);
    }
    // --- Environment (clock + weather) -------------------------------------
    showEnvironment(env) {
        if (typeof env.time === 'string')
            this.timeLabel = env.time;
        if (typeof env.weather === 'string')
            this.weatherLabel = env.weather;
        this.text('#env-time', this.timeLabel || '—');
        this.text('#env-weather', this.weatherLabel || '—');
        // Pick a glanceable glyph from the time-of-day label (server sends the
        // localized string from Lighting/Weather; match on its known keywords).
        const time = this.timeLabel.toUpperCase();
        const weather = this.weatherLabel.toUpperCase();
        let icon = '☾';
        if (weather.includes('ГРОЗА'))
            icon = '⚡';
        else if (weather.includes('ДОЖДЬ'))
            icon = '☔';
        else if (weather.includes('ТУМАН'))
            icon = '≋';
        else if (weather.includes('ПЕПЕЛ'))
            icon = '❄';
        else if (weather.includes('ПАСМУРНО'))
            icon = '☁';
        else if (time.includes('ДЕНЬ') || time.includes('ПОЛУДН') || time.includes('УТРО'))
            icon = '☀';
        else if (time.includes('РАССВЕТ') || time.includes('ЗАКАТ') || time.includes('СУМЕРК'))
            icon = '☼';
        else
            icon = '☾';
        this.text('#env-icon', icon);
        // Tint the widget by day/night for an at-a-glance read.
        const widget = this.root.querySelector('#env-widget');
        const isNight = time.includes('НОЧЬ') || time.includes('СУМЕРК');
        widget === null || widget === void 0 ? void 0 : widget.classList.toggle('night', isNight);
        widget === null || widget === void 0 ? void 0 : widget.classList.toggle('day', !isNight);
        // Keep the open map's time/weather line in sync.
        const mapEnv = this.root.querySelector('#map-env');
        if (mapEnv)
            mapEnv.textContent = [this.timeLabel, this.weatherLabel].filter(Boolean).join(' • ') || '—';
    }
    // --- Damage-flash vignette ---------------------------------------------
    showHurt(severity) {
        const vignette = this.root.querySelector('#hurt-vignette');
        if (!vignette)
            return;
        // Severity scales the flash strength; clamp so a big hit is intense but the
        // screen never goes fully opaque red.
        const intensity = Math.max(0.25, Math.min(1, severity));
        vignette.style.setProperty('--hurt-alpha', intensity.toFixed(2));
        window.clearTimeout(this.hurtTimer);
        vignette.classList.remove('flash');
        void vignette.offsetWidth;
        vignette.classList.add('flash');
        this.hurtTimer = window.setTimeout(() => vignette.classList.remove('flash'), 620);
    }
    showLoot(itemId, quantity) {
        const item = (0, items_1.getItem)(itemId);
        const banner = this.root.querySelector('#loot-banner');
        if (!item || !banner)
            return;
        window.clearTimeout(this.lootTimer);
        this.text('#loot-icon', item.icon);
        this.text('#loot-name', item.name);
        this.text('#loot-quantity', `+${quantity}`);
        banner.style.setProperty('--loot-color', items_1.RARITY_COLOR[item.rarity]);
        banner.classList.remove('visible');
        requestAnimationFrame(() => banner.classList.add('visible'));
        this.lootTimer = window.setTimeout(() => banner.classList.remove('visible'), 2300);
    }
    showToast(message) {
        const toast = this.root.querySelector('#toast');
        if (!toast)
            return;
        window.clearTimeout(this.toastTimer);
        toast.textContent = message;
        toast.classList.remove('visible');
        requestAnimationFrame(() => toast.classList.add('visible'));
        this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
    }
    showDeath() {
        const screen = this.root.querySelector('#death-screen');
        if (screen) {
            screen.setAttribute('aria-hidden', 'false');
            // Restart the fade-in animation each death (re-death after respawn).
            screen.classList.remove('appear');
            void screen.offsetWidth;
            screen.classList.add('appear');
        }
        events_1.GameEvents.emit('ui-lock', true);
    }
    showEnding(data) {
        const layer = this.root.querySelector('#ending-screen');
        const stats = this.root.querySelector('#ending-stats');
        if (stats)
            stats.innerHTML = `<span><b>${Math.max(1, Math.round(data.playtime / 60))}</b> мин.</span><span><b>${data.level}</b> уровень</span><span><b>${data.reputation}</b> репутация</span>`;
        layer === null || layer === void 0 ? void 0 : layer.setAttribute('aria-hidden', 'false');
        events_1.GameEvents.emit('ui-lock', true);
    }
    text(selector, value) {
        const element = this.root.querySelector(selector);
        if (element)
            element.textContent = value;
    }
    width(selector, value) {
        const element = this.root.querySelector(selector);
        if (element)
            element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }
}
exports.GameUI = GameUI;
/* ===========================================================================
 * GameEvents contract for GameUI (scene integration reference)
 * ---------------------------------------------------------------------------
 * All communication with the scene goes through the shared GameEvents emitter.
 * Below is the complete list this UI depends on. Events marked NEW were added in
 * this UI pass and need a scene-side counterpart; the rest predate it.
 *
 * ── CONSUMED (GameUI listens; the scene emits) ─────────────────────────────
 *   'hud'              { snapshot: HudSnapshot; save: PlayerSave }
 *                        Drives the whole HUD. `save` now also feeds the new
 *                        panels via its v3 fields (weaponUpgrades, bestiary,
 *                        achievements, stats) — no extra HudSnapshot fields are
 *                        required, the UI reads them straight off the save.
 *   'toast'            string
 *   'loot'             { itemId: string; quantity: number }
 *   'combo'            { hits: number; multiplier: number }
 *   'ability-cooldown' { dash: number; special: number; dashMax?: number; specialMax?: number }
 *                        NEW optional fields dashMax/specialMax: the ability's
 *                        full cooldown in seconds. Supplying them makes the
 *                        radial conic sweep exact; if omitted the UI infers the
 *                        max from the largest remaining value it has seen.
 *   'rift-status'      { name: string; wave: number; remaining: number } | null
 *   'location'         string
 *   'tutorial'         { step: number; title: string; text: string } | null
 *   'dialogue'         DialoguePayload
 *   'dialogue-close'   void
 *   'panel-open'       string   (now also accepts 'craft' | 'bestiary' | 'achievements')
 *   'death'            void
 *   'ending'           { playtime: number; level: number; reputation: number }
 *   'prompt'           { text?: string }
 *   'boss-engage'      { name: string; maxHealth: number; phases?: number }   NEW
 *   'boss-health'      { health: number; phase?: number }                     NEW
 *   'boss-defeated'    void                                                    NEW
 *   'environment'      { time?: string; weather?: string }                    NEW
 *                        Localized labels — pass DaylightState.label and
 *                        WeatherProfile.label. Either field may be sent alone.
 *   'player-hurt'      { severity?: number }   NEW   (0..1; scales the vignette)
 *
 * ── EMITTED (GameUI fires; the scene handles) ──────────────────────────────
 *   'ui-heal' | 'ui-dash' | 'ui-special' | 'ui-attack' | 'ui-interact'  void
 *   'ui-move'          { x: number; y: number }   (normalized -1..1)
 *   'ui-lock'          boolean
 *   'equip'            weaponId: string
 *   'buy'              weaponId: string
 *   'claim-tier'       tier: number
 *   'equip-item'       itemId: string
 *   'use-item'         itemId: string
 *   'use-quick-slot'   index: number   NEW   (scene calls InventorySystem.useQuickSlot;
 *                        result shape matches use-item, so reuse that handler)
 *   'assign-quick-slot'{ itemId: string; slot: number }   NEW
 *                        (scene calls InventorySystem.setQuickSlot, then re-emits 'hud')
 *   'clear-quick-slot' slot: number   NEW
 *                        (scene calls InventorySystem.clearQuickSlot, then re-emits 'hud')
 *   'transfer-item'    { itemId: string; direction: 'toInventory' | 'toChest' }
 *   'set-volume'       { key: string; value: number }
 *   'toggle-sound' | 'toggle-motion' | 'toggle-quality' | 'fullscreen'  void
 *   'respawn'          void
 *   'reset-game'       void   (now fired only after the styled in-panel confirm)
 *   dialogue action events: emitted verbatim from DialoguePayload.actions[].event
 *   'craft-recipe'     recipeId: string   NEW   (scene calls CraftingSystem.craft)
 *   'upgrade-weapon'   weaponId: string   NEW   (scene calls CraftingSystem.upgradeWeapon)
 *
 * After handling 'craft-recipe' / 'upgrade-weapon' the scene should re-emit
 * 'hud' so the panel (open at the time) re-renders with the new material counts,
 * coins and upgrade levels. A 'toast' with CraftResult.message is a nice touch.
 * =========================================================================== */

});
__define("src/data/bestiary.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBestiaryLore = exports.BESTIARY_LORE = void 0;
exports.BESTIARY_LORE = {
    husk: {
        lore: 'Когда-то они пахали эти поля и хоронили своих у старых ворот. Проклятие долины выпило из них имена и оставило лишь голод. Одичалые не помнят, кем были, но всё ещё бредут к теплу живых.',
        weakness: 'Медлительны и хрупки — тяжёлый удар в голову валит их с одного замаха.',
    },
    boneguard: {
        lore: 'Кости давних стражей связаны костяной печатью и поставлены сторожить то, что давно истлело. Они не спят и не устают, ибо в них нет плоти, что могла бы ослабнуть. Разбей печать — и скелет рассыплется прахом.',
        weakness: 'Костяные печати не пробить в упор; бьющий издали арбалет крошит их вернее клинка.',
    },
    direwolf: {
        lore: 'Волки Шепчущего леса напились из отравленных ручьёв и переменились. Их глаза светятся болотным огнём, а вой сводит с ума заплутавших путников. Стая чует страх раньше, чем видит добычу.',
        weakness: 'Стремительны, но безрассудны — встречный удар в прыжке ломает их натиск.',
    },
    wraith: {
        lore: 'Теневики — это тоска мёртвых, что не нашли покоя и растворились в сумраке. Они текут меж деревьев беззвучно, и холод идёт впереди них. Свет причиняет им боль, ибо напоминает о жизни, которой их лишили.',
        weakness: 'Сгусток огня из посоха развеивает их тень быстрее любой стали.',
    },
    bogling: {
        lore: 'Утопленники Чёрной топи тянут на дно всякого, кто поверит болотным огням. Их лёгкие полны ила, но они не тонут и не всплывают — лишь ждут. Говорят, каждый из них когда-то шёл к перевозчику и не дошёл.',
        weakness: 'Разбухшие от воды, они неповоротливы — обходи со спины и руби, пока разворачиваются.',
    },
    cavecrawler: {
        lore: 'В Старых шахтах что-то росло в темноте, пока люди били руду. Пещерные твари слепы, но чуют дрожь камня и тепло крови сквозь стену. Их панцирь чёрен, как та порода, среди которой они вылупились.',
        weakness: 'Слепы и наводятся на звук — дымная сфера сбивает их с толку, открывая брюхо.',
    },
    ashborn: {
        lore: 'Пеплорождённые выходят из трещин у цитадели вместе с горячим ветром. В их груди тлеет уголь, что не гаснет даже под дождём. Там, где они прошли, остаётся выжженный след и запах серы.',
        weakness: 'Внутренний жар — их слабость: холодная сталь и вода гасят угли под кожей.',
    },
    nameless: {
        lore: 'Ту, что держит проклятие над долиной, давно не зовут по имени — оно стёрлось вместе с её лицом. В руинах она плетёт из чужого горя новую тьму и не помнит, зачем начала. Победить её — не убить, а наконец отпустить.',
        weakness: 'Её сила слабеет в свете луны; бей в разрыве между её волнами теней.',
    },
    cinderlord: {
        lore: 'Владыка углей воссел на троне из плавящегося камня, когда цитадель пала в огонь. Он вдыхает жар недр и выдыхает новые выбросы, что душат долину пеплом. Пока бьётся его угольное сердце, зима над Серым Холмом не кончится.',
        weakness: 'Между выбросами его сердце обнажается — вот единственный миг пробить броню из спёкшегося пепла.',
    },
};
const getBestiaryLore = (enemyId) => exports.BESTIARY_LORE[enemyId];
exports.getBestiaryLore = getBestiaryLore;

});
__define("src/data/achievements.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAchievement = exports.ACHIEVEMENTS = void 0;
// ~20 achievements. Names/descriptions are Russian (player-facing); ids and the
// event names they react to are English. The AchievementSystem matches these by
// id in its rule table — this array is the display/source-of-truth catalogue.
// Categories cover the full brief: kills, exploration, crafting, quests,
// economy, skill, secrets.
exports.ACHIEVEMENTS = [
    // --- kills ---
    { id: 'first_blood', name: 'Первая кровь', description: 'Уничтожьте первого врага долины.', category: 'kills', icon: '⚔' },
    { id: 'slayer_25', name: 'Охотник', description: 'Уничтожьте 25 врагов.', category: 'kills', icon: '☠' },
    { id: 'slayer_100', name: 'Жнец Серого Холма', description: 'Уничтожьте 100 врагов.', category: 'kills', icon: '☠' },
    { id: 'nameless_fallen', name: 'Тишина руин', description: 'Победите Безымянную.', category: 'kills', icon: '◈' },
    { id: 'cinder_fallen', name: 'Конец пепла', description: 'Свергните Владыку углей.', category: 'kills', icon: '✹' },
    // --- exploration ---
    { id: 'wanderer', name: 'Странник', description: 'Откройте пять уголков долины.', category: 'exploration', icon: '✦' },
    { id: 'cartographer', name: 'Картограф', description: 'Откройте все девять земель долины.', category: 'exploration', icon: '❖' },
    { id: 'bestiary_half', name: 'Летописец', description: 'Занесите пять существ в бестиарий.', category: 'exploration', icon: '❦' },
    { id: 'bestiary_full', name: 'Хранитель бестиария', description: 'Изучите всех существ долины.', category: 'exploration', icon: '❦' },
    // --- crafting ---
    { id: 'first_craft', name: 'Ремесленник', description: 'Создайте первый предмет у мастера.', category: 'crafting', icon: '⚒' },
    { id: 'first_upgrade', name: 'Кузнечное дело', description: 'Усильте оружие впервые.', category: 'crafting', icon: '⚒' },
    { id: 'master_smith', name: 'Мастер-оружейник', description: 'Доведите оружие до +5.', category: 'crafting', icon: '✷' },
    // --- quests ---
    { id: 'first_oath_done', name: 'Данная клятва', description: 'Выполните первое поручение.', category: 'quests', icon: '✎' },
    { id: 'quests_10', name: 'Верное слово', description: 'Завершите десять поручений.', category: 'quests', icon: '✎' },
    { id: 'saviour', name: 'Спаситель долины', description: 'Завершите основную историю.', category: 'quests', icon: '♛' },
    // --- economy ---
    { id: 'first_coin', name: 'Звон монет', description: 'Заработайте первую сотню золота.', category: 'economy', icon: '◉' },
    { id: 'rich', name: 'Сундук изгнанника', description: 'Накопите 1000 золота за игру.', category: 'economy', icon: '◉' },
    { id: 'armory', name: 'Оружейная', description: 'Соберите пять видов оружия.', category: 'economy', icon: '⚔' },
    // --- skill ---
    { id: 'flawless_boss', name: 'Без единой царапины', description: 'Одолейте босса, не получив урона.', category: 'skill', icon: '✧', },
    { id: 'combo_10', name: 'Вихрь клинка', description: 'Наберите серию из 10 ударов без промаха.', category: 'skill', icon: '➶' },
    // --- secret ---
    { id: 'deserter_truth', name: 'Правда дезертира', description: 'Узнайте, от чего бежала капитан Сера.', category: 'secret', hidden: true, icon: '✹' },
    { id: 'rift_walker', name: 'Идущий сквозь разломы', description: 'Загляните за все три разлома долины.', category: 'secret', hidden: true, icon: '❂' },
];
const getAchievement = (id) => exports.ACHIEVEMENTS.find((achievement) => achievement.id === id);
exports.getAchievement = getAchievement;

});
__define("src/data/crafting.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecipe = exports.RECIPES = exports.upgradeDamagePct = exports.MAX_WEAPON_UPGRADE = exports.WEAPON_UPGRADE_TIERS = void 0;
// ---------------------------------------------------------------------------
// Weapon reinforcement (blacksmith Runa).
//
// Balance intent: upgrades are a *supplementary* sink for the six material
// types, not a gate in front of weapon purchases. Fully maxing ONE weapon costs
// 410 coins total (25+45+70+110+160) — cheaper than the second-tier Graveaxe
// (90) is deliberately NOT true; instead the coin cost is deliberately kept
// well below the ~1915 total quest gold so a player can still afford new
// weapons. The real cost is materials, which otherwise pile up as dead weight.
//
// Damage bonus is a *cumulative* percentage of the weapon's base damage, so the
// same tier ladder feels proportional on a 24-damage Rustblade and an 86-damage
// Cinderbrand. +5 caps at +50% (e.g. Rustblade 24 -> 36, Cinderbrand 86 -> 129).
// The percentage is intentionally below what a full weapon-tier jump gives, so
// buying the next weapon stays the stronger play — upgrading smooths the gap.
// ---------------------------------------------------------------------------
exports.WEAPON_UPGRADE_TIERS = [
    { level: 1, coins: 25, damageBonusPct: 8, materials: [{ itemId: 'bone_shard', quantity: 3 }] },
    { level: 2, coins: 45, damageBonusPct: 16, materials: [{ itemId: 'bone_shard', quantity: 4 }, { itemId: 'mine_ore', quantity: 2 }] },
    { level: 3, coins: 70, damageBonusPct: 25, materials: [{ itemId: 'mine_ore', quantity: 3 }, { itemId: 'wolf_pelt', quantity: 2 }] },
    { level: 4, coins: 110, damageBonusPct: 35, materials: [{ itemId: 'mine_ore', quantity: 3 }, { itemId: 'ash_crystal', quantity: 2 }] },
    { level: 5, coins: 160, damageBonusPct: 50, materials: [{ itemId: 'ash_crystal', quantity: 3 }, { itemId: 'glowcap', quantity: 2 }] },
];
exports.MAX_WEAPON_UPGRADE = exports.WEAPON_UPGRADE_TIERS.length;
// Cumulative damage percentage granted by owning `level` reinforcements.
const upgradeDamagePct = (level) => {
    if (level <= 0)
        return 0;
    const tier = exports.WEAPON_UPGRADE_TIERS[Math.min(level, exports.MAX_WEAPON_UPGRADE) - 1];
    return tier ? tier.damageBonusPct : 0;
};
exports.upgradeDamagePct = upgradeDamagePct;
// ---------------------------------------------------------------------------
// Recipes.
//
// These turn materials into consumables and equipment so every material type
// has a real drain:
//   - glowcap -> blood_vial / greater_vial (potions from foraged mushrooms)
//   - bog_reed + glowcap -> greater_vial   (the "strong potion" the reeds hint at)
//   - wolf_pelt -> traveler_coat            (light armour from pelts)
//   - ash_crystal + mine_ore + bone_shard -> grave_warden_mail (mid armour)
//   - ash_crystal x + mine_ore -> cinder_plate is intentionally NOT craftable
//     (that stays a boss drop / late reward) to protect progression.
//
// Coin costs are token amounts — the recipes are meant to be reachable from
// farmed materials, not a second economy. Every output item already exists in
// items.ts, so the data tests' item-id checks pass unchanged.
// ---------------------------------------------------------------------------
exports.RECIPES = [
    {
        id: 'craft_blood_vial',
        name: 'Зелье крови',
        description: 'Светогриб растереть в кровяную взвесь — простейшее лечебное зелье.',
        kind: 'consumable',
        station: 'runa',
        materials: [{ itemId: 'glowcap', quantity: 1 }],
        coins: 6,
        output: { itemId: 'blood_vial', quantity: 1 },
    },
    {
        id: 'craft_greater_vial',
        name: 'Большое зелье',
        description: 'Болотный тростник со светогрибом дают густой отвар, что затягивает даже глубокие раны.',
        kind: 'consumable',
        station: 'iva',
        materials: [{ itemId: 'bog_reed', quantity: 2 }, { itemId: 'glowcap', quantity: 1 }],
        coins: 14,
        output: { itemId: 'greater_vial', quantity: 1 },
    },
    {
        id: 'craft_smoke_bomb',
        name: 'Дымная сфера',
        description: 'Осколок кости и щепоть чёрной руды — хлопок дыма, чтобы уйти от беды.',
        kind: 'consumable',
        station: 'iva',
        materials: [{ itemId: 'bone_shard', quantity: 2 }, { itemId: 'mine_ore', quantity: 1 }],
        coins: 10,
        output: { itemId: 'smoke_bomb', quantity: 1 },
    },
    {
        id: 'craft_traveler_coat',
        name: 'Плащ странника',
        description: 'Две волчьи шкуры сшиваются в плотный дорожный плащ.',
        kind: 'equipment',
        station: 'runa',
        materials: [{ itemId: 'wolf_pelt', quantity: 2 }],
        coins: 20,
        output: { itemId: 'traveler_coat', quantity: 1 },
    },
    {
        id: 'craft_grave_mail',
        name: 'Кольчуга смотрителя',
        description: 'Пепельный кристалл, чёрная руда и кости — кузнец Руна куёт тяжёлую кольчугу.',
        kind: 'equipment',
        station: 'runa',
        materials: [
            { itemId: 'ash_crystal', quantity: 2 },
            { itemId: 'mine_ore', quantity: 3 },
            { itemId: 'bone_shard', quantity: 4 },
        ],
        coins: 90,
        requiredRep: 5,
        output: { itemId: 'grave_warden_mail', quantity: 1 },
    },
    {
        id: 'craft_wolf_fang',
        name: 'Клык искажённого волка',
        description: 'Клык и шкура волка на костяной оправе — оберег, ускоряющий шаг.',
        kind: 'equipment',
        station: 'runa',
        materials: [{ itemId: 'wolf_pelt', quantity: 3 }, { itemId: 'bone_shard', quantity: 2 }],
        coins: 45,
        requiredRep: 2,
        output: { itemId: 'wolf_fang', quantity: 1 },
    },
];
const getRecipe = (id) => exports.RECIPES.find((recipe) => recipe.id === id);
exports.getRecipe = getRecipe;

});
__define("src/systems/InventorySystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventorySystem = void 0;
const content_1 = __req("src/data/content.ts");
const items_1 = __req("src/data/items.ts");
class InventorySystem {
    constructor(saves) {
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: saves
        });
    }
    add(itemId, quantity = 1, immediate = false) {
        const weapon = content_1.WEAPONS.find((entry) => entry.id === itemId);
        this.saves.mutate((save) => {
            if (weapon) {
                if (!save.ownedWeapons.includes(itemId))
                    save.ownedWeapons.push(itemId);
            }
            else {
                save.inventory = (0, items_1.addStack)(save.inventory, itemId, quantity);
                if (itemId === 'blood_vial')
                    save.potions = (0, items_1.stackQuantity)(save.inventory, 'blood_vial');
            }
        }, immediate);
    }
    remove(itemId, quantity = 1, immediate = false) {
        const save = this.saves.get();
        if ((0, items_1.stackQuantity)(save.inventory, itemId) < quantity)
            return false;
        this.saves.mutate((state) => {
            state.inventory = (0, items_1.removeStack)(state.inventory, itemId, quantity);
            if (itemId === 'blood_vial')
                state.potions = (0, items_1.stackQuantity)(state.inventory, 'blood_vial');
        }, immediate);
        return true;
    }
    quantity(itemId) {
        return (0, items_1.stackQuantity)(this.saves.get().inventory, itemId);
    }
    equip(itemId) {
        const weapon = content_1.WEAPONS.find((entry) => entry.id === itemId);
        const item = (0, items_1.getItem)(itemId);
        const save = this.saves.get();
        if (weapon) {
            if (!save.ownedWeapons.includes(itemId))
                return false;
            this.saves.mutate((state) => {
                state.equippedWeapon = itemId;
                state.equipment.weapon = itemId;
            }, true);
            return true;
        }
        if (!item || this.quantity(itemId) < 1)
            return false;
        if (item.category !== 'armor' && item.category !== 'amulet')
            return false;
        this.saves.mutate((state) => {
            if (item.category === 'armor')
                state.equipment.armor = itemId;
            else
                state.equipment.amulet = itemId;
        }, true);
        return true;
    }
    use(itemId) {
        const item = (0, items_1.getItem)(itemId);
        const save = this.saves.get();
        if (!item || item.category !== 'consumable' || this.quantity(itemId) < 1)
            return { used: false, message: 'Предмет нельзя использовать' };
        if (item.heal && save.health >= this.maxHealth())
            return { used: false, message: 'Здоровье уже полное' };
        this.saves.mutate((state) => {
            state.inventory = (0, items_1.removeStack)(state.inventory, itemId, 1);
            if (item.heal)
                state.health = Math.min(this.maxHealth(state), state.health + item.heal);
            state.potions = (0, items_1.stackQuantity)(state.inventory, 'blood_vial');
        }, true);
        return { used: true, message: item.heal ? `Восстановлено ${item.heal} здоровья` : 'Дым скрывает ваш след', effect: item.heal ? 'heal' : 'smoke' };
    }
    /** The current quick bar, always normalised to exactly QUICK_SLOTS entries. */
    quickSlots(save = this.saves.get()) {
        var _a;
        const slots = (_a = save.equipment.quick) !== null && _a !== void 0 ? _a : [];
        return Array.from({ length: InventorySystem.QUICK_SLOTS }, (_, index) => { var _a; return (_a = slots[index]) !== null && _a !== void 0 ? _a : null; });
    }
    isValidSlot(index) {
        return Number.isInteger(index) && index >= 0 && index < InventorySystem.QUICK_SLOTS;
    }
    /**
     * Assign a consumable to a quick slot. Rejects non-consumables and unknown
     * items. Returns true on success. Assigning an item already in another slot
     * moves it there (no duplicate binding), which keeps the small bar tidy.
     */
    setQuickSlot(index, itemId) {
        if (!this.isValidSlot(index))
            return false;
        const item = (0, items_1.getItem)(itemId);
        if (!item || item.category !== 'consumable')
            return false;
        this.saves.mutate((state) => {
            const quick = this.quickSlots(state);
            // Remove the item from any other slot so it lives in exactly one place.
            for (let slot = 0; slot < quick.length; slot += 1) {
                if (quick[slot] === itemId)
                    quick[slot] = null;
            }
            quick[index] = itemId;
            state.equipment.quick = quick;
        }, true);
        return true;
    }
    /** Clear a quick slot. Returns true if the index was valid. */
    clearQuickSlot(index) {
        if (!this.isValidSlot(index))
            return false;
        this.saves.mutate((state) => {
            const quick = this.quickSlots(state);
            quick[index] = null;
            state.equipment.quick = quick;
        }, true);
        return true;
    }
    /**
     * Use the consumable bound to a quick slot. Returns the SAME result shape as
     * `use()` so scenes can treat quick-slot use exactly like any other item use
     * (heal glow, smoke bomb, toast). An empty or invalid slot returns a friendly
     * not-usable result rather than throwing.
     */
    useQuickSlot(index) {
        if (!this.isValidSlot(index))
            return { used: false, message: 'Ячейка недоступна' };
        const itemId = this.quickSlots()[index];
        if (!itemId)
            return { used: false, message: 'Ячейка пуста' };
        return this.use(itemId);
    }
    transfer(itemId, quantity, direction) {
        const save = this.saves.get();
        const from = direction === 'toChest' ? save.inventory : save.chest;
        if ((0, items_1.stackQuantity)(from, itemId) < quantity)
            return false;
        this.saves.mutate((state) => {
            if (direction === 'toChest') {
                state.inventory = (0, items_1.removeStack)(state.inventory, itemId, quantity);
                state.chest = (0, items_1.addStack)(state.chest, itemId, quantity);
            }
            else {
                state.chest = (0, items_1.removeStack)(state.chest, itemId, quantity);
                state.inventory = (0, items_1.addStack)(state.inventory, itemId, quantity);
            }
            state.potions = (0, items_1.stackQuantity)(state.inventory, 'blood_vial');
        }, true);
        return true;
    }
    stacks(category) {
        const save = this.saves.get();
        if (!category)
            return save.inventory;
        if (category === 'weapon')
            return save.ownedWeapons.map((itemId) => ({ itemId, quantity: 1 }));
        return save.inventory.filter((stack) => { var _a; return ((_a = (0, items_1.getItem)(stack.itemId)) === null || _a === void 0 ? void 0 : _a.category) === category; });
    }
    armor(save = this.saves.get()) {
        var _a, _b, _c;
        return (_c = (_b = (0, items_1.getItem)((_a = save.equipment.armor) !== null && _a !== void 0 ? _a : '')) === null || _b === void 0 ? void 0 : _b.armor) !== null && _c !== void 0 ? _c : 0;
    }
    damageBonus(save = this.saves.get()) {
        var _a, _b, _c;
        return (_c = (_b = (0, items_1.getItem)((_a = save.equipment.amulet) !== null && _a !== void 0 ? _a : '')) === null || _b === void 0 ? void 0 : _b.damageBonus) !== null && _c !== void 0 ? _c : 0;
    }
    speedBonus(save = this.saves.get()) {
        var _a, _b, _c;
        return (_c = (_b = (0, items_1.getItem)((_a = save.equipment.amulet) !== null && _a !== void 0 ? _a : '')) === null || _b === void 0 ? void 0 : _b.speedBonus) !== null && _c !== void 0 ? _c : 0;
    }
    maxHealth(save = this.saves.get()) {
        return save.maxHealth + this.armor(save) * 4;
    }
}
exports.InventorySystem = InventorySystem;
// ---- quick slots ------------------------------------------------------
// save.equipment.quick is a fixed 3-slot bar of nullable item ids. It is
// saved/loaded but was never wired to any usage logic; these three methods are
// that logic. Only *consumables* may be assigned — the bar is for potions and
// the smoke bomb, not armour or materials.
/** Number of quick slots. Mirrors the save's fixed-length array. */
Object.defineProperty(InventorySystem, "QUICK_SLOTS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 3
});

});
__define("src/systems/QuestSystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestSystem = void 0;
const content_1 = __req("src/data/content.ts");
const content_2 = __req("src/data/content.ts");
const items_1 = __req("src/data/items.ts");
class QuestSystem {
    constructor(saves) {
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: saves
        });
    }
    getDefinition(id) {
        return content_1.QUESTS.find((quest) => quest.id === id);
    }
    status(quest) {
        var _a;
        const progress = this.saves.get().questProgress[quest.id];
        if (progress)
            return progress.status;
        if (!quest.prerequisite)
            return 'available';
        return ((_a = this.saves.get().questProgress[quest.prerequisite]) === null || _a === void 0 ? void 0 : _a.status) === 'completed' ? 'available' : 'completed';
    }
    isLocked(quest) {
        var _a;
        return Boolean(quest.prerequisite && ((_a = this.saves.get().questProgress[quest.prerequisite]) === null || _a === void 0 ? void 0 : _a.status) !== 'completed');
    }
    availableForNpc(npcId) {
        return content_1.QUESTS.filter((quest) => quest.giver === npcId && !this.isLocked(quest) && this.status(quest) !== 'completed');
    }
    accept(id) {
        const quest = this.getDefinition(id);
        if (!quest || this.isLocked(quest) || this.saves.get().questProgress[id])
            return false;
        this.saves.mutate((save) => {
            save.questProgress[id] = { status: 'active', objectiveIndex: 0, amount: 0 };
        }, true);
        return true;
    }
    turnIn(id) {
        const quest = this.getDefinition(id);
        const progress = this.saves.get().questProgress[id];
        if (!quest || (progress === null || progress === void 0 ? void 0 : progress.status) !== 'ready')
            return undefined;
        this.saves.mutate((save) => {
            var _a;
            progress.status = 'completed';
            save.coins += quest.reward.coins;
            save.xp += quest.reward.xp;
            save.reputation += quest.reward.reputation;
            if (quest.reward.potions)
                save.inventory = (0, items_1.addStack)(save.inventory, 'blood_vial', quest.reward.potions);
            for (const reward of (_a = quest.reward.items) !== null && _a !== void 0 ? _a : [])
                save.inventory = (0, items_1.addStack)(save.inventory, reward.itemId, reward.quantity);
            save.potions = (0, items_1.stackQuantity)(save.inventory, 'blood_vial');
            while (save.xp >= (0, content_2.XP_FOR_LEVEL)(save.level)) {
                save.xp -= (0, content_2.XP_FOR_LEVEL)(save.level);
                save.level += 1;
                save.maxHealth += 12;
                save.health = save.maxHealth;
            }
        }, true);
        return quest;
    }
    record(type, target, amount = 1) {
        const result = { changed: false };
        this.saves.mutate((save) => {
            for (const [id, progress] of Object.entries(save.questProgress)) {
                if (progress.status !== 'active')
                    continue;
                const quest = this.getDefinition(id);
                const objective = quest === null || quest === void 0 ? void 0 : quest.objectives[progress.objectiveIndex];
                if (!quest || !objective || objective.type !== type || objective.target !== target)
                    continue;
                progress.amount = Math.min(objective.amount, progress.amount + amount);
                result.changed = true;
                if (progress.amount >= objective.amount) {
                    result.completedObjective = objective.label;
                    if (progress.objectiveIndex >= quest.objectives.length - 1) {
                        progress.status = 'ready';
                        result.readyQuest = quest;
                    }
                    else {
                        progress.objectiveIndex += 1;
                        progress.amount = 0;
                    }
                }
            }
        });
        return result;
    }
    getActive() {
        const save = this.saves.get();
        return Object.entries(save.questProgress)
            .filter(([, progress]) => progress.status === 'active' || progress.status === 'ready')
            .map(([id, progress]) => ({ quest: this.getDefinition(id), progress }))
            .filter((item) => Boolean(item.quest));
    }
    activeObjective() {
        var _a;
        const active = this.getActive();
        return (_a = active.find((item) => item.quest.category === 'main')) !== null && _a !== void 0 ? _a : active[0];
    }
    snapshotQuests() {
        return content_1.QUESTS.filter((quest) => !this.isLocked(quest) || this.saves.get().questProgress[quest.id])
            .map((quest) => {
            const status = this.status(quest);
            const progress = this.saves.get().questProgress[quest.id];
            const objective = progress ? quest.objectives[progress.objectiveIndex] : undefined;
            return {
                id: quest.id,
                title: quest.title,
                category: quest.category,
                status,
                objective: objective === null || objective === void 0 ? void 0 : objective.label,
                amount: progress === null || progress === void 0 ? void 0 : progress.amount,
                required: objective === null || objective === void 0 ? void 0 : objective.amount,
            };
        });
    }
}
exports.QuestSystem = QuestSystem;

});
__define("src/systems/WeaponShopSystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeaponShopSystem = void 0;
const content_1 = __req("src/data/content.ts");
class WeaponShopSystem {
    constructor(saves) {
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: saves
        });
    }
    purchase(weaponId) {
        const weapon = content_1.WEAPONS.find((entry) => entry.id === weaponId);
        const save = this.saves.get();
        if (!weapon || weapon.price <= 0)
            return { ok: false, message: 'Это оружие нельзя купить' };
        if (save.ownedWeapons.includes(weaponId))
            return { ok: false, message: 'Оружие уже принадлежит вам', weapon };
        if (save.reputation < weapon.requiredRep)
            return { ok: false, message: `Нужна репутация ${weapon.requiredRep}`, weapon };
        if (save.coins < weapon.price)
            return { ok: false, message: `Не хватает ${weapon.price - save.coins} золота`, weapon };
        this.saves.mutate((state) => {
            state.coins -= weapon.price;
            state.ownedWeapons.push(weaponId);
            state.equippedWeapon = weaponId;
            state.equipment.weapon = weaponId;
        }, true);
        return { ok: true, message: `Куплено за ${weapon.price} золота: ${weapon.name}`, weapon };
    }
    purchasable() {
        return content_1.WEAPONS.filter((weapon) => weapon.price > 0);
    }
}
exports.WeaponShopSystem = WeaponShopSystem;

});
__define("src/systems/CraftingSystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingSystem = exports.MAX_WEAPON_UPGRADE = exports.WEAPON_UPGRADE_TIERS = exports.RECIPES = void 0;
const content_1 = __req("src/data/content.ts");
const crafting_1 = __req("src/data/crafting.ts");
const items_1 = __req("src/data/items.ts");
// Re-exported so callers (and tests) can pull recipe/upgrade data straight from
// the system module without also reaching into data/crafting.
var crafting_2 = __req("src/data/crafting.ts");
Object.defineProperty(exports, "RECIPES", { enumerable: true, get: function () { return crafting_2.RECIPES; } });
Object.defineProperty(exports, "WEAPON_UPGRADE_TIERS", { enumerable: true, get: function () { return crafting_2.WEAPON_UPGRADE_TIERS; } });
Object.defineProperty(exports, "MAX_WEAPON_UPGRADE", { enumerable: true, get: function () { return crafting_2.MAX_WEAPON_UPGRADE; } });
/**
 * Crafting + weapon reinforcement.
 *
 * The system owns two related loops that both consume the six material types:
 *  - recipes (materials + coins -> a consumable/equipment item), and
 *  - weapon upgrades (materials + coins -> +1 reinforcement, persisted per weapon).
 *
 * It reads the player's material stock through InventorySystem so it shares the
 * exact same stacking/removal rules as the rest of the game, and it writes
 * upgrade levels into save.weaponUpgrades (a v3 field defaulted to {}).
 */
class CraftingSystem {
    constructor(saves, inventory) {
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: saves
        });
        Object.defineProperty(this, "inventory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: inventory
        });
    }
    // ---- recipes ----------------------------------------------------------
    listRecipes() {
        return crafting_1.RECIPES;
    }
    getRecipe(recipeId) {
        return (0, crafting_1.getRecipe)(recipeId);
    }
    // Does the player currently have the materials, coins and reputation for it?
    canCraft(recipeId) {
        const recipe = (0, crafting_1.getRecipe)(recipeId);
        if (!recipe)
            return false;
        const save = this.saves.get();
        if (recipe.requiredRep && save.reputation < recipe.requiredRep)
            return false;
        if (recipe.coins && save.coins < recipe.coins)
            return false;
        return recipe.materials.every((mat) => this.inventory.quantity(mat.itemId) >= mat.quantity);
    }
    // Human-readable reason crafting is blocked (or empty string if craftable).
    craftBlockReason(recipe) {
        var _a;
        const save = this.saves.get();
        if (recipe.requiredRep && save.reputation < recipe.requiredRep)
            return `Нужна репутация ${recipe.requiredRep}`;
        if (recipe.coins && save.coins < recipe.coins)
            return `Не хватает ${recipe.coins - save.coins} золота`;
        const missing = recipe.materials.find((mat) => this.inventory.quantity(mat.itemId) < mat.quantity);
        if (missing) {
            const item = (0, items_1.getItem)(missing.itemId);
            const have = this.inventory.quantity(missing.itemId);
            return `Нужно ещё ${missing.quantity - have} — ${(_a = item === null || item === void 0 ? void 0 : item.name) !== null && _a !== void 0 ? _a : missing.itemId}`;
        }
        return '';
    }
    craft(recipeId) {
        var _a;
        const recipe = (0, crafting_1.getRecipe)(recipeId);
        if (!recipe)
            return { ok: false, message: 'Неизвестный рецепт' };
        const blocked = this.craftBlockReason(recipe);
        if (blocked)
            return { ok: false, message: blocked };
        // Spend materials + coins, then grant the output. Weapons are never recipe
        // outputs (only items in items.ts are), so inventory.add handles everything.
        for (const mat of recipe.materials)
            this.inventory.remove(mat.itemId, mat.quantity, false);
        if (recipe.coins)
            this.saves.mutate((state) => { state.coins -= recipe.coins; }, false);
        this.inventory.add(recipe.output.itemId, recipe.output.quantity, false);
        this.saves.mutate((state) => { state.stats.itemsCrafted += 1; }, true);
        const item = (0, items_1.getItem)(recipe.output.itemId);
        return { ok: true, message: `Создано: ${(_a = item === null || item === void 0 ? void 0 : item.name) !== null && _a !== void 0 ? _a : recipe.output.itemId}` };
    }
    // ---- weapon upgrades --------------------------------------------------
    // Current reinforcement level for a weapon (0 if never upgraded / unknown key).
    upgradeLevel(weaponId) {
        var _a;
        return (_a = this.saves.get().weaponUpgrades[weaponId]) !== null && _a !== void 0 ? _a : 0;
    }
    tierFor(level) {
        return crafting_1.WEAPON_UPGRADE_TIERS.find((tier) => tier.level === level);
    }
    // Cost of the NEXT upgrade for a weapon, or undefined at max level / unknown weapon.
    upgradeCost(weaponId) {
        const weapon = content_1.WEAPONS.find((entry) => entry.id === weaponId);
        if (!weapon)
            return undefined;
        const next = this.upgradeLevel(weaponId) + 1;
        if (next > crafting_1.MAX_WEAPON_UPGRADE)
            return undefined;
        const tier = this.tierFor(next);
        if (!tier)
            return undefined;
        return {
            level: next,
            coins: tier.coins,
            materials: tier.materials.map((mat) => ({ ...mat })),
            damageBonusPct: tier.damageBonusPct,
        };
    }
    canUpgrade(weaponId) {
        const save = this.saves.get();
        // The weapon must actually be owned before it can be reinforced.
        if (!save.ownedWeapons.includes(weaponId))
            return false;
        const cost = this.upgradeCost(weaponId);
        if (!cost)
            return false; // at max, or unknown weapon
        if (save.coins < cost.coins)
            return false;
        return cost.materials.every((mat) => this.inventory.quantity(mat.itemId) >= mat.quantity);
    }
    upgradeWeapon(weaponId) {
        var _a;
        const weapon = content_1.WEAPONS.find((entry) => entry.id === weaponId);
        if (!weapon)
            return { ok: false, message: 'Неизвестное оружие' };
        const save = this.saves.get();
        if (!save.ownedWeapons.includes(weaponId))
            return { ok: false, message: 'Сначала нужно владеть оружием' };
        const cost = this.upgradeCost(weaponId);
        if (!cost)
            return { ok: false, message: `${weapon.name} уже усилено до предела` };
        if (save.coins < cost.coins)
            return { ok: false, message: `Не хватает ${cost.coins - save.coins} золота` };
        const missing = cost.materials.find((mat) => this.inventory.quantity(mat.itemId) < mat.quantity);
        if (missing) {
            const item = (0, items_1.getItem)(missing.itemId);
            const have = this.inventory.quantity(missing.itemId);
            return { ok: false, message: `Нужно ещё ${missing.quantity - have} — ${(_a = item === null || item === void 0 ? void 0 : item.name) !== null && _a !== void 0 ? _a : missing.itemId}` };
        }
        for (const mat of cost.materials)
            this.inventory.remove(mat.itemId, mat.quantity, false);
        this.saves.mutate((state) => {
            state.coins -= cost.coins;
            state.weaponUpgrades[weaponId] = cost.level;
            state.stats.weaponsUpgraded += 1;
        }, true);
        return { ok: true, message: `${weapon.name} усилено до +${cost.level}` };
    }
    // Effective damage of a weapon = base damage + reinforcement percentage.
    // Rounded so combat maths stays on whole numbers like the base values.
    weaponDamage(weaponId) {
        const weapon = content_1.WEAPONS.find((entry) => entry.id === weaponId);
        if (!weapon)
            return 0;
        const pct = (0, crafting_1.upgradeDamagePct)(this.upgradeLevel(weaponId));
        return Math.round(weapon.damage * (1 + pct / 100));
    }
    // Convenience for UI: how much raw damage the reinforcement adds on its own.
    upgradeDamageBonus(weaponId) {
        var _a, _b;
        return this.weaponDamage(weaponId) - ((_b = (_a = content_1.WEAPONS.find((entry) => entry.id === weaponId)) === null || _a === void 0 ? void 0 : _a.damage) !== null && _b !== void 0 ? _b : 0);
    }
}
exports.CraftingSystem = CraftingSystem;

});
__define("src/systems/BestiarySystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BestiarySystem = exports.BESTIARY_WEAKNESS_AT = exports.BESTIARY_STATS_AT = exports.BESTIARY_APPEARANCE_AT = void 0;
const content_1 = __req("src/data/content.ts");
const bestiary_1 = __req("src/data/bestiary.ts");
// Progressive reveal thresholds (kills). Kept as named constants so UI copy and
// the reveal logic never drift apart.
exports.BESTIARY_APPEARANCE_AT = 1; // name + appearance
exports.BESTIARY_STATS_AT = 5; // health/damage numbers
exports.BESTIARY_WEAKNESS_AT = 15; // weakness hint
/**
 * Bestiary progression.
 *
 * Kills are counted per enemy id in save.bestiary (v3 field, defaults to {}).
 * Lore is fixed data (data/bestiary.ts); the *reveal* of name/stats/weakness is
 * derived purely from the kill count, so nothing extra needs persisting. Only
 * enemies that exist in ENEMIES are tracked — an unknown id is ignored, so the
 * data tests' enemy-id invariants are never violated by this system.
 */
class BestiarySystem {
    constructor(saves) {
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: saves
        });
    }
    // Record one (or more) kills of an enemy. Returns the new kill total. Unknown
    // enemy ids are a no-op and return 0 rather than polluting the save.
    recordKill(enemyId, amount = 1) {
        if (!content_1.ENEMIES[enemyId] || amount <= 0)
            return 0;
        let total = 0;
        this.saves.mutate((save) => {
            var _a;
            total = ((_a = save.bestiary[enemyId]) !== null && _a !== void 0 ? _a : 0) + amount;
            save.bestiary[enemyId] = total;
            save.stats.totalKills += amount;
            const enemy = content_1.ENEMIES[enemyId];
            // A "boss" here is a large, high-value foe. Both story bosses use scale,
            // so that's the cheapest reliable signal without new data.
            if (enemy.scale && enemy.scale >= 1.4)
                save.stats.bossKills += amount;
        }, true);
        return total;
    }
    kills(enemyId) {
        var _a;
        return (_a = this.saves.get().bestiary[enemyId]) !== null && _a !== void 0 ? _a : 0;
    }
    totalKills() {
        // Prefer the flat counter, but fall back to summing the map for safety on
        // saves migrated before stats existed.
        const save = this.saves.get();
        if (save.stats.totalKills > 0)
            return save.stats.totalKills;
        return Object.values(save.bestiary).reduce((sum, n) => sum + n, 0);
    }
    // Number of enemy types with at least one kill (i.e. discovered entries).
    discoveredCount() {
        const save = this.saves.get();
        return Object.keys(content_1.ENEMIES).filter((id) => { var _a; return ((_a = save.bestiary[id]) !== null && _a !== void 0 ? _a : 0) >= exports.BESTIARY_APPEARANCE_AT; }).length;
    }
    totalSpecies() {
        return Object.keys(content_1.ENEMIES).length;
    }
    // Build a display entry for one enemy with progressive reveal applied.
    getEntry(enemyId) {
        var _a;
        const enemy = content_1.ENEMIES[enemyId];
        if (!enemy)
            return undefined;
        const kills = this.kills(enemyId);
        const lore = (_a = (0, bestiary_1.getBestiaryLore)(enemyId)) !== null && _a !== void 0 ? _a : { lore: '', weakness: '' };
        const statsRevealed = kills >= exports.BESTIARY_STATS_AT;
        return {
            enemyId,
            // Name is masked until the first kill, matching a classic bestiary tease.
            name: kills >= exports.BESTIARY_APPEARANCE_AT ? enemy.name : '???',
            kills,
            appearanceRevealed: kills >= exports.BESTIARY_APPEARANCE_AT,
            statsRevealed,
            weaknessRevealed: kills >= exports.BESTIARY_WEAKNESS_AT,
            lore: lore.lore,
            weakness: lore.weakness,
            // Stats are only attached once earned; UI decides how to show the rest.
            stats: statsRevealed ? { health: enemy.health, damage: enemy.damage, speed: enemy.speed } : undefined,
        };
    }
    // All entries in the fixed ENEMIES order, each with reveal state applied.
    listEntries() {
        return Object.keys(content_1.ENEMIES)
            .map((id) => this.getEntry(id))
            .filter((entry) => Boolean(entry));
    }
}
exports.BestiarySystem = BestiarySystem;

});
__define("src/systems/AchievementSystem.ts", function(exports, module, __req){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AchievementSystem = void 0;
const content_1 = __req("src/data/content.ts");
const world_1 = __req("src/data/world.ts");
const achievements_1 = __req("src/data/achievements.ts");
const crafting_1 = __req("src/data/crafting.ts");
// Story bosses are the large, high-value foes; keep the roster data-driven so a
// new boss automatically counts toward boss-kill achievements.
const BOSS_IDS = Object.values(content_1.ENEMIES).filter((e) => { var _a; return ((_a = e.scale) !== null && _a !== void 0 ? _a : 1) >= 1.4; }).map((e) => e.id);
// Story's final beat. Its completion is the whole main chain done, because every
// other main quest is a transitive prerequisite of it (validated in data.test).
const FINAL_MAIN_QUEST = 'ash_crown';
const RIFT_FLAG_PREFIX = 'rift_seen_';
const questDone = (save, id) => { var _a; return ((_a = save.questProgress[id]) === null || _a === void 0 ? void 0 : _a.status) === 'completed'; };
const RULES = {
    // kills
    first_blood: (s) => s.stats.totalKills >= 1,
    slayer_25: (s) => s.stats.totalKills >= 25,
    slayer_100: (s) => s.stats.totalKills >= 100,
    nameless_fallen: (s) => { var _a; return ((_a = s.bestiary['nameless']) !== null && _a !== void 0 ? _a : 0) >= 1; },
    cinder_fallen: (s) => { var _a; return ((_a = s.bestiary['cinderlord']) !== null && _a !== void 0 ? _a : 0) >= 1; },
    // exploration
    wanderer: (s) => s.discoveredLocations.length >= 5,
    cartographer: (s) => world_1.LOCATIONS.every((loc) => s.discoveredLocations.includes(loc.id)),
    bestiary_half: (s) => Object.values(s.bestiary).filter((n) => n >= 1).length >= 5,
    bestiary_full: (s) => Object.keys(content_1.ENEMIES).every((id) => { var _a; return ((_a = s.bestiary[id]) !== null && _a !== void 0 ? _a : 0) >= 1; }),
    // crafting
    first_craft: (s) => s.stats.itemsCrafted >= 1,
    first_upgrade: (s) => s.stats.weaponsUpgraded >= 1,
    master_smith: (s) => Object.values(s.weaponUpgrades).some((lvl) => lvl >= crafting_1.MAX_WEAPON_UPGRADE),
    // quests
    first_oath_done: (s) => s.stats.questsCompleted >= 1,
    quests_10: (s) => s.stats.questsCompleted >= 10,
    saviour: (s) => questDone(s, FINAL_MAIN_QUEST),
    // economy
    first_coin: (s) => s.stats.coinsEarned >= 100,
    rich: (s) => s.stats.coinsEarned >= 1000,
    armory: (s) => s.ownedWeapons.length >= 5,
    // skill
    flawless_boss: (s) => s.stats.flawlessBossKills >= 1,
    combo_10: (s) => s.stats.bestCombo >= 10,
    // secret
    deserter_truth: (s) => Boolean(s.flags['serah_truth']),
    rift_walker: (s) => ['forest_rift', 'marsh_rift', 'citadel_rift'].every((r) => Boolean(s.flags[`${RIFT_FLAG_PREFIX}${r}`])),
};
/**
 * Achievements.
 *
 * Unlocked ids live in save.achievements (v3 field, defaults to []). Progress
 * counters the rules read (kills, crafts, best combo, lifetime coins…) live in
 * save.stats, also v3. check(event, payload) first folds the event into those
 * persisted counters/flags, then re-evaluates every still-locked achievement.
 * This keeps unlocking correct no matter which event fired — e.g. a boss kill
 * updates totalKills AND the boss-specific rules in one pass.
 */
class AchievementSystem {
    constructor(saves) {
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: saves
        });
    }
    // Fold an incoming event into persisted counters/flags so the rules can see it.
    // Kill/coin/craft/upgrade tallies are owned by their own systems where those
    // exist, so here we only record the deltas the achievement layer needs and
    // that no other system is guaranteed to have written yet (combos, flawless
    // kills, story flags, rift/quest bookkeeping).
    ingest(event, payload) {
        this.saves.mutate((save) => {
            var _a;
            switch (event) {
                case 'combo':
                    if (typeof payload.streak === 'number')
                        save.stats.bestCombo = Math.max(save.stats.bestCombo, payload.streak);
                    break;
                case 'boss_flawless':
                    if (payload.enemyId && BOSS_IDS.includes(payload.enemyId))
                        save.stats.flawlessBossKills += 1;
                    break;
                case 'coins':
                    // Two accepted shapes: an incremental `amount` (coins just earned,
                    // accumulated) or an absolute lifetime `total` (kept as a max so
                    // replays never shrink it). Integrators can use whichever is handier.
                    if (typeof payload.amount === 'number' && payload.amount > 0)
                        save.stats.coinsEarned += payload.amount;
                    if (typeof payload.total === 'number')
                        save.stats.coinsEarned = Math.max(save.stats.coinsEarned, payload.total);
                    break;
                case 'quest':
                    if (payload.questId && ((_a = save.questProgress[payload.questId]) === null || _a === void 0 ? void 0 : _a.status) === 'completed') {
                        // questsCompleted is derived from questProgress to stay replay-safe.
                        save.stats.questsCompleted = Object.values(save.questProgress).filter((p) => p.status === 'completed').length;
                    }
                    break;
                case 'rift':
                    if (payload.riftId)
                        save.flags[`${RIFT_FLAG_PREFIX}${payload.riftId}`] = true;
                    break;
                case 'flag':
                    if (payload.flag)
                        save.flags[payload.flag] = true;
                    break;
                default:
                    break;
            }
        }, false);
    }
    /**
     * Feed a gameplay event in. Returns any achievements unlocked as a result so
     * the UI can pop a toast. Safe to call on every event; already-unlocked
     * achievements are skipped.
     */
    check(event, payload = {}) {
        this.ingest(event, payload);
        const save = this.saves.get();
        const unlocked = [];
        for (const achievement of achievements_1.ACHIEVEMENTS) {
            if (save.achievements.includes(achievement.id))
                continue;
            const rule = RULES[achievement.id];
            if (rule && rule(save, payload)) {
                this.unlock(achievement.id);
                unlocked.push(achievement);
            }
        }
        return unlocked;
    }
    // Directly unlock by id (used by check(), and callable for story-scripted
    // grants). No-op if unknown or already unlocked.
    unlock(id) {
        if (!(0, achievements_1.getAchievement)(id))
            return false;
        if (this.saves.get().achievements.includes(id))
            return false;
        this.saves.mutate((save) => {
            if (!save.achievements.includes(id))
                save.achievements.push(id);
        }, true);
        return true;
    }
    isUnlocked(id) {
        return this.saves.get().achievements.includes(id);
    }
    unlockedCount() {
        return this.saves.get().achievements.length;
    }
    total() {
        return achievements_1.ACHIEVEMENTS.length;
    }
    // Catalogue with unlock state applied. Hidden achievements stay in the list
    // (so counts line up) but callers can mask name/description until unlocked.
    listAchievements() {
        const owned = new Set(this.saves.get().achievements);
        return achievements_1.ACHIEVEMENTS.map((achievement) => ({ ...achievement, unlocked: owned.has(achievement.id) }));
    }
}
exports.AchievementSystem = AchievementSystem;

});
__define("src/systems/world/Weather.ts", function(exports, module, __req){
"use strict";
/**
 * Weather.
 *
 * Weather is deliberately not cosmetic here. Rain damps visibility and makes
 * stone slippery-sounding; fog shrinks how far you can see trouble coming; an ash
 * storm near the citadel both obscures and burns. Each state drives a visibility
 * multiplier that the enemy AI reads, so a storm genuinely changes how the game
 * plays rather than just how it looks.
 *
 * Everything is screen-space particles on a fixed budget, so weather costs the
 * same whether you're in a clearing or a forest, and the whole system can be
 * turned down on low-end devices.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherSystem = exports.WEATHER = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
exports.WEATHER = {
    clear: { tint: 0x000000, tintAlpha: 0, visibility: 1, rainVolume: 0, thunderChance: 0, label: 'ЯСНО' },
    overcast: { tint: 0x3a4050, tintAlpha: 0.14, visibility: 0.94, rainVolume: 0, thunderChance: 0, label: 'ПАСМУРНО' },
    rain: { tint: 0x2c3a4a, tintAlpha: 0.24, visibility: 0.82, rainVolume: 0.6, thunderChance: 0.004, label: 'ДОЖДЬ' },
    storm: { tint: 0x1e2636, tintAlpha: 0.4, visibility: 0.64, rainVolume: 1, thunderChance: 0.05, label: 'ГРОЗА' },
    fog: { tint: 0x59606c, tintAlpha: 0.34, visibility: 0.52, rainVolume: 0, thunderChance: 0, label: 'ТУМАН' },
    ashfall: { tint: 0x4a3630, tintAlpha: 0.3, visibility: 0.7, rainVolume: 0, thunderChance: 0.008, label: 'ПЕПЕЛЬНАЯ БУРЯ' },
};
/** Which weather each region can produce, and how likely. */
const REGION_WEATHER = {
    home: [{ kind: 'clear', weight: 5 }, { kind: 'overcast', weight: 3 }, { kind: 'rain', weight: 2 }],
    village: [{ kind: 'clear', weight: 5 }, { kind: 'overcast', weight: 3 }, { kind: 'rain', weight: 2 }],
    cemetery: [{ kind: 'fog', weight: 5 }, { kind: 'overcast', weight: 4 }, { kind: 'rain', weight: 2 }],
    forest: [{ kind: 'overcast', weight: 4 }, { kind: 'clear', weight: 3 }, { kind: 'rain', weight: 3 }, { kind: 'fog', weight: 2 }],
    ruins: [{ kind: 'fog', weight: 4 }, { kind: 'storm', weight: 3 }, { kind: 'overcast', weight: 3 }],
    marsh: [{ kind: 'fog', weight: 6 }, { kind: 'rain', weight: 4 }, { kind: 'storm', weight: 2 }],
    mine: [{ kind: 'overcast', weight: 6 }, { kind: 'fog', weight: 2 }],
    docks: [{ kind: 'rain', weight: 4 }, { kind: 'storm', weight: 3 }, { kind: 'overcast', weight: 3 }, { kind: 'fog', weight: 2 }],
    citadel: [{ kind: 'ashfall', weight: 6 }, { kind: 'storm', weight: 3 }, { kind: 'overcast', weight: 2 }],
    interior: [{ kind: 'clear', weight: 1 }],
};
class WeatherSystem {
    constructor(scene) {
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: scene
        });
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fogLayers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "particles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "current", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'clear'
        });
        Object.defineProperty(this, "target", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'clear'
        });
        /** 0..1 crossfade toward the target profile. */
        Object.defineProperty(this, "blend", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "nextChangeAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "elapsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "quality", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'high'
        });
        Object.defineProperty(this, "onThunder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lightningFlash", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    create(depth = 885, quality = 'high') {
        this.quality = quality;
        const { width, height } = this.scene.scale;
        this.overlay = this.scene.add
            .rectangle(0, 0, width, height, 0x000000, 0)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(depth);
        // Fog is three parallax bands of the soft light texture, stretched wide and
        // drifting at different speeds — cheap but reads as real volumetric haze.
        if (!this.scene.textures.exists('weather-fog')) {
            const texture = this.scene.textures.createCanvas('weather-fog', 256, 128);
            if (texture) {
                const ctx = texture.context;
                const gradient = ctx.createRadialGradient(128, 64, 0, 128, 64, 128);
                gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
                gradient.addColorStop(0.6, 'rgba(255,255,255,0.16)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 256, 128);
                texture.refresh();
            }
        }
        const bands = quality === 'low' ? 2 : 3;
        for (let i = 0; i < bands; i += 1) {
            const image = this.scene.add
                .image(width * 0.5, height * (0.3 + i * 0.24), 'weather-fog')
                .setScrollFactor(0)
                .setDepth(depth - 1)
                .setDisplaySize(width * 1.9, height * (0.5 + i * 0.14))
                .setAlpha(0)
                .setTint(0xaebac9);
            this.fogLayers.push(image);
        }
        this.scene.scale.on('resize', this.handleResize, this);
        this.buildParticles();
    }
    handleResize() {
        var _a;
        const { width, height } = this.scene.scale;
        (_a = this.overlay) === null || _a === void 0 ? void 0 : _a.setSize(width, height);
        this.fogLayers.forEach((layer, i) => {
            layer.setPosition(width * 0.5, height * (0.3 + i * 0.24));
            layer.setDisplaySize(width * 1.9, height * (0.5 + i * 0.14));
        });
    }
    /** Allocate the particle pool once; individual particles are recycled. */
    buildParticles() {
        const count = this.quality === 'low' ? 46 : 130;
        const { width, height } = this.scene.scale;
        for (let i = 0; i < count; i += 1) {
            const object = this.scene.add
                .rectangle(phaser_1.default.Math.Between(0, width), phaser_1.default.Math.Between(0, height), 2, 12, 0xa8bccd, 0)
                .setScrollFactor(0)
                .setDepth(886);
            this.particles.push({ object, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, swayAmount: 0 });
        }
    }
    setQuality(quality) {
        this.quality = quality;
        // Cull half the pool on low quality rather than rebuilding it.
        this.particles.forEach((particle, index) => {
            if (quality === 'low' && index % 3 !== 0)
                particle.object.setVisible(false);
            else
                particle.object.setVisible(true);
        });
    }
    onThunderStrike(callback) {
        this.onThunder = callback;
    }
    /** Force a specific weather, e.g. for a scripted story beat. */
    setWeather(kind, immediate = false) {
        if (kind === this.target && !immediate)
            return;
        this.target = kind;
        if (immediate) {
            this.current = kind;
            this.blend = 1;
        }
        else {
            this.current = this.currentKindForBlend();
            this.blend = 0;
        }
        this.configureParticles(kind);
    }
    currentKindForBlend() {
        return this.blend >= 0.5 ? this.target : this.current;
    }
    /** Pick a plausible weather for a region and schedule the next change. */
    rollForRegion(region) {
        var _a;
        const table = (_a = REGION_WEATHER[region]) !== null && _a !== void 0 ? _a : REGION_WEATHER.village;
        const total = table.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * total;
        for (const entry of table) {
            roll -= entry.weight;
            if (roll <= 0) {
                this.setWeather(entry.kind);
                break;
            }
        }
        // Weather holds for 50-140s so it feels like a system, not a slot machine.
        this.nextChangeAt = this.elapsed + 50 + Math.random() * 90;
    }
    configureParticles(kind) {
        const { width, height } = this.scene.scale;
        for (const particle of this.particles) {
            const object = particle.object;
            switch (kind) {
                case 'rain':
                case 'storm': {
                    const fast = kind === 'storm';
                    object.setSize(2, fast ? 20 : 14).setFillStyle(0xa8c0d4, fast ? 0.5 : 0.36).setRotation(fast ? -0.28 : -0.16);
                    particle.vx = fast ? -260 : -130;
                    particle.vy = fast ? 1150 : 780;
                    particle.swayAmount = 0;
                    break;
                }
                case 'ashfall':
                    // Ash tumbles and drifts rather than falling straight.
                    object.setSize(3, 3).setFillStyle(Math.random() > 0.7 ? 0xff8a52 : 0x8d8079, 0.6).setRotation(0);
                    particle.vx = -26;
                    particle.vy = 54 + Math.random() * 44;
                    particle.swayAmount = 26;
                    break;
                case 'fog':
                case 'overcast':
                case 'clear':
                default:
                    object.setFillStyle(0x000000, 0);
                    particle.vx = 0;
                    particle.vy = 0;
                    particle.swayAmount = 0;
                    break;
            }
            object.setPosition(phaser_1.default.Math.Between(-40, width + 40), phaser_1.default.Math.Between(-height, height));
        }
    }
    /** Blended profile between the outgoing and incoming weather. */
    profile() {
        const from = exports.WEATHER[this.current];
        const to = exports.WEATHER[this.target];
        const t = this.blend;
        return {
            tint: t > 0.5 ? to.tint : from.tint,
            tintAlpha: from.tintAlpha + (to.tintAlpha - from.tintAlpha) * t,
            visibility: from.visibility + (to.visibility - from.visibility) * t,
            rainVolume: from.rainVolume + (to.rainVolume - from.rainVolume) * t,
            thunderChance: from.thunderChance + (to.thunderChance - from.thunderChance) * t,
            label: t > 0.5 ? to.label : from.label,
        };
    }
    getKind() { return this.blend > 0.5 ? this.target : this.current; }
    update(deltaMs, region) {
        var _a;
        const delta = deltaMs / 1000;
        this.elapsed += delta;
        if (this.blend < 1)
            this.blend = Math.min(1, this.blend + delta / 6);
        if (this.elapsed >= this.nextChangeAt)
            this.rollForRegion(region);
        const profile = this.profile();
        const { width, height } = this.scene.scale;
        // Lightning decays fast; it's added on top of the weather tint.
        if (this.lightningFlash > 0)
            this.lightningFlash = Math.max(0, this.lightningFlash - delta * 4.5);
        if (this.overlay) {
            const alpha = profile.tintAlpha;
            this.overlay.setFillStyle(profile.tint, alpha);
            if (this.lightningFlash > 0) {
                this.overlay.setFillStyle(0xc8d4ee, this.lightningFlash * 0.5);
            }
        }
        // Fog bands drift at different rates for a parallax read.
        const fogTarget = this.getKind() === 'fog' ? 0.55 : this.getKind() === 'overcast' ? 0.14 : 0;
        this.fogLayers.forEach((layer, index) => {
            const speed = 8 + index * 6;
            layer.x -= speed * delta;
            if (layer.x < -width * 0.45)
                layer.x = width * 1.45;
            const target = fogTarget * (1 - index * 0.22);
            layer.setAlpha(layer.alpha + (target - layer.alpha) * Math.min(1, delta * 1.2));
        });
        // Precipitation.
        const kind = this.getKind();
        const active = kind === 'rain' || kind === 'storm' || kind === 'ashfall';
        for (const particle of this.particles) {
            if (!active || !particle.object.visible) {
                if (particle.object.alpha !== 0 && !active)
                    particle.object.setAlpha(0);
                continue;
            }
            particle.object.setAlpha(1);
            particle.phase += delta * 2.2;
            const sway = particle.swayAmount > 0 ? Math.sin(particle.phase) * particle.swayAmount * delta : 0;
            particle.object.x += particle.vx * delta + sway;
            particle.object.y += particle.vy * delta;
            if (particle.object.y > height + 30) {
                particle.object.y = -30;
                particle.object.x = phaser_1.default.Math.Between(-40, width + 60);
            }
            if (particle.object.x < -60)
                particle.object.x = width + 40;
        }
        // Thunder.
        if (profile.thunderChance > 0 && Math.random() < profile.thunderChance * delta * 60) {
            this.lightningFlash = 1;
            (_a = this.onThunder) === null || _a === void 0 ? void 0 : _a.call(this);
        }
    }
    destroy() {
        var _a;
        this.scene.scale.off('resize', this.handleResize, this);
        for (const particle of this.particles)
            particle.object.destroy();
        this.particles = [];
        for (const layer of this.fogLayers)
            layer.destroy();
        this.fogLayers = [];
        (_a = this.overlay) === null || _a === void 0 ? void 0 : _a.destroy();
    }
}
exports.WeatherSystem = WeatherSystem;

});
__define("src/systems/combat/EnemyAI.ts", function(exports, module, __req){
"use strict";
/**
 * EnemyAI — per-archetype behaviour for Trupy's mooks.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every enemy used to run one identical "walk straight at the player and touch
 * them" loop, so a husk, a wolf and a fire-mage all fought the same way. That is
 * the single biggest thing flattening combat: the player learns one counter
 * (back-pedal and swing) and it beats the entire bestiary. This module gives
 * each creature a distinct *movement grammar* and a distinct *threat vector*, so
 * the player has to read the enemy's silhouette and change tactics:
 *
 *   - a shambler you can kite but never out-wait (it never gives up),
 *   - a shieldbearer you must flank (frontal damage bounces),
 *   - a wolf pack you must not let surround you (they circle and take turns),
 *   - a wraith you can't reliably combo (it blinks out and reappears),
 *   - a brute you must bait-and-dodge (huge telegraphed slam),
 *   - a skitterer that refuses to hold still (dashes, burrows behind you),
 *   - a ranged ashborn that punishes standing still (the archetype the game
 *     most lacked — a real ranged threat rewrites how the player moves).
 *
 * DESIGN CONTRACT WITH WorldScene
 * -------------------------------
 * This file never touches WorldScene internals. It reads the enemy's existing
 * getData() fields and steers the enemy's Arcade body, and it asks the scene to
 * do the privileged things (deal damage to the player, spawn a projectile, spawn
 * an add) through the callbacks on `AIContext`. That keeps WorldScene the single
 * integrator: it wires the callbacks once and calls `EnemyAI.update(enemy, ctx)`
 * from `updateEnemies`. See the INTEGRATION NOTE at the bottom for exact sites.
 *
 * PERFORMANCE
 * -----------
 * `update` runs for up to ~30 enemies. It allocates nothing per call: all vector
 * maths goes through module-level scratch vectors, and all per-enemy state lives
 * in a single object stashed on the sprite via getData/setData('ai'). The scene
 * already throttles enemy updates to a ~72ms "slow tick", so `context.delta` is
 * ~72ms, not a 16ms frame — behaviours are written in wall-clock time (ms), not
 * frames, so they stay correct at any tick rate.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnemyAI = exports.ARCHETYPE_BY_ENEMY = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
/** The nine content enemies mapped onto their archetype. */
exports.ARCHETYPE_BY_ENEMY = {
    husk: 'shambler',
    boneguard: 'shieldbearer',
    direwolf: 'packHunter',
    wraith: 'phaser',
    bogling: 'brute',
    cavecrawler: 'skitterer',
    ashborn: 'ranged',
    nameless: 'boss',
    cinderlord: 'boss',
};
// ---------------------------------------------------------------------------
// Module-level scratch. Reused across every enemy and every tick so the hot
// path allocates nothing. NEVER return these or hold them across a yield.
// ---------------------------------------------------------------------------
const toPlayer = new phaser_1.default.Math.Vector2();
const perp = new phaser_1.default.Math.Vector2();
const desired = new phaser_1.default.Math.Vector2();
const scratch = new phaser_1.default.Math.Vector2();
/**
 * Elite tuning. Elites are the "oh no" spike: tankier, faster to react, hit
 * harder, and visibly marked. Kept modest on damage (the player's health pool is
 * small) but generous on HP so they change the *pacing* of a fight, not just its
 * lethality.
 */
const ELITE_HEALTH_MULT = 2.35;
const ELITE_DAMAGE_MULT = 1.4;
const ELITE_SPEED_MULT = 1.12;
/** Base chance a normal (non-boss, non-rift-forced) spawn rolls elite. */
const ELITE_CHANCE = 0.09;
/** A warm gold-ish shift laid over the enemy's tint so elites read instantly. */
const ELITE_TINT = 0xffd27a;
exports.EnemyAI = {
    /**
     * Decide (once, at spawn) whether an enemy is elite and, if so, buff it in
     * place. Returns true if it became elite. WorldScene calls this right after it
     * finishes `setData` in `spawnEnemy`, before adding the health bar, so the
     * buffed maxHealth is what the bar reads.
     *
     * `force` lets callers opt a spawn in/out (bosses never elite; a rift could
     * force one). `chanceMult` lets night/danger raise the elite rate.
     */
    rollElite(enemy, opts = {}) {
        var _a, _b;
        const type = String(enemy.getData('type'));
        const archetype = (_a = exports.ARCHETYPE_BY_ENEMY[type]) !== null && _a !== void 0 ? _a : 'shambler';
        if (archetype === 'boss')
            return false; // bosses are their own event
        const forced = opts.force === true;
        const chance = Math.min(0.4, ELITE_CHANCE * ((_b = opts.chanceMult) !== null && _b !== void 0 ? _b : 1));
        const isElite = forced || Math.random() < chance;
        if (!isElite) {
            enemy.setData('elite', false);
            return false;
        }
        enemy.setData('elite', true);
        const maxHealth = Math.round(Number(enemy.getData('maxHealth')) * ELITE_HEALTH_MULT);
        enemy.setData('maxHealth', maxHealth);
        enemy.setData('health', maxHealth);
        enemy.setData('damage', Math.round(Number(enemy.getData('damage')) * ELITE_DAMAGE_MULT));
        enemy.setData('speed', Math.round(Number(enemy.getData('speed')) * ELITE_SPEED_MULT));
        // Elites drop more: WorldScene reads this multiplier in killEnemy.
        enemy.setData('lootMult', 2);
        // A colour-shifted tint + a subtle scale bump so the silhouette reads as
        // "bigger, hotter, dangerous" before any number is visible.
        enemy.setTint(ELITE_TINT);
        enemy.setData('eliteTint', ELITE_TINT);
        enemy.setScale(enemy.scaleX * 1.14, enemy.scaleY * 1.14);
        return true;
    },
    /**
     * Attach a floating marker above an elite so the player can pick it out of a
     * crowd. Returns the marker (a Text) or undefined for non-elites. WorldScene
     * owns the object's lifetime; it should destroy it in killEnemy alongside the
     * health bar. Kept here so all elite presentation lives in one place.
     */
    createEliteMarker(scene, enemy) {
        if (!enemy.getData('elite'))
            return undefined;
        const marker = scene.add
            .text(enemy.x, enemy.y - enemy.displayHeight * 0.62, '✦', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffdc86',
            stroke: '#2a1a06',
            strokeThickness: 4,
        })
            .setOrigin(0.5)
            .setDepth(enemy.depth + 3);
        return marker;
    },
    /**
     * The per-tick brain. Steers the enemy's body, plays animations, and requests
     * privileged actions via the context. Returns whether this enemy is in combat
     * this tick, so the scene can keep its existing `combat` flag / music logic
     * (it OR-reduces the return across all enemies).
     *
     * WorldScene calls this INSTEAD of its old inline chase+`tryEnemySpecial`
     * block, once per non-boss enemy inside the range check. Boss sprites return
     * false immediately (their fight is driven by BossFight.ts).
     */
    update(enemy, ctx) {
        const body = enemy.body;
        if (!body || !enemy.active)
            return false;
        const state = getState(enemy);
        if (state.archetype === 'boss') {
            // Boss movement/attacks are BossFight's job. Leave the body untouched so
            // the two systems never fight over velocity.
            return false;
        }
        const type = String(enemy.getData('type'));
        const baseAggro = Number(enemy.getData('aggro')) || 240;
        const speed = Number(enemy.getData('speed')) || 60;
        const damage = Number(enemy.getData('damage')) || 10;
        // ---- Detection. Fog shrinks it (visibility<1), night grows it (danger>1),
        // so the same enemy is a longer-range threat in the dark and an ambush in
        // fog. Elites are more alert. This is the core of "the weather changes how
        // the game plays" — a foggy marsh genuinely hides the drowned until close.
        const detectRange = baseAggro * ctx.visibility * (0.85 + ctx.danger * 0.35) * (state.elite ? 1.2 : 1);
        toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
        const distance = toPlayer.length();
        // ---- Alert state machine: idle → alerted → engaged.
        // The alerted beat (a brief pause + a "notice" cue) is what makes stealth
        // and fog meaningful: you get a heartbeat of warning, or you get the drop.
        updateAlert(enemy, state, ctx, distance, detectRange);
        if (state.alert === 'idle') {
            idleWander(enemy, body, ctx, state, speed);
            return false;
        }
        if (state.alert === 'alerted') {
            // Freeze-and-notice: hold position, face the player, play idle. This is the
            // fair-warning window before the enemy commits.
            body.setVelocity(0, 0);
            faceTarget(enemy, ctx.playerX);
            playLoop(enemy, type, 'idle');
            return true;
        }
        // ---- Engaged: dispatch to the archetype behaviour. Each returns whether it
        // wants the "in combat" flag set (essentially always true when engaged).
        switch (state.archetype) {
            case 'shambler':
                return behaveShambler(enemy, body, ctx, state, type, distance, speed, damage);
            case 'shieldbearer':
                return behaveShieldbearer(enemy, body, ctx, state, type, distance, speed, damage);
            case 'packHunter':
                return behavePackHunter(enemy, body, ctx, state, type, distance, speed, damage);
            case 'phaser':
                return behavePhaser(enemy, body, ctx, state, type, distance, speed, damage);
            case 'brute':
                return behaveBrute(enemy, body, ctx, state, type, distance, speed, damage);
            case 'skitterer':
                return behaveSkitterer(enemy, body, ctx, state, type, distance, speed, damage);
            case 'ranged':
                return behaveRanged(enemy, body, ctx, state, type, distance, speed, damage);
            default:
                return false;
        }
    },
    /**
     * Frontal damage reduction for shieldbearers. WorldScene calls this in
     * `damageEnemy` to fold the shield into the incoming hit: a blow landing on
     * the raised shield (player in front of the facing arc) is cut ~60%, so the
     * player is pushed to flank. Returns the (possibly reduced) damage.
     *
     * Non-shieldbearers and shield-lowered states return `damage` unchanged.
     */
    mitigateDamage(enemy, damage, attackerX, attackerY) {
        const state = enemy.getData('ai');
        if (!state || state.archetype !== 'shieldbearer')
            return damage;
        if (state.phase === 'open')
            return damage; // shield lowered to strike = real opening
        // Shield faces the player when raised. The enemy's flipX encodes facing:
        // flipX=true → facing left (−x). Compare the attack's incoming direction to
        // the shield normal; a frontal hit is mitigated, a flank/back hit is not.
        const facingX = enemy.flipX ? -1 : 1;
        const dx = attackerX - enemy.x;
        const dy = attackerY - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        // dot of (attacker→direction) with facing on x, plus a small vertical
        // tolerance so "in front" is a ~120° frontal cone, not a razor line.
        const frontal = (dx / len) * facingX;
        if (frontal > 0.35 && Math.abs(dy) < len * 0.85) {
            return Math.max(1, Math.round(damage * 0.4)); // ~60% reduction
        }
        return damage;
    },
    /** True if the sprite is currently intangible (wraith mid-blink): the scene
     * skips damage entirely. Cheap read for the melee/projectile hit paths. */
    isIntangible(enemy) {
        const state = enemy.getData('ai');
        return Boolean(state && state.archetype === 'phaser' && state.phase === 'blink');
    },
    /** Reset cached AI state — call if an enemy sprite is recycled to a new type. */
    reset(enemy) {
        enemy.setData('ai', undefined);
    },
    /**
     * Blind an enemy for `durationMs`: drop it straight back to idle and prevent it
     * from detecting or re-acquiring the player until the timer expires. This is the
     * public hook the smoke bomb (SmokeBomb.ts) uses so an enemy caught in the cloud
     * loses aggro and can't lock back on while the smoke lingers.
     *
     * Bosses are intentionally immune — their fights are choreographed by
     * BossFight.ts and must not be interrupted by a consumable. Calling this on a
     * boss is a harmless no-op.
     *
     * Time is read from the enemy's scene clock so the caller doesn't have to pass
     * `time` in; the AI update path compares against the same clock.
     */
    blind(enemy, durationMs) {
        var _a, _b;
        if (!enemy.active)
            return;
        const state = getState(enemy);
        if (state.archetype === 'boss')
            return;
        const now = (_b = (_a = enemy.scene) === null || _a === void 0 ? void 0 : _a.time.now) !== null && _b !== void 0 ? _b : 0;
        state.blindUntil = Math.max(state.blindUntil, now + Math.max(0, durationMs));
        // Immediately forget the player: reset the alert machine and any committed
        // attack phase so the enemy visibly disengages the instant the smoke lands.
        state.alert = 'idle';
        state.phase = 'approach';
        state.alertedAt = 0;
        state.until = 0;
    },
    /** True if the enemy is currently blinded by smoke (for scene-side visuals). */
    isBlinded(enemy) {
        var _a, _b;
        const state = enemy.getData('ai');
        if (!state)
            return false;
        return state.blindUntil > ((_b = (_a = enemy.scene) === null || _a === void 0 ? void 0 : _a.time.now) !== null && _b !== void 0 ? _b : 0);
    },
};
// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------
function getState(enemy) {
    var _a;
    let state = enemy.getData('ai');
    const type = String(enemy.getData('type'));
    const archetype = (_a = exports.ARCHETYPE_BY_ENEMY[type]) !== null && _a !== void 0 ? _a : 'shambler';
    if (!state || state.archetype !== archetype) {
        state = {
            archetype,
            alert: 'idle',
            phase: 'approach',
            until: 0,
            nextSpecial: 0,
            orbitSign: Math.random() < 0.5 ? -1 : 1,
            elite: Boolean(enemy.getData('elite')),
            alertedAt: 0,
            blindUntil: 0,
        };
        enemy.setData('ai', state);
    }
    return state;
}
/**
 * idle→alerted→engaged transitions. Alerted is a short (350ms) beat: the enemy
 * has noticed but hasn't committed. Losing sight (player leaves 1.4× detect,
 * e.g. by breaking away in fog) drops it back toward idle after a grace period,
 * so enemies genuinely "lose" you rather than tracking forever.
 */
function updateAlert(enemy, state, ctx, distance, detectRange) {
    // Smoke blindness overrides everything: while the timer is live the enemy
    // simply cannot perceive the player, so it falls back to idle wander and can't
    // re-engage from inside the cloud.
    const blinded = state.blindUntil > ctx.time;
    const seen = !blinded && distance < detectRange && ctx.playerAlive;
    switch (state.alert) {
        case 'idle':
            if (seen) {
                state.alert = 'alerted';
                state.alertedAt = ctx.time;
                // A small "!" so the noticing is legible to the player, scaled down when
                // motion is reduced (still shown — it's information, not decoration).
                spawnAlertMark(enemy);
            }
            break;
        case 'alerted':
            if (!seen) {
                state.alert = 'idle';
            }
            else if (ctx.time > state.alertedAt + 350) {
                state.alert = 'engaged';
            }
            break;
        case 'engaged':
            // Grace: only disengage once the player is well outside detection, and
            // give the enemy a moment so a single fog wisp doesn't reset the fight.
            if (distance > detectRange * 1.5 || !ctx.playerAlive) {
                if (state.until < ctx.time) {
                    state.alert = 'idle';
                    state.phase = 'approach';
                }
            }
            else {
                state.until = ctx.time + 900; // keep the fight alive while in range
            }
            break;
    }
}
function spawnAlertMark(enemy) {
    const scene = enemy.scene;
    if (!scene)
        return;
    const mark = scene.add
        .text(enemy.x, enemy.y - enemy.displayHeight * 0.5, '!', {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffe08a',
        stroke: '#1a1206',
        strokeThickness: 4,
    })
        .setOrigin(0.5)
        .setDepth(enemy.depth + 4);
    scene.tweens.add({
        targets: mark,
        y: mark.y - 12,
        alpha: 0,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => mark.destroy(),
    });
}
/** Idle behaviour when the player is unseen: a gentle drift near home. Mirrors
 * the scene's old home-tether so enemies don't wander off their spawn zone. */
function idleWander(enemy, body, ctx, state, speed) {
    const homeX = Number(enemy.getData('homeX'));
    const homeY = Number(enemy.getData('homeY'));
    const type = String(enemy.getData('type'));
    const homeDist = phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, homeX, homeY);
    if (homeDist > 55) {
        desired.set(homeX - enemy.x, homeY - enemy.y).normalize().scale(speed * 0.45);
        body.setVelocity(desired.x, desired.y);
        playLoop(enemy, type, 'walk');
        faceTarget(enemy, homeX);
    }
    else {
        // Tiny sinusoidal shuffle so idle enemies breathe rather than freeze.
        body.setVelocity(Math.sin((ctx.time + homeX) * 0.001) * 8, Math.cos((ctx.time + homeY) * 0.0012) * 8);
        playLoop(enemy, type, 'idle');
    }
    void state;
}
/**
 * Play a looping pose (idle/walk) if not already the current animation. Guards
 * against restarting the anim every tick (which would freeze it on frame 0).
 */
function playLoop(enemy, type, pose) {
    var _a, _b;
    const key = `enemy-${type}-${pose}`;
    const current = (_a = enemy.anims.currentAnim) === null || _a === void 0 ? void 0 : _a.key;
    if (current !== key && ((_b = enemy.scene) === null || _b === void 0 ? void 0 : _b.anims.exists(key))) {
        enemy.play(key, true);
    }
}
/**
 * Play a one-shot pose (attack). Lets it run to completion; the loop poses will
 * take back over once it finishes. Returns nothing; safe to call repeatedly (it
 * no-ops while the same one-shot is already playing).
 */
function playOnce(enemy, type, pose) {
    var _a, _b;
    const key = `enemy-${type}-${pose}`;
    const anims = enemy.anims;
    if (anims.isPlaying && ((_a = anims.currentAnim) === null || _a === void 0 ? void 0 : _a.key) === key)
        return;
    if ((_b = enemy.scene) === null || _b === void 0 ? void 0 : _b.anims.exists(key))
        enemy.play(key, true);
}
/** Face the given world x by flipping the sprite. flipX=true means facing −x. */
function faceTarget(enemy, targetX) {
    enemy.setFlipX(targetX < enemy.x);
}
/** Move toward a world point at `speed`, updating facing + walk anim. */
function moveToward(enemy, body, tx, ty, speed, type) {
    desired.set(tx - enemy.x, ty - enemy.y);
    if (desired.lengthSq() > 0.001)
        desired.normalize().scale(speed);
    body.setVelocity(desired.x, desired.y);
    faceTarget(enemy, tx);
    playLoop(enemy, type, 'walk');
}
/**
 * A ground telegraph ring that fills over `windup` ms then fires `onFire`. This
 * is the single most important fairness primitive: every dangerous enemy attack
 * shows this first, so a hit is always the player's mistake, never a surprise.
 * Scales its particle/stroke work down on low quality and reduced motion.
 */
function telegraph(scene, x, y, radius, color, windup, ctx, onFire) {
    const alpha = ctx.reducedMotion ? 0.22 : 0.14;
    const ring = scene.add
        .circle(x, y, radius, color, alpha)
        .setStrokeStyle(ctx.lowQuality ? 3 : 5, color, 0.9)
        .setDepth(880);
    scene.tweens.add({
        targets: ring,
        scale: ctx.reducedMotion ? 1.05 : 1.2,
        alpha: alpha + 0.24,
        duration: windup,
        onComplete: () => {
            ring.destroy();
            onFire();
        },
    });
}
// ---------------------------------------------------------------------------
// SHAMBLER (husk) — slow, relentless, no retreat. It never kites, never gives
// ground; the pressure is that it simply keeps coming. Its one trick is a short
// lunge when it gets close, so a player who lets it into melee eats a bite.
// The fantasy: attrition. You can out-run it, but you can't out-wait it.
// ---------------------------------------------------------------------------
function behaveShambler(enemy, body, ctx, state, type, distance, speed, damage) {
    const scene = enemy.scene;
    const meleeRange = 40 + enemy.displayWidth * 0.18;
    if (state.phase === 'lunge') {
        // Committed lunge: velocity already set; just wait it out, then recover.
        if (ctx.time > state.until)
            state.phase = 'approach';
        if (distance < meleeRange + 6)
            tryTouch(enemy, ctx, damage, 1.3);
        return true;
    }
    // Wind up a lunge when close and off cooldown.
    if (distance < meleeRange + 34 && ctx.time > state.nextSpecial && scene) {
        state.phase = 'lunge';
        state.until = ctx.time + 260;
        state.nextSpecial = ctx.time + 2200;
        playOnce(enemy, type, 'attack');
        toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y).normalize();
        body.setVelocity(toPlayer.x * speed * 3.4, toPlayer.y * speed * 3.4);
        faceTarget(enemy, ctx.playerX);
        return true;
    }
    // Otherwise: relentless plod straight at the player.
    moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
    if (distance < meleeRange)
        tryTouch(enemy, ctx, damage, 1);
    return true;
}
// ---------------------------------------------------------------------------
// SHIELDBEARER (boneguard) — advances behind a raised shield. Frontal damage is
// cut ~60% (see mitigateDamage), so trading blows head-on is a losing game; the
// player must circle to its flank. Periodically it LOWERS the shield to wind up
// a heavy bash — a real, readable opening where it takes full damage. The
// fantasy: a puzzle of positioning, not a DPS race.
// ---------------------------------------------------------------------------
function behaveShieldbearer(enemy, body, ctx, state, type, distance, speed, damage) {
    const meleeRange = 46 + enemy.displayWidth * 0.18;
    if (state.phase === 'open') {
        // Shield down, mid-bash. Full-damage window. Freeze in place for the strike.
        if (ctx.time > state.until) {
            state.phase = 'guard';
            state.nextSpecial = ctx.time + 2600;
        }
        body.setVelocity(0, 0);
        faceTarget(enemy, ctx.playerX);
        if (distance < meleeRange + 10)
            tryTouch(enemy, ctx, damage, 1.5);
        return true;
    }
    // Guarding: advance slowly, shield up (mitigation active), always facing the
    // player so the shield stays between them. Slower than a mook — it's a wall.
    faceTarget(enemy, ctx.playerX);
    if (distance > meleeRange - 4) {
        moveToward(enemy, body, ctx.playerX, ctx.playerY, speed * 0.9, type);
        faceTarget(enemy, ctx.playerX); // moveToward faces travel dir; re-face player
    }
    else {
        body.setVelocity(0, 0);
        playLoop(enemy, type, 'idle');
    }
    // Drop the guard to bash when in range and off cooldown — the opening.
    if (distance < meleeRange + 8 && ctx.time > state.nextSpecial) {
        state.phase = 'open';
        state.until = ctx.time + 520; // vulnerable while the shield is down
        playOnce(enemy, type, 'attack');
        if (enemy.scene && !ctx.reducedMotion) {
            // A brief glint where the shield drops, so the opening is legible.
            const glint = enemy.scene.add
                .circle(enemy.x, enemy.y - 6, 7, 0xffe6b0, 0.5)
                .setDepth(enemy.depth + 3);
            enemy.scene.tweens.add({ targets: glint, alpha: 0, scale: 1.6, duration: 300, onComplete: () => glint.destroy() });
        }
    }
    return true;
}
// ---------------------------------------------------------------------------
// PACK HUNTER (direwolf) — does not charge in a straight line; it circles,
// looking for an opening, and the pack COORDINATES: only one wolf commits to a
// lunge at a time (a shared token via the nearest-wolf check), so the player
// faces staggered attacks instead of an alpha-strike blob. After a lunge it
// retreats to reposition. The fantasy: being hunted by something smart.
// ---------------------------------------------------------------------------
function behavePackHunter(enemy, body, ctx, state, type, distance, speed, damage) {
    const lungeRange = 300;
    if (state.phase === 'lunge') {
        if (ctx.time > state.until) {
            state.phase = 'retreat';
            state.until = ctx.time + 700;
        }
        if (distance < 60)
            tryTouch(enemy, ctx, damage, 1.35);
        return true;
    }
    if (state.phase === 'retreat') {
        // Pull back after striking to reset — this is what makes the pack read as
        // "circling for another pass" rather than piling on.
        if (ctx.time > state.until)
            state.phase = 'circle';
        toPlayer.set(enemy.x - ctx.playerX, enemy.y - ctx.playerY).normalize();
        body.setVelocity(toPlayer.x * speed, toPlayer.y * speed);
        faceTarget(enemy, ctx.playerX);
        playLoop(enemy, type, 'walk');
        return true;
    }
    // Default: circle. Move mostly tangentially around the player with a slight
    // inward bias, at the circling radius.
    const orbitRadius = 150;
    toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
    const dist = toPlayer.length() || 1;
    toPlayer.scale(1 / dist);
    perp.set(-toPlayer.y * state.orbitSign, toPlayer.x * state.orbitSign);
    // Blend tangential + radial (in if far, out if too close) so wolves settle
    // onto the ring instead of spiralling in.
    const radialBias = distance > orbitRadius ? 0.55 : -0.35;
    desired.set(perp.x + toPlayer.x * radialBias, perp.y + toPlayer.y * radialBias).normalize().scale(speed);
    body.setVelocity(desired.x, desired.y);
    faceTarget(enemy, ctx.playerX);
    playLoop(enemy, type, 'walk');
    // Commit to a lunge only if this wolf currently "holds the token": it is the
    // nearest engaged wolf to the player and no wolf lunged very recently. This
    // sequences the pack.
    if (distance < lungeRange &&
        ctx.time > state.nextSpecial &&
        packHoldsToken(enemy, ctx)) {
        state.phase = 'lunge';
        state.until = ctx.time + 300;
        state.nextSpecial = ctx.time + 2600;
        setPackLungeStamp(ctx, ctx.time);
        playOnce(enemy, type, 'attack');
        if (enemy.scene) {
            const line = enemy.scene.add
                .line(0, 0, enemy.x, enemy.y, ctx.playerX, ctx.playerY, 0xd9a06a, 0.6)
                .setOrigin(0)
                .setLineWidth(ctx.lowQuality ? 2 : 4)
                .setDepth(878);
            enemy.scene.tweens.add({ targets: line, alpha: 0, duration: 260, onComplete: () => line.destroy() });
        }
        toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y).normalize();
        body.setVelocity(toPlayer.x * speed * 3.6, toPlayer.y * speed * 3.6);
    }
    return true;
}
/**
 * Pack coordination token. A wolf may lunge only if it is the closest engaged
 * wolf to the player AND at least ~700ms has passed since any wolf last lunged.
 * The stamp is stored on the scene's data manager (registry-free) via a shared
 * WeakMap keyed by scene, so no globals leak across scene restarts.
 */
const lastPackLunge = new WeakMap();
function setPackLungeStamp(ctx, time) {
    var _a;
    const scene = (_a = ctx.enemies[0]) === null || _a === void 0 ? void 0 : _a.scene;
    if (scene)
        lastPackLunge.set(scene, time);
}
function packHoldsToken(enemy, ctx) {
    var _a;
    const scene = enemy.scene;
    if (!scene)
        return true;
    const last = (_a = lastPackLunge.get(scene)) !== null && _a !== void 0 ? _a : -9999;
    if (ctx.time < last + 700)
        return false; // another wolf just went; wait our turn
    const myDist = phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, ctx.playerX, ctx.playerY);
    for (const other of ctx.enemies) {
        if (other === enemy || !other.active)
            continue;
        if (String(other.getData('type')) !== 'direwolf')
            continue;
        const otherState = other.getData('ai');
        if (!otherState || otherState.alert !== 'engaged')
            continue;
        const d = phaser_1.default.Math.Distance.Between(other.x, other.y, ctx.playerX, ctx.playerY);
        if (d < myDist - 1)
            return false; // someone is closer; let them lead
    }
    return true;
}
// ---------------------------------------------------------------------------
// PHASER (wraith) — teleports short hops toward the player, going briefly
// intangible (immune) mid-blink then reappearing, often beside or behind the
// target. It drifts through terrain (its body already ignores collision in the
// scene sense — we simply never path it around walls). The fantasy: an enemy you
// can't reliably combo, that punishes tunnel-vision by reappearing off-angle.
// ---------------------------------------------------------------------------
function behavePhaser(enemy, body, ctx, state, type, distance, speed, damage) {
    const scene = enemy.scene;
    const meleeRange = 44;
    if (state.phase === 'blink') {
        // Intangible transit. Body is parked (we hard-set position on arrival); the
        // sprite is faded so the player reads "can't hit this right now".
        if (ctx.time > state.until) {
            // Reappear at the stashed destination.
            const dx = Number(enemy.getData('blinkX'));
            const dy = Number(enemy.getData('blinkY'));
            enemy.setPosition(dx, dy);
            enemy.setAlpha(1);
            state.phase = 'approach';
            if (scene && !ctx.lowQuality) {
                const pop = scene.add.circle(dx, dy, 10, 0x9d7be0, 0.5).setDepth(enemy.depth + 2);
                scene.tweens.add({ targets: pop, scale: 2, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
            }
        }
        body.setVelocity(0, 0);
        return true;
    }
    // Drift toward the player through anything (no wall avoidance by design).
    moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
    // Touch damage in melee.
    if (distance < meleeRange)
        tryTouch(enemy, ctx, damage, 1);
    // Start a blink when it's time: fade out, stash a destination near/behind the
    // player, and go intangible for the transit window.
    if (ctx.time > state.nextSpecial && distance < 360 && scene) {
        state.phase = 'blink';
        state.until = ctx.time + 340;
        state.nextSpecial = ctx.time + 2400;
        playOnce(enemy, type, 'attack');
        // Destination: a point on the far side of the player (flank/behind), so the
        // wraith keeps ending up off the player's facing.
        scratch.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
        if (scratch.lengthSq() < 1)
            scratch.set(1, 0);
        scratch.normalize();
        const behindDist = 70;
        const destX = phaser_1.default.Math.Clamp(ctx.playerX + scratch.x * behindDist, 40, 4860);
        const destY = phaser_1.default.Math.Clamp(ctx.playerY + scratch.y * behindDist, 40, 2760);
        enemy.setData('blinkX', destX);
        enemy.setData('blinkY', destY);
        enemy.setAlpha(0.28);
        body.setVelocity(0, 0);
        // A departure wisp at the origin.
        if (!ctx.lowQuality) {
            const wisp = scene.add.circle(enemy.x, enemy.y, 9, 0x8d63c4, 0.45).setDepth(enemy.depth + 2);
            scene.tweens.add({ targets: wisp, scale: 2.1, alpha: 0, duration: 280, onComplete: () => wisp.destroy() });
        }
    }
    return true;
}
// ---------------------------------------------------------------------------
// BRUTE (bogling) — slow and heavy with a big HP pool and one huge, telegraphed
// slam that puts out a ground shockwave. Its whole threat is the slam: a wide
// wind-up ring you must be out of when it lands. The fantasy: a lumbering
// pressure that forces committed dodges rather than continuous poking.
// ---------------------------------------------------------------------------
function behaveBrute(enemy, body, ctx, state, type, distance, speed, damage) {
    const scene = enemy.scene;
    const slamRange = 150;
    if (state.phase === 'slam') {
        // Rooted during the wind-up (the telegraph tween handles the payload).
        body.setVelocity(0, 0);
        if (ctx.time > state.until)
            state.phase = 'approach';
        return true;
    }
    // Advance slowly.
    moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
    if (distance < 42 + enemy.displayWidth * 0.18)
        tryTouch(enemy, ctx, damage, 1);
    // Telegraphed slam with a ground shockwave.
    if (distance < slamRange && ctx.time > state.nextSpecial && scene) {
        state.phase = 'slam';
        const windup = 620;
        state.until = ctx.time + windup + 120;
        state.nextSpecial = ctx.time + 3200;
        playOnce(enemy, type, 'attack');
        faceTarget(enemy, ctx.playerX);
        const slamX = enemy.x;
        const slamY = enemy.y;
        const radius = 118;
        telegraph(scene, slamX, slamY, radius, 0x83d6ad, windup, ctx, () => {
            // Shockwave ring expands outward; anyone inside `radius` at impact is hit.
            if (!enemy.active)
                return;
            const wave = scene.add
                .circle(slamX, slamY, 24, 0x4fa985, 0.6)
                .setDepth(enemy.depth + 1);
            scene.tweens.add({ targets: wave, radius: radius + 18, alpha: 0, duration: 360, onComplete: () => wave.destroy() });
            if (!ctx.reducedMotion)
                scene.cameras.main.shake(160, 0.006);
            if (phaser_1.default.Math.Distance.Between(slamX, slamY, ctx.playerX, ctx.playerY) < radius) {
                ctx.hurtPlayer(Math.round(damage * 1.5));
            }
        });
    }
    return true;
}
// ---------------------------------------------------------------------------
// SKITTERER (cavecrawler) — fast and erratic. It dashes in bursts at odd angles
// rather than tracking smoothly, and periodically BURROWS, vanishing and
// re-emerging behind the player. The fantasy: a jittery, hard-to-pin target
// that keeps getting behind you — punishes players who don't keep moving.
// ---------------------------------------------------------------------------
function behaveSkitterer(enemy, body, ctx, state, type, distance, speed, damage) {
    const scene = enemy.scene;
    const meleeRange = 40 + enemy.displayWidth * 0.16;
    if (state.phase === 'burrow') {
        // Underground: intangible-ish (we just hide + park), emerge behind player.
        if (ctx.time > state.until) {
            scratch.set(enemy.x - ctx.playerX, enemy.y - ctx.playerY);
            if (scratch.lengthSq() < 1)
                scratch.set(1, 0);
            scratch.normalize();
            const emergeX = phaser_1.default.Math.Clamp(ctx.playerX - scratch.x * 60, 40, 4860);
            const emergeY = phaser_1.default.Math.Clamp(ctx.playerY - scratch.y * 60, 40, 2760);
            enemy.setPosition(emergeX, emergeY).setAlpha(1).setVisible(true);
            state.phase = 'dash';
            state.until = ctx.time + 220;
            toPlayer.set(ctx.playerX - emergeX, ctx.playerY - emergeY).normalize();
            body.setVelocity(toPlayer.x * speed * 2.2, toPlayer.y * speed * 2.2);
            if (scene && !ctx.lowQuality) {
                const dirt = scene.add.circle(emergeX, emergeY, 12, 0x8b7159, 0.55).setDepth(enemy.depth + 2);
                scene.tweens.add({ targets: dirt, scale: 2.2, alpha: 0, duration: 300, onComplete: () => dirt.destroy() });
            }
        }
        else {
            body.setVelocity(0, 0);
        }
        return true;
    }
    if (state.phase === 'dash') {
        // Committed erratic dash: hold velocity, then re-choose.
        if (ctx.time > state.until)
            state.phase = 'approach';
        if (distance < meleeRange)
            tryTouch(enemy, ctx, damage, 1.2);
        return true;
    }
    // Approach in stutter-dashes at a jittered angle, not a smooth line.
    if (ctx.time > state.until) {
        state.until = ctx.time + 260;
        const jitter = (Math.random() - 0.5) * 0.9; // radians of wobble off-axis
        toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
        const ang = Math.atan2(toPlayer.y, toPlayer.x) + jitter;
        body.setVelocity(Math.cos(ang) * speed * 1.6, Math.sin(ang) * speed * 1.6);
        faceTarget(enemy, ctx.playerX);
        playLoop(enemy, type, 'walk');
    }
    if (distance < meleeRange)
        tryTouch(enemy, ctx, damage, 1.1);
    // Burrow to reposition behind the player.
    if (ctx.time > state.nextSpecial && distance < 340 && distance > 60 && scene) {
        state.phase = 'burrow';
        state.until = ctx.time + 520;
        state.nextSpecial = ctx.time + 3000;
        playOnce(enemy, type, 'attack');
        enemy.setAlpha(0.15);
        body.setVelocity(0, 0);
        if (!ctx.lowQuality) {
            const dust = scene.add.circle(enemy.x, enemy.y, 12, 0x6f5a44, 0.5).setDepth(enemy.depth + 1);
            scene.tweens.add({ targets: dust, scale: 2, alpha: 0, duration: 320, onComplete: () => dust.destroy() });
        }
    }
    return true;
}
// ---------------------------------------------------------------------------
// RANGED (ashborn) — THE archetype the game most lacked. Keeps its distance and
// lobs fire projectiles; when the player closes, it back-pedals to re-open the
// gap before firing again. A single ranged threat changes the whole spatial
// game: the player can no longer treat "far away" as "safe", and must choose
// between chasing the ashborn or dodging its shots while fighting melee mobs.
// The fantasy: a zoner that dictates the range of the fight.
// ---------------------------------------------------------------------------
function behaveRanged(enemy, body, ctx, state, type, distance, speed, damage) {
    const scene = enemy.scene;
    const preferredMin = 190; // too close → retreat
    const preferredMax = 330; // too far → advance
    const fireRange = 380;
    if (state.phase === 'cast') {
        // Rooted during the cast wind-up; the telegraph fires the projectile.
        body.setVelocity(0, 0);
        faceTarget(enemy, ctx.playerX);
        if (ctx.time > state.until)
            state.phase = 'approach';
        return true;
    }
    // Kiting movement: retreat if the player is inside preferredMin, close if
    // beyond preferredMax, otherwise strafe to keep a clean line of sight.
    if (distance < preferredMin) {
        toPlayer.set(enemy.x - ctx.playerX, enemy.y - ctx.playerY).normalize().scale(speed * 1.15);
        body.setVelocity(toPlayer.x, toPlayer.y);
        faceTarget(enemy, ctx.playerX);
        playLoop(enemy, type, 'walk');
    }
    else if (distance > preferredMax) {
        moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
        faceTarget(enemy, ctx.playerX);
    }
    else {
        // In the sweet spot: gentle strafe so it isn't a stationary turret.
        toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
        const d = toPlayer.length() || 1;
        toPlayer.scale(1 / d);
        perp.set(-toPlayer.y * state.orbitSign, toPlayer.x * state.orbitSign).scale(speed * 0.5);
        body.setVelocity(perp.x, perp.y);
        faceTarget(enemy, ctx.playerX);
        playLoop(enemy, type, 'walk');
    }
    // Fire a telegraphed fireball when in range and off cooldown.
    if (distance < fireRange && ctx.time > state.nextSpecial && scene) {
        state.phase = 'cast';
        const windup = 460;
        state.until = ctx.time + windup + 80;
        state.nextSpecial = ctx.time + (state.elite ? 1500 : 2100);
        playOnce(enemy, type, 'attack');
        faceTarget(enemy, ctx.playerX);
        // A charge glow at the caster that resolves into the shot.
        const originX = enemy.x;
        const originY = enemy.y;
        if (!ctx.lowQuality) {
            const charge = scene.add.circle(originX, originY - 4, 5, 0xff9d68, 0.6).setDepth(enemy.depth + 3);
            scene.tweens.add({ targets: charge, scale: 2.4, alpha: 0, duration: windup, onComplete: () => charge.destroy() });
        }
        scene.time.delayedCall(windup, () => {
            if (!enemy.active)
                return;
            // Aim at the player's position AT FIRE TIME (leading is unfair with a slow
            // lob — this way a moving player naturally dodges, rewarding movement).
            ctx.spawnProjectile({
                x: originX,
                y: originY - 6,
                targetX: ctx.playerX,
                targetY: ctx.playerY,
                damage: Math.round(damage * 1.1),
                speed: 260,
                kind: 'fire',
                source: enemy,
            });
        });
    }
    return true;
}
// ---------------------------------------------------------------------------
// Touch-attack helper. Applies the scene's melee hit through the context (which
// respects the player's i-frames) on the enemy's own attack cadence, and plays
// the attack pose. `mult` scales the enemy's base damage for lunges/bashes.
// ---------------------------------------------------------------------------
function tryTouch(enemy, ctx, damage, mult) {
    const last = Number(enemy.getData('lastAttack')) || 0;
    if (ctx.time < last + 850)
        return;
    enemy.setData('lastAttack', ctx.time);
    const type = String(enemy.getData('type'));
    playOnce(enemy, type, 'attack');
    ctx.hurtPlayer(Math.round(damage * mult));
}
/*
 * ===========================================================================
 * INTEGRATION NOTE — how WorldScene wires this in (no WorldScene edits by me).
 * ===========================================================================
 *
 * 1) IMPORT at the top of WorldScene.ts:
 *
 *      import { EnemyAI, type AIContext } from '../systems/combat/EnemyAI';
 *
 * 2) ELITE ROLL — in `spawnEnemy`, right after the existing `enemy.setData({...})`
 *    block and BEFORE creating the health bar (so the bar reads the buffed HP).
 *    Skip bosses; let night raise the elite rate via the lighting danger value:
 *
 *      if (spawn.type !== 'nameless' && spawn.type !== 'cinderlord') {
 *        EnemyAI.rollElite(enemy, { chanceMult: this.lighting?.getState().danger ?? 1 });
 *        const marker = EnemyAI.createEliteMarker(this, enemy);
 *        if (marker) enemy.setData('eliteMarker', marker);
 *      }
 *
 *    Then in `killEnemy`, destroy the marker next to the bar, and honour loot
 *    multiplier + keep the elite tint from being cleared as a hit-flash:
 *
 *      (enemy.getData('eliteMarker') as Phaser.GameObjects.Text | undefined)?.destroy();
 *      const lootMult = Number(enemy.getData('lootMult')) || 1;   // multiply drop quantity
 *
 *    And in `updateEnemyBars`/`updateEnemies` the marker position can be synced:
 *
 *      const em = enemy.getData('eliteMarker') as Phaser.GameObjects.Text | undefined;
 *      if (em) em.setPosition(enemy.x, enemy.y - enemy.displayHeight * 0.62).setDepth(enemy.depth + 3);
 *
 * 3) DRIVE THE AI — replace the body of `updateEnemies`' per-enemy `if (distance
 *    < aggro) { ... } else { ... }` chase/tryEnemySpecial block with a single
 *    call. Build the context ONCE before the loop (reused each enemy):
 *
 *      const enemyList = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
 *      const visibility = this.weather.profile().visibility;
 *      const danger = this.lighting.getState().danger;
 *      const reducedMotion = this.saves.get().settings.reducedMotion;
 *      const lowQuality = this.saves.get().settings.quality === 'low'
 *        || (this.saves.get().settings.quality === 'auto' && this.scale.width < 700);
 *      const ctx: AIContext = {
 *        playerX: this.player.x, playerY: this.player.y,
 *        playerAlive: this.player.active,
 *        time, delta: _delta, visibility, danger, reducedMotion, lowQuality,
 *        hurtPlayer: (amount) => this.hurtPlayer(amount),
 *        spawnProjectile: (o) => this.spawnEnemyProjectile(o),   // small helper, see 5)
 *        spawnAdd: (t, x, y) => this.spawnEnemy({ type: t as keyof typeof ENEMIES, x, y, temporary: true }),
 *        enemies: enemyList,
 *      };
 *
 *    then inside the loop, after the renderDistance cull:
 *
 *      const inCombat = EnemyAI.update(enemy, ctx);
 *      if (inCombat) combat = true;
 *      enemy.setDepth(enemy.y / 10 + 12);
 *
 *    Boss sprites make EnemyAI.update return false and leave their body alone —
 *    BossFight drives them — so nothing else in updateEnemies needs to change.
 *
 * 4) SHIELD + INTANGIBILITY in `damageEnemy` (very top, before applying damage):
 *
 *      if (EnemyAI.isIntangible(enemy)) return;   // wraith mid-blink is immune
 *      damage = EnemyAI.mitigateDamage(enemy, damage, this.player.x, this.player.y);
 *
 *    (Do the same isIntangible guard in the projectile overlap in setupPhysics.)
 *
 * 5) ENEMY PROJECTILES — the scene needs a small spawner + an overlap vs the
 *    player. Add an `enemyProjectiles` group in create() and:
 *
 *      private spawnEnemyProjectile(o: EnemyProjectileRequest): void {
 *        const tex = o.kind === 'fire' ? 'projectile-magic' : 'projectile-bolt';
 *        const p = this.physics.add.sprite(o.x, o.y, tex).setScale(1.7).setDepth(920);
 *        const ang = Math.atan2(o.targetY - o.y, o.targetX - o.x);
 *        p.setRotation(ang).setVelocity(Math.cos(ang) * o.speed, Math.sin(ang) * o.speed);
 *        p.setData('damage', o.damage); p.setData('ttl', 2600);
 *        if (o.kind === 'fire') p.setTint(0xff8a4c);
 *        this.enemyProjectiles.add(p);
 *        this.sfx.attack('magic');
 *      }
 *
 *      // in setupPhysics:
 *      this.physics.add.overlap(this.enemyProjectiles, this.player, (pObj) => {
 *        const p = pObj as Phaser.Physics.Arcade.Sprite;
 *        this.hurtPlayer(Number(p.getData('damage')) || 10);
 *        p.destroy();
 *      });
 *      this.physics.add.collider(this.enemyProjectiles, this.solids, (p) => p.destroy());
 *
 *      // in updateProjectiles: tick down enemyProjectiles ttl the same way.
 *
 * That's the whole surface: an import, an elite roll in spawn, one call in the
 * enemy loop, two one-liners in damageEnemy, and a small enemy-projectile path.
 * ===========================================================================
 */

});
__define("src/systems/combat/BossFight.ts", function(exports, module, __req){
"use strict";
/**
 * BossFight — multi-phase boss choreography for Trupy's two bosses.
 *
 * WHY THIS EXISTS
 * ---------------
 * The two bosses used to differ from a common mook only in a bigger HP bar and a
 * single telegraphed slam, so "boss" meant "the same fight, but longer". A boss
 * should instead be a *conversation that escalates*: it opens readable, teaches
 * you its tells, then — as you win — changes the question it's asking. This module
 * turns each boss into a scripted, phased encounter with distinct attack sets per
 * phase, hard phase-transition beats (invulnerable pause, roar, shake, light
 * bloom), and a phase indicator the health bar can show.
 *
 * FAIRNESS FIRST
 * --------------
 * Every dangerous attack is telegraphed: a ground ring or a travelling warning
 * fills for a wind-up before anything can hurt the player. A boss hit should
 * always be "I read that wrong / I dodged late", never "where did that come
 * from". The telegraph windows widen slightly on lower-skill-friendly settings
 * implicitly (reduced motion keeps the ring but drops the shake), and every
 * effect scales down on low quality / reduced motion for performance and comfort.
 *
 * CONTRACT WITH WorldScene
 * ------------------------
 * WorldScene constructs one of these when a boss activates, then calls:
 *   - update(time, delta)   every enemy tick, to run the state machine,
 *   - onDamaged(hp)         after it applies damage, so phases can trigger,
 *   - destroy()             on boss death / scene shutdown, to clean up.
 * All privileged actions (hurt the player, spawn adds/projectiles, drive the
 * boss body) go through the BossContext callbacks, so BossFight never reaches
 * into WorldScene internals. It moves the boss sprite directly (the scene's
 * updateEnemies leaves boss bodies alone once EnemyAI returns false for them).
 *
 * PERFORMANCE
 * -----------
 * One instance per boss (so at most two ever). Vector maths uses module scratch
 * vectors; the state machine is a switch on a string. Projectile/ember visuals
 * are pooled by Phaser's tween/timer systems and self-destroy.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BossFight = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
// ---------------------------------------------------------------------------
// Module scratch — no per-tick allocation.
// ---------------------------------------------------------------------------
const toPlayer = new phaser_1.default.Math.Vector2();
const move = new phaser_1.default.Math.Vector2();
/** Arena clamp so teleports/positions never leave the world. */
const ARENA = { minX: 40, maxX: 4860, minY: 40, maxY: 2760 };
class BossFight {
    constructor(scene, boss, kind, ctx) {
        var _a, _b;
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "boss", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "kind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxHealth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** 1-based current phase. */
        Object.defineProperty(this, "phase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
        Object.defineProperty(this, "totalPhases", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 3
        });
        /** Fractional HP thresholds that trigger the next phase (descending). */
        Object.defineProperty(this, "phaseThresholds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Current action within the phase's rotation. */
        Object.defineProperty(this, "action", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'idle'
        });
        /** When the current action/cooldown ends (absolute ms). */
        Object.defineProperty(this, "actionUntil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Next time an attack may begin. */
        Object.defineProperty(this, "nextAttack", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Transition lock: boss is invulnerable + inert until this time. */
        Object.defineProperty(this, "transitionUntil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Rotating index so attacks cycle rather than repeat randomly. */
        Object.defineProperty(this, "rotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** Timers/tweens we own, cleared on destroy to avoid leaks after death. */
        Object.defineProperty(this, "timers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "destroyed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.scene = scene;
        this.boss = boss;
        this.kind = kind;
        this.ctx = ctx;
        this.type = String(boss.getData('type'));
        this.maxHealth = Number(boss.getData('maxHealth')) || (kind === 'cinderlord' ? 760 : 460);
        // Phase gates per the design brief:
        //   nameless  → 100 / 60 / 30 %  (thresholds crossed at 60% and 30%)
        //   cinderlord→ 100 / 65 / 35 %  (thresholds crossed at 65% and 35%)
        this.phaseThresholds = kind === 'cinderlord' ? [0.65, 0.35] : [0.6, 0.3];
        boss.setData('bossPhase', 1);
        boss.setData('bossInvulnerable', false);
        this.nextAttack = scene.time.now + 900; // a breath before the first attack
        (_b = (_a = this.ctx).onPhase) === null || _b === void 0 ? void 0 : _b.call(_a, 1, this.totalPhases);
    }
    /** Current 1-based phase, for the health-bar indicator. */
    getPhase() {
        return this.phase;
    }
    getTotalPhases() {
        return this.totalPhases;
    }
    /**
     * Called after WorldScene applies damage. Drives phase transitions off the
     * boss's current HP. Kept off the render path so it only runs on real hits.
     */
    onDamaged(hp) {
        if (this.destroyed)
            return;
        const frac = hp / this.maxHealth;
        const nextIndex = this.phase - 1; // threshold to cross to reach phase+1
        if (nextIndex < this.phaseThresholds.length && frac <= this.phaseThresholds[nextIndex]) {
            this.enterPhase(this.phase + 1);
        }
    }
    /** Per-tick brain. `delta` is the scene's enemy-tick delta (~72ms). */
    update(time, delta) {
        if (this.destroyed)
            return;
        const body = this.boss.body;
        if (!body || !this.boss.active)
            return;
        // Transition pause: invulnerable, inert, glaring. Nothing else runs.
        if (time < this.transitionUntil) {
            body.setVelocity(0, 0);
            return;
        }
        if (this.kind === 'nameless')
            this.updateNameless(time, delta, body);
        else
            this.updateCinderlord(time, delta, body);
    }
    /** Clean up all owned timers/state. Call on boss death and scene shutdown. */
    destroy() {
        var _a, _b;
        this.destroyed = true;
        for (const timer of this.timers)
            timer.remove(false);
        this.timers.length = 0;
        (_b = (_a = this.ctx).setInvulnerable) === null || _b === void 0 ? void 0 : _b.call(_a, false);
        if (this.boss.active)
            this.boss.setData('bossInvulnerable', false);
    }
    // -------------------------------------------------------------------------
    // Phase transition — the "moment": invulnerable pause, roar (audio is the
    // scene's; we do the visible + tactile part), screen shake, light-ish flash
    // via an expanding ring, then resume harder. This beat is what sells that the
    // fight just changed gears.
    // -------------------------------------------------------------------------
    enterPhase(phase) {
        var _a, _b;
        if (phase > this.totalPhases || phase <= this.phase)
            return;
        this.phase = phase;
        this.boss.setData('bossPhase', phase);
        this.action = 'idle';
        this.rotation = 0;
        const pauseMs = 1100;
        this.transitionUntil = this.scene.time.now + pauseMs;
        this.nextAttack = this.transitionUntil + 300;
        this.setInvulnerable(true);
        const color = this.kind === 'cinderlord' ? 0xff7a3c : 0xc85182;
        const body = this.boss.body;
        body === null || body === void 0 ? void 0 : body.setVelocity(0, 0);
        // Visible burst: a shockwave ring + a hard tint pulse. Scaled by settings.
        if (!this.ctx.lowQuality) {
            const ring = this.scene.add
                .circle(this.boss.x, this.boss.y, 60, color, 0.35)
                .setDepth(this.boss.depth - 1);
            this.scene.tweens.add({
                targets: ring,
                radius: 320,
                alpha: 0,
                duration: 900,
                ease: 'Quad.easeOut',
                onComplete: () => ring.destroy(),
            });
        }
        this.boss.setTintFill(color);
        this.scene.time.delayedCall(220, () => {
            if (this.boss.active)
                this.boss.clearTint();
        });
        if (!this.ctx.reducedMotion) {
            this.scene.cameras.main.shake(pauseMs * 0.5, 0.01);
            this.scene.cameras.main.flash(160, (color >> 16) & 255, (color >> 8) & 255, color & 255);
        }
        // A brief pulse of the boss growing then settling — reads as "drawing power".
        this.scene.tweens.add({
            targets: this.boss,
            scaleX: this.boss.scaleX * 1.12,
            scaleY: this.boss.scaleY * 1.12,
            duration: 260,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
        // Drop invulnerability when the pause ends.
        this.scene.time.delayedCall(pauseMs, () => {
            if (!this.destroyed)
                this.setInvulnerable(false);
        });
        (_b = (_a = this.ctx).onPhase) === null || _b === void 0 ? void 0 : _b.call(_a, phase, this.totalPhases);
    }
    setInvulnerable(value) {
        var _a, _b;
        this.boss.setData('bossInvulnerable', value);
        (_b = (_a = this.ctx).setInvulnerable) === null || _b === void 0 ? void 0 : _b.call(_a, value);
    }
    // =========================================================================
    // БЕЗЫМЯННАЯ (nameless) — an elegant four-armed horror. A duel that grows
    // frantic. 460 HP, phases at 100 / 60 / 30 %.
    //   Phase 1: measured, telegraphed reach attacks (long four-arm sweeps).
    //   Phase 2: summons wraith adds and blinks around the arena.
    //   Phase 3: desperate — fast, chained multi-strike combos, little downtime.
    // =========================================================================
    updateNameless(time, _delta, body) {
        const px = this.ctx.playerX();
        const py = this.ctx.playerY();
        const speed = Number(this.boss.getData('speed')) || 64;
        // Resolve an in-progress action first.
        if (this.action !== 'idle') {
            if (time > this.actionUntil)
                this.action = 'idle';
            else {
                // While mid-action the boss is committed (rooted), except the phase-3
                // combo which walks between strikes for a stalking feel.
                if (this.action === 'combo') {
                    this.stepToward(body, px, py, speed * 1.15);
                }
                else {
                    body.setVelocity(0, 0);
                }
                this.faceTarget(px);
                return;
            }
        }
        const distance = phaser_1.default.Math.Distance.Between(this.boss.x, this.boss.y, px, py);
        // Movement between attacks: glide toward the player at phase-scaled speed.
        const phaseSpeed = speed * (this.phase === 3 ? 1.5 : this.phase === 2 ? 1.15 : 1);
        if (distance > 70)
            this.stepToward(body, px, py, phaseSpeed);
        else
            body.setVelocity(0, 0);
        this.faceTarget(px);
        this.playLoop(distance > 70 ? 'walk' : 'idle');
        if (time < this.nextAttack)
            return;
        // Choose an attack from the current phase's rotation.
        if (this.phase === 1) {
            this.namelessReachSweep(time, px, py);
        }
        else if (this.phase === 2) {
            // Alternate: summon, then blink-strike, then reach sweep.
            const pick = this.rotation % 3;
            this.rotation += 1;
            if (pick === 0)
                this.namelessSummon(time);
            else if (pick === 1)
                this.namelessBlinkStrike(time, px, py);
            else
                this.namelessReachSweep(time, px, py);
        }
        else {
            // Phase 3: mostly the fast combo, occasionally a blink to reposition.
            if (this.rotation % 4 === 3)
                this.namelessBlinkStrike(time, px, py);
            else
                this.namelessCombo(time, px, py);
            this.rotation += 1;
        }
    }
    /**
     * Phase-1 signature: a long four-arm reach. A wide arc telegraph in front of
     * the boss fills, then sweeps — being anywhere in the arc at the strike is a
     * hit. Teaches the player to respect the boss's reach and to get to its side.
     */
    namelessReachSweep(time, px, py) {
        this.action = 'reach';
        const windup = this.phase === 3 ? 360 : 560;
        this.actionUntil = time + windup + 200;
        this.nextAttack = time + windup + (this.phase === 1 ? 1500 : 1000);
        this.playOnce('attack');
        this.faceTarget(px);
        // The reach lands in a forward arc; represent it as a ring centred a bit in
        // front of the boss toward the player, radius = reach.
        toPlayer.set(px - this.boss.x, py - this.boss.y);
        if (toPlayer.lengthSq() < 1)
            toPlayer.set(1, 0);
        toPlayer.normalize();
        const reach = 120;
        const cx = this.boss.x + toPlayer.x * reach * 0.6;
        const cy = this.boss.y + toPlayer.y * reach * 0.6;
        this.telegraph(cx, cy, reach, 0xc85182, windup, () => {
            if (phaser_1.default.Math.Distance.Between(cx, cy, this.ctx.playerX(), this.ctx.playerY()) < reach) {
                this.ctx.hurtPlayer(Number(this.boss.getData('damage')) || 22);
            }
            // A sweep arc flourish.
            if (!this.ctx.lowQuality) {
                const arc = this.scene.add.circle(cx, cy, reach * 0.5, 0xa64d8c, 0.4).setDepth(this.boss.depth + 1);
                this.scene.tweens.add({ targets: arc, radius: reach, alpha: 0, duration: 260, onComplete: () => arc.destroy() });
            }
        });
    }
    /**
     * Phase-2: summon two wraith adds at the arena edges, then a short recovery.
     * Adds pressure the player must split attention to — the boss stops being a
     * pure 1v1 and forces target priority.
     */
    namelessSummon(time) {
        this.action = 'summon';
        this.actionUntil = time + 900;
        this.nextAttack = time + 2600;
        this.playOnce('attack');
        const count = this.phase === 3 ? 3 : 2;
        for (let i = 0; i < count; i += 1) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
            const radius = 160;
            const sx = phaser_1.default.Math.Clamp(this.boss.x + Math.cos(angle) * radius, ARENA.minX, ARENA.maxX);
            const sy = phaser_1.default.Math.Clamp(this.boss.y + Math.sin(angle) * radius, ARENA.minY, ARENA.maxY);
            // A gather-in telegraph so the add "coalesces" rather than popping in.
            this.telegraph(sx, sy, 40, 0x8d63c4, 620, () => {
                if (!this.destroyed)
                    this.ctx.spawnAdd('wraith', sx, sy);
            });
        }
    }
    /**
     * Phase-2/3: blink to a flank of the player and immediately threaten a strike.
     * A departure wisp, a short intangible gap, then reappear beside them with a
     * telegraphed jab — punishes standing still, keeps the duel mobile.
     */
    namelessBlinkStrike(time, px, py) {
        this.action = 'blink';
        this.actionUntil = time + 520;
        this.nextAttack = time + 1200;
        // Depart.
        if (!this.ctx.lowQuality) {
            const wisp = this.scene.add.circle(this.boss.x, this.boss.y, 22, 0x8d63c4, 0.4).setDepth(this.boss.depth + 2);
            this.scene.tweens.add({ targets: wisp, scale: 2.2, alpha: 0, duration: 260, onComplete: () => wisp.destroy() });
        }
        // Destination: a flank of the player (perpendicular offset), clamped.
        toPlayer.set(px - this.boss.x, py - this.boss.y);
        if (toPlayer.lengthSq() < 1)
            toPlayer.set(1, 0);
        toPlayer.normalize();
        const side = Math.random() < 0.5 ? 1 : -1;
        const destX = phaser_1.default.Math.Clamp(px - toPlayer.y * 90 * side, ARENA.minX, ARENA.maxX);
        const destY = phaser_1.default.Math.Clamp(py + toPlayer.x * 90 * side, ARENA.minY, ARENA.maxY);
        this.setInvulnerable(true);
        const arriveMs = 240;
        this.timers.push(this.scene.time.delayedCall(arriveMs, () => {
            if (this.destroyed || !this.boss.active)
                return;
            this.boss.setPosition(destX, destY);
            this.setInvulnerable(false);
            this.playOnce('attack');
            this.faceTarget(this.ctx.playerX());
            if (!this.ctx.lowQuality) {
                const pop = this.scene.add.circle(destX, destY, 16, 0xa64d8c, 0.45).setDepth(this.boss.depth + 2);
                this.scene.tweens.add({ targets: pop, scale: 2.2, alpha: 0, duration: 240, onComplete: () => pop.destroy() });
            }
            // Telegraphed jab at the landing.
            this.telegraph(destX, destY, 90, 0xc85182, 320, () => {
                if (phaser_1.default.Math.Distance.Between(destX, destY, this.ctx.playerX(), this.ctx.playerY()) < 100) {
                    this.ctx.hurtPlayer(Math.round((Number(this.boss.getData('damage')) || 22) * 1.15));
                }
            });
        }));
    }
    /**
     * Phase-3 desperation: a fast chain of three telegraphed strikes with barely a
     * beat between them. Each is individually dodgeable, but together they demand
     * clean, committed dodges — the climax of the duel.
     */
    namelessCombo(time, _px, _py) {
        this.action = 'combo';
        const strikes = 3;
        const gap = 300;
        this.actionUntil = time + strikes * gap + 260;
        this.nextAttack = this.actionUntil + 500;
        this.playOnce('attack');
        for (let i = 0; i < strikes; i += 1) {
            this.timers.push(this.scene.time.delayedCall(i * gap, () => {
                if (this.destroyed || !this.boss.active)
                    return;
                const tx = this.ctx.playerX();
                const ty = this.ctx.playerY();
                this.playOnce('attack');
                this.telegraph(tx, ty, 70, 0xc85182, 200, () => {
                    if (phaser_1.default.Math.Distance.Between(tx, ty, this.ctx.playerX(), this.ctx.playerY()) < 78) {
                        this.ctx.hurtPlayer(Math.round((Number(this.boss.getData('damage')) || 22) * 0.85));
                    }
                });
            }));
        }
    }
    // =========================================================================
    // ВЛАДЫКА УГЛЕЙ (cinderlord) — an armoured fire-lord. Bulk and area denial.
    // 760 HP, phases at 100 / 65 / 35 %.
    //   Phase 1: slow heavy slams that leave burning ground (a lingering hazard).
    //   Phase 2: fire-wave projectile patterns the player must dodge THROUGH.
    //   Phase 3: arena-wide ember rain + enrage speed — sustained pressure.
    // =========================================================================
    updateCinderlord(time, _delta, body) {
        const px = this.ctx.playerX();
        const py = this.ctx.playerY();
        const speed = Number(this.boss.getData('speed')) || 70;
        if (this.action !== 'idle') {
            if (time > this.actionUntil)
                this.action = 'idle';
            else {
                body.setVelocity(0, 0); // the cinderlord roots to attack — it's a slab
                this.faceTarget(px);
                return;
            }
        }
        const distance = phaser_1.default.Math.Distance.Between(this.boss.x, this.boss.y, px, py);
        const phaseSpeed = speed * (this.phase === 3 ? 1.55 : this.phase === 2 ? 1.1 : 0.85);
        if (distance > 90)
            this.stepToward(body, px, py, phaseSpeed);
        else
            body.setVelocity(0, 0);
        this.faceTarget(px);
        this.playLoop(distance > 90 ? 'walk' : 'idle');
        if (time < this.nextAttack)
            return;
        if (this.phase === 1) {
            this.cinderSlam(time, px, py);
        }
        else if (this.phase === 2) {
            // Alternate fire-wave fans with the occasional slam to keep melee honest.
            if (this.rotation % 3 === 2)
                this.cinderSlam(time, px, py);
            else
                this.cinderFireWave(time, px, py);
            this.rotation += 1;
        }
        else {
            // Phase 3: ember rain is the spine; a fire-wave now and then adds a lane
            // to thread while dodging the rain.
            if (this.rotation % 3 === 1)
                this.cinderFireWave(time, px, py);
            else
                this.cinderEmberRain(time);
            this.rotation += 1;
        }
    }
    /**
     * Phase-1: a heavy overhead slam. Wide ground-ring telegraph; on impact it
     * both hits and leaves a patch of burning ground that ticks damage for a few
     * seconds, denying that spot. Slow enough to dodge, punishing to ignore.
     */
    cinderSlam(time, px, py) {
        this.action = 'slam';
        const windup = this.phase === 3 ? 460 : 700;
        this.actionUntil = time + windup + 220;
        this.nextAttack = time + windup + 900;
        this.playOnce('attack');
        this.faceTarget(px);
        const radius = 150;
        // Slam lands where the player IS at cast (with the wind-up they can leave).
        const sx = px;
        const sy = py;
        this.telegraph(sx, sy, radius, 0xff7a3c, windup, () => {
            const wave = this.scene.add.circle(sx, sy, 30, 0xf05b39, 0.6).setDepth(this.boss.depth + 1);
            this.scene.tweens.add({ targets: wave, radius: radius + 20, alpha: 0, duration: 340, onComplete: () => wave.destroy() });
            if (!this.ctx.reducedMotion)
                this.scene.cameras.main.shake(180, 0.008);
            if (phaser_1.default.Math.Distance.Between(sx, sy, this.ctx.playerX(), this.ctx.playerY()) < radius) {
                this.ctx.hurtPlayer(Number(this.boss.getData('damage')) || 30);
            }
            this.spawnBurningGround(sx, sy, radius * 0.7);
        });
    }
    /**
     * A patch of burning ground: a visible fire zone that ticks damage while the
     * player stands in it, for ~3.5s. Area denial that reshapes the safe space.
     */
    spawnBurningGround(x, y, radius) {
        const zone = this.scene.add
            .circle(x, y, radius, 0xff6a2a, this.ctx.reducedMotion ? 0.16 : 0.24)
            .setDepth(this.boss.depth - 2);
        this.scene.tweens.add({ targets: zone, alpha: 0, duration: 3500, onComplete: () => zone.destroy() });
        const ticks = 7;
        const dmg = Math.round((Number(this.boss.getData('damage')) || 30) * 0.35);
        for (let i = 1; i <= ticks; i += 1) {
            this.timers.push(this.scene.time.delayedCall(i * 500, () => {
                if (this.destroyed)
                    return;
                if (phaser_1.default.Math.Distance.Between(x, y, this.ctx.playerX(), this.ctx.playerY()) < radius) {
                    this.ctx.hurtPlayer(dmg);
                }
            }));
        }
    }
    /**
     * Phase-2 signature: a fan of fire projectiles with a GAP the player dodges
     * through. Rather than an unavoidable wall, it's a readable pattern — several
     * bolts in an arc with one lane left open, so the player is rewarded for
     * reading the spread and moving into the gap.
     */
    cinderFireWave(time, px, py) {
        this.action = 'firewave';
        const windup = 420;
        this.actionUntil = time + windup + 260;
        this.nextAttack = time + windup + 800;
        this.playOnce('attack');
        this.faceTarget(px);
        const originX = this.boss.x;
        const originY = this.boss.y;
        toPlayer.set(px - originX, py - originY);
        const baseAngle = Math.atan2(toPlayer.y, toPlayer.x);
        const bolts = this.phase === 3 ? 7 : 5;
        const spread = 0.9; // total fan width in radians
        const gapIndex = phaser_1.default.Math.Between(0, bolts - 1); // the lane to leave open
        // A faint aim line so the fan is telegraphed before it fires.
        if (!this.ctx.lowQuality) {
            const aim = this.scene.add
                .line(0, 0, originX, originY, px, py, 0xff7a3c, 0.4)
                .setOrigin(0)
                .setLineWidth(3)
                .setDepth(878);
            this.scene.tweens.add({ targets: aim, alpha: 0, duration: windup, onComplete: () => aim.destroy() });
        }
        this.timers.push(this.scene.time.delayedCall(windup, () => {
            if (this.destroyed || !this.boss.active)
                return;
            for (let i = 0; i < bolts; i += 1) {
                if (i === gapIndex)
                    continue; // leave the dodge lane
                // Fan the bolts evenly across the spread, centred on the aim line.
                const t = i / (bolts - 1) - 0.5;
                const ang = baseAngle + t * spread;
                const reach = 500;
                this.ctx.spawnProjectile({
                    x: originX,
                    y: originY - 6,
                    targetX: originX + Math.cos(ang) * reach,
                    targetY: originY + Math.sin(ang) * reach,
                    damage: Math.round((Number(this.boss.getData('damage')) || 30) * 0.6),
                    speed: 300,
                    kind: 'fire',
                });
            }
        }));
    }
    /**
     * Phase-3: arena-wide ember rain. A sequence of telegraphed strike-markers
     * rains across the area around the player; each shows a small ring before it
     * lands. Sustained, spreads the player out, and combined with enrage speed
     * makes the finish genuinely frantic — but every single ember is dodgeable.
     */
    cinderEmberRain(time) {
        this.action = 'emberrain';
        const duration = 2600;
        this.actionUntil = time + duration + 200;
        this.nextAttack = time + duration + 700;
        this.playOnce('attack');
        const drops = this.ctx.lowQuality ? 8 : 14;
        const dmg = Math.round((Number(this.boss.getData('damage')) || 30) * 0.5);
        for (let i = 0; i < drops; i += 1) {
            const at = (i / drops) * duration;
            this.timers.push(this.scene.time.delayedCall(at, () => {
                if (this.destroyed)
                    return;
                // Bias impacts around the player's current position so it tracks the
                // fight, but with scatter so it's dodgeable, not homing.
                const ex = phaser_1.default.Math.Clamp(this.ctx.playerX() + phaser_1.default.Math.Between(-180, 180), ARENA.minX, ARENA.maxX);
                const ey = phaser_1.default.Math.Clamp(this.ctx.playerY() + phaser_1.default.Math.Between(-180, 180), ARENA.minY, ARENA.maxY);
                this.telegraph(ex, ey, 46, 0xff8a4c, 420, () => {
                    const flash = this.scene.add.circle(ex, ey, 20, 0xffb066, 0.7).setDepth(this.boss.depth + 1);
                    this.scene.tweens.add({ targets: flash, radius: 48, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
                    if (phaser_1.default.Math.Distance.Between(ex, ey, this.ctx.playerX(), this.ctx.playerY()) < 50) {
                        this.ctx.hurtPlayer(dmg);
                    }
                });
            }));
        }
    }
    // -------------------------------------------------------------------------
    // Shared boss helpers.
    // -------------------------------------------------------------------------
    stepToward(body, tx, ty, speed) {
        move.set(tx - this.boss.x, ty - this.boss.y);
        if (move.lengthSq() > 0.001)
            move.normalize().scale(speed);
        body.setVelocity(move.x, move.y);
    }
    faceTarget(targetX) {
        this.boss.setFlipX(targetX < this.boss.x);
    }
    playLoop(pose) {
        var _a;
        const key = `enemy-${this.type}-${pose}`;
        if (((_a = this.boss.anims.currentAnim) === null || _a === void 0 ? void 0 : _a.key) !== key && this.scene.anims.exists(key)) {
            this.boss.play(key, true);
        }
    }
    playOnce(pose) {
        var _a;
        const key = `enemy-${this.type}-${pose}`;
        if (this.boss.anims.isPlaying && ((_a = this.boss.anims.currentAnim) === null || _a === void 0 ? void 0 : _a.key) === key)
            return;
        if (this.scene.anims.exists(key))
            this.boss.play(key, true);
    }
    /**
     * The universal fairness primitive (mirrors EnemyAI.telegraph): a filling ring
     * that resolves into `onFire`. Scales stroke/alpha down on low quality and
     * keeps the ring (but not the shake) under reduced motion. Registers no
     * long-lived timer — the tween self-cleans — so it's safe to spam per attack.
     */
    telegraph(x, y, radius, color, windup, onFire) {
        const alpha = this.ctx.reducedMotion ? 0.22 : 0.12;
        const ring = this.scene.add
            .circle(x, y, radius, color, alpha)
            .setStrokeStyle(this.ctx.lowQuality ? 4 : 6, color, 0.95)
            .setDepth(882);
        this.scene.tweens.add({
            targets: ring,
            scale: this.ctx.reducedMotion ? 1.04 : 1.18,
            alpha: alpha + 0.28,
            duration: windup,
            onComplete: () => {
                ring.destroy();
                if (!this.destroyed)
                    onFire();
            },
        });
    }
}
exports.BossFight = BossFight;
/*
 * ===========================================================================
 * INTEGRATION NOTE — how WorldScene drives BossFight (no WorldScene edits by me).
 * ===========================================================================
 *
 * 1) IMPORT:
 *
 *      import { BossFight, type BossContext } from '../systems/combat/BossFight';
 *
 *    and hold two handles next to `boss` / `cinderBoss`:
 *
 *      private namelessFight?: BossFight;
 *      private cinderFight?: BossFight;
 *
 * 2) CONSTRUCT on activation. In `syncBoss`, inside the branch that flips the
 *    boss active/visible (right after `this.bossFightStartedAt = this.time.now;`),
 *    build the fight for that boss:
 *
 *      const bossCtx: BossContext = {
 *        hurtPlayer: (a) => this.hurtPlayer(a),
 *        spawnAdd: (t, x, y) => this.spawnEnemy({ type: t as keyof typeof ENEMIES, x, y, temporary: true }),
 *        spawnProjectile: (o) => this.spawnEnemyProjectile(o),   // same helper as EnemyAI (see EnemyAI note 5)
 *        playerX: () => this.player.x,
 *        playerY: () => this.player.y,
 *        playerAlive: () => this.player.active,
 *        reducedMotion: this.saves.get().settings.reducedMotion,
 *        lowQuality: this.saves.get().settings.quality === 'low'
 *          || (this.saves.get().settings.quality === 'auto' && this.scale.width < 700),
 *        onPhase: (phase, total) => GameEvents.emit('boss-phase', { type, phase, total }), // health bar hook
 *        setInvulnerable: (v) => enemy!.setData('bossInvulnerable', v),
 *      };
 *      if (type === 'nameless') this.namelessFight = new BossFight(this, enemy, 'nameless', bossCtx);
 *      else this.cinderFight = new BossFight(this, enemy, 'cinderlord', bossCtx);
 *
 * 3) DRIVE per tick. In `update` (or at the end of `updateEnemies`), after the
 *    slow-tick guard so it runs on the same cadence as enemies:
 *
 *      this.namelessFight?.update(time, delta);
 *      this.cinderFight?.update(time, delta);
 *
 *    (delta here is the same value passed to updateEnemies.)
 *
 * 4) FEED DAMAGE + RESPECT INVULNERABILITY. In `damageEnemy`, guard the boss
 *    transition/blink invuln and notify the fight after applying HP:
 *
 *      if (enemy.getData('bossInvulnerable')) return;            // near the top, with the isIntangible guard
 *      ...
 *      // after `enemy.setData('health', health);`:
 *      if (type === 'nameless') this.namelessFight?.onDamaged(health);
 *      else if (type === 'cinderlord') this.cinderFight?.onDamaged(health);
 *
 * 5) DESTROY. In `killEnemy`, where the boss handles are cleared, and in
 *    `cleanup`:
 *
 *      this.namelessFight?.destroy(); this.namelessFight = undefined;   // for nameless
 *      this.cinderFight?.destroy();   this.cinderFight = undefined;     // for cinderlord
 *
 * 6) HEALTH-BAR PHASE INDICATOR. `onPhase` emits `boss-phase` with { phase,
 *    total }; GameUI's boss bar can render `total` pips and fill `phase` of them,
 *    or show "Фаза 2/3". BossFight also stores it on the sprite as
 *    getData('bossPhase') if you prefer to read it in `updateEnemyBars`.
 *
 * Effects honour reducedMotion (rings stay, shakes drop) and lowQuality (fewer
 * embers / no flourish lines), and no per-tick allocation occurs on the hot path.
 * ===========================================================================
 */

});
__define("src/systems/combat/SmokeBomb.ts", function(exports, module, __req){
"use strict";
/**
 * SmokeBomb — the reusable effect behind the `smoke_bomb` consumable.
 *
 * WHY THIS EXISTS
 * ---------------
 * The item (`отпугивает врагов рядом и даёт передышку`) had a description and a
 * crafting recipe but no implementation: `InventorySystem.use` returned
 * `effect: 'smoke'` and WorldScene only drew a single fading circle and shoved
 * nearby enemies once. There was nothing that made the smoke a *tactic* — no
 * lingering cover, no loss of aggro. This module makes the bomb do what the text
 * promises, and does it identically for both the world and interiors so the two
 * scenes never drift.
 *
 * WHAT IT DOES
 * ------------
 *  - Visual: an expanding cloud of grey particles that blooms out, hangs for
 *    ~4 seconds, then fades. Particle counts scale down for reduced-motion and
 *    low-quality so it stays cheap on weak hardware / accessibility settings.
 *  - Effect: every enemy within `radius` is pushed away from the blast, loses
 *    aggro (dropped to idle via EnemyAI.blind), and — crucially — cannot
 *    re-detect the player for as long as the cloud lingers. Enemies that walk
 *    into the cloud while it is still active are also blinded, so the smoke is a
 *    genuine screen of cover, not a one-frame shove.
 *
 * DESIGN CONTRACT WITH THE SCENES
 * -------------------------------
 * Like EnemyAI, this file never reaches into a scene's private state. The caller
 * hands it a scene, an origin, the live enemy list and the player's settings; it
 * owns the particle/tween lifetime and asks EnemyAI to do the AI-side work. Both
 * WorldScene and InteriorScene can call it — interiors have no persistent enemies
 * today, so there `enemies` is simply empty and only the visual plays, which is
 * still the right feedback for "you used a smoke bomb indoors".
 *
 * See the INTEGRATION NOTE at the bottom for the exact WorldScene call site.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detonateSmokeBomb = detonateSmokeBomb;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
const EnemyAI_1 = __req("src/systems/combat/EnemyAI.ts");
/** Tunables shared by every detonation. */
const DEFAULT_DURATION = 4000;
const DEFAULT_RADIUS = 190;
const PUSH_SPEED = 300;
/** Grey palette for the cloud — cool smoke, not warm fire. */
const SMOKE_TINTS = [0x8b8791, 0x6f6b78, 0xa9a5b0, 0x565360];
/**
 * Detonate a smoke bomb at (x, y).
 *
 * Returns the number of enemies caught, so a caller can vary its feedback (e.g.
 * a different toast when the smoke actually broke a fight). Safe to call with no
 * enemies — the cloud still plays.
 */
function detonateSmokeBomb(scene, options) {
    const { x, y, enemies = [], reducedMotion = false, lowQuality = false, durationMs = DEFAULT_DURATION, radius = DEFAULT_RADIUS, depth = 900, } = options;
    // --- AI effect: push out, blind, and keep blinding for the cloud's lifetime.
    let caught = 0;
    const affect = (enemy) => {
        if (!enemy.active)
            return;
        if (phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, x, y) > radius)
            return;
        caught += 1;
        // Shove away from the blast so the player gets breathing room.
        const push = new phaser_1.default.Math.Vector2(enemy.x - x, enemy.y - y);
        if (push.lengthSq() < 0.01)
            push.set(Math.random() - 0.5, Math.random() - 0.5);
        push.normalize();
        enemy.setVelocity(push.x * PUSH_SPEED, push.y * PUSH_SPEED);
        // Drop aggro and prevent re-detection for the whole lingering window.
        EnemyAI_1.EnemyAI.blind(enemy, durationMs);
    };
    for (const enemy of enemies)
        affect(enemy);
    // Re-apply blindness periodically so enemies wandering *into* the cloud while
    // it lingers are also caught — the smoke is cover, not a single pulse. Cheap:
    // a few ticks over the lifetime, each a short distance check per enemy.
    if (enemies.length) {
        const reblindEvery = 500;
        const ticks = Math.max(1, Math.floor(durationMs / reblindEvery) - 1);
        for (let index = 1; index <= ticks; index += 1) {
            scene.time.delayedCall(index * reblindEvery, () => {
                for (const enemy of enemies) {
                    if (!enemy.active)
                        continue;
                    if (phaser_1.default.Math.Distance.Between(enemy.x, enemy.y, x, y) > radius)
                        continue;
                    // Top up the blind timer to at least cover the rest of the cloud.
                    EnemyAI_1.EnemyAI.blind(enemy, durationMs - index * reblindEvery);
                }
            });
        }
    }
    // --- Visual: an expanding, lingering, fading cloud of grey puffs.
    // Particle budget scales with the accessibility / quality settings.
    const puffCount = reducedMotion ? 8 : lowQuality ? 12 : 26;
    const fadeIn = reducedMotion ? 120 : 260;
    // The cloud should sit (linger) most of its life, then fade out at the end.
    const lingerAlpha = reducedMotion ? 0.32 : 0.44;
    const fadeOut = Math.max(500, Math.round(durationMs * 0.4));
    // A soft base disc gives the cloud body under the puffs.
    const base = scene.add.circle(x, y, radius * 0.34, 0x6f6b78, 0)
        .setDepth(depth - 1)
        .setBlendMode(phaser_1.default.BlendModes.NORMAL);
    scene.tweens.add({
        targets: base,
        radius: radius * 0.92,
        fillAlpha: lingerAlpha * 0.6,
        duration: fadeIn,
        ease: 'Quad.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: base,
                fillAlpha: 0,
                radius: radius,
                delay: Math.max(0, durationMs - fadeIn - fadeOut),
                duration: fadeOut,
                onComplete: () => base.destroy(),
            });
        },
    });
    for (let index = 0; index < puffCount; index += 1) {
        const angle = (index / puffCount) * Math.PI * 2 + Math.random() * 0.6;
        const spread = radius * (0.35 + Math.random() * 0.6);
        const targetX = x + Math.cos(angle) * spread;
        const targetY = y + Math.sin(angle) * spread * 0.8;
        const tint = SMOKE_TINTS[index % SMOKE_TINTS.length];
        const puff = scene.add.image(x, y, 'pixel')
            .setTint(tint)
            .setAlpha(0)
            .setDepth(depth)
            .setScale(phaser_1.default.Math.FloatBetween(3, 6));
        // Bloom out and up a touch, hold, then dissipate. Reduced motion keeps the
        // puffs nearly in place (information over spectacle).
        const driftX = reducedMotion ? targetX : targetX + phaser_1.default.Math.Between(-14, 14);
        const driftY = reducedMotion ? targetY : targetY - phaser_1.default.Math.Between(4, 22);
        scene.tweens.add({
            targets: puff,
            x: driftX,
            y: driftY,
            alpha: lingerAlpha,
            scale: phaser_1.default.Math.FloatBetween(7, 13),
            duration: fadeIn + phaser_1.default.Math.Between(0, 180),
            ease: 'Quad.easeOut',
            onComplete: () => {
                scene.tweens.add({
                    targets: puff,
                    alpha: 0,
                    y: reducedMotion ? puff.y : puff.y - phaser_1.default.Math.Between(10, 30),
                    scale: puff.scaleX * 1.35,
                    delay: Math.max(0, durationMs - fadeIn - fadeOut) + phaser_1.default.Math.Between(0, 200),
                    duration: fadeOut,
                    onComplete: () => puff.destroy(),
                });
            },
        });
    }
    return caught;
}
/*
 * ===========================================================================
 * INTEGRATION NOTE — WorldScene call site (no WorldScene edits by me).
 * ===========================================================================
 *
 * WorldScene already routes the consumable through `useInventoryItem`, whose
 * `result.effect === 'smoke'` branch currently hand-rolls a one-off circle and a
 * single shove. Replace the BODY of that `else if (result.effect === 'smoke')`
 * branch with a call into this module so the world gets the lingering,
 * aggro-dropping cloud:
 *
 *   1) IMPORT at the top of WorldScene.ts, next to the other combat imports:
 *
 *        import { detonateSmokeBomb } from '../systems/combat/SmokeBomb';
 *
 *   2) In `useInventoryItem`, swap the smoke branch for:
 *
 *        } else if (result.effect === 'smoke') {
 *          const settings = this.saves.get().settings;
 *          const lowQuality = settings.quality === 'low'
 *            || (settings.quality === 'auto' && this.scale.width < 700);
 *          detonateSmokeBomb(this, {
 *            x: this.player.x,
 *            y: this.player.y,
 *            enemies: this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[],
 *            reducedMotion: settings.reducedMotion,
 *            lowQuality,
 *            depth: this.player.depth + 2,
 *          });
 *          this.sfx.special('magic');            // a soft "whoomph"; optional
 *          this.lighting.flash(this.player.x, this.player.y, 120, 0x8b8791, 320);
 *        }
 *
 * That's the whole surface: one import and the swapped branch. The blindness is
 * driven entirely through EnemyAI.blind, which WorldScene's existing
 * `EnemyAI.update` call in `updateEnemies` already honours (it forces detection
 * to fail while the timer is live), so no change to the enemy loop is needed.
 * ===========================================================================
 */

});
__define("src/game/InteriorScene.ts", function(exports, module, __req){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteriorScene = void 0;
const phaser_1 = __importDefault(({ default: window.Phaser, __esModule: true }));
const content_1 = __req("src/data/content.ts");
const world_1 = __req("src/data/world.ts");
const AudioManager_1 = __req("src/systems/AudioManager.ts");
const InventorySystem_1 = __req("src/systems/InventorySystem.ts");
const QuestSystem_1 = __req("src/systems/QuestSystem.ts");
const SaveSystem_1 = __req("src/systems/SaveSystem.ts");
const WeaponShopSystem_1 = __req("src/systems/WeaponShopSystem.ts");
const CraftingSystem_1 = __req("src/systems/CraftingSystem.ts");
const SmokeBomb_1 = __req("src/systems/combat/SmokeBomb.ts");
const Lighting_1 = __req("src/systems/world/Lighting.ts");
const hero_1 = __req("src/systems/sprites/hero.ts");
const GameUI_1 = __req("src/ui/GameUI.ts");
const events_1 = __req("src/game/events.ts");
class InteriorScene extends phaser_1.default.Scene {
    constructor() {
        super('InteriorScene');
        Object.defineProperty(this, "saves", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "inventory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "shop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "quests", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "crafting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ui", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lighting", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "definition", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "player", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "heldWeapon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cursors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "keys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mobileMove", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new phaser_1.default.Math.Vector2()
        });
        Object.defineProperty(this, "facing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new phaser_1.default.Math.Vector2(0, -1)
        });
        Object.defineProperty(this, "heroDir", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'down'
        });
        Object.defineProperty(this, "heroPose", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'idle'
        });
        Object.defineProperty(this, "heroPoseUntil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        /** The anvil in Runa's forge, if this interior is the forge. */
        Object.defineProperty(this, "anvil", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Hearth/candle light sources collected while dressing, lit in createLighting. */
        Object.defineProperty(this, "lightSources", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "returnPoint", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: { x: 430, y: 585 }
        });
        Object.defineProperty(this, "uiLocked", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "chest", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "exitDoor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "npc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "prompt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lastStepAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "dashReadyAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "specialReadyAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "isDashing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "eventDisposers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    init(data) {
        var _a, _b, _c;
        this.definition = (_a = (0, world_1.getInterior)(data.interiorId)) !== null && _a !== void 0 ? _a : (0, world_1.getInterior)('player_home');
        this.returnPoint = { x: (_b = data.returnX) !== null && _b !== void 0 ? _b : 430, y: (_c = data.returnY) !== null && _c !== void 0 ? _c : 585 };
    }
    create() {
        this.saves = new SaveSystem_1.SaveSystem();
        this.inventory = new InventorySystem_1.InventorySystem(this.saves);
        this.shop = new WeaponShopSystem_1.WeaponShopSystem(this.saves);
        this.quests = new QuestSystem_1.QuestSystem(this.saves);
        this.crafting = new CraftingSystem_1.CraftingSystem(this.saves, this.inventory);
        this.saves.mutate((save) => { save.currentScene = this.definition.id; }, true);
        AudioManager_1.audio.setMix(this.audioMix(this.saves.get()));
        AudioManager_1.audio.setRegion('interior', false);
        this.physics.world.setBounds(0, 0, this.definition.width, this.definition.height);
        this.drawRoom();
        this.createLighting();
        this.createPlayer();
        this.createResident();
        this.setupInput();
        this.setupUi();
        this.cameras.main.setBounds(0, 0, this.definition.width, this.definition.height);
        this.cameras.main.startFollow(this.player, true, .1, .1);
        this.cameras.main.setZoom(this.scale.width < 700 ? 1.05 : 1.55);
        this.cameras.main.fadeIn(360, 9, 10, 16);
        this.events.once(phaser_1.default.Scenes.Events.SHUTDOWN, () => this.cleanup());
    }
    update(time, delta) {
        var _a;
        this.updatePlayer(time);
        this.updatePrompt();
        events_1.GameEvents.emit('ability-cooldown', { dash: Math.max(0, (this.dashReadyAt - time) / 1000), special: Math.max(0, (this.specialReadyAt - time) / 1000) });
        this.player.setDepth(this.player.y / 10 + 20);
        // Drive the hearth/candle flicker. The day length is set enormous in
        // createLighting so the fixed dim tint barely drifts over an interior visit —
        // the room is lit by its light sources, not a day/night cycle.
        (_a = this.lighting) === null || _a === void 0 ? void 0 : _a.update(delta);
        this.syncHeldWeapon();
    }
    drawRoom() {
        const { width, height, floor, wall, accent } = this.definition;
        this.lightSources = [];
        const room = this.add.graphics();
        room.fillStyle(0x090b11, 1).fillRect(0, 0, width, height);
        room.fillStyle(wall, 1).fillRoundedRect(42, 36, width - 84, height - 72, 12);
        room.fillStyle(floor, 1).fillRect(78, 84, width - 156, height - 156);
        room.lineStyle(5, 0x15161d, 1).strokeRect(78, 84, width - 156, height - 156);
        for (let y = 96; y < height - 80; y += 34)
            room.lineStyle(2, 0x191a22, .35).lineBetween(80, y, width - 80, y);
        for (let x = 95; x < width - 80; x += 70)
            room.lineStyle(1, 0x747078, .09).lineBetween(x, 88, x, height - 78);
        // Exit doorway at the bottom-centre.
        room.fillStyle(0x171821, 1).fillRect(width / 2 - 38, height - 100, 76, 25);
        room.fillStyle(accent, .55).fillRect(width / 2 - 29, height - 98, 58, 5);
        this.exitDoor = this.add.rectangle(width / 2, height - 92, 84, 42, accent, .08).setStrokeStyle(2, accent, .7).setDepth(8);
        // Recognisable dressing per interior, built from the sculpted prop sprites.
        this.dressRoom();
        this.add.text(width / 2, 54, this.definition.name.toUpperCase(), {
            fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#d8d3dc', stroke: '#101119', strokeThickness: 5, letterSpacing: 4,
        }).setOrigin(.5).setDepth(15);
        if (this.definition.chest) {
            const opened = Boolean(this.saves.get().flags[`interior-chest:${this.definition.id}`]);
            this.chest = this.add.image(width - 145, height - 145, opened ? 'chest-open' : 'chest-closed').setScale(2.2).setDepth((height - 145) / 10 + 10);
        }
        this.createInteriorParticles();
    }
    /** Depth-sorted prop placement helper. */
    prop(x, y, key, scale = 2, depthBias = 6) {
        return this.add.image(x, y, key).setScale(scale).setDepth(y / 10 + depthBias);
    }
    /** Register a warm light emitter to be lit in createLighting. */
    addHearth(x, y, radius, forge = false, intensity) {
        this.lightSources.push({ x, y, radius, preset: forge ? Lighting_1.FORGE_LIGHT : Lighting_1.FLAME_LIGHT, intensity });
    }
    /**
     * Dresses the room according to its `ambience`, giving each interior a distinct
     * identity out of the sculpted prop textures. Every branch also seeds the
     * `lightSources` list with its hearth/candles so createLighting can make the
     * room feel lit from within.
     */
    dressRoom() {
        const { width, height, ambience } = this.definition;
        // Wall torches flanking the exit door read as a lit threshold in every room.
        this.prop(width / 2 - 150, height - 96, 'torch-wall', 2, 8);
        this.prop(width / 2 + 150, height - 96, 'torch-wall', 2, 8);
        this.addHearth(width / 2 - 150, height - 104, 92, false, 0.5);
        this.addHearth(width / 2 + 150, height - 104, 92, false, 0.5);
        switch (ambience) {
            case 'home':
                this.dressHome();
                break;
            case 'inn':
                this.dressInn();
                break;
            case 'forge':
                this.dressForge();
                break;
            case 'herbalist':
                this.dressHerbalist();
                break;
            case 'house':
                this.dressHouse();
                break;
            case 'chapel':
                this.dressChapel();
                break;
            case 'marsh':
                this.dressMarsh();
                break;
            case 'warehouse':
                this.dressWarehouse();
                break;
            case 'citadel':
                this.dressCitadel();
                break;
        }
    }
    /** A modest cottage: bed, hearth brazier, a barrel and crate. */
    dressHome() {
        const { width, height } = this.definition;
        this.drawBed(205, height - 200);
        this.prop(width - 170, height - 175, 'barrel', 2.1);
        this.prop(width - 235, height - 165, 'crate', 2);
        this.prop(230, 200, 'brazier-lit', 2.1);
        this.addHearth(230, 190, 150, false, 0.7);
        this.prop(width - 200, 195, 'sack', 2);
    }
    /** The inn: long tables, benches implied by stools, barrels of ale, a hearth. */
    dressInn() {
        const { width, height } = this.definition;
        this.drawBed(200, height - 195);
        this.drawTable(width / 2, 220, 3);
        this.drawTable(width / 2 + 210, height - 205, 2);
        this.prop(width - 175, 200, 'barrel', 2.2);
        this.prop(width - 230, 215, 'barrel', 2);
        this.prop(150, 210, 'brazier-lit', 2.1);
        this.addHearth(150, 200, 155, false, 0.72);
        this.prop(width - 150, height - 200, 'crate', 2);
    }
    /** Runa's forge: the anvil (interactable), roaring forge fire, crates of ore. */
    dressForge() {
        const { width, height } = this.definition;
        // The forge fire against the back wall — the hot heart of the room.
        this.prop(width - 200, 210, 'forge-fire', 2.3);
        this.addHearth(width - 200, 205, 235, true, 0.9);
        this.emberFountain(width - 200, 215);
        // Braziers throwing extra heat.
        this.prop(160, 220, 'brazier-lit', 2.1);
        this.addHearth(160, 210, 150, true, 0.7);
        // The anvil, front-and-centre and interactable to open crafting.
        this.anvil = this.prop(width / 2 - 30, height / 2 + 30, 'anvil', 2.6, 10);
        // Materials around the workspace.
        this.prop(width / 2 + 150, height / 2 + 70, 'crate', 2.1);
        this.prop(width / 2 + 210, height / 2 + 40, 'ore-vein', 2);
        this.prop(width - 150, height - 175, 'barrel', 2.1);
        this.prop(220, height - 175, 'crate', 2);
    }
    /** The herbalist: shelves of bottles, hanging herbs, a glowing cap or two. */
    dressHerbalist() {
        const { width, height } = this.definition;
        this.drawShelf(width - 160, 175);
        this.drawShelf(width - 160, height - 210);
        this.drawTable(280, height / 2, 2);
        this.prop(200, 200, 'mushroom-cluster', 2.2);
        this.prop(width / 2, height - 165, 'glowcap', 2.4);
        this.addHearth(width / 2, height - 168, 120, false, 0.55);
        this.prop(width / 2 + 70, height - 175, 'glowcap', 2);
        this.addHearth(width / 2 + 70, height - 178, 100, false, 0.5);
        this.prop(230, 210, 'sack', 1.9);
        this.prop(width - 250, height / 2 + 40, 'barrel', 2);
    }
    /** Elira's house: a tidy home — bed, table, a candle brazier, a keepsake charm. */
    dressHouse() {
        const { width, height } = this.definition;
        this.drawBed(205, height - 190);
        this.drawTable(width - 230, 210, 2);
        this.prop(200, 205, 'brazier-lit', 2);
        this.addHearth(200, 197, 145, false, 0.68);
        this.prop(width - 175, height - 175, 'crate', 1.9);
        this.prop(width / 2 + 40, height / 2 + 20, 'charm', 2.4, 10);
        this.prop(width - 260, height - 185, 'sack', 1.9);
    }
    /** Chapel + crypt: pews (benches), a shrine altar, cold candle braziers. */
    dressChapel() {
        const { width, height } = this.definition;
        // Pews down the nave.
        for (let row = 0; row < 3; row += 1) {
            const y = 210 + row * 120;
            this.drawBench(width / 2 - 130, y);
            this.drawBench(width / 2 + 130, y);
        }
        // The altar at the head of the chapel.
        this.prop(width / 2, 150, 'altar', 2.2, 12);
        this.addHearth(width / 2, 150, 150, false, 0.55);
        // Candle braziers flanking it.
        this.prop(width / 2 - 150, 165, 'brazier-lit', 1.9);
        this.prop(width / 2 + 150, 165, 'brazier-lit', 1.9);
        this.addHearth(width / 2 - 150, 158, 120, false, 0.6);
        this.addHearth(width / 2 + 150, 158, 120, false, 0.6);
        // A hint of the crypt below: bones and a skull in a corner.
        this.prop(150, height - 165, 'bones', 2);
        this.prop(200, height - 150, 'skull', 2);
    }
    /** Marsh hut (Iva): a still/cauldron feel — barrels, reeds, bog bottles, brew. */
    dressMarsh() {
        const { width, height } = this.definition;
        this.drawShelf(width - 160, height / 2);
        this.drawTable(260, height - 200, 2);
        this.prop(200, 200, 'brazier-lit', 2);
        this.addHearth(200, 192, 150, false, 0.68);
        // Reeds and marsh flora brought indoors.
        for (let index = 0; index < 4; index += 1) {
            this.prop(150 + index * 60, 150, 'reeds', 1.8, 7);
        }
        this.prop(width / 2 + 40, height / 2 + 40, 'mushroom-cluster', 2.1);
        this.prop(width - 250, height - 180, 'barrel', 2);
        this.prop(width / 2 + 150, height - 170, 'glowcap', 2.1);
        this.addHearth(width / 2 + 150, height - 173, 95, false, 0.45);
    }
    /** Dock warehouse: stacked crates, barrels, sacks, coils of chain. */
    dressWarehouse() {
        const { width, height } = this.definition;
        // Rows of stacked crates and barrels.
        const layout = [
            [180, 180, 'crate'], [250, 195, 'barrel'], [320, 180, 'crate'],
            [width - 320, 185, 'barrel'], [width - 250, 175, 'crate'], [width - 180, 195, 'sack'],
            [200, height - 175, 'barrel'], [270, height - 165, 'crate'], [340, height - 178, 'sack'],
            [width - 260, height - 175, 'crate'], [width - 190, height - 165, 'barrel'],
        ];
        for (const [x, y, key] of layout)
            this.prop(x, y, key, 2.05);
        // A hanging lantern for work light.
        this.prop(width / 2, 150, 'lantern-on', 2.2, 8);
        this.addHearth(width / 2, 158, 165, false, 0.6);
        this.prop(width / 2 + 90, 150, 'chain', 2, 6);
        this.prop(width / 2 - 90, 150, 'chain', 2, 6);
    }
    /** Citadel gatehouse: a war-room — banners, weapon crates, braziers, statue. */
    dressCitadel() {
        const { width, height } = this.definition;
        // Banners flanking the far wall.
        this.prop(150, 165, 'banner', 2.2, 8);
        this.prop(width - 150, 165, 'banner', 2.2, 8);
        // Braziers throwing hot citadel light.
        this.prop(280, 190, 'brazier-lit', 2.2);
        this.prop(width - 280, 190, 'brazier-lit', 2.2);
        this.addHearth(280, 182, 175, true, 0.78);
        this.addHearth(width - 280, 182, 175, true, 0.78);
        // A grim statue watching the gate.
        this.prop(width / 2, 160, 'statue', 2.4, 12);
        // Weapon crates and barrels along the walls.
        this.prop(200, height - 175, 'crate', 2.1);
        this.prop(270, height - 165, 'crate', 2);
        this.prop(width - 210, height - 175, 'barrel', 2.1);
        this.prop(width - 280, height - 165, 'crate', 2);
    }
    // ---- small furniture built from primitives (kept, but sharpened) --------
    drawBed(x, y) {
        const g = this.add.graphics().setDepth(y / 10 + 6);
        g.fillStyle(0x171821, 1).fillRect(x - 46, y - 26, 92, 54);
        g.fillStyle(0x4a3327, 1).fillRect(x - 44, y - 24, 88, 50);
        g.fillStyle(this.definition.accent, .5).fillRect(x - 40, y - 20, 76, 42);
        g.fillStyle(0xc6b9a8, 1).fillRect(x - 36, y - 16, 26, 18);
        g.lineStyle(2, 0x9b7048, .6).strokeRect(x - 44, y - 24, 88, 50);
    }
    drawTable(x, y, stools = 0) {
        const g = this.add.graphics().setDepth(y / 10 + 6);
        g.fillStyle(0x171821, 1).fillRect(x - 66, y - 30, 132, 60);
        g.fillStyle(0x6c4c38, 1).fillRect(x - 62, y - 26, 124, 52);
        g.lineStyle(2, 0x9b7048, .7).strokeRect(x - 62, y - 26, 124, 52);
        for (let index = 0; index < stools; index += 1) {
            const sx = x - 44 + index * 44;
            g.fillStyle(0x4a3327, 1).fillCircle(sx, y + 44, 12);
            g.fillStyle(0x6c4c38, 1).fillCircle(sx, y + 42, 9);
        }
    }
    drawBench(x, y) {
        const g = this.add.graphics().setDepth(y / 10 + 6);
        g.fillStyle(0x171821, 1).fillRect(x - 84, y - 8, 168, 20);
        g.fillStyle(0x514a50, 1).fillRect(x - 80, y - 6, 160, 16);
        g.lineStyle(1, 0x736a78, .5).strokeRect(x - 80, y - 6, 160, 16);
    }
    drawShelf(x, y) {
        const g = this.add.graphics().setDepth(y / 10 + 6);
        g.fillStyle(0x171821, 1).fillRect(x - 66, y - 92, 132, 184);
        g.fillStyle(0x4a3b2c, 1).fillRect(x - 60, y - 86, 120, 172);
        const bottle = [0x79b87a, 0x9c70b5, 0xc58a55, 0x6fa8c0];
        for (let row = -60; row <= 60; row += 60) {
            g.fillStyle(0x2b2620, 1).fillRect(x - 52, y + row, 104, 7);
            for (let b = -38; b <= 38; b += 26) {
                g.fillStyle(bottle[Math.abs(b / 26) % bottle.length], .95).fillRect(x + b - 5, y + row - 20, 11, 19);
                g.fillStyle(0xffffff, .12).fillRect(x + b - 3, y + row - 18, 3, 14);
            }
        }
        g.lineStyle(2, 0x6a5540, .6).strokeRect(x - 60, y - 86, 120, 172);
    }
    /** A rising fountain of embers over a forge/fire, respecting quality. */
    emberFountain(x, y) {
        const count = this.saves.get().settings.quality === 'low' ? 4 : this.saves.get().settings.reducedMotion ? 5 : 9;
        for (let index = 0; index < count; index += 1) {
            const ember = this.add.image(x + phaser_1.default.Math.Between(-30, 30), y + phaser_1.default.Math.Between(-6, 20), 'ember').setDepth(40).setScale(1.4);
            this.tweens.add({ targets: ember, y: ember.y - phaser_1.default.Math.Between(45, 95), x: ember.x + phaser_1.default.Math.Between(-16, 16), alpha: 0, duration: phaser_1.default.Math.Between(900, 1800), repeat: -1, delay: index * 130 });
        }
    }
    /**
     * Interiors are lit by their own hearth/candles rather than a day/night cycle.
     * We pin the daylight tint to a fixed dim value and set an enormous day length
     * so it barely drifts during a visit, then punch warm light back through it
     * from every emitter the dressing pass registered.
     */
    createLighting() {
        const save = this.saves.get();
        const low = save.settings.quality === 'low' || (save.settings.quality === 'auto' && this.scale.width < 700);
        this.lighting = new Lighting_1.LightingSystem(this);
        this.lighting.create();
        // Effectively freeze the cycle: a day is ~28 hours of real play, so the fixed
        // interior gloom never noticeably brightens or darkens while inside.
        this.lighting.setDayLength(100000);
        // A dim, indoor value — well into evening so the hearths clearly matter.
        this.lighting.setDayProgress(0.8);
        if (low) {
            // On weak hardware keep only the two brightest hearths so night still reads.
            const brightest = [...this.lightSources].sort((a, b) => { var _a, _b; return ((_a = b.intensity) !== null && _a !== void 0 ? _a : b.preset.intensity) - ((_b = a.intensity) !== null && _b !== void 0 ? _b : a.preset.intensity); }).slice(0, 2);
            for (const light of brightest) {
                this.lighting.addLight({ x: light.x, y: light.y, radius: light.radius, ...light.preset, ...(light.intensity !== undefined ? { intensity: light.intensity } : {}) });
            }
            return;
        }
        for (const light of this.lightSources) {
            this.lighting.addLight({ x: light.x, y: light.y, radius: light.radius, ...light.preset, ...(light.intensity !== undefined ? { intensity: light.intensity } : {}) });
        }
    }
    createInteriorParticles() {
        const count = this.saves.get().settings.quality === 'low' ? 8 : 20;
        for (let index = 0; index < count; index += 1) {
            const mote = this.add.image(phaser_1.default.Math.Between(90, this.definition.width - 90), phaser_1.default.Math.Between(90, this.definition.height - 90), 'pixel')
                .setTint(this.definition.accent).setAlpha(phaser_1.default.Math.FloatBetween(.08, .3)).setDepth(4).setScale(phaser_1.default.Math.FloatBetween(.5, 1.5));
            this.tweens.add({ targets: mote, y: mote.y - phaser_1.default.Math.Between(18, 45), alpha: .02, duration: phaser_1.default.Math.Between(1800, 3600), yoyo: true, repeat: -1 });
        }
    }
    createPlayer() {
        this.player = this.physics.add.sprite(this.definition.width / 2, this.definition.height - 145, (0, hero_1.heroKey)('up', 'idle', 0)).setScale(1.65).setCollideWorldBounds(true);
        const body = this.player.body;
        body.setSize(16, 12).setOffset(8, 26);
        this.heldWeapon = this.add.image(this.player.x, this.player.y, `held-${this.saves.get().equippedWeapon}`).setScale(1.45).setOrigin(.2, .5).setDepth(25);
        this.syncHeldWeapon();
    }
    syncHeldWeapon() {
        var _a;
        if (!((_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.scene))
            return;
        const weaponId = this.saves.get().equippedWeapon;
        if (this.heldWeapon.texture.key !== `held-${weaponId}`)
            this.heldWeapon.setTexture(`held-${weaponId}`);
        document.documentElement.dataset.heldWeapon = weaponId;
        this.heldWeapon.setPosition(this.player.x + this.facing.x * 10, this.player.y + 5 + this.facing.y * 9).setRotation(this.facing.angle()).setAlpha(this.player.alpha);
        this.heldWeapon.setDepth(this.facing.y < -.35 ? this.player.depth - 1 : this.player.depth + 2);
    }
    createResident() {
        const residentByRoom = { forge: 'runa', herbalist: 'vesna', elira_house: 'elira', chapel: 'gran', marsh_hut: 'iva', dock_house: 'ferryman', citadel_gatehouse: 'serah' };
        const npcId = residentByRoom[this.definition.id];
        if (!npcId)
            return;
        const index = content_1.NPCS.findIndex((entry) => entry.id === npcId);
        this.npc = this.add.sprite(this.definition.width / 2 + 190, 190, `npc-${Math.max(0, index)}`).setScale(1.72).setDepth(30);
        const npc = content_1.NPCS[index];
        this.add.text(this.npc.x, this.npc.y - 46, npc.name, { fontFamily: 'monospace', fontSize: '10px', color: '#e7e0e8', stroke: '#11131a', strokeThickness: 4 }).setOrigin(.5).setDepth(32);
    }
    setupInput() {
        if (!this.input.keyboard)
            return;
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,I,R,Z,X,V,SHIFT,ESC,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
        this.input.on('wheel', (_pointer, _objects, _deltaX, deltaY) => {
            if (!this.uiLocked)
                this.cycleWeapon(deltaY > 0 ? 1 : -1);
        });
    }
    setupUi() {
        this.ui = new GameUI_1.GameUI();
        this.ui.mount();
        events_1.GameEvents.emit('location', this.definition.name);
        events_1.GameEvents.emit('tutorial', null);
        this.emitHud();
        this.listen('ui-lock', (locked) => { this.uiLocked = locked; if (locked)
            this.player.setVelocity(0); });
        this.listen('ui-move', (vector) => this.mobileMove.set(vector.x, vector.y));
        this.listen('ui-interact', () => { if (!this.uiLocked)
            this.interact(); });
        this.listen('ui-attack', () => this.interiorAttack());
        this.listen('ui-dash', () => this.dash());
        this.listen('ui-special', () => this.interiorSpecial());
        this.listen('ui-heal', () => this.useItem('blood_vial'));
        this.listen('equip', (id) => this.equipWeapon(id));
        this.listen('buy', (id) => this.buyWeapon(id));
        this.listen('equip-item', (id) => { this.inventory.equip(id); AudioManager_1.audio.ui(); this.emitHud(); });
        this.listen('use-item', (id) => this.useItem(id));
        this.listen('use-quick-slot', (index) => this.useQuickSlot(index));
        this.listen('assign-quick-slot', ({ itemId, slot }) => {
            if (itemId && typeof slot === 'number' && this.inventory.setQuickSlot(slot, itemId)) {
                AudioManager_1.audio.ui();
                this.emitHud();
            }
        });
        this.listen('clear-quick-slot', (slot) => { if (this.inventory.clearQuickSlot(slot)) {
            AudioManager_1.audio.ui();
            this.emitHud();
        } });
        this.listen('transfer-item', ({ itemId, direction }) => {
            if (itemId && direction && this.inventory.transfer(itemId, 1, direction)) {
                AudioManager_1.audio.pickup();
                this.emitHud();
            }
        });
        this.listen('toggle-sound', () => this.toggleSound());
        this.listen('set-volume', ({ key, value }) => this.setVolume(key, value));
        this.listen('toggle-motion', () => this.toggleMotion());
        this.listen('toggle-quality', () => this.toggleQuality());
        this.listen('fullscreen', () => { if (this.scale.isFullscreen)
            this.scale.stopFullscreen();
        else
            this.scale.startFullscreen(); });
        this.listen('open-shop', () => events_1.GameEvents.emit('panel-open', 'shop'));
        this.listen('craft-recipe', (recipeId) => this.craftRecipe(recipeId));
        this.listen('upgrade-weapon', (weaponId) => this.upgradeWeapon(weaponId));
        this.listen('reset-game', () => { this.saves.reset(); window.location.reload(); });
    }
    /**
     * Craft a recipe at Runa's anvil, then refresh the HUD so the open panel
     * re-renders with new material counts (the GameUI contract). Note: the craft
     * stat is incremented inside CraftingSystem.craft, so it is intentionally NOT
     * bumped again here (WorldScene bumps it a second time — a pre-existing quirk we
     * don't replicate).
     */
    craftRecipe(recipeId) {
        const result = this.crafting.craft(recipeId);
        if (result.ok)
            AudioManager_1.audio.craft();
        else
            AudioManager_1.audio.ui('error');
        events_1.GameEvents.emit('toast', result.message);
        this.emitHud();
    }
    /** Reinforce a weapon at the forge, then refresh the HUD + held-weapon sprite. */
    upgradeWeapon(weaponId) {
        const result = this.crafting.upgradeWeapon(weaponId);
        if (result.ok) {
            AudioManager_1.audio.craft();
            this.syncHeldWeapon();
        }
        else
            AudioManager_1.audio.ui('error');
        events_1.GameEvents.emit('toast', result.message);
        this.emitHud();
    }
    updatePlayer(time) {
        if (this.uiLocked) {
            this.player.setVelocity(0);
            this.player.anims.stop();
            return;
        }
        if (this.isDashing)
            return;
        const input = new phaser_1.default.Math.Vector2((this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0), (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0));
        if (this.mobileMove.lengthSq() > .02)
            input.copy(this.mobileMove);
        if (input.lengthSq() > 1)
            input.normalize();
        const speed = 165 + this.inventory.speedBonus();
        this.player.setVelocity(input.x * speed, input.y * speed);
        if (input.lengthSq() > .02) {
            this.facing.copy(input).normalize();
            this.setHeroAnimation('walk', input.x, input.y);
            if (time > this.lastStepAt + 340) {
                AudioManager_1.audio.step('wood');
                this.lastStepAt = time;
            }
        }
        else {
            this.player.setVelocity(0);
            this.setHeroAnimation('idle', this.facing.x, this.facing.y);
        }
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.E))
            this.interact();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.F))
            this.useItem('blood_vial');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.I))
            events_1.GameEvents.emit('panel-open', 'inventory');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.ESC))
            events_1.GameEvents.emit('panel-open', 'pause');
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.SPACE))
            this.interiorAttack();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.SHIFT))
            this.dash();
        if (phaser_1.default.Input.Keyboard.JustDown(this.keys.R))
            this.interiorSpecial();
        const weaponKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
        weaponKeys.forEach((key, index) => {
            if (phaser_1.default.Input.Keyboard.JustDown(this.keys[key])) {
                const weapon = content_1.WEAPONS[index];
                if (weapon && this.saves.get().ownedWeapons.includes(weapon.id))
                    this.equipWeapon(weapon.id);
            }
        });
        // Quick-item slots on Z / X / V — the same binding WorldScene should add.
        const quickKeys = ['Z', 'X', 'V'];
        quickKeys.forEach((key, index) => {
            if (phaser_1.default.Input.Keyboard.JustDown(this.keys[key]))
                this.useQuickSlot(index);
        });
    }
    /**
     * Chooses the hero animation from a movement/facing vector — mirrors
     * WorldScene.setHeroAnimation so the exile animates identically indoors: five
     * sculpted directions (the three facing right are mirrored for left) with a
     * short hold on transient poses.
     */
    setHeroAnimation(pose, dx, dy) {
        if (this.heroPose !== pose && this.time.now < this.heroPoseUntil)
            return;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        let dir;
        if (absX < 0.001 && absY < 0.001)
            dir = this.heroDir;
        else if (absX > absY * 2.2)
            dir = 'side';
        else if (absY > absX * 2.2)
            dir = dy < 0 ? 'up' : 'down';
        else
            dir = dy < 0 ? 'up-side' : 'down-side';
        this.heroDir = dir;
        this.heroPose = pose;
        const flip = dir !== 'up' && dir !== 'down' && dx < 0;
        const animKey = `hero-${dir}-${pose}`;
        if (this.anims.exists(animKey))
            this.player.play(animKey, true);
        else {
            this.player.anims.stop();
            this.player.setTexture((0, hero_1.heroKey)(dir, pose, 0));
        }
        this.player.setFlipX(flip);
    }
    /** Play a one-shot pose (attack/dash/hurt) and lock it for `holdMs`. */
    playHeroPose(pose, holdMs) {
        this.heroPoseUntil = 0;
        this.setHeroAnimation(pose, this.facing.x, this.facing.y);
        this.heroPoseUntil = this.time.now + holdMs;
    }
    /** Use the consumable bound to quick slot `index`, sharing useItem's feedback. */
    useQuickSlot(index) {
        const result = this.inventory.useQuickSlot(index);
        events_1.GameEvents.emit('toast', result.message);
        if (!result.used)
            return;
        if (result.effect === 'heal')
            AudioManager_1.audio.heal();
        else if (result.effect === 'smoke')
            this.playSmoke();
        else
            AudioManager_1.audio.ui();
        this.emitHud();
    }
    updatePrompt() {
        const candidates = [
            { type: 'exit', x: this.exitDoor.x, y: this.exitDoor.y, label: 'Выйти наружу' },
        ];
        if (this.chest)
            candidates.push({ type: 'chest', x: this.chest.x, y: this.chest.y, label: 'Открыть сундук' });
        if (this.npc)
            candidates.push({ type: 'npc', x: this.npc.x, y: this.npc.y, label: 'Поговорить' });
        if (this.anvil)
            candidates.push({ type: 'anvil', x: this.anvil.x, y: this.anvil.y, label: 'Работать у наковальни' });
        const nearest = candidates
            .map((candidate) => ({ ...candidate, distance: phaser_1.default.Math.Distance.Between(this.player.x, this.player.y, candidate.x, candidate.y) }))
            .filter((candidate) => candidate.distance < 86)
            .sort((a, b) => a.distance - b.distance)[0];
        const next = nearest === null || nearest === void 0 ? void 0 : nearest.type;
        if (next !== this.prompt) {
            this.prompt = next;
            events_1.GameEvents.emit('prompt', { text: nearest === null || nearest === void 0 ? void 0 : nearest.label });
        }
    }
    interact() {
        if (this.prompt === 'exit')
            return this.exitInterior();
        if (this.prompt === 'anvil') {
            // Runa's anvil is the crafting station: recipes carry a `station: 'runa'`,
            // so interacting here opens the crafting panel where WorldScene wires the
            // craft-recipe / upgrade-weapon events.
            AudioManager_1.audio.craft();
            events_1.GameEvents.emit('panel-open', 'craft');
            return;
        }
        if (this.prompt === 'chest') {
            if (this.chest && !this.saves.get().flags[`interior-chest:${this.definition.id}`]) {
                this.saves.mutate((save) => { save.flags[`interior-chest:${this.definition.id}`] = true; }, true);
                this.chest.setTexture('chest-open');
                const reward = this.definition.id === 'forge' ? 'ash_crystal' : this.definition.id === 'herbalist' ? 'greater_vial' : 'bone_shard';
                this.inventory.add(reward, this.definition.id === 'player_home' ? 3 : 1, true);
                AudioManager_1.audio.chest();
                events_1.GameEvents.emit('loot', { itemId: reward, quantity: this.definition.id === 'player_home' ? 3 : 1 });
            }
            events_1.GameEvents.emit('panel-open', 'chest');
            this.emitHud();
            return;
        }
        if (this.prompt === 'npc')
            this.openResidentDialogue();
    }
    openResidentDialogue() {
        var _a;
        const residentByRoom = { forge: 'runa', herbalist: 'vesna', elira_house: 'elira', chapel: 'gran', marsh_hut: 'iva', dock_house: 'ferryman', citadel_gatehouse: 'serah' };
        const npcId = residentByRoom[this.definition.id];
        const npc = content_1.NPCS.find((entry) => entry.id === npcId);
        if (!npc)
            return;
        const text = {
            runa: 'Внутри кузницы металл говорит громче людей. Если слышишь звон — значит, оружие ещё живо.',
            vesna: 'Здесь безопасно трогать почти всё. Банку с чёрной крышкой лучше не открывай.',
            elira: 'Дом стал тише после твоего возвращения. Иногда тишина — тоже награда.',
            gran: 'Под часовней есть склеп. Пока печати держатся, мёртвые остаются внизу.',
            iva: 'В топи стены ставят не от людей, а от того, что смотрит из воды.',
            ferryman: 'Каждый ящик имеет цену. Иногда золотом, иногда памятью.',
            serah: 'Здесь хранилось оружие стражи. Возьми подходящее, если заслужишь доверие.',
        };
        events_1.GameEvents.emit('dialogue', { speaker: npc.name, subtitle: npc.role.toUpperCase(), text: (_a = text[npcId]) !== null && _a !== void 0 ? _a : 'Добро пожаловать.', accent: `#${npc.accent.toString(16).padStart(6, '0')}`, actions: [{ label: npcId === 'runa' ? 'Открыть магазин' : 'Продолжить', event: npcId === 'runa' ? 'open-shop' : 'close', primary: true }, { label: 'Уйти', event: 'close' }] });
    }
    cycleWeapon(direction) {
        const owned = content_1.WEAPONS.filter((weapon) => this.saves.get().ownedWeapons.includes(weapon.id));
        if (owned.length < 2)
            return;
        const current = owned.findIndex((weapon) => weapon.id === this.saves.get().equippedWeapon);
        this.equipWeapon(owned[(current + direction + owned.length) % owned.length].id);
    }
    equipWeapon(weaponId) {
        var _a;
        const weapon = content_1.WEAPONS.find((entry) => entry.id === weaponId);
        if (!weapon || !this.inventory.equip(weaponId))
            return;
        (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setTexture(`held-${weaponId}`).setScale(1.8).setTint(phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color);
        this.time.delayedCall(170, () => { var _a; return (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setScale(1.45).clearTint(); });
        AudioManager_1.audio.ui();
        events_1.GameEvents.emit('toast', `Экипировано: ${weapon.name}`);
        this.emitHud();
    }
    buyWeapon(weaponId) {
        var _a;
        const result = this.shop.purchase(weaponId);
        events_1.GameEvents.emit('toast', result.message);
        if (!result.ok || !result.weapon)
            return;
        (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setTexture(`held-${weaponId}`).setScale(1.95).setTint(phaser_1.default.Display.Color.HexStringToColor(result.weapon.accent).color);
        this.time.delayedCall(220, () => { var _a; return (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setScale(1.45).clearTint(); });
        AudioManager_1.audio.coin();
        this.emitHud();
    }
    dash() {
        if (this.uiLocked || this.isDashing || this.time.now < this.dashReadyAt)
            return;
        const direction = this.mobileMove.lengthSq() > .05 ? this.mobileMove.clone().normalize() : this.facing.clone().normalize();
        this.dashReadyAt = this.time.now + 1800;
        this.isDashing = true;
        this.playHeroPose('dash', 200);
        this.player.setVelocity(direction.x * 520, direction.y * 520).setAlpha(.7);
        AudioManager_1.audio.dash();
        this.time.delayedCall(170, () => { this.isDashing = false; this.player.setAlpha(1).setVelocity(0); });
    }
    interiorSpecial() {
        var _a, _b;
        if (this.uiLocked || this.time.now < this.specialReadyAt)
            return;
        const weapon = (_a = content_1.WEAPONS.find((entry) => entry.id === this.saves.get().equippedWeapon)) !== null && _a !== void 0 ? _a : content_1.WEAPONS[0];
        this.specialReadyAt = this.time.now + 4500;
        AudioManager_1.audio.special(weapon.kind);
        this.playHeroPose('attack', 300);
        (_b = this.lighting) === null || _b === void 0 ? void 0 : _b.flash(this.player.x, this.player.y, 200, phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color, 460);
        const ring = this.add.circle(this.player.x, this.player.y, 26, 0xb46dcc, .4).setStrokeStyle(5, 0xf0ccff, .9).setDepth(90);
        this.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
    }
    interiorAttack() {
        var _a, _b;
        if (this.uiLocked)
            return;
        const weapon = (_a = content_1.WEAPONS.find((entry) => entry.id === this.saves.get().equippedWeapon)) !== null && _a !== void 0 ? _a : content_1.WEAPONS[0];
        if (weapon.cooldown >= 600)
            AudioManager_1.audio.heavyAttack(weapon.kind);
        else
            AudioManager_1.audio.attack(weapon.kind);
        this.playHeroPose('attack', 200);
        (_b = this.heldWeapon) === null || _b === void 0 ? void 0 : _b.setScale(1.8).setTint(phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color);
        this.time.delayedCall(130, () => { var _a; return (_a = this.heldWeapon) === null || _a === void 0 ? void 0 : _a.setScale(1.45).clearTint(); });
        const x = this.player.x + this.facing.x * 38;
        const y = this.player.y + this.facing.y * 38;
        const slash = this.add.rectangle(x, y, 46, 10, phaser_1.default.Display.Color.HexStringToColor(weapon.accent).color, .8).setRotation(this.facing.angle()).setDepth(80);
        this.tweens.add({ targets: slash, scaleX: 1.6, alpha: 0, duration: 150, onComplete: () => slash.destroy() });
    }
    exitInterior() {
        AudioManager_1.audio.door();
        this.saves.mutate((save) => { save.currentScene = 'world'; save.playerPosition = { ...this.returnPoint }; }, true);
        this.cameras.main.fadeOut(300, 8, 9, 14);
        this.time.delayedCall(310, () => this.scene.start('WorldScene', { spawnX: this.returnPoint.x, spawnY: this.returnPoint.y, fromInterior: true }));
    }
    useItem(itemId) {
        const result = this.inventory.use(itemId);
        events_1.GameEvents.emit('toast', result.message);
        if (result.used) {
            if (result.effect === 'heal')
                AudioManager_1.audio.heal();
            else if (result.effect === 'smoke')
                this.playSmoke();
            else
                AudioManager_1.audio.ui();
            this.emitHud();
        }
    }
    /**
     * Smoke bomb indoors. Interiors have no persistent enemies, so this is purely
     * the visual "breather" cloud — the shared SmokeBomb module keeps it identical
     * to the world effect (it simply finds no enemies to blind here).
     */
    playSmoke() {
        var _a;
        const settings = this.saves.get().settings;
        const low = settings.quality === 'low' || (settings.quality === 'auto' && this.scale.width < 700);
        (0, SmokeBomb_1.detonateSmokeBomb)(this, {
            x: this.player.x,
            y: this.player.y,
            enemies: [],
            reducedMotion: settings.reducedMotion,
            lowQuality: low,
        });
        AudioManager_1.audio.special('magic');
        (_a = this.lighting) === null || _a === void 0 ? void 0 : _a.flash(this.player.x, this.player.y, 120, 0x8b8791, 320);
    }
    emitHud() {
        const save = this.saves.get();
        const active = this.quests.activeObjective();
        const objective = active ? active.quest.objectives[active.progress.objectiveIndex] : undefined;
        const snapshot = {
            health: save.health, maxHealth: this.inventory.maxHealth(), level: save.level, xp: save.xp, xpNext: (0, content_1.XP_FOR_LEVEL)(save.level), coins: save.coins,
            reputation: save.reputation, potions: this.inventory.quantity('blood_vial'), equippedWeapon: save.equippedWeapon, ownedWeapons: [...save.ownedWeapons],
            inventory: save.inventory.map((stack) => ({ ...stack })), chest: save.chest.map((stack) => ({ ...stack })), equipment: structuredClone(save.equipment),
            discoveredLocations: [...save.discoveredLocations],
            discoveredSecrets: Object.keys(save.flags).filter((key) => key.startsWith('secret-found:')).map((key) => key.slice('secret-found:'.length)),
            currentScene: this.definition.id, settings: { ...save.settings },
            activeQuest: active && objective ? { title: active.quest.title, objective: objective.label, amount: active.progress.amount, required: objective.amount, ready: active.progress.status === 'ready' } : undefined,
            quests: this.quests.snapshotQuests(), claimedTiers: [...save.claimedTiers], tutorialDone: save.tutorialDone,
        };
        events_1.GameEvents.emit('hud', { snapshot, save: structuredClone(save) });
    }
    toggleSound() {
        this.saves.mutate((save) => { save.settings.sound = !save.settings.sound; }, true);
        AudioManager_1.audio.setMix(this.audioMix(this.saves.get()));
        this.emitHud();
    }
    setVolume(key, value) {
        if (!key || typeof value !== 'number' || !key.endsWith('Volume'))
            return;
        this.saves.mutate((save) => { save.settings[key] = value; }, true);
        AudioManager_1.audio.setMix(this.audioMix(this.saves.get()));
    }
    toggleMotion() {
        this.saves.mutate((save) => { save.settings.reducedMotion = !save.settings.reducedMotion; }, true);
        document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
        this.emitHud();
    }
    toggleQuality() {
        const order = ['auto', 'high', 'low'];
        this.saves.mutate((save) => { save.settings.quality = order[(order.indexOf(save.settings.quality) + 1) % order.length]; }, true);
        document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low');
        this.emitHud();
    }
    audioMix(save) {
        return { enabled: save.settings.sound, master: save.settings.masterVolume, music: save.settings.musicVolume, sfx: save.settings.sfxVolume, ambience: save.settings.ambienceVolume };
    }
    listen(event, callback) {
        events_1.GameEvents.on(event, callback);
        this.eventDisposers.push(() => events_1.GameEvents.off(event, callback));
    }
    cleanup() {
        var _a, _b, _c;
        this.eventDisposers.forEach((dispose) => dispose());
        this.eventDisposers = [];
        (_a = this.lighting) === null || _a === void 0 ? void 0 : _a.destroy();
        (_b = this.ui) === null || _b === void 0 ? void 0 : _b.destroy();
        (_c = this.saves) === null || _c === void 0 ? void 0 : _c.flush();
    }
}
exports.InteriorScene = InteriorScene;

});
  __req("src/main.ts");
})();