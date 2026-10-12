/**
 * Read-only access to the CAD project tree outside the app, rooted at CAD_ROOT.
 *
 * Every path that reaches the filesystem goes through `resolveInRoot()`. The
 * tree it guards is a Google-Drive-synced folder on the operator's workstation,
 * so it contains junctions, multi-hundred-MB archives and sync temp folders —
 * all of which the listing has to cope with.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CAD_ROOT = process.env.CAD_ROOT ? process.env.CAD_ROOT.trim() : '';

/** Folders that never hold deliverables, or that would be ruinous to walk. */
const SKIP_DIRS = new Set([
  '.git',
  '.venv',
  'venv',
  'node_modules',
  '__pycache__',
  '.vs',
  '.idea',
  '.hubcad-bak',
  'site-packages',
]);

const SKIP_PREFIXES = ['.tmp.drive'];

/** How the UI should treat a file. `other` is listed but not actionable. */
const KIND_BY_EXT = {
  py: 'script',
  step: 'model',
  stp: 'model',
  iges: 'model',
  igs: 'model',
  brep: 'model',
  stl: 'mesh',
  obj: 'mesh',
  md: 'doc',
  txt: 'doc',
  json: 'doc',
  dxf: 'doc',
  pdf: 'doc',
};

export const TEXT_EXT = new Set(['py', 'md', 'txt', 'json', 'cfg', 'ini', 'toml']);
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_RAW_BYTES = 50 * 1024 * 1024;

export function httpError(status, message, code = null) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

export function isConfigured() {
  return Boolean(CAD_ROOT) && fs.existsSync(CAD_ROOT);
}

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function kindOf(name) {
  return KIND_BY_EXT[extOf(name)] || 'other';
}

/** Google Drive renames a losing copy to "foo (1).step" — worth flagging. */
export function isSyncConflict(name) {
  return / \(\d+\)\.[^.]+$/.test(name);
}

function skipped(name) {
  const lower = name.toLowerCase();
  if (SKIP_DIRS.has(lower)) return true;
  return SKIP_PREFIXES.some((p) => lower.startsWith(p));
}

/** Deepest ancestor of `abs` that exists, so realpath has something to resolve. */
function nearestExisting(abs) {
  let p = abs;
  for (;;) {
    if (fs.existsSync(p)) return p;
    const up = path.dirname(p);
    if (up === p) return p;
    p = up;
  }
}

/**
 * Resolve a caller-supplied relative path to an absolute one proven to sit
 * inside CAD_ROOT.
 *
 * Absolute paths and drive letters are refused outright; `..` is refused after
 * resolution rather than by string matching; symlinks and NTFS junctions are
 * followed before the containment test, because a Drive-synced tree really does
 * contain them; and win32 gets a second case-insensitive check, since
 * `path.relative` compares case-sensitively even on Windows.
 */
export function resolveInRoot(rel) {
  if (!isConfigured()) throw httpError(400, 'CAD_ROOT is not configured', 'NO_ROOT');
  let r = rel == null || rel === '' ? '.' : rel;
  if (typeof r !== 'string' || r.includes('\0')) throw httpError(400, 'Bad path');
  r = r.replace(/\\/g, '/');
  if (path.isAbsolute(r) || /^[a-zA-Z]:/.test(r)) {
    throw httpError(403, 'Absolute paths are not allowed', 'ESCAPE');
  }

  const rootReal = fs.realpathSync.native(CAD_ROOT);
  const abs = path.resolve(rootReal, r);
  const probe = nearestExisting(abs);
  const checked = path.join(fs.realpathSync.native(probe), path.relative(probe, abs));

  const back = path.relative(rootReal, checked);
  if (back.startsWith('..') || path.isAbsolute(back)) {
    throw httpError(403, 'Path escapes CAD_ROOT', 'ESCAPE');
  }
  if (
    process.platform === 'win32' &&
    checked.toLowerCase() !== rootReal.toLowerCase() &&
    !(checked + path.sep).toLowerCase().startsWith((rootReal + path.sep).toLowerCase())
  ) {
    throw httpError(403, 'Path escapes CAD_ROOT', 'ESCAPE');
  }
  return checked;
}

/** Path relative to CAD_ROOT, with forward slashes — the id used by the API. */
export function toRel(abs) {
  return path.relative(fs.realpathSync.native(CAD_ROOT), abs).replace(/\\/g, '/');
}

/**
 * Turn a path the operator typed or pasted into one of our relative ids.
 *
 * They work in Explorer and think in absolute paths, so the UI accepts
 * "C:\Users\...\02. LCD\F_Pebble" as readily as "02. LCD/F_Pebble". CAD_ROOT
 * stays the fence either way: anything outside it is refused by name, so the
 * message can say which folder the app is allowed to read.
 */
