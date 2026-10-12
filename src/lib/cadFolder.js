/**
 * Browse a CAD project folder from the browser, without uploading anything.
 *
 * Engineers keep their work in a tree like 05.FBT-CAD/02. LCD/<variant>/, with
 * the STEP master, its STL and the native SolidWorks part side by side. Picking
 * files one by one through the upload box loses that structure, so this module
 * reads a whole directory and hands the viewer a grouped index instead.
 *
 * Two pickers exist and both keep the files on the operator's machine:
 *   - showDirectoryPicker() (Chromium): returns handles, so a file is read only
 *     when it is actually opened, and the folder can be re-opened later.
 *   - <input webkitdirectory> (everyone else): the browser materialises the
 *     File objects up front; we still never send them anywhere.
 */

/** Extensions the 3D viewer can parse today. Mirrors CAD_ACCEPT. */
const VIEWABLE = ['stl', 'obj', 'step', 'stp', 'iges', 'igs', 'brep'];

/**
 * Native CAD formats. These are closed binary containers — no browser parser
 * exists — so they are listed for context and marked "export to STEP first".
 */
const NATIVE = {
  sldprt: 'SolidWorks part',
  sldasm: 'SolidWorks assembly',
  slddrw: 'SolidWorks drawing',
  ipt: 'Inventor part',
  iam: 'Inventor assembly',
  idw: 'Inventor drawing',
  f3d: 'Fusion 360',
  f3z: 'Fusion 360',
  prt: 'NX / Creo part',
  asm: 'Creo assembly',
  catpart: 'CATIA part',
  catproduct: 'CATIA assembly',
  x_t: 'Parasolid',
  x_b: 'Parasolid',
  sat: 'ACIS',
  '3dm': 'Rhino',
  skp: 'SketchUp',
};

/** 2D and reference files worth showing beside the models. */
const DOC = { dxf: '2D drawing', dwg: '2D drawing', pdf: 'Document' };

/** Folders that never hold deliverables — skipping them keeps the tree short. */
const SKIP_DIRS = new Set([
  '.git',
  '.venv',
  'venv',
  'node_modules',
  '__pycache__',
  '.history',
  '.vs',
  '.idea',
  'site-packages',
]);

const MAX_FILES = 4000;

export function extOf(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

export function baseOf(name) {
  return name.replace(/\.[^.]+$/, '');
}

/** How the browser should treat one file: open it, flag it, or ignore it. */
export function classifyFile(name) {
  const ext = extOf(name);
  if (VIEWABLE.includes(ext)) return { kind: 'viewable', ext, label: ext.toUpperCase() };
  if (NATIVE[ext]) return { kind: 'native', ext, label: NATIVE[ext] };
  if (DOC[ext]) return { kind: 'doc', ext, label: DOC[ext] };
  return { kind: 'other', ext, label: ext.toUpperCase() };
}

/** True when this browser can hand out directory handles (Chrome, Edge). */
export function supportsDirectoryPicker() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Walk a FileSystemDirectoryHandle. Entries carry the handle, not the bytes —
 * a 200 MB assembly costs nothing until the operator clicks it.
 */
async function walkHandle(dir, prefix, out, onProgress) {
  for await (const entry of dir.values()) {
    if (out.length >= MAX_FILES) return;
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
      await walkHandle(entry, [...prefix, entry.name], out, onProgress);
    } else {
      const info = classifyFile(entry.name);
      if (info.kind === 'other') continue;
      out.push({ name: entry.name, dir: prefix, handle: entry, file: null, size: null, ...info });
      onProgress?.(out.length);
    }
  }
}

/**
 * Ask the operator for a folder and index every CAD file inside it.
 * Returns `null` when the picker is dismissed.
 */
export async function pickCadFolder(onProgress) {
  if (!supportsDirectoryPicker()) throw new Error('Directory picker not supported');
  let dir;
  try {
    dir = await window.showDirectoryPicker({ id: 'hubcad-cad', mode: 'read' });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
  const files = [];
  await walkHandle(dir, [], files, onProgress);
  return { root: dir.name, files, handle: dir };
}

/**
 * Index a FileList from <input webkitdirectory>. Each File already carries its
 * path inside the chosen folder as `webkitRelativePath`.
 */
export function indexPickedFiles(fileList) {
  const all = Array.from(fileList || []);
  if (!all.length) return null;

  const rootName = (all[0].webkitRelativePath || all[0].name).split('/')[0];
  const files = [];
  for (const file of all) {
    if (files.length >= MAX_FILES) break;
    const rel = (file.webkitRelativePath || file.name).split('/');
    const dir = rel.slice(1, -1); // drop the root name and the file itself
    if (dir.some((d) => SKIP_DIRS.has(d.toLowerCase()))) continue;
    const info = classifyFile(file.name);
    if (info.kind === 'other') continue;
    files.push({ name: file.name, dir, handle: null, file, size: file.size, ...info });
  }
  return { root: rootName, files, handle: null };
}

/** Read one indexed entry as a File, whichever picker produced it. */
export async function readEntry(entry) {
  if (entry.file) return entry.file;
  if (entry.handle) return entry.handle.getFile();
  throw new Error(`Cannot read ${entry.name}`);
}

/**
 * Group the flat index by folder, so the panel mirrors the design variants
 * (A_Wedge, B_Block, …) the engineer already works in.
 *
 * Within a folder, a part that exists as both STEP and STL is one row: the
 * STEP is the master and the STL is offered as its mesh alternative.
 */
export function groupByFolder(files, query = '') {
  const q = query.trim().toLowerCase();
  const byDir = new Map();

  for (const f of files) {
    if (q && !f.name.toLowerCase().includes(q) && !f.dir.join('/').toLowerCase().includes(q)) {
      continue;
    }
    const key = f.dir.join('/');
    if (!byDir.has(key)) byDir.set(key, { path: f.dir, key, rows: [] });
    byDir.get(key).rows.push(f);
  }

  const folders = [];
  for (const group of byDir.values()) {
    const rows = [];
    const byBase = new Map();

    for (const f of group.rows) {
      // Only a viewable solid can act as the master of a merged row.
      if (f.kind !== 'viewable') {
        rows.push({ ...f, alt: null });
        continue;
      }
      const base = baseOf(f.name).toLowerCase();
      const existing = byBase.get(base);
      if (!existing) {
        const row = { ...f, alt: null };
        byBase.set(base, row);
        rows.push(row);
        continue;
      }
      // Prefer the B-rep master (STEP/IGES) and keep the mesh as the alternate.
      const isMesh = (x) => x.ext === 'stl' || x.ext === 'obj';
      if (isMesh(f) && !isMesh(existing)) {
        existing.alt = f;
      } else if (!isMesh(f) && isMesh(existing)) {
        const demoted = { ...existing, alt: null };
        Object.assign(existing, f, { alt: demoted });
      } else {
        rows.push({ ...f, alt: null });
      }
    }

    const rank = { viewable: 0, native: 1, doc: 2, other: 3 };
    rows.sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
    folders.push({ ...group, rows });
  }

  folders.sort((a, b) => a.key.localeCompare(b.key));
  return folders;
}

/** Headline counts for the panel subtitle. */
export function summarize(files) {
  const total = { viewable: 0, native: 0, doc: 0 };
  for (const f of files) if (f.kind in total) total[f.kind] += 1;
  return total;
}
