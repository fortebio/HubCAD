/**
 * Editing a numeric literal inside a CAD source file, byte-exactly.
 *
 * The file is an engineer's source of truth for a part that gets manufactured,
 * so the only acceptable change is the digits that were asked for. Everything
 * else — encoding, BOM, line endings, the trailing `# comment` that labels the
 * field, indentation, every other byte — must survive untouched.
 *
 * That is why this works on Buffers and byte offsets from Python's `ast` rather
 * than on strings: `col_offset` counts UTF-8 bytes within a line, and these
 * files carry  ±  °  →  and Vietnamese, so a character-index splice would cut
 * in the wrong place.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CAD_ROOT, httpError, resolveInRoot, toRel } from './cadRoot.js';

/** A plain decimal or exponent number, and nothing else. */
export const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

export const BACKUP_DIR = '.hubcad-bak';

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

/** Byte offset of the first character of every line. */
function lineStarts(buf) {
  const starts = [0];
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) starts.push(i + 1);
  return starts;
}

/**
 * Keep the written number looking like the one it replaces: a file that spells
 * everything `-16.0` should not slowly fill up with `-18`.
 */
export function styleLiteral(oldLiteral, newLiteral) {
  if (!/^[+-]?\d+$/.test(newLiteral)) return newLiteral; // already has . or e
  if (/[eE]/.test(oldLiteral)) return newLiteral;
  if (!oldLiteral.includes('.')) return newLiteral;
  return `${newLiteral}.0`;
}

export function validateLiteral(value) {
  const text = String(value).trim();
  if (!NUMBER_RE.test(text)) {
    throw httpError(
      400,
      `Only plain numbers can be written, got "${text}" / Chỉ ghi được số thuần`,
      'NOT_NUMERIC'
    );
  }
  return text;
}

/**
 * Apply edits to one file in memory and return the new buffer plus a report.
 * `edits` are `{ lineno, colByte, endColByte, expect, literal }`.
 */
export function spliceFile(buf, edits) {
  const starts = lineStarts(buf);
  const ranges = edits.map((e) => {
    if (e.lineno < 1 || e.lineno > starts.length) {
      throw httpError(409, `Line ${e.lineno} is past the end of the file`, 'STALE');
    }
    const a = starts[e.lineno - 1] + e.colByte;
    const b = starts[e.lineno - 1] + e.endColByte;
    if (b > buf.length || a >= b) throw httpError(409, 'Edit range is outside the file', 'STALE');
    const found = buf.slice(a, b).toString('utf8');
    if (found !== e.expect) {
      throw httpError(
        409,
        `Line ${e.lineno} now reads "${found}", expected "${e.expect}" — the file changed / File đã thay đổi`,
        'STALE'
      );
    }
    return { ...e, a, b, found };
  });

  // Descending, so each splice leaves the earlier offsets valid.
  ranges.sort((x, y) => y.a - x.a);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].b > ranges[i - 1].a) {
      throw httpError(400, 'Two edits overlap in the same file', 'OVERLAP');
    }
  }

  let out = buf;
  for (const r of ranges) {
    out = Buffer.concat([out.slice(0, r.a), Buffer.from(r.literal, 'utf8'), out.slice(r.b)]);
  }
  return { buffer: out, applied: ranges.length };
}

// --------------------------------------------------------------------- diff
/** Longest common subsequence over lines, the basis of the unified diff. */
function lcs(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: ' ', line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: '-', line: a[i++] });
    } else {
      ops.push({ t: '+', line: b[j++] });
    }
  }
  while (i < n) ops.push({ t: '-', line: a[i++] });
  while (j < m) ops.push({ t: '+', line: b[j++] });
  return ops;
}