export function relFromInput(input) {
  if (!isConfigured()) throw httpError(400, 'CAD_ROOT is not configured', 'NO_ROOT');
  const raw = String(input ?? '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return '';

  const rootReal = fs.realpathSync.native(CAD_ROOT);
  const normalised = raw.replace(/\\/g, '/');
  let rel = normalised;

  if (path.isAbsolute(normalised) || /^[a-zA-Z]:/.test(normalised)) {
    const abs = path.resolve(normalised);
    const back = path.relative(rootReal, abs);
    const outside =
      back.startsWith('..') ||
      path.isAbsolute(back) ||
      (process.platform === 'win32' &&
        abs.toLowerCase() !== rootReal.toLowerCase() &&
        !(abs + path.sep).toLowerCase().startsWith((rootReal + path.sep).toLowerCase()));
    if (outside) {
      throw httpError(
        403,
        `That folder is outside CAD_ROOT (${CAD_ROOT}) / Thư mục nằm ngoài vùng cho phép`,
        'OUTSIDE_ROOT'
      );
    }
    rel = back.replace(/\\/g, '/');
  }

  // resolveInRoot does the real containment proof, including symlinks.
  const abs = resolveInRoot(rel);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw httpError(404, `Not found: ${raw}`);
  }
  if (!st.isDirectory()) throw httpError(400, `Not a folder: ${raw}`);
  return toRel(abs);
}

// ---------------------------------------------------------------- caches
// Both are keyed by `${abs}:${mtimeMs}:${size}`, so a changed file misses.
const scriptCache = new Map();
const sha1Cache = new Map();

function cacheKey(abs, st) {
  return `${abs}:${st.mtimeMs}:${st.size}`;
}

/**
 * Is this a script that builds a model, i.e. safe to offer a Rebuild button for?
 * It must import cadquery AND have a __main__ block — a shared helper module
 * like f_common.py imports cadquery but produces nothing when run.
 *
 * This predicate is the rebuild allowlist, so it reads the file rather than
 * trusting the name.
 */
export function isModelScript(abs, st) {
  if (extOf(abs) !== 'py') return false;
  const key = cacheKey(abs, st);
  if (scriptCache.has(key)) return scriptCache.get(key);
  let yes = false;
  try {
    const head = fs.readFileSync(abs, 'utf8');
    yes =
      /^[ \t]*(?:import\s+cadquery|from\s+cadquery\s+import)/m.test(head) &&
      /if\s+__name__\s*==/.test(head);
  } catch {
    yes = false;
  }
  scriptCache.set(key, yes);
  return yes;
}

export function sha1Of(abs, st) {
  const key = cacheKey(abs, st);
  if (sha1Cache.has(key)) return sha1Cache.get(key);
  const hash = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');
  sha1Cache.set(key, hash);
  return hash;
}

/**
 * List one directory level. Never recursive: the root holds a 286 MB archive
 * and a virtualenv, and the UI expands lazily anyway.
 */
export function listDir(rel) {
  const abs = resolveInRoot(rel);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw httpError(404, `Not found: ${rel}`);
  }
  if (!st.isDirectory()) throw httpError(400, `Not a directory: ${rel}`);

  const entries = [];
  for (const name of fs.readdirSync(abs)) {
    if (skipped(name)) continue;
    const child = path.join(abs, name);
    let cst;
    try {
      cst = fs.statSync(child);
    } catch {
      continue; // a Drive placeholder mid-download, or a vanished temp file
    }
    if (cst.isDirectory()) {
      entries.push({
        name,
        rel: toRel(child),
        kind: 'dir',
        ext: '',
        size: null,
        mtime: cst.mtimeMs,
      });
      continue;
    }
    const kind = kindOf(name);
    entries.push({
      name,
      rel: toRel(child),
      kind,
      ext: extOf(name),
      size: cst.size,
      mtime: cst.mtimeMs,
      ...(kind === 'script' ? { isModelScript: isModelScript(child, cst) } : {}),
      ...(isSyncConflict(name) ? { syncConflict: true } : {}),
    });
  }

  const rank = { dir: 0, script: 1, model: 2, mesh: 3, doc: 4, other: 5 };
  entries.sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
  return { path: toRel(abs), entries };
}

/** Read a text file with its hash and line-ending style. */
export function readTextFile(rel) {
  const abs = resolveInRoot(rel);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw httpError(404, `Not found: ${rel}`);
  }
  if (!st.isFile()) throw httpError(400, `Not a file: ${rel}`);
  if (!TEXT_EXT.has(extOf(abs))) throw httpError(415, `Not a text file: ${rel}`);
  if (st.size > MAX_TEXT_BYTES) throw httpError(413, `File is larger than 2 MB: ${rel}`);

  const buf = fs.readFileSync(abs);
  const text = buf.toString('utf8');
  return {
    path: toRel(abs),
    text,
    mtime: st.mtimeMs,
    size: st.size,
    sha1: sha1Of(abs, st),
    lineCount: text.length ? text.split('\n').length : 0,
    eol: text.includes('\r\n') ? 'crlf' : 'lf',
  };
}
