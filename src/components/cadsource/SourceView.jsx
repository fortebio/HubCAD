import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch, IconX, IconArrowDown } from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { highlightPython, TOKEN_CLASS } from '@/lib/pyHighlight';

/**
 * Read-only source pane with line numbers and jump-to-line.
 *
 * `jumpTo` is a `{ line, nonce }` pair rather than a bare number so asking for
 * the same line twice still scrolls and re-flashes it.
 */
export function SourceView({ text = '', fileName = '', jumpTo = null, className = '' }) {
  const [query, setQuery] = useState('');
  const [flash, setFlash] = useState(null);
  const scrollRef = useRef(null);
  const lineRefs = useRef(new Map());

  const lines = useMemo(() => highlightPython(text), [text]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits = [];
    lines.forEach((runs, i) => {
      if (runs.map((r) => r.text).join('').toLowerCase().includes(q)) hits.push(i + 1);
    });
    return hits;
  }, [lines, query]);

  useEffect(() => {
    if (!jumpTo?.line) return undefined;
    const el = lineRefs.current.get(jumpTo.line);
    if (!el) return undefined;
    // Instant, not smooth: a smooth scroll over thousands of pixels is
    // cancelled by the re-render that paints the highlight, and landing on the
    // line matters more than animating to it.
    el.scrollIntoView({ block: 'center' });
    setFlash(jumpTo.line);
    const timer = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(timer);
  }, [jumpTo]);

  function gotoMatch(line) {
    const el = lineRefs.current.get(line);
    if (el) el.scrollIntoView({ block: 'center' });
    setFlash(line);
    setTimeout(() => setFlash(null), 1600);
  }

  if (!text) {
    return (
      <div className={cx('flex items-center justify-center text-[12px] text-gray-500', className)}>
        Select a file to read / Chọn một file để xem
      </div>
    );
  }

  const gutterWidth = `${String(lines.length).length + 1}ch`;

  return (
    <div className={cx('flex flex-col min-h-0', className)}>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 shrink-0">
        <span className="text-[11px] font-mono text-gray-600 truncate" title={fileName}>
          {fileName}
        </span>
        <span className="text-[11px] text-gray-500 shrink-0">{lines.length} dòng</span>
        <div className="relative ml-auto w-44 shrink-0">
          <IconSearch
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find / Tìm"
            aria-label="Find in file / Tìm trong file"
            className="w-full h-7 pl-7 pr-6 text-[11px] rounded-md border border-gray-300 bg-white focus:border-primary-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn !min-w-[20px] !min-h-[20px]"
              aria-label="Clear / Xóa"
            >
              <IconX size={11} aria-hidden="true" />
            </button>
          )}
        </div>
        {matches && (
          <span className="text-[11px] text-gray-600 shrink-0 flex items-center gap-1">
            {matches.length} hit
            {matches.length > 0 && (
              <button
                type="button"
                onClick={() => gotoMatch(matches[0])}
                className="icon-btn !min-w-[20px] !min-h-[20px]"
                aria-label="Go to first match / Tới kết quả đầu"
              >
                <IconArrowDown size={11} aria-hidden="true" />
              </button>
            )}
          </span>
        )}
      </div>

      {/* min-h-0: a flex child defaults to min-height:auto, which makes it grow
          to the content instead of scrolling inside the fixed-height card. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-gray-50">
        <pre className="text-[11.5px] leading-[1.55] font-mono m-0 p-0">
          <code className="block">
            {lines.map((runs, i) => {
              const no = i + 1;
              const isHit = matches?.includes(no);
              return (
                <div
                  key={no}
                  ref={(el) => {
                    if (el) lineRefs.current.set(no, el);
                    else lineRefs.current.delete(no);
                  }}
                  className={cx(
                    'flex transition-colors',
                    flash === no && 'bg-amber-100',
                    flash !== no && isHit && 'bg-yellow-50'
                  )}
                >
                  <span
                    className="select-none text-right pr-3 pl-2 text-gray-400 shrink-0 sticky left-0 bg-gray-50"
                    style={{ width: gutterWidth }}
                    aria-hidden="true"
                  >
                    {no}
                  </span>
                  <span className="whitespace-pre pr-4">
                    {runs.length === 0 ? (
                      ' '
                    ) : (
                      runs.map((r, k) => (
                        <span key={k} className={r.kind ? TOKEN_CLASS[r.kind] : undefined}>
                          {r.text}
                        </span>
                      ))
                    )}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