/** A unified diff with `context` lines around each change. No dependency. */
export function unifiedDiff(beforeText, afterText, { context = 3, label = '' } = {}) {
  const a = beforeText.split('\n');
  const b = afterText.split('\n');
  const ops = lcs(a, b);

  const keep = new Set();
  ops.forEach((op, idx) => {
    if (op.t === ' ') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) {
      keep.add(k);
    }
  });
  if (!keep.size) return '';

  const lines = [];
  if (label) lines.push(`--- ${label}`, `+++ ${label}`);
  let aNo = 1;
  let bNo = 1;
  let hunk = null;
  ops.forEach((op, idx) => {
    const inHunk = keep.has(idx);
    if (inHunk) {
      if (!hunk) hunk = { aStart: aNo, bStart: bNo, aLen: 0, bLen: 0, body: [] };
      hunk.body.push(op.t + op.line);
      if (op.t !== '+') hunk.aLen++;
      if (op.t !== '-') hunk.bLen++;
    } else if (hunk) {
      lines.push(`@@ -${hunk.aStart},${hunk.aLen} +${hunk.bStart},${hunk.bLen} @@`, ...hunk.body);
      hunk = null;
    }
    if (op.t !== '+') aNo++;
    if (op.t !== '-') bNo++;
  });
  if (hunk) lines.push(`@@ -${hunk.aStart},${hunk.aLen} +${hunk.bStart},${hunk.bLen} @@`, ...hunk.body);
  return lines.join('\n');
}

// ------------------------------------------------------------------ backups
/**
 * Where a backup of `rel` goes: a hidden mirror at the CAD root rather than a
 * sibling file, so edits do not litter the project folder — which is synced to
 * Google Drive and globbed by the engineer's own scripts.
 */
export function backupPathFor(rel, when = new Date()) {
  const stamp =
    when.getFullYear().toString() +
    String(when.getMonth() + 1).padStart(2, '0') +
    String(when.getDate()).padStart(2, '0') +
    '-' +
    String(when.getHours()).padStart(2, '0') +
    String(when.getMinutes()).padStart(2, '0') +
    String(when.getSeconds()).padStart(2, '0');
  const dir = path.dirname(rel);
  const name = path.basename(rel);
  return path.join(CAD_ROOT, BACKUP_DIR, dir === '.' ? '' : dir, `${name}.${stamp}.bak`);
}

/** Write to a temp file in the same directory, then rename — atomic on NTFS. */
function writeAtomic(abs, buffer) {
  const tmp = `${abs}.hubcad-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, buffer);
  try {
    fs.renameSync(tmp, abs);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* the rename failure is the real error */
    }
    throw e;
  }
}

// -------------------------------------------------------------- transaction
/**
 * Plan a multi-file edit: read every file, check every guard, splice in memory.
 * Nothing touches the disk here, so `/preview` and `/write` run the same code
 * and a `/write` cannot half-apply.
 *
 * `byFile` is `{ [rel]: [{ lineno, colByte, endColByte, expect, literal }] }`.
 */
export function planEdits(byFile, expectSha = {}) {
  const plan = [];
  for (const [rel, edits] of Object.entries(byFile)) {
    const abs = resolveInRoot(rel);
    if (!fs.existsSync(abs)) throw httpError(404, `Not found: ${rel}`);
    const before = fs.readFileSync(abs);
    const beforeSha1 = sha1(before);
    if (expectSha[rel] && expectSha[rel] !== beforeSha1) {
      throw httpError(409, `${rel} changed on disk since it was read / File đã thay đổi`, 'STALE');
    }
    const { buffer } = spliceFile(before, edits);
    plan.push({
      rel,
      abs,
      before,
      after: buffer,
      beforeSha1,
      afterSha1: sha1(buffer),
      edits,
      changed: !before.equals(buffer),
    });
  }
  return plan;
}

/** Render a plan as diffs, for the confirmation step. */
export function describePlan(plan) {
  return plan.map((f) => ({
    file: f.rel,
    beforeSha1: f.beforeSha1,
    changed: f.changed,
    backupWillBe: toRel(backupPathFor(f.rel)),
    unified: unifiedDiff(f.before.toString('utf8'), f.after.toString('utf8'), { label: f.rel }),
  }));
}

/** Back up and write every file in the plan. Backups come first, always. */
export function commitPlan(plan) {
  const when = new Date();
  const written = [];
  for (const f of plan) {
    if (!f.changed) continue;
    const backupAbs = backupPathFor(f.rel, when);
    fs.mkdirSync(path.dirname(backupAbs), { recursive: true });
    fs.writeFileSync(backupAbs, f.before);
    writeAtomic(f.abs, f.after);
    written.push({
      file: f.rel,
      backup: toRel(backupAbs),
      beforeSha1: f.beforeSha1,
      afterSha1: f.afterSha1,
      edits: f.edits.length,
    });
  }
  return written;
}

export { sha1 };
