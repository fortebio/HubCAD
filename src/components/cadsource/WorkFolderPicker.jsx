import { useEffect, useState } from 'react';
import {
  IconFolderOpen,
  IconFolder,
  IconChevronRight,
  IconCornerLeftUp,
  IconCheck,
  IconX,
  IconHome,
} from '@tabler/icons-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api, apiPaths } from '@/lib/api';
import { toast } from '@/stores/useToastStore';
import { cx } from '@/lib/cx';

/**
 * Point the page at the one folder being worked on.
 *
 * Without this the tree always opens at CAD_ROOT, which here holds five product
 * lines and a 286 MB archive — everything except the job in hand. The operator
 * can paste a Windows path straight out of Explorer or click down to a folder;
 * CAD_ROOT stays the fence and anything outside it is refused by name.
 *
 * The choice is remembered per browser, not on the server: which job someone is
 * on is their business, and it should not change for everyone else.
 */
export function WorkFolderPicker({ open, onClose, current, cadRoot, onPick }) {
  const [typed, setTyped] = useState('');
  const [at, setAt] = useState(current || '');
  const [entries, setEntries] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setAt(current || '');
  }, [open, current]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setEntries(null);
    api
      .get(apiPaths.cadTree(at))
      .then((d) => !cancelled && setEntries(d.entries.filter((e) => e.kind === 'dir')))
      .catch((e) => {
        if (!cancelled) {
          setEntries([]);
          toast.error('Could not list that folder', e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, at]);

  async function usePath(value) {
    setBusy(true);
    try {
      const res = await api.post(apiPaths.cadResolveFolder, { path: value });
      onPick(res);
      onClose();
    } catch (e) {
      toast.error('That folder cannot be used', e.message);
    } finally {
      setBusy(false);
    }
  }

  const crumbs = at ? at.split('/') : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose the folder to work on / Chọn thư mục cần xử lý"
      subtitle={`Trong phạm vi ${cadRoot}`}
      maxWidth="620px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel / Hủy
          </Button>
          <Button size="sm" onClick={() => usePath(at)} loading={busy} disabled={busy}>
            <IconCheck size={14} />
            Use this folder / Dùng thư mục này
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label
            htmlFor="cad-folder-path"
            className="block text-[11px] font-medium text-gray-700 mb-1"
          >
            Paste a path from Explorer / Dán đường dẫn từ Explorer
          </label>
          <div className="flex gap-2">
            <input
              id="cad-folder-path"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && typed.trim()) usePath(typed);
              }}
              placeholder={`${cadRoot}\\02. LCD\\F_Pebble`}
              className="flex-1 h-8 px-2 text-[12px] font-mono rounded-lg border border-gray-300 bg-white focus:border-primary-500 focus:outline-none"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => usePath(typed)}
              disabled={busy || !typed.trim()}
            >
              Go
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-2">
          <div className="flex items-center gap-1 text-[11px] text-gray-600 mb-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setAt('')}
              className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-gray-100"
            >
              <IconHome size={12} aria-hidden="true" />
              root
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <IconChevronRight size={11} className="text-gray-400" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setAt(crumbs.slice(0, i + 1).join('/'))}
                  className="px-1 py-0.5 rounded hover:bg-gray-100 font-mono"
                >
                  {c}
                </button>
              </span>
            ))}
          </div>

          <ul className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {at && (
              <li>
                <button
                  type="button"
                  onClick={() => setAt(crumbs.slice(0, -1).join('/'))}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-gray-600 hover:bg-gray-50"
                >
                  <IconCornerLeftUp size={13} aria-hidden="true" />
                  ..
                </button>
              </li>
            )}
            {entries === null ? (
              <li className="px-2 py-3 text-[12px] text-gray-500 text-center">Loading…</li>
            ) : entries.length === 0 ? (
              <li className="px-2 py-3 text-[12px] text-gray-500 text-center">
                No sub-folder here / Không có thư mục con
              </li>
            ) : (
              entries.map((e) => (
                <li key={e.rel}>
                  <button
                    type="button"
                    onClick={() => setAt(e.rel)}
                    className={cx(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-left hover:bg-gray-50',
                      e.rel === at && 'bg-primary-50'
                    )}
                  >
                    <IconFolder size={13} className="text-gray-500 shrink-0" aria-hidden="true" />
                    <span className="truncate">{e.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

/** The strip above the tree: where we are, and a way to change it. */
export function WorkFolderBar({ folder, cadRoot, onChange, onClear }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-2 mb-1 border-b border-gray-100">
      <IconFolderOpen size={14} className="text-primary-600 shrink-0" aria-hidden="true" />
      <button
        type="button"
        onClick={onChange}
        className="flex-1 min-w-0 text-left text-[11px] font-mono text-gray-700 hover:text-primary-700 truncate py-1 min-h-[24px]"
        title={folder ? `${cadRoot}/${folder}` : cadRoot}
      >
        {folder || cadRoot}
      </button>
      {folder && (
        <button
          type="button"
          onClick={onClear}
          className="icon-btn !min-w-[22px] !min-h-[22px] text-gray-500"
          aria-label="Back to the whole root / Về thư mục gốc"
          title="Back to the whole root / Về thư mục gốc"
        >
          <IconX size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
