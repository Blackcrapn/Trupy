/**
 * Module resolve/load hooks used by ts-loader.mjs.
 *
 * `resolve` appends the extension the bundler would have inferred; `load`
 * transpiles TypeScript to ESM with the compiler already present in
 * node_modules. Type errors are not reported here — that is `tsc --noEmit`'s job,
 * run separately in CI and by `npm run typecheck`.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

/** Candidate on-disk targets for a bundler-style specifier. */
function resolveCandidates(basePath) {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.mts`,
    path.join(basePath, 'index.ts'),
  ];
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = path.resolve(parentDir, specifier);
    for (const candidate of resolveCandidates(target)) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return { url: pathToFileURL(candidate).href, format: 'module', shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.mts')) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        useDefineForClassFields: true,
        isolatedModules: true,
      },
      fileName: fileURLToPath(url),
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
