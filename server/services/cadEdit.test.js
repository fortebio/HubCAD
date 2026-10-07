/**
 * Tests for the two functions that can destroy an engineer's source file:
 * the path guard and the byte splicer.
 *
 * Run: node --test server/services/
 *
 * CAD_ROOT has to exist before the modules are imported, because both read it
 * at module scope — hence the temp root built here and the dynamic import.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hubcad-cadroot-'));
const OUTSIDE = fs.mkdtempSync(path.join(os.tmpdir(), 'hubcad-outside-'));
fs.writeFileSync(path.join(OUTSIDE, 'secret.txt'), 'should never be reachable');
fs.mkdirSync(path.join(ROOT, 'proj'), { recursive: true });

process.env.CAD_ROOT = ROOT;

const { resolveInRoot } = await import('./cadRoot.js');
const { spliceFile, unifiedDiff, styleLiteral, validateLiteral, planEdits, NUMBER_RE } =
  await import('./cadEdit.js');

/** An edit descriptor as the API builds one from the Python AST output. */
const edit = (lineno, colByte, endColByte, expect, literal) => ({
  lineno,
  colByte,
  endColByte,
  expect,
  literal,
});

// --------------------------------------------------------------- path guard
test('resolveInRoot accepts a plain relative path', () => {
  const abs = resolveInRoot('proj');
  assert.equal(path.basename(abs), 'proj');
});

test('resolveInRoot rejects traversal, absolute paths and drive letters', () => {
  for (const bad of [
    '../../../Windows/System32',
    '..',
    'proj/../../escape',
    '/etc/passwd',
    'C:/Windows',
    '\\\\server\\share',
  ]) {
    assert.throws(() => resolveInRoot(bad), /escapes CAD_ROOT|Absolute path/, `allowed: ${bad}`);
  }
});

test('resolveInRoot rejects backslash traversal and NUL bytes', () => {
  assert.throws(() => resolveInRoot('..\\..\\.env'), /escapes CAD_ROOT/);
  assert.throws(() => resolveInRoot('proj\u0000.py'), /Bad path/);
});

test('resolveInRoot follows a junction out of the root and refuses it', (t) => {
  const link = path.join(ROOT, 'escape-link');
  try {
    fs.symlinkSync(OUTSIDE, link, 'junction');
  } catch {
    return t.skip('cannot create a junction here');
  }
  assert.throws(() => resolveInRoot('escape-link/secret.txt'), /escapes CAD_ROOT/);
});

// ----------------------------------------------------------------- splicing
test('splices a negative literal without doubling the sign', () => {
  // Z_BACK = -16.0  -> the AST range covers the UnaryOp, sign included
  const buf = Buffer.from('Z_BACK = -16.0  # back outer face\n', 'utf8');
  const { buffer } = spliceFile(buf, [edit(1, 9, 14, '-16.0', '-18.0')]);
  assert.equal(buffer.toString('utf8'), 'Z_BACK = -18.0  # back outer face\n');
});

test('keeps the trailing comment and every other byte', () => {
  const src = 'A = 1.0\nWALL_S, WALL_B = 3.0, 1.5   # side / end walls\nB = 2.0\n';
  const buf = Buffer.from(src, 'utf8');
  const { buffer } = spliceFile(buf, [edit(2, 17, 20, '3.0', '4.0')]);
  const out = buffer.toString('utf8');
  assert.equal(out, 'A = 1.0\nWALL_S, WALL_B = 4.0, 1.5   # side / end walls\nB = 2.0\n');
  assert.ok(out.includes('# side / end walls'));
});

test('addresses one tuple element and leaves its siblings byte-identical', () => {
  const src = 'BATT = (-40.0, 20.0, -25.0, 25.0, 3.8)     # x0 x1 y0 y1 thickness\n';
  const buf = Buffer.from(src, 'utf8');
  // the 5th element, 3.8, at bytes 34..37
  const { buffer } = spliceFile(buf, [edit(1, 34, 37, '3.8', '4.2')]);
  const out = buffer.toString('utf8');
  assert.equal(out, 'BATT = (-40.0, 20.0, -25.0, 25.0, 4.2)     # x0 x1 y0 y1 thickness\n');
  assert.ok(out.includes('(-40.0, 20.0, -25.0, 25.0,'));
});

test('byte offsets stay correct when the line holds non-ASCII before the number', () => {
  // "±30 %" and "°" sit before the literal, so a character index would be short.
  const line = 'BEAD = 1.0  # 4 gờ 45° ở ±30 % chiều dài\nNEXT = 9.0\n';
  const buf = Buffer.from(line, 'utf8');
  const col = Buffer.from('BEAD = ', 'utf8').length;
  const { buffer } = spliceFile(buf, [edit(1, col, col + 3, '1.0', '1.4')]);
  const out = buffer.toString('utf8');
  assert.ok(out.startsWith('BEAD = 1.4  '));
  assert.ok(out.includes('4 gờ 45° ở ±30 %'), 'the Vietnamese comment survived');
  assert.ok(out.endsWith('NEXT = 9.0\n'));
});

