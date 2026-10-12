/**
 * Shop rules and blast radius for an edit.
 *
 * Two kinds of warning come from here:
 *   constraints  - relations the shop declares in <CAD_ROOT>/.hubcad/constraints.json,
 *                  such as the RB009 snap wall being LIP_T + JGAP + TONGUE_T.
 *   shared files - a module under common/ is imported by every concept folder,
 *                  so editing it is never the local change it looks like.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CAD_ROOT, toRel } from './cadRoot.js';

const CONFIG_DIR = '.hubcad';
const SKIP_DIRS = new Set(['.git', '.venv', 'venv', 'node_modules', '__pycache__', '.hubcad-bak']);

/** Declared constraints, filtered to the ones that mention this entry script. */
export function loadConstraints(entryRel) {
  const file = path.join(CAD_ROOT, CONFIG_DIR, 'constraints.json');
  if (!fs.existsSync(file)) return [];
  let list;
  try {
    list = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    // A broken rules file must not block an edit; it is advisory data.
    console.warn('[cad-source] constraints.json is not valid JSON:', e.message);
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.filter((c) => {
    if (!c?.expr) return false;
    if (!c.appliesTo?.length) return true;
    return c.appliesTo.includes(entryRel);
  });
}

const importerCache = new Map(); // moduleName -> { at, files }
const CACHE_TTL_MS = 120_000;

/**
 * Which other project files import `moduleName`. A grep rather than an import
 * graph: we want the reach across the whole CAD root, not just this script's
 * own dependencies.
 */
export function importersOf(moduleName, limit = 400) {
  const cached = importerCache.get(moduleName);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.files;

  const re = new RegExp(`^\\s*(?:import\\s+${moduleName}\\b|from\\s+${moduleName}\\s+import)`, 'm');
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6 || found.length >= limit) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= limit) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name.toLowerCase()) || e.name.startsWith('.tmp.drive')) continue;
        walk(full, depth + 1);
      } else if (e.name.toLowerCase().endsWith('.py')) {
        try {
          if (re.test(fs.readFileSync(full, 'utf8'))) found.push(toRel(full));
        } catch {
          /* unreadable file, skip */
        }
      }
    }
  };
  walk(CAD_ROOT, 0);
  found.sort();
  importerCache.set(moduleName, { at: Date.now(), files: found });
  return found;
}

/**
 * For each file about to be written, who else depends on it. The entry script's
 * own folder is excluded from the count — the point is reach *beyond* this job.
 */
export function sharedFileWarnings(relFiles, entryRel) {
  const entryDir = path.posix.dirname(entryRel);
  const out = [];
  for (const rel of relFiles) {
    const moduleName = path.basename(rel, '.py');
    const importers = importersOf(moduleName).filter((f) => f !== rel);
    const outside = importers.filter((f) => path.posix.dirname(f) !== entryDir);
    if (outside.length) {
      out.push({ file: rel, module: moduleName, importedBy: outside, count: outside.length });
    }
  }
  return out;
}
