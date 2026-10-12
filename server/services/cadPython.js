/**
 * Finding and running the Python interpreter that owns the CAD project.
 *
 * The right interpreter is the project's own virtualenv — it is the one with
 * cadquery installed. The `python` on PATH is usually something else entirely
 * (here it is Espressif's, which has no cadquery), so PATH is the last resort,
 * never the first.
 *
 * Everything is spawned with `execFile` and an argument array: CAD paths contain
 * spaces ("02. LCD") and a shell string would split them.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CAD_ROOT, isConfigured, resolveInRoot } from './cadRoot.js';

/** Worker JSON is prefixed so the project's own print() output cannot corrupt it. */
export const SENTINEL = '#HUBCAD-JSON#';

const PROBE_TTL_MS = 60_000;
let probeCache = null; // { at, result }

const VENV_BINS = [
  path.join('.venv', 'Scripts', 'python.exe'), // Windows
  path.join('.venv', 'bin', 'python'), // POSIX
  path.join('venv', 'Scripts', 'python.exe'),
  path.join('venv', 'bin', 'python'),
];

/**
 * Walk up from `startAbs` towards CAD_ROOT looking for a virtualenv.
 * The venv for this project lives at "02. LCD/.venv", i.e. one level above the
 * script's own folder — hence the walk rather than a fixed path.
 */
export function findVenvFrom(startAbs) {
  if (!isConfigured()) return null;
  const root = fs.realpathSync.native(CAD_ROOT);
  let dir = startAbs;
  for (let depth = 0; depth < 12; depth++) {
    for (const rel of VENV_BINS) {
      const candidate = path.join(dir, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
    if (path.resolve(dir) === root) break;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/**
 * Pick an interpreter. `nearAbs` biases the search towards the venv that owns
 * the file being worked on; without it we look from CAD_ROOT downwards one
 * level, which finds "02. LCD/.venv" for the common case.
 */
export function findInterpreter(nearAbs = null) {
  if (process.env.CAD_PYTHON && fs.existsSync(process.env.CAD_PYTHON)) {
    return { path: process.env.CAD_PYTHON, source: 'env' };
  }
  if (nearAbs) {
    const venv = findVenvFrom(fs.statSync(nearAbs).isDirectory() ? nearAbs : path.dirname(nearAbs));
    if (venv) return { path: venv, source: 'venv' };
  }
  if (isConfigured()) {
    const root = fs.realpathSync.native(CAD_ROOT);
    for (const name of fs.readdirSync(root)) {
      const dir = path.join(root, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      for (const rel of VENV_BINS) {
        const candidate = path.join(dir, rel);
        if (fs.existsSync(candidate)) return { path: candidate, source: 'venv' };
      }
    }
  }
  return { path: process.platform === 'win32' ? 'python' : 'python3', source: 'path' };
}

function run(bin, args, opts = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      bin,
      args,
      {
        timeout: opts.timeout ?? 20_000,
        maxBuffer: opts.maxBuffer ?? 32 * 1024 * 1024,
        windowsHide: true,
        cwd: opts.cwd,
        env: {
          ...process.env,
          // Without this, a print() carrying Vietnamese or "±" crashes the
          // child under the Windows cp1252 console codec.
          PYTHONIOENCODING: 'utf-8',
          // Keep __pycache__ out of a Drive-synced folder.
          PYTHONDONTWRITEBYTECODE: '1',
        },
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err?.code ?? 0,
          killed: Boolean(err?.killed),
          signal: err?.signal || null,
          stdout: stdout || '',
          stderr: stderr || '',
          error: err ? err.message : null,
        });
      }
    );
    // The constraints mode takes its request on stdin.
    if (opts.input != null) child.stdin.end(opts.input);
  });
}

