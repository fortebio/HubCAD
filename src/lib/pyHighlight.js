/**
 * Minimal Python tokenizer for read-only source display.
 *
 * Single pass over the whole file, never line by line: a CadQuery model script
 * opens with a long triple-quoted docstring full of `#`, `*`, `->` and `:`, and
 * a per-line regex highlighter colours its insides as code. The scan therefore
 * carries string state across newlines and splits multi-line tokens afterwards.
 *
 * Returns one array of `{ text, kind }` runs per line, ready to render as spans.
 * `kind` is null for ordinary text.
 */

const KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
  'with', 'yield',
]);

const CONSTANTS = new Set(['True', 'False', 'None', 'self', 'cls']);

const ID_START = /[A-Za-z_]/;
const ID_CHAR = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const STRING_PREFIX = /^(?:[rRbBuUfF]{0,2})$/;

/** Scan `src` into absolute-offset tokens. */
function tokenize(src) {
  const out = [];
  const n = src.length;
  let i = 0;

  const push = (start, end, kind) => {
    if (end > start) out.push({ start, end, kind });
  };

  while (i < n) {
    const c = src[i];

    // comment to end of line
    if (c === '#') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      // stop before the CR of a CRLF file, which is not part of the comment
      push(i, src[j - 1] === '\r' ? j - 1 : j, 'cm');
      i = j;
      continue;
    }

    // string, optionally with an r/b/u/f prefix
    if (c === '"' || c === "'") {
      i = scanString(src, i, i, out);
      continue;
    }
    if (ID_START.test(c)) {
      let j = i;
      while (j < n && ID_CHAR.test(src[j])) j++;
      const word = src.slice(i, j);
      // a prefix immediately followed by a quote belongs to the string
      if (j < n && (src[j] === '"' || src[j] === "'") && STRING_PREFIX.test(word)) {
        i = scanString(src, i, j, out);
        continue;
      }
      if (KEYWORDS.has(word)) {
        push(i, j, 'kw');
        // the name after def/class is the definition itself
        if (word === 'def' || word === 'class') {
          let k = j;
          while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
          if (k < n && ID_START.test(src[k])) {
            let m = k;
            while (m < n && ID_CHAR.test(src[m])) m++;
            push(j, k, null);
            push(k, m, 'fn');
            i = m;
            continue;
          }
        }
      } else if (CONSTANTS.has(word)) {
        push(i, j, 'cn');
      } else {
        push(i, j, null);
      }
      i = j;
      continue;
    }

    // number: 12, 1.5, .5, 1e-3, 0x1f
    if (DIGIT.test(c) || (c === '.' && DIGIT.test(src[i + 1] || ''))) {
      let j = i;
      if (c === '0' && /[xXoObB]/.test(src[i + 1] || '')) {
        j = i + 2;
        while (j < n && /[0-9a-fA-F_]/.test(src[j])) j++;
      } else {
        while (j < n && /[0-9_]/.test(src[j])) j++;
        if (src[j] === '.') {
          j++;
          while (j < n && /[0-9_]/.test(src[j])) j++;
        }
        if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) {
          j += 2;
          while (j < n && DIGIT.test(src[j])) j++;
        }
      }
      push(i, j, 'nu');
      i = j;
      continue;
    }

    // decorator line
    if (c === '@' && (i === 0 || src[i - 1] === '\n')) {
      let j = i + 1;
      while (j < n && (ID_CHAR.test(src[j]) || src[j] === '.')) j++;
      push(i, j, 'dec');
      i = j;
      continue;
    }

    if ('+-*/%=<>!&|^~:,;()[]{}.'.includes(c)) {
      push(i, i + 1, 'op');
      i += 1;
      continue;
    }

    push(i, i + 1, null);
    i += 1;
  }
  return out;
}

/**
 * Consume one string starting at `quoteAt`, with the token beginning at
 * `tokenStart` so an r/f prefix is coloured with it. Returns the new index.
 */
function scanString(src, tokenStart, quoteAt, out) {
  const n = src.length;
  const q = src[quoteAt];
  const triple = src[quoteAt + 1] === q && src[quoteAt + 2] === q;
  const close = triple ? q + q + q : q;
  let j = quoteAt + close.length;

  while (j < n) {
    if (src[j] === '\\') {
      j += 2;
      continue;
    }
    if (src.startsWith(close, j)) {
      j += close.length;
      break;
    }
    // an unterminated single-quoted string ends at the newline, as Python says
    if (!triple && src[j] === '\n') break;
    j += 1;
  }
  out.push({ start: tokenStart, end: Math.min(j, n), kind: 'st' });
  return Math.min(j, n);
}

/**
 * Split `src` into lines of `{ text, kind }` runs. A token spanning newlines
 * (a docstring) contributes one run to each line it crosses, keeping its kind.
 */
export function highlightPython(src) {
  const text = typeof src === 'string' ? src : '';
  const tokens = tokenize(text);
  const lines = [];
  let current = [];
  let cursor = 0;

  // Adjacent runs of the same kind are merged: without this a line of code
  // becomes one span per space, which is a lot of DOM for nothing.
  const add = (text, kind) => {
    if (!text) return;
    const last = current[current.length - 1];
    if (last && last.kind === kind) last.text += text;
    else current.push({ text, kind });
  };

  const emit = (chunk, kind) => {
    if (!chunk) return;
    let rest = chunk;
    for (;;) {
      const nl = rest.indexOf('\n');
      if (nl < 0) {
        // A CR can only sit at a line end here, so it is never content.
        add(rest.replace(/\r$/, ''), kind);
        return;
      }
      // Drop the CR of a CRLF file so it does not render as a stray glyph.
      const head = rest.slice(0, nl).replace(/\r$/, '');
      add(head, kind);
      lines.push(current);
      current = [];
      rest = rest.slice(nl + 1);
    }
  };

  for (const t of tokens) {
    if (t.start > cursor) emit(text.slice(cursor, t.start), null);
    emit(text.slice(t.start, t.end), t.kind);
    cursor = t.end;
  }
  if (cursor < text.length) emit(text.slice(cursor), null);
  lines.push(current);

  // A trailing newline produces one empty line that no editor would number.
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

/** Tailwind classes per token kind, tuned for both themes. */
export const TOKEN_CLASS = {
  cm: 'text-gray-500 italic',
  st: 'text-emerald-700 dark:text-emerald-400',
  nu: 'text-orange-700 dark:text-orange-400',
  kw: 'text-purple-700 dark:text-purple-400 font-medium',
  cn: 'text-sky-700 dark:text-sky-400',
  fn: 'text-blue-700 dark:text-blue-400 font-medium',
  dec: 'text-amber-700 dark:text-amber-400',
  op: 'text-gray-500',
};
