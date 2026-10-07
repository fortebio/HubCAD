import { useCallback, useEffect, useState } from 'react';
import {
  IconChevronRight,
  IconChevronDown,
  IconFolder,
  IconFileCode,
  IconCube,
  IconFileText,
  IconFile,
  IconPlayerPlay,
  IconAlertTriangle,
  IconLoader2,
} from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { api, apiPaths } from '@/lib/api';
import { toast } from '@/stores/useToastStore';

const ICONS = {
  dir: IconFolder,
  script: IconFileCode,
  model: IconCube,
  mesh: IconCube,
  doc: IconFileText,
  other: IconFile,
};

function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * Lazy, one-level-at-a-time tree over CAD_ROOT.
 *
 * Nothing is fetched until a folder is opened: the root holds a virtualenv and
 * a 286 MB archive, so a recursive walk would be both slow and pointless.
 */
export function CadSourceTree({ selected, onSelect, root = '', className = '' }) {
  const [children, setChildren] = useState({}); // rel -> entries[]
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState({});

  const load = useCallback(
    async (rel) => {
      if (children[rel]) return;
      setLoading((l) => ({ ...l, [rel]: true }));
      try {
        const data = await api.get(apiPaths.cadTree(rel));
        setChildren((c) => ({ ...c, [rel]: data.entries }));
      } catch (e) {
        toast.error(`Could not list ${rel || 'root'}`, e.message);
      } finally {
        setLoading((l) => ({ ...l, [rel]: false }));
      }
    },
    [children]
  );

  // Re-reads when the operator points the page at a different folder.
  useEffect(() => {
    load(root);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over its own cache
  }, [root]);

  function toggle(rel) {
    const next = !open[rel];
    setOpen((o) => ({ ...o, [rel]: next }));
    if (next) load(rel);
  }

  function renderLevel(rel, depth) {
    const entries = children[rel];
    if (loading[rel] && !entries) {
      return (
        <div
          className="flex items-center gap-1.5 text-[11px] text-gray-500 py-1"
          style={{ paddingLeft: depth * 12 + 8 }}
        >
          <IconLoader2 size={12} className="animate-spin" aria-hidden="true" />
          Loading…
        </div>
      );
    }
    if (!entries) return null;
    if (!entries.length) {
      return (
        <div className="text-[11px] text-gray-500 py-1" style={{ paddingLeft: depth * 12 + 8 }}>
          Empty / Trống
        </div>
      );
    }

    return entries.map((e) => {
      const Icon = ICONS[e.kind] || IconFile;
      const isDir = e.kind === 'dir';
      const isOpen = !!open[e.rel];
      const active = selected === e.rel;
      const pickable = e.kind === 'script' || e.kind === 'model' || e.kind === 'mesh' || e.kind === 'doc';

      return (
        <div key={e.rel}>
          <button
            type="button"
            onClick={() => (isDir ? toggle(e.rel) : pickable && onSelect(e))}
            disabled={!isDir && !pickable}
            aria-expanded={isDir ? isOpen : undefined}
            aria-current={active ? 'true' : undefined}
            className={cx(
              'w-full flex items-center gap-1.5 py-1 pr-2 rounded-md text-left transition-colors',
              active ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50',
              !isDir && !pickable && 'opacity-50 cursor-default'
            )}
            style={{ paddingLeft: depth * 12 + 4 }}
          >
            {isDir ? (
              isOpen ? (
                <IconChevronDown size={12} className="shrink-0 text-gray-500" aria-hidden="true" />
              ) : (
                <IconChevronRight size={12} className="shrink-0 text-gray-500" aria-hidden="true" />
              )
            ) : (
              <span className="w-3 shrink-0" aria-hidden="true" />
            )}
            <Icon
              size={14}
              className={cx(
                'shrink-0',
                e.kind === 'script' && 'text-purple-600',
                e.kind === 'model' && 'text-primary-600',
                e.kind === 'mesh' && 'text-sky-600',
                (isDir || e.kind === 'doc' || e.kind === 'other') && 'text-gray-500'
              )}
              aria-hidden="true"
            />
            <span className="text-[12px] truncate min-w-0 flex-1" title={e.name}>
              {e.name}
            </span>
            {e.isModelScript && (
              <IconPlayerPlay
                size={11}
                className="shrink-0 text-emerald-600"
                aria-label="Buildable script / Script dựng được"
              />
            )}
            {e.syncConflict && (
              <IconAlertTriangle
                size={11}
                className="shrink-0 text-amber-500"
                aria-label="Drive sync conflict copy / Bản sao xung đột Drive"
              />
            )}
            {!isDir && (
              <span className="text-[10px] font-mono text-gray-400 shrink-0">{fmtSize(e.size)}</span>
            )}
          </button>
          {isDir && isOpen && renderLevel(e.rel, depth + 1)}
        </div>
      );
    });
  }

  return <div className={cx('overflow-y-auto', className)}>{renderLevel(root, 0)}</div>;
}
