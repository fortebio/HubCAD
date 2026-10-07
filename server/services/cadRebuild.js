/**
 * Running a model script to regenerate its STEP/STL.
 *
 * This is the one endpoint in HubCAD that executes code on the workstation, so
 * it is deliberately narrow: only a script that declares itself buildable, only
 * a whitelisted argument, one run at a time per script, a hard timeout, and an
 * audit row for every invocation.
 *
 * The opt-in lives in the CAD project rather than here — a `.hubcad.json` next
 * to the script with `"allowRebuild": true`. That way the set of runnable
 * scripts is declared by the engineers who own the files, not inferred by us.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CAD_ROOT, httpError, isModelScript, toRel } from './cadRoot.js';
import { findInterpreter, introspect, runPython } from './cadPython.js';

export const OPT_IN_FILE = '.hubcad.json';
const ALLOWED_ARGS = new Set(['--check']);
const TIMEOUT_MS = 120_000;
const MAX_LOG_LINES = 200;

/** One run at a time per script: a second build would race the first's output. */
const inFlight = new Map(); // abs path -> started at

export function readOptIn(scriptAbs) {
  const file = path.join(path.dirname(scriptAbs), OPT_IN_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function rebuildAllowed(scriptAbs) {
  const cfg = readOptIn(scriptAbs);
  return Boolean(cfg?.allowRebuild);
}

/** Write the opt-in, preserving anything else already in the file. */
export function enableRebuild(scriptAbs, user) {
  const file = path.join(path.dirname(scriptAbs), OPT_IN_FILE);
  const existing = readOptIn(scriptAbs) || {};
  const next = {
    ...existing,
    allowRebuild: true,
    enabledBy: user?.username || null,
    enabledAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { file: toRel(file), config: next };
}

function tail(text, lines = MAX_LOG_LINES) {
  const all = (text || '').split(/\r?\n/);
  return all.length <= lines ? all.join('\n') : all.slice(-lines).join('\n');
}

function statOf(abs) {
  try {
    const st = fs.statSync(abs);
    return { exists: true, size: st.size, mtime: st.mtimeMs };
  } catch {
    return { exists: false, size: null, mtime: null };
  }
}

/** Google Drive renames a losing copy to "foo (1).step" when it races a write. */
function conflictsIn(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => / \(\d+\)\.[^.]+$/.test(n))
      .map((n) => toRel(path.join(dir, n)));
  } catch {
    return [];
  }
}

/**
 * Run `script` with its project interpreter and report what changed on disk.
 * `scriptAbs` must already be proven inside CAD_ROOT by the caller.
 */
export async function rebuild(scriptAbs, { args = [], user } = {}) {
  const st = fs.statSync(scriptAbs);
  if (!isModelScript(scriptAbs, st)) {
    throw httpError(
      400,
      'Not a model script — it must import cadquery and have a __main__ block / Không phải script dựng mô hình',
      'NOT_MODEL_SCRIPT'
    );
  }
  if (!rebuildAllowed(scriptAbs)) {
    throw httpError(
      403,
      `Rebuild is not enabled for this folder. Add ${OPT_IN_FILE} with {"allowRebuild": true} next to the script / Thư mục này chưa bật dựng lại`,
      'REBUILD_NOT_ENABLED'
    );
  }
  for (const a of args) {
    if (!ALLOWED_ARGS.has(a)) throw httpError(400, `Argument not allowed: ${a}`, 'ARG_NOT_ALLOWED');
  }
  if (inFlight.has(scriptAbs)) {
    throw httpError(
      409,
      'That script is already building / Script này đang được dựng',
      'BUSY'
    );
  }

  // Predicted outputs from the AST alone — fast, and no geometry is built.
  let predicted = [];
  try {
    const meta = await introspect(scriptAbs, { live: false, timeout: 20_000 });
    predicted = (meta.exports || []).flatMap((ex) => [
      ex.assembly.rel,
      ...ex.printable.flatMap((p) => [p.step.rel, p.stl.rel]),
    ]);
  } catch {
    // A script we cannot parse can still be run; we just cannot predict outputs.
    predicted = [];
  }

  const dir = path.dirname(scriptAbs);
  // `predicted` paths are relative to CAD_ROOT, which is where toRel measured them.
  const absOf = (rel) => path.join(CAD_ROOT, rel.replace(/\//g, path.sep));
  const beforeStats = Object.fromEntries(predicted.map((rel) => [rel, statOf(absOf(rel))]));
  const beforeConflicts = new Set(conflictsIn(dir));

  const python = findInterpreter(scriptAbs);
  inFlight.set(scriptAbs, Date.now());
  const t0 = Date.now();
  let res;
  try {
    res = await runPython(python.path, [scriptAbs, ...args], {
      cwd: dir,
      timeout: TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
  } finally {
    inFlight.delete(scriptAbs);
  }
  const durationMs = Date.now() - t0;

  const outputs = predicted.map((rel) => {
    const now = statOf(absOf(rel));
    const was = beforeStats[rel];
    return {
      rel,
      ...now,
      changed: now.exists && (!was.exists || now.mtime !== was.mtime || now.size !== was.size),
    };
  });
  const conflicts = conflictsIn(dir).filter((c) => !beforeConflicts.has(c));

  if (res.killed) {
    const err = httpError(
      504,
      `Rebuild timed out after ${Math.round(TIMEOUT_MS / 1000)}s / Quá thời gian dựng lại`,
      'TIMEOUT'
    );
    err.detail = { stdout: tail(res.stdout), stderr: tail(res.stderr), durationMs };
    throw err;
  }

  return {
    ok: res.ok,
    exitCode: res.code === 0 && !res.ok ? 1 : res.code,
    durationMs,
    python: { path: python.path, source: python.source },
    stdout: tail(res.stdout),
    stderr: tail(res.stderr),
    outputs,
    conflicts,
  };
}