test('a CRLF file keeps its line endings', () => {
  const buf = Buffer.from('A = 1.0\r\nZ_BACK = -16.0\r\nB = 2.0\r\n', 'utf8');
  const { buffer } = spliceFile(buf, [edit(2, 9, 14, '-16.0', '-18.0')]);
  const out = buffer.toString('utf8');
  assert.equal(out, 'A = 1.0\r\nZ_BACK = -18.0\r\nB = 2.0\r\n');
  assert.equal((out.match(/\r\n/g) || []).length, 3);
});

test('refuses to write when the literal under the range is not what was read', () => {
  const buf = Buffer.from('Z_BACK = -16.0\n', 'utf8');
  assert.throws(
    () => spliceFile(buf, [edit(1, 9, 14, '-99.0', '-18.0')]),
    (e) => e.code === 'STALE'
  );
});

test('applies several edits on one line, descending, without shifting offsets', () => {
  const src = 'XT, XB, YS = -59.7, 63.7, 36.4\n';
  const buf = Buffer.from(src, 'utf8');
  const { buffer } = spliceFile(buf, [
    edit(1, 13, 18, '-59.7', '-61.0'), // XT, longer by one byte
    edit(1, 20, 24, '63.7', '65.0'),
    edit(1, 26, 30, '36.4', '38.0'),
  ]);
  assert.equal(buffer.toString('utf8'), 'XT, XB, YS = -61.0, 65.0, 38.0\n');
});

test('rejects overlapping edits instead of corrupting the line', () => {
  const buf = Buffer.from('A = 12.345\n', 'utf8');
  assert.throws(
    () => spliceFile(buf, [edit(1, 4, 10, '12.345', '1.0'), edit(1, 7, 10, '345', '9')]),
    (e) => e.code === 'OVERLAP'
  );
});

test('rejects a line number past the end of the file', () => {
  const buf = Buffer.from('A = 1.0\n', 'utf8');
  assert.throws(
    () => spliceFile(buf, [edit(99, 4, 7, '1.0', '2.0')]),
    (e) => e.code === 'STALE'
  );
});

// --------------------------------------------------------------- validation
test('only plain numbers pass validation', () => {
  for (const ok of ['1', '-1', '+1', '1.5', '-16.0', '.5', '1e-3', '2.5E+4']) {
    assert.equal(validateLiteral(ok), ok, `rejected: ${ok}`);
  }
  for (const bad of [
    '__import__("os").system("calc")',
    '1; import os',
    '0x1f',
    'True',
    '1_000',
    '',
    '1.2.3',
  ]) {
    assert.throws(() => validateLiteral(bad), (e) => e.code === 'NOT_NUMERIC', `allowed: ${bad}`);
  }
});

test('NUMBER_RE is anchored so it cannot match a suffix', () => {
  assert.equal(NUMBER_RE.test('1\nimport os'), false);
});

test('style is carried over from the literal being replaced', () => {
  assert.equal(styleLiteral('-16.0', '-18'), '-18.0');
  assert.equal(styleLiteral('3', '4'), '4');
  assert.equal(styleLiteral('1e-3', '2'), '2');
  assert.equal(styleLiteral('-16.0', '-18.5'), '-18.5');
});

// --------------------------------------------------------------- transaction
test('planEdits refuses the whole batch when one file moved underneath it', () => {
  const rel = 'proj/p.py';
  const abs = path.join(ROOT, rel);
  fs.writeFileSync(abs, 'A = 1.0\n');
  assert.throws(
    () => planEdits({ [rel]: [edit(1, 4, 7, '1.0', '2.0')] }, { [rel]: 'not-the-real-hash' }),
    (e) => e.code === 'STALE'
  );
  assert.equal(fs.readFileSync(abs, 'utf8'), 'A = 1.0\n', 'the file was not touched');
});

test('planEdits leaves the disk alone — it only plans', () => {
  const rel = 'proj/q.py';
  const abs = path.join(ROOT, rel);
  fs.writeFileSync(abs, 'A = 1.0\n');
  const plan = planEdits({ [rel]: [edit(1, 4, 7, '1.0', '2.0')] });
  assert.equal(plan[0].changed, true);
  assert.equal(plan[0].after.toString('utf8'), 'A = 2.0\n');
  assert.equal(fs.readFileSync(abs, 'utf8'), 'A = 1.0\n', 'still the original on disk');
});

// --------------------------------------------------------------------- diff
test('the unified diff shows one changed line with context', () => {
  const before = 'a\nb\nZ_BACK = -16.0\nd\ne\n';
  const after = 'a\nb\nZ_BACK = -18.0\nd\ne\n';
  const d = unifiedDiff(before, after, { label: 'x.py' });
  assert.ok(d.includes('-Z_BACK = -16.0'));
  assert.ok(d.includes('+Z_BACK = -18.0'));
  assert.equal((d.match(/^-(?!--)/gm) || []).length, 1);
  assert.equal((d.match(/^\+(?!\+\+)/gm) || []).length, 1);
});

test('an unchanged file produces an empty diff', () => {
  assert.equal(unifiedDiff('a\nb\n', 'a\nb\n'), '');
});

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.rmSync(OUTSIDE, { recursive: true, force: true });
});