/** Pull the one sentinel line out of a worker's stdout, or explain why not. */
function readSentinel(res, what) {
  const marked = res.stdout.split(/\r?\n/).find((l) => l.startsWith(SENTINEL));
  if (!marked) {
    const err = new Error(
      res.killed ? `${what} timed out` : res.stderr.slice(-600) || `${what} produced no output`
    );
    err.status = res.killed ? 504 : 500;
    err.code = res.killed ? 'TIMEOUT' : 'WORKER_FAILED';
    throw err;
  }
  try {
    return JSON.parse(marked.slice(SENTINEL.length));
  } catch (e) {
    const err = new Error(`${what} returned malformed JSON: ${e.message}`);
    err.status = 500;
    err.code = 'WORKER_FAILED';
    throw err;
  }
}

/** Version + cadquery presence for the chosen interpreter. Cached 60 s. */
export async function probePython({ force = false } = {}) {
  if (!force && probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) {
    return probeCache.result;
  }
  const chosen = findInterpreter();
  // Real newlines, and no compound statement after a ';' — `python -c` parses
  // this as an ordinary module, so `try:` must start its own line.
  const script = [
    'import sys, json, importlib',
    'cq = None',
    'try:',
    '    cq = getattr(importlib.import_module("cadquery"), "__version__", None)',
    'except Exception:',
    '    pass',
    'print(json.dumps({"version": "%d.%d.%d" % sys.version_info[:3], "cadquery": cq}))',
  ].join('\n');

  const res = await run(chosen.path, ['-c', script], { timeout: 30_000 });
  let parsed = null;
  if (res.ok) {
    const line = res.stdout.trim().split(/\r?\n/).pop() || '';
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = null;
    }
  }
  const result = {
    available: Boolean(parsed),
    path: chosen.path,
    source: chosen.source,
    version: parsed?.version || null,
    cadquery: parsed?.cadquery || null,
    detail: parsed ? null : res.error || res.stderr.slice(0, 400) || 'Interpreter did not respond',
    probedAt: new Date().toISOString(),
  };
  probeCache = { at: Date.now(), result };
  return result;
}

/** Drop the cached probe — used after CAD_PYTHON changes. */
export function resetProbe() {
  probeCache = null;
}

const WORKER = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'python', 'cad_introspect.py');

/**
 * Run the introspection worker on one entry script.
 *
 * The worker prints its JSON behind a sentinel because the CAD project's own
 * modules print while importing — "back fillet skipped" and friends would
 * otherwise sit in front of the payload.
 */
export async function introspect(entryAbs, { live = true, timeout = 40_000 } = {}) {
  const chosen = findInterpreter(entryAbs);
  const args = [
    WORKER,
    '--root',
    fs.realpathSync.native(CAD_ROOT),
    '--entry',
    entryAbs,
    ...(live ? [] : ['--no-live']),
  ];
  const res = await run(chosen.path, args, { timeout, cwd: path.dirname(entryAbs) });

  const payload = readSentinel(res, 'Introspection');

  if (payload.error === 'SYNTAX') {
    const err = new Error(`Python syntax error: ${payload.message}`);
    err.status = 422;
    err.code = 'SYNTAX';
    err.detail = { lineno: payload.lineno, offset: payload.offset };
    throw err;
  }
  if (payload.error) {
    const err = new Error(payload.message || 'Introspection failed');
    err.status = 500;
    err.code = payload.error;
    throw err;
  }
  return { ...payload, python: { path: chosen.path, source: chosen.source } };
}

/**
 * Evaluate shop constraints before and after a proposed set of edits.
 * `overrides` is `{ [relFile]: { NAME: number } }`.
 */
export async function runConstraints(entryAbs, constraints, overrides, { timeout = 60_000 } = {}) {
  if (!constraints?.length) return { error: null, results: [] };
  const chosen = findInterpreter(entryAbs);
  const res = await run(
    chosen.path,
    [WORKER, '--mode', 'constraints', '--root', fs.realpathSync.native(CAD_ROOT), '--entry', entryAbs],
    { timeout, cwd: path.dirname(entryAbs), input: JSON.stringify({ constraints, overrides }) }
  );
  return readSentinel(res, 'Constraint check');
}

export { run as runPython, resolveInRoot };
