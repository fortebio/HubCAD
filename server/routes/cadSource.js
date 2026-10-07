/**
 * /api/cad-source — read access to the CAD project tree outside the app.
 *
 * Thin by design: validate, delegate to a service, and let the shared error
 * handler in server/index.js turn thrown `{status, code}` errors into JSON.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import {
  commitPlan,
  describePlan,
  planEdits,
  styleLiteral,
  validateLiteral,
} from '../services/cadEdit.js';
import { loadConstraints, sharedFileWarnings } from '../services/cadConstraints.js';
import {
  OPT_IN_FILE,
  enableRebuild,
  readOptIn,
  rebuild,
  rebuildAllowed,
} from '../services/cadRebuild.js';
import {
  CAD_ROOT,
  MAX_RAW_BYTES,
  isConfigured,
  isModelScript,
  listDir,
  readTextFile,
  resolveInRoot,
  sha1Of,
  httpError,
  toRel,
} from '../services/cadRoot.js';
import { introspect, probePython, runConstraints } from '../services/cadPython.js';

const router = express.Router();
router.use(requireAuth);

const EDIT_ROLES = ['designer', 'manager'];

/**
 * What this installation can actually do. Always 200 — the page uses it to
 * decide between the real UI and an explanatory empty state, so an error here
 * would just hide the explanation.
 */
