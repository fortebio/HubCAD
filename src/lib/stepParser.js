// STEP / IGES / BREP → triangle mesh, using occt-import-js (OpenCascade WASM).
// Output shape matches src/lib/stlParser.js: a flat Float32Array of triangle
// vertex positions so STLViewer can consume it directly.
//
// IMPORTANT — why this is loaded as a classic <script> and not imported:
// occt-import-js ships a UMD bundle whose only exports are `module.exports`
// (CJS) and AMD `define`. Inside an ES module neither `module` nor `define`
// exists, so `import('occt-import-js')` resolves to a namespace with no
// callable export — the previous code failed with "factory is not a function"
// on every file. It also cannot be pre-bundled, because the emscripten glue
// calls require('path') / require('crypto') in its Node branch.
//
// Loaded as a classic script the bundle's top-level `var occtimportjs` becomes
// a global, which is how the library's own worker consumes it. The files are
// copied into public/occt/ by scripts/copy-occt.js (npm postinstall).

const OCCT_SCRIPT_URL = '/occt/occt-import-js.js';
const OCCT_WASM_URL = '/occt/occt-import-js.wasm';

let occtPromise = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-occt="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Could not load the CAD engine')));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.occt = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    });
    script.addEventListener('error', () =>
      reject(new Error(`Could not load the CAD engine from ${src}`))
    );
    document.head.appendChild(script);
  });
}

async function loadOcct() {
  if (!occtPromise) {
    occtPromise = (async () => {
      await loadScriptOnce(OCCT_SCRIPT_URL);
      const factory = globalThis.occtimportjs;
      if (typeof factory !== 'function') {
        throw new Error(
          'CAD engine did not initialise — public/occt/occt-import-js.js may be missing. Run: npm run setup:occt'
        );
      }
      return factory({
        locateFile: (file) => (file.endsWith('.wasm') ? OCCT_WASM_URL : file),
      });
    })().catch((e) => {
      // Let the next attempt retry instead of caching a failed load forever.
      occtPromise = null;
      throw e;
    });
  }
  return occtPromise;
}

function flatten(meshes) {
  let total = 0;
  for (const m of meshes) {
    const idx = m.index?.array;
    total += idx ? idx.length * 3 : (m.attributes?.position?.array?.length || 0);
  }
  const out = new Float32Array(total);
  let o = 0;
  for (const m of meshes) {
    const pos = m.attributes?.position?.array;
    if (!pos) continue;
    const idx = m.index?.array;
    if (idx) {
      for (let i = 0; i < idx.length; i++) {
        const k = idx[i] * 3;
        out[o++] = pos[k];
        out[o++] = pos[k + 1];
        out[o++] = pos[k + 2];
      }
    } else {
      for (let i = 0; i < pos.length; i++) out[o++] = pos[i];
    }
  }
  return out;
}

function toHex(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3) return null;
  const c = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Walk the assembly tree occt-import-js returns (`root.children[]`, each node
 * naming the meshes it owns) into one entry per placed body. The path is the
 * chain of assembly names above the body — the same information a CAD tree
 * shows — so a STEP assembly can be explored part by part instead of being
 * collapsed into a single mesh.
 */
function splitParts(result) {
  const meshes = result.meshes || [];
  const parts = [];
  const walk = (node, ancestors, label) => {
    const name = label ?? (node.name || '').trim();
    // The root node is usually unnamed; keep the path readable.
    const path = name ? [...ancestors, name] : ancestors;
    for (const idx of node.meshes || []) {
      const mesh = meshes[idx];
      if (!mesh) continue;
      const positions = flatten([mesh]);
      if (!positions.length) continue;
      parts.push({
        name: (mesh.name || '').trim() || name || `Body ${idx + 1}`,
        path,
        positions,
        color: toHex(mesh.color),
      });
    }
    // Two instances of the same sub-assembly share a name; number the
    // repeats ("bracket-assembly (2)") so each keeps its own branch.
    const seen = new Map();
    for (const child of node.children || []) {
      const childName = (child.name || '').trim();
      const n = (seen.get(childName) || 0) + 1;
      seen.set(childName, n);
      walk(child, path, childName && n > 1 ? `${childName} (${n})` : childName);
    }
  };
  if (result.root) walk(result.root, [], undefined);
  // A file with meshes but no usable tree still yields its bodies.
  if (!parts.length) {
    meshes.forEach((mesh, idx) => {
      const positions = flatten([mesh]);
      if (positions.length) {
        parts.push({ name: (mesh.name || '').trim() || `Body ${idx + 1}`, path: [], positions, color: toHex(mesh.color) });
      }
    });
  }
  return parts;
}

async function read(method, arrayBuffer, label) {
  const occt = await loadOcct();
  const result = occt[method](new Uint8Array(arrayBuffer), null);
  if (!result || !result.success) {
    throw new Error(`${label} parse failed (file may be invalid or unsupported)`);
  }
  return result;
}

async function readFlat(method, arrayBuffer, label) {
  const result = await read(method, arrayBuffer, label);
  const positions = flatten(result.meshes || []);
  if (!positions.length) {
    throw new Error(`${label} file contains no solid geometry`);
  }
  return positions;
}

async function readParts(method, arrayBuffer, label) {
  const result = await read(method, arrayBuffer, label);
  const parts = splitParts(result);
  if (!parts.length) {
    throw new Error(`${label} file contains no solid geometry`);
  }
  return parts;
}

/** Whole file as one triangle soup — what the cost estimator wants. */
export async function parseSTEP(arrayBuffer) {
  return readFlat('ReadStepFile', arrayBuffer, 'STEP');
}

export async function parseIGES(arrayBuffer) {
  return readFlat('ReadIgesFile', arrayBuffer, 'IGES');
}

export async function parseBREP(arrayBuffer) {
  return readFlat('ReadBrepFile', arrayBuffer, 'BREP');
}

/**
 * One entry per placed body, with its assembly path and STEP colour:
 * `[{ name, path: string[], positions: Float32Array, color: '#rrggbb'|null }]`.
 */
export async function parseSTEPParts(arrayBuffer) {
  return readParts('ReadStepFile', arrayBuffer, 'STEP');
}

export async function parseIGESParts(arrayBuffer) {
  return readParts('ReadIgesFile', arrayBuffer, 'IGES');
}

export async function parseBREPParts(arrayBuffer) {
  return readParts('ReadBrepFile', arrayBuffer, 'BREP');
}
