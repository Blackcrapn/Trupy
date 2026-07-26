/**
 * Minimal TypeScript ESM loader for running the test suite with plain Node.
 *
 * The suite is normally run through `tsx`. This loader is a dependency-free
 * fallback that does the same two jobs `tsx` does for us: resolve the
 * bundler-style extensionless relative imports the source uses, and transpile
 * `.ts` on the fly. It lets `node --import ./tests/ts-loader.mjs` run the tests
 * in environments where the dev dependencies are unavailable.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-hooks.mjs', pathToFileURL(import.meta.filename));
