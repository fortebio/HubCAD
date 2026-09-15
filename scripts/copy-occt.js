/**
 * Copy the occt-import-js browser bundle into public/occt/.
 *
 * occt-import-js ships a UMD script that exports only through `module.exports`
 * or AMD `define`. Neither exists in an ES module, so importing it from source
 * yields a namespace with no callable export. It also cannot be pre-bundled:
 * the emscripten glue calls require('path') / require('crypto') for its Node
 * branch, which the browser dep-optimizer cannot resolve.
 *
 * Serving it from public/ and loading it as a classic <script> avoids both
 * problems — exactly how the library's own worker uses it.
 *
 * Runs automatically after `npm install` so the copies cannot go stale.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'occt-import-js', 'dist');
const to = join(root, 'public', 'occt');

const FILES = ['occt-import-js.js', 'occt-import-js.wasm'];

if (!existsSync(from)) {
  console.warn('[copy-occt] occt-import-js is not installed — skipping.');
  process.exit(0);
}

mkdirSync(to, { recursive: true });
for (const file of FILES) {
  copyFileSync(join(from, file), join(to, file));
  console.log(`[copy-occt] ${file} → public/occt/`);
}
