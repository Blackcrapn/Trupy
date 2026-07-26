/**
 * Headless harness: boots the real game in Node with stubbed DOM/Canvas/WebAudio.
 *
 * Typechecking cannot catch a missing texture key or a call on an undefined
 * system, and the Playwright smoke test needs a browser. This sits in between:
 * it runs the actual Phaser scenes so integration mistakes fail loudly in CI.
 */
// Boots the real game in Node with a stubbed DOM/Canvas/WebAudio, to catch
// runtime errors that typechecking cannot (bad texture keys, undefined calls).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(process.env.TMPDIR || '/tmp', 'trupy-headless-build');

// ---- Minimal Canvas2D context stub
function makeCtx(w, h) {
  const noop = () => {};
  return {
    canvas: { width: w, height: h },
    imageSmoothingEnabled: false, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', globalAlpha: 1, font: '', textAlign: 'left', textBaseline: 'top',
    globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, scale: noop,
    rotate: noop, transform: noop, setTransform: noop, clip: noop, drawImage: noop,
    fillText: noop, strokeText: noop, setLineDash: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    measureText: () => ({ width: 10, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: (x, y, gw, gh) => ({ data: new Uint8ClampedArray(Math.max(1, gw * gh * 4)), width: gw, height: gh }),
    putImageData: noop,
    createImageData: (iw, ih) => ({ data: new Uint8ClampedArray(Math.max(1, iw * ih * 4)), width: iw, height: ih }),
    getContextAttributes: () => ({ alpha: true }),
  };
}
function makeCanvas(w = 300, h = 150) {
  const el = {
    width: w, height: h, style: {}, nodeType: 1, tagName: 'CANVAS',
    getContext: (kind) => (kind === '2d' ? makeCtx(el.width, el.height) : null),
    toDataURL: () => 'data:image/png;base64,', addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: el.width, height: el.height, right: el.width, bottom: el.height }),
    setAttribute: () => {}, getAttribute: () => null, appendChild: () => {}, removeChild: () => {},
    parentNode: null, focus: () => {}, blur: () => {},
  };
  return el;
}

// ---- DOM stub
function makeElement(tag = 'div') {
  const children = [];
  const el = {
    tagName: String(tag).toUpperCase(), nodeType: 1, style: {}, dataset: {},
    children, childNodes: children, innerHTML: '', textContent: '', value: '',
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    appendChild(c){ children.push(c); if (c) c.parentNode = el; return c; },
    removeChild(c){ const i = children.indexOf(c); if (i>=0) children.splice(i,1); return c; },
    insertBefore(c){ children.push(c); return c; },
    remove(){}, setAttribute(){}, removeAttribute(){}, getAttribute: () => null, hasAttribute: () => false,
    addEventListener(){}, removeEventListener(){}, dispatchEvent: () => true,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left:0, top:0, width: 960, height: 540, right:960, bottom:540 }),
    focus(){}, blur(){}, click(){}, closest: () => null, contains: () => false,
    setPointerCapture(){}, releasePointerCapture(){},
    getContext: tag === 'canvas' ? (k) => (k === '2d' ? makeCtx(960,540) : null) : undefined,
    parentNode: null, offsetWidth: 960, offsetHeight: 540, scrollTop: 0,
  };
  return el;
}
const documentStub = {
  nodeType: 9,
  documentElement: makeElement('html'),
  body: makeElement('body'),
  head: makeElement('head'),
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : makeElement(tag)),
  createElementNS: (_ns, tag) => makeElement(tag),
  createTextNode: (t) => ({ nodeType: 3, textContent: t }),
  getElementById: (id) => { documentStub.__byId ||= {}; return (documentStub.__byId[id] ||= makeElement('div')); },
  querySelector: (sel) => {
    // The UI layer looks up its mount points by id selector.
    const match = /^#([\w-]+)$/.exec(String(sel));
    return match ? documentStub.getElementById(match[1]) : null;
  },
  querySelectorAll: () => [],
  addEventListener(){}, removeEventListener(){}, dispatchEvent: () => true,
  hidden: false, visibilityState: 'visible', readyState: 'complete',
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), add(){}, check: () => true },
};
documentStub.documentElement.dataset = {};

// ---- Web Audio stub
class AudioParamStub { constructor(v=0){ this.value=v; } setValueAtTime(){return this;} linearRampToValueAtTime(){return this;}
  exponentialRampToValueAtTime(){return this;} setTargetAtTime(){return this;} cancelScheduledValues(){return this;} }
function audioNode(ctx, extra = {}) {
  return { context: ctx, connect(){ return arguments[0]; }, disconnect(){}, ...extra };
}
class AudioContextStub {
  constructor(){ this.sampleRate=44100; this.currentTime=0; this.state='running'; this.destination=audioNode(this); }
  createGain(){ return audioNode(this,{ gain:new AudioParamStub(1) }); }
  createOscillator(){ const n=audioNode(this,{ frequency:new AudioParamStub(440), detune:new AudioParamStub(0), type:'sine', start(){}, stop(){}, onended:null }); return n; }
  createBufferSource(){ return audioNode(this,{ buffer:null, loop:false, playbackRate:new AudioParamStub(1), start(){}, stop(){}, onended:null }); }
  createBiquadFilter(){ return audioNode(this,{ type:'lowpass', frequency:new AudioParamStub(350), Q:new AudioParamStub(1), gain:new AudioParamStub(0) }); }
  createStereoPanner(){ return audioNode(this,{ pan:new AudioParamStub(0) }); }
  createDynamicsCompressor(){ return audioNode(this,{ threshold:new AudioParamStub(-24), knee:new AudioParamStub(30), ratio:new AudioParamStub(12), attack:new AudioParamStub(.003), release:new AudioParamStub(.25) }); }
  createConvolver(){ return audioNode(this,{ buffer:null, normalize:true }); }
  createBuffer(ch,len){ const d=[]; for(let i=0;i<ch;i++) d.push(new Float32Array(len));
    return { numberOfChannels:ch, length:len, sampleRate:44100, duration:len/44100, getChannelData:(i)=>d[i] }; }
  resume(){ return Promise.resolve(); } suspend(){ return Promise.resolve(); } close(){ return Promise.resolve(); }
}

