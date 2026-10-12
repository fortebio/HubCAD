import { useMemo, useState } from 'react';
import {
  IconSearch,
  IconX,
  IconChevronRight,
  IconChevronDown,
  IconAlertTriangle,
  IconLock,
  IconAlertHexagon,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { cx } from '@/lib/cx';

const ROLE_HINT = {
  literal: { label: 'number', cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  derived: { label: 'derived', cls: 'text-sky-700 bg-sky-50 border-sky-200' },
  opaque: { label: 'object', cls: 'text-gray-600 bg-gray-50 border-gray-200' },
};

function fmt(value) {
  if (value == null) return '—';
  if (Array.isArray(value)) return `(${value.map(fmt).join(', ')})`;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  return String(value);
}

/** `BATT` element 2 reads as `BATT[2]`, a scalar just as its name. */
function displayName(p) {
  return p.index == null ? p.name : `${p.name}[${p.index}]`;
}

/**
 * Parameters of a model script, grouped by the file that declares them.
 *
 * Read-only for now: the point of this stage is to show what *would* be
 * editable, and in particular which names are declared in more than one file —
 * editing one of those without the other is the quiet failure this page exists
 * to prevent.
 */
export function ParamTable({
  data,
  entryFile,
  onJump,
  canEdit = false,
  pending = {},
  onEdit,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState({});
  const [showDerived, setShowDerived] = useState(true);

  const groups = useMemo(() => {
    if (!data?.params) return [];
    const q = query.trim().toLowerCase();
    const byFile = new Map();
    for (const p of data.params) {
      if (!showDerived && p.role !== 'literal') continue;
      if (q && !displayName(p).toLowerCase().includes(q) && !(p.comment || '').toLowerCase().includes(q)) {
        continue;
      }
      if (!byFile.has(p.file)) byFile.set(p.file, []);
      byFile.get(p.file).push(p);
    }
    // The entry script first, then its imports in graph order.
    const order = (data.graph || []).map((g) => g.rel);
    return [...byFile.entries()]
      .map(([file, rows]) => ({ file, rows }))
      .sort((a, b) => {
        if (a.file === entryFile) return -1;
        if (b.file === entryFile) return 1;
        return order.indexOf(a.file) - order.indexOf(b.file);
      });
  }, [data, query, showDerived, entryFile]);

  const stats = useMemo(() => {
    const all = data?.params || [];
    return {
      total: all.length,
      editable: all.filter((p) => p.editable).length,
      shadowed: new Set(all.filter((p) => p.shadowedIn?.length).map((p) => p.name)).size,
    };
  }, [data]);

  if (!data) return null;

  return (
    <div className={cx('flex flex-col min-h-0', className)}>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 shrink-0">
        <span className="text-[11px] text-gray-600">
          <strong className="font-mono">{stats.editable}</strong> số sửa được ·{' '}
          <strong className="font-mono">{stats.total}</strong> tham số
          {stats.shadowed > 0 && (
            <>
              {' · '}
              <span className="text-amber-700">{stats.shadowed} trùng tên</span>
            </>
          )}
        </span>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-gray-600 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={showDerived}
            onChange={(e) => setShowDerived(e.target.checked)}
            className="w-3 h-3"
          />
          Derived
        </label>
        <div className="relative w-36 shrink-0">
          <IconSearch
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter / Lọc"
            aria-label="Filter parameters / Lọc tham số"
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="text-[12px] text-gray-500 py-6 text-center">
            No parameter matches / Không có tham số nào khớp
          </p>
        ) : (
          groups.map(({ file, rows }) => {
            const isClosed = !!closed[file];
            const isEntry = file === entryFile;
            return (
              <div key={file}>
                <button
                  type="button"
                  onClick={() => setClosed((c) => ({ ...c, [file]: !isClosed }))}
                  aria-expanded={!isClosed}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 sticky top-0 bg-white border-b border-gray-100 z-10"
                >
                  {isClosed ? (
                    <IconChevronRight size={12} aria-hidden="true" />
                  ) : (
                    <IconChevronDown size={12} aria-hidden="true" />
                  )}
                  <span className="truncate font-mono normal-case">{file.split('/').pop()}</span>
                  {isEntry && (
                    <span className="px-1 rounded bg-primary-100 text-primary-700 text-[10px] uppercase tracking-wide">
                      entry
                    </span>
                  )}
                  <span className="ml-auto font-mono text-gray-500">{rows.length}</span>
                </button>
                {!isClosed && (
                  <ul>
                    {rows.map((p) => (
                      <ParamRow
                        key={p.id + (p.index ?? '')}
                        p={p}
                        onJump={onJump}
                        canEdit={canEdit && p.editable}
                        draft={pending[p.id]}
                        onEdit={onEdit}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ParamRow({ p, onJump, canEdit = false, draft, onEdit }) {
  const role = ROLE_HINT[p.role] || ROLE_HINT.opaque;
  const shadow = p.shadowedIn?.length ? p.shadowedIn : null;
  // A shadow whose value differs is a live inconsistency, not just a duplicate.
  const divergent = shadow?.some((s) => s.value !== p.value);

  return (
    <li
      className="px-2 py-1 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onJump?.(p)}
      title={`${p.file}:${p.lineno}`}
    >
      <div className="w-full text-left">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-gray-800 truncate min-w-0 flex-1">
            {displayName(p)}
          </span>
          {shadow && (
            <span
              className={cx(
                'inline-flex items-center gap-0.5 px-1 rounded text-[10px] border shrink-0',
                divergent
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              )}
              title={
                (divergent
                  ? 'Declared in several files with DIFFERENT values / Khai báo nhiều nơi, giá trị khác nhau: '
                  : 'Declared in several files, same value / Khai báo nhiều nơi, cùng giá trị: ') +
                shadow.map((s) => `${s.file.split('/').pop()} = ${fmt(s.value)}`).join(', ')
              }
            >
              {divergent ? (
                <IconAlertHexagon size={10} aria-hidden="true" />
              ) : (
                <IconAlertTriangle size={10} aria-hidden="true" />
              )}
              {shadow.length + 1}×{divergent ? ' ≠' : ''}
            </span>
          )}
          {!p.editable && (
            <span
              className={cx('inline-flex items-center gap-0.5 px-1 rounded text-[10px] border shrink-0', role.cls)}
            >
              <IconLock size={9} aria-hidden="true" />
              {role.label}
            </span>
          )}
          {canEdit ? (
            <span className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                value={draft ?? p.literal}
                onChange={(e) => onEdit?.(p, e.target.value)}
                inputMode="decimal"
                aria-label={`${displayName(p)} value`}
                className={cx(
                  'w-20 h-6 px-1 text-[12px] font-mono text-right rounded border focus:outline-none',
                  draft != null && draft !== p.literal
                    ? 'border-primary-400 bg-primary-50 text-primary-800'
                    : 'border-gray-200 text-orange-700 focus:border-primary-400'
                )}
              />
              {draft != null && draft !== p.literal && (
                <button
                  type="button"
                  onClick={() => onEdit?.(p, p.literal)}
                  className="icon-btn !min-w-[20px] !min-h-[20px] text-gray-500"
                  aria-label="Revert / Hoàn tác"
                >
                  <IconArrowBackUp size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          ) : (
            <span className="font-mono text-[12px] text-right shrink-0 w-24 truncate">
              {p.literal != null ? (
                <span className="text-orange-700">{p.literal}</span>
              ) : (
                <span className="text-sky-700">{fmt(p.value)}</span>
              )}
            </span>
          )}
        </div>
        {(p.comment || p.expr) && (
          <div className="text-[10px] text-gray-500 truncate pr-1">
            {p.expr && <span className="font-mono text-sky-700 mr-1">= {p.expr}</span>}
            {p.comment}
          </div>
        )}
      </div>
    </li>
  );
}
