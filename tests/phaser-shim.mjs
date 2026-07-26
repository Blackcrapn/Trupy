// Re-exports Phaser's named ESM exports as a default namespace object, matching
// the shape `import Phaser from 'phaser'` expects under the bundler resolution
// the app uses in production.
import * as PhaserNS from 'phaser/dist/phaser.esm.js';
export * from 'phaser/dist/phaser.esm.js';
export default PhaserNS;