// ---- window / globals
// Capture the real timers before the stubs shadow them, otherwise the stub
// delegates to itself and blows the stack.
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
const nativeSetInterval = globalThis.setInterval.bind(globalThis);
const nativeClearInterval = globalThis.clearInterval.bind(globalThis);
const listeners = {};
const windowStub = {
  document: documentStub, navigator: { userAgent: 'node-headless', platform: 'linux', maxTouchPoints: 0, language: 'ru' },
  location: { href: 'http://localhost/', search: '', hash: '', protocol: 'http:', host: 'localhost' },
  innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
  addEventListener: (t, f) => { (listeners[t] ||= []).push(f); }, removeEventListener(){}, dispatchEvent: () => true,
  requestAnimationFrame: (cb) => nativeSetTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: (id) => nativeClearTimeout(id),
  setTimeout: nativeSetTimeout, clearTimeout: nativeClearTimeout,
  setInterval: nativeSetInterval, clearInterval: nativeClearInterval,
  AudioContext: AudioContextStub, webkitAudioContext: AudioContextStub,
  Image: class { constructor(){ this.width=1; this.height=1; } set src(_v){ nativeSetTimeout(()=>this.onload&&this.onload(),0); } addEventListener(){} },
  URL: { createObjectURL: () => 'blob:', revokeObjectURL(){} },
  performance: { now: () => Date.now() },
  localStorage: (() => { const m=new Map(); return { getItem:(k)=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:(k)=>m.delete(k), clear:()=>m.clear(), get length(){return m.size;}, key:(i)=>[...m.keys()][i] }; })(),
  matchMedia: () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
  focus(){}, blur(){}, scrollTo(){}, getComputedStyle: () => ({ getPropertyValue: () => '' }),
  HTMLCanvasElement: class {}, HTMLElement: class {}, Element: class {}, Node: class {},
  CanvasRenderingContext2D: class {}, WebGLRenderingContext: undefined,
  // Phaser's ScaleManager reads these directly off the global scope.
  screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, orientation: { type: 'landscape-primary', addEventListener(){}, removeEventListener(){} } },
  visualViewport: { width: 960, height: 540, scale: 1, addEventListener(){}, removeEventListener(){} },
  ImageData: class { constructor(w,h){ this.width=w; this.height=h; this.data=new Uint8ClampedArray(Math.max(1,w*h*4)); } },
  XMLHttpRequest: class { open(){} send(){} setRequestHeader(){} addEventListener(){} },
  Audio: class { constructor(){} play(){ return Promise.resolve(); } pause(){} addEventListener(){} canPlayType(){ return ''; } },
};
windowStub.window = windowStub; windowStub.self = windowStub; windowStub.top = windowStub;

export function installDom() {
  for (const [k, v] of Object.entries(windowStub)) {
    try { Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true }); } catch {}
  }
  const define = (key, value) => {
    try { Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); }
    catch { /* immutable global in this runtime; the stub above is enough */ }
  };
  define('window', windowStub);
  define('document', documentStub);
  define('navigator', windowStub.navigator);
  define('localStorage', windowStub.localStorage);
  globalThis.AudioContext = AudioContextStub;
  globalThis.Image = windowStub.Image;
  globalThis.requestAnimationFrame = windowStub.requestAnimationFrame;
  globalThis.cancelAnimationFrame = windowStub.cancelAnimationFrame;
  globalThis.matchMedia = windowStub.matchMedia;
  globalThis.HTMLCanvasElement = function(){};
  globalThis.HTMLCanvasElement.prototype = {};
  return { windowStub, documentStub, listeners };
}

// ---- transpile the project so it can be imported by Node
export function buildProject() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const rel = path.relative(path.join(ROOT, 'src'), full);
      const dst = path.join(OUT, rel).replace(/\.ts$/, '.mjs');
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const src = fs.readFileSync(full, 'utf8');
      let js = ts.transpileModule(src, { compilerOptions:{ target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, useDefineForClassFields:true } }).outputText;
      js = js
        .replace(/from\s+['"]phaser['"]/g, `from '${path.join(ROOT, 'tests/phaser-shim.mjs')}'`)
        .replace(/import\s+['"][^'"]+\.css['"];?/g, '')
        .replace(/from\s+['"](\.\.?\/[^'"]+)['"]/g, (m, p) => (/\.(m?js|json)$/.test(p) ? m : `from '${p}.mjs'`));
      fs.writeFileSync(dst, js);
    }
  };
  walk(path.join(ROOT, 'src'));
  return OUT;
}