router.get('/capabilities', async (req, res, next) => {
  try {
    const configured = isConfigured();
    const python = configured
      ? await probePython()
      : { available: false, path: null, source: null, version: null, cadquery: null };
    const canEdit = EDIT_ROLES.includes(req.user?.role);
    res.json({
      configured,
      cadRoot: configured ? CAD_ROOT : null,
      python,
      you: {
        role: req.user?.role || null,
        canEdit,
        canRebuild: canEdit && python.available,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/tree', (req, res, next) => {
  try {
    res.json(listDir(req.query.path || ''));
  } catch (e) {
    next(e);
  }
});

router.get('/file', (req, res, next) => {
  try {
    if (!req.query.path) throw httpError(400, 'path is required');
    res.json(readTextFile(req.query.path));
  } catch (e) {
    next(e);
  }
});

/**
 * Parameters, import graph, part index and predicted outputs for one script.
 *
 * Needs the project's Python, so it is the first endpoint that fails when the
 * app runs somewhere without one — the page keeps its tree and source view.
 */
router.get('/introspect', async (req, res, next) => {
  try {
    const rel = req.query.path;
    if (!rel) throw httpError(400, 'path is required');
    if (!rel.toLowerCase().endsWith('.py')) throw httpError(400, 'Not a Python file');
    const abs = resolveInRoot(rel);
    if (!fs.existsSync(abs)) throw httpError(404, `Not found: ${rel}`);

    const python = await probePython();
    if (!python.available) {
      throw httpError(
        503,
        'Python is not available on this host / Không tìm thấy Python trên máy chủ',
        'PYTHON_UNAVAILABLE'
      );
    }
    res.json(await introspect(abs, { live: req.query.live !== '0' }));
  } catch (e) {
    next(e);
  }
});

/** Raw bytes for the 3D viewer. Conditional on ETag so re-opening is free. */
router.get('/raw', (req, res, next) => {
  try {
    if (!req.query.path) throw httpError(400, 'path is required');
    const abs = resolveInRoot(req.query.path);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      throw httpError(404, `Not found: ${req.query.path}`);
    }
    if (!st.isFile()) throw httpError(400, 'Not a file');
    if (st.size > MAX_RAW_BYTES) throw httpError(413, 'File is larger than 50 MB');

    const etag = `"${sha1Of(abs, st)}"`;
    res.set({
      ETag: etag,
      'Last-Modified': new Date(st.mtimeMs).toUTCString(),
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(st.size),
      'X-Cad-Path': encodeURIComponent(toRel(abs)),
    });
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    next(e);
  }
});

// --------------------------------------------------------------- editing
/**
 * Turn the request's edits into a per-file plan.
 *
 * Every edit carries the byte range and the literal that was read, so the
 * splicer can refuse when the file moved underneath the operator. `applyTo`
 * decides whether a name declared in several files is changed everywhere or
 * only where it was clicked.
 */
function buildPlanInput(body) {
  const edits = Array.isArray(body?.edits) ? body.edits : [];
  if (!edits.length) throw httpError(400, 'No edits supplied');
  if (edits.length > 200) throw httpError(400, 'Too many edits in one request');

  const byFile = {};
  const overrides = {};
  for (const e of edits) {
    if (!e?.file || !Number.isInteger(e.lineno) || !Number.isInteger(e.colByte)) {
      throw httpError(400, 'Each edit needs file, lineno, colByte, endColByte, expect, newLiteral');
    }
    const literal = styleLiteral(String(e.expect ?? ''), validateLiteral(e.newLiteral));
    (byFile[e.file] ||= []).push({
      lineno: e.lineno,
      colByte: e.colByte,
      endColByte: e.endColByte,
      expect: String(e.expect ?? ''),
      literal,
      name: e.name,
    });
    if (e.name) (overrides[e.file] ||= {})[e.name] = Number(literal);
  }
  return { byFile, overrides };
}

/** Shared by /preview and /write so a write can never see a different picture. */
async function assess(body, user) {
  const entry = body?.entry;
  if (!entry) throw httpError(400, 'entry (the script being edited) is required');
  const entryAbs = resolveInRoot(entry);

  const { byFile, overrides } = buildPlanInput(body);
  const plan = planEdits(byFile, body.expect || {});
  const diffs = describePlan(plan);

  const constraints = loadConstraints(entry);
  let constraintResults = [];
  if (constraints.length) {
    const python = await probePython();
    if (python.available) {
      const run = await runConstraints(entryAbs, constraints, overrides);
      const byId = new Map(constraints.map((c) => [c.id, c]));
      constraintResults = (run.results || []).map((r) => ({
        ...r,
        message: byId.get(r.id)?.message || null,
      }));
    }
  }

  const shared = sharedFileWarnings(Object.keys(byFile), entry);
  const blockers = constraintResults.filter((r) => r.severity === 'error' && r.holds === false);
  const ack = new Set(body.acknowledge || []);
  const unacknowledged = blockers.filter((b) => !ack.has(b.id));

  return {
    plan,
    diffs,
    constraints: constraintResults,
    sharedFileWarnings: shared,
    blocked: unacknowledged.length > 0,
    blockReasons: unacknowledged.map((b) => ({ id: b.id, message: b.message })),
    user,
  };
}

router.post('/preview', requireRole('designer', 'manager'), async (req, res, next) => {
  try {
    const out = await assess(req.body, req.user);
    res.json({
      diffs: out.diffs,
      constraints: out.constraints,
      sharedFileWarnings: out.sharedFileWarnings,
      blocked: out.blocked,
      blockReasons: out.blockReasons,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/write', requireRole('designer', 'manager'), async (req, res, next) => {
  try {
    const out = await assess(req.body, req.user);
    if (out.blocked) {
      throw httpError(
        409,
        `Blocked by a shop rule: ${out.blockReasons.map((b) => b.message?.en || b.id).join('; ')}`,
        'CONSTRAINT'
      );
    }
    const written = commitPlan(out.plan);
    if (!written.length) {
      return res.json({ written: [], note: 'Nothing changed / Không có gì thay đổi' });
    }
    recordAudit({
      user: req.user,
      action: 'cad_source.write',
      entityType: 'cad_file',
      entityId: null,
      summary: `Edited ${written.length} CAD source file(s): ${written.map((w) => w.file).join(', ')}`,
      meta: { entry: req.body.entry, written, edits: req.body.edits },
    });
    res.json({ written, constraints: out.constraints });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------- rebuilding
/**
 * Run a model script and report what it wrote.
 *
 * This executes code on the workstation, so it is gated four ways: the script
 * must import cadquery and have a __main__ block, its folder must carry an
 * explicit `.hubcad.json` opt-in, only `--check` may be passed, and one build
 * runs at a time per script.
 */
router.post('/rebuild', requireRole('designer', 'manager'), async (req, res, next) => {
  try {
    const rel = req.body?.script;
    if (!rel) throw httpError(400, 'script is required');
    const abs = resolveInRoot(rel);
    if (!fs.existsSync(abs)) throw httpError(404, `Not found: ${rel}`);

    const python = await probePython();
    if (!python.available) {
      throw httpError(
        503,
        'Python is not available on this host / Không tìm thấy Python trên máy chủ',
        'PYTHON_UNAVAILABLE'
      );
    }

    const args = Array.isArray(req.body.args) ? req.body.args : [];
    const out = await rebuild(abs, { args, user: req.user });

    recordAudit({
      user: req.user,
      action: 'cad_source.rebuild',
      entityType: 'cad_file',
      entityId: null,
      summary: `Rebuilt ${rel} (exit ${out.exitCode}, ${Math.round(out.durationMs / 100) / 10}s)`,
      meta: {
        script: rel,
        args,
        exitCode: out.exitCode,
        durationMs: out.durationMs,
        outputs: out.outputs.filter((o) => o.changed).map((o) => o.rel),
        conflicts: out.conflicts,
      },
    });
    res.json({ script: rel, ...out });
  } catch (e) {
    next(e);
  }
});

/** Whether this script may be rebuilt, and why not when it may not. */
router.get('/rebuild-status', (req, res, next) => {
  try {
    const rel = req.query.path;
    if (!rel) throw httpError(400, 'path is required');
    const abs = resolveInRoot(rel);
    const exists = fs.existsSync(abs);
    const modelScript = exists && isModelScript(abs, fs.statSync(abs));
    res.json({
      path: rel,
      isModelScript: modelScript,
      allowed: modelScript && rebuildAllowed(abs),
      optIn: exists ? readOptIn(abs) : null,
      optInFile: OPT_IN_FILE,
      canEdit: EDIT_ROLES.includes(req.user?.role),
    });
  } catch (e) {
    next(e);
  }
});

/** Opt this folder in, on an explicit request from the operator. */
router.post('/allow-rebuild', requireRole('manager'), (req, res, next) => {
  try {
    const rel = req.body?.script;
    if (!rel) throw httpError(400, 'script is required');
    const abs = resolveInRoot(rel);
    if (!fs.existsSync(abs)) throw httpError(404, `Not found: ${rel}`);
    if (!isModelScript(abs, fs.statSync(abs))) {
      throw httpError(400, 'Not a model script', 'NOT_MODEL_SCRIPT');
    }
    const out = enableRebuild(abs, req.user);
    recordAudit({
      user: req.user,
      action: 'cad_source.allow_rebuild',
      entityType: 'cad_file',
      entityId: null,
      summary: `Enabled rebuild for ${path.posix.dirname(rel)}`,
      meta: out,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
