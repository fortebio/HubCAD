// Decompress PDF content streams and find all Tf (set font) operators.
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inspect-pdf.mjs <pdf>');
  process.exit(1);
}

const buf = fs.readFileSync(file);

// Find each "X 0 obj << ... >> stream\n...endstream"
const text = buf.toString('binary');

// Build map of font names: search for "/F1 ... 0 R" pattern and resolve obj
const fontMap = {};
for (const m of text.matchAll(/\/F(\d+)\s+(\d+)\s+0\s+R/g)) {
  fontMap['F' + m[1]] = { obj: m[2] };
}
// Map obj -> BaseFont
for (const m of text.matchAll(/(\d+)\s+0\s+obj\s*<<[^>]*?\/BaseFont\s*\/([^\s/>]+)/g)) {
  const obj = m[1];
  const name = m[2];
  for (const k of Object.keys(fontMap)) {
    if (fontMap[k].obj === obj) fontMap[k].name = name;
  }
}

console.log('Font map:');
for (const [k, v] of Object.entries(fontMap)) {
  console.log(`  /${k} -> obj ${v.obj} -> ${v.name || '(unknown)'}`);
}

// Find all object streams and decompress
const objs = [...text.matchAll(/(\d+)\s+0\s+obj\s*<<([^>]*?)>>\s*stream\r?\n/g)];
const usage = {};
for (const m of objs) {
  const headerEnd = m.index + m[0].length;
  const endStreamIdx = text.indexOf('endstream', headerEnd);
  if (endStreamIdx < 0) continue;
  const compressed = buf.subarray(headerEnd, endStreamIdx);
  const header = m[2];
  let decoded;
  try {
    if (/FlateDecode/.test(header)) {
      decoded = zlib.inflateSync(compressed).toString('binary');
    } else {
      decoded = compressed.toString('binary');
    }
  } catch (e) {
    continue;
  }
  // Skip embedded font streams — they have /Length1 entries
  if (/\/Length1\s/.test(header)) continue;
  // Find Tf operators
  for (const t of decoded.matchAll(/\/(F\d+)\s+[\d.]+\s+Tf/g)) {
    usage[t[1]] = (usage[t[1]] || 0) + 1;
  }
}

console.log('\nActual Tf usage in content streams:');
for (const [f, n] of Object.entries(usage).sort((a, b) => b[1] - a[1])) {
  const fontName = fontMap[f]?.name || '?';
  console.log(`  /${f} (${fontName}): ${n} times`);
}

// Show context for the suspect font (Helvetica typically /F1)
const suspect = process.argv[3] || 'F1';
console.log(`\nContext around /${suspect} Tf operators:`);
for (const m of objs) {
  const headerEnd = m.index + m[0].length;
  const endStreamIdx = text.indexOf('endstream', headerEnd);
  if (endStreamIdx < 0) continue;
  const compressed = buf.subarray(headerEnd, endStreamIdx);
  const header = m[2];
  if (/\/Length1\s/.test(header)) continue;
  let decoded;
  try {
    decoded = /FlateDecode/.test(header)
      ? zlib.inflateSync(compressed).toString('binary')
      : compressed.toString('binary');
  } catch {
    continue;
  }
  const re = new RegExp(`/${suspect}\\s+[\\d.]+\\s+Tf[\\s\\S]{0,80}?TJ`, 'g');
  for (const t of decoded.matchAll(re)) {
    const m2 = /<([0-9a-fA-F\s]+)>/.exec(t[0]);
    if (m2) {
      const hex = m2[1].replace(/\s/g, '');
      // group by 2 hex chars
      const pairs = hex.match(/.{1,2}/g) || [];
      console.log(`  glyph codes (hex): ${pairs.join(' ')}`);
    }
  }
}
