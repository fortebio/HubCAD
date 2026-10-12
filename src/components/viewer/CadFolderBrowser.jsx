import { useMemo, useRef, useState } from 'react';
import {
  IconFolderOpen,
  IconFolder,
  IconChevronRight,
  IconChevronDown,
  IconSearch,
  IconX,
  IconCube,
  IconLock,
  IconFileText,
  IconLayersSubtract,
  IconRefresh,
} from '@tabler/icons-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/useToastStore';
import {
  groupByFolder,
  indexPickedFiles,
  pickCadFolder,
  readEntry,
  summarize,
  supportsDirectoryPicker,
} from '@/lib/cadFolder';

/**
 * Browse a CAD project folder and open its models in the viewer.
 *
 * Nothing leaves the machine: the folder is read through the browser's own
 * picker and files are parsed in the tab, exactly like a drag & drop. Native
 * parts (SLDPRT, IPT, …) are listed but cannot be opened — their formats are
 * closed binaries, so the row says to export a STEP instead.
 */
export function CadFolderBrowser({ onOpenFiles, busy = false }) {
  const [index, setIndex] = useState(null); // { root, files, handle }
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({});
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  const folders = useMemo(
    () => (index ? groupByFolder(index.files, search) : []),
    [index, search]
  );
  const counts = useMemo(() => (index ? summarize(index.files) : null), [index]);
  const shown = folders.reduce((n, f) => n + f.rows.length, 0);

  function adopt(result, label) {
    if (!result) return; // picker dismissed
    if (!result.files.length) {
      toast.warning(
        'No CAD files found in that folder',
        'Không tìm thấy file CAD nào trong thư mục đã chọn'
      );
      return;
    }
    setIndex(result);
    setSearch('');
    // One variant folder is usually the whole job — open everything at first.
    setOpen(Object.fromEntries(groupByFolder(result.files).map((f) => [f.key, true])));
    const s = summarize(result.files);
    toast.success(
      `${result.files.length} CAD files in ${result.root}`,
      `${s.viewable} file xem được · ${s.native} file gốc · ${s.doc} bản vẽ — ${label}`
    );
  }

  async function choose() {
    if (!supportsDirectoryPicker()) {
      inputRef.current?.click();
      return;
    }
    setScanning(true);
    try {
      adopt(await pickCadFolder(), 'đọc trực tiếp từ thư mục');
    } catch (e) {
      toast.error('Could not read that folder', e.message);
    } finally {
      setScanning(false);
    }
  }

  async function openRow(entry) {
    if (entry.kind !== 'viewable') return;
    try {
      onOpenFiles([await readEntry(entry)]);
    } catch (e) {
      toast.error(`Could not open ${entry.name}`, e.message);
    }
  }

  async function openFolder(folder) {
    const viewable = folder.rows.filter((r) => r.kind === 'viewable');
    if (!viewable.length) return;
    try {
      onOpenFiles(await Promise.all(viewable.map(readEntry)));
    } catch (e) {
      toast.error('Could not open that folder', e.message);
    }
  }

  return (
    <Card>
      <CardHeader
        title="CAD project folder"
        subtitle={
          index
            ? `${index.root} — ${counts.viewable} xem được · ${counts.native} file gốc`
            : 'Mở cả thư mục dự án thay vì chọn từng file'
        }
        icon={<IconFolderOpen size={18} aria-hidden="true" />}
        action={
          index && (
            <button
              type="button"
              onClick={choose}
              disabled={scanning || busy}
              className="text-[11px] px-2 py-1 rounded-md text-primary-600 hover:bg-primary-50 disabled:opacity-50"
            >
              <IconRefresh size={12} className="inline -mt-0.5 mr-1" aria-hidden="true" />
              Change / Đổi
            </button>
          )
        }
      />

      {!index ? (
        <div className="text-center py-2">
          <button
            type="button"
            onClick={choose}
            disabled={scanning}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            <IconFolder size={14} className="mr-1.5" aria-hidden="true" />
            {scanning ? 'Scanning… / Đang quét…' : 'Open folder / Mở thư mục'}
          </button>
          <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
            Files stay on your machine — nothing is uploaded.
            <br />
            File nằm nguyên trên máy bạn, không tải lên server.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <IconSearch
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files / Lọc file"
              aria-label="Filter files / Lọc file"
              className="w-full h-8 pl-8 pr-7 text-[12px] rounded-lg border border-gray-300 bg-white focus:border-primary-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn !min-w-[22px] !min-h-[22px]"
                aria-label="Clear filter / Xóa bộ lọc"
              >
                <IconX size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          {!shown ? (
            <p className="text-[12px] text-gray-600 py-3 text-center">
              No file matches / Không có file nào khớp
            </p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto -mx-1 px-1">
              {folders.map((folder) => {
                const isOpen = !!open[folder.key];
                const canOpen = folder.rows.filter((r) => r.kind === 'viewable').length;
                return (
                  <div key={folder.key} className="mb-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOpen((o) => ({ ...o, [folder.key]: !isOpen }))}
                        aria-expanded={isOpen}
                        className="flex-1 flex items-center gap-1.5 px-1 py-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 min-w-0"
                      >
                        {isOpen ? (
                          <IconChevronDown size={12} aria-hidden="true" />
                        ) : (
                          <IconChevronRight size={12} aria-hidden="true" />
                        )}
                        <span className="truncate">{folder.path.join(' › ') || index.root}</span>
                        <span className="font-mono normal-case tracking-normal text-gray-500">
                          {folder.rows.length}
                        </span>
                      </button>
                      {canOpen > 1 && (
                        <button
                          type="button"
                          onClick={() => openFolder(folder)}
                          disabled={busy}
                          className="text-[10px] px-1.5 py-0.5 rounded text-primary-600 hover:bg-primary-50 shrink-0 disabled:opacity-50"
                          title={`Open all ${canOpen} models in this folder`}
                        >
                          <IconLayersSubtract
                            size={11}
                            className="inline -mt-0.5 mr-0.5"
                            aria-hidden="true"
                          />
                          All {canOpen}
                        </button>
                      )}
                    </div>
                    {isOpen && (
                      <ul className="space-y-0.5">
                        {folder.rows.map((row) => (
                          <FileRow
                            key={`${folder.key}/${row.name}`}
                            row={row}
                            busy={busy}
                            onOpen={() => openRow(row)}
                            onOpenAlt={() => openRow(row.alt)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Fallback picker for browsers without showDirectoryPicker (Firefox, Safari). */}
      <input
        ref={inputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => {
          adopt(indexPickedFiles(e.target.files), 'đã đọc toàn bộ thư mục');
          e.target.value = '';
        }}
      />
    </Card>
  );
}

function FileRow({ row, busy, onOpen, onOpenAlt }) {
  const viewable = row.kind === 'viewable';
  const Icon = viewable ? IconCube : row.kind === 'native' ? IconLock : IconFileText;

  return (
    <li>
      <div
        className={cx(
          'flex items-center gap-1.5 rounded-lg border px-1.5 py-1',
          viewable ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-100 bg-gray-50/60'
        )}
      >
        <Icon
          size={14}
          className={cx('shrink-0', viewable ? 'text-primary-500' : 'text-gray-400')}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onOpen}
          disabled={!viewable || busy}
          className="flex-1 min-w-0 text-left disabled:cursor-default"
          title={viewable ? `Open ${row.name}` : `${row.label} — export STEP to view`}
        >
          <span
            className={cx(
              'block text-[12px] truncate',
              viewable ? 'text-gray-800' : 'text-gray-500'
            )}
          >
            {row.name}
          </span>
          <span className="block text-[10px] font-mono text-gray-500 truncate">
            {viewable
              ? row.label
              : row.kind === 'native'
                ? `${row.label} — xuất STEP để xem`
                : row.label}
          </span>
        </button>
        {row.alt && (
          <button
            type="button"
            onClick={onOpenAlt}
            disabled={busy}
            className="text-[10px] px-1.5 py-0.5 rounded text-gray-600 hover:bg-gray-100 shrink-0 font-mono disabled:opacity-50"
            title={`Open the mesh instead: ${row.alt.name}`}
          >
            {row.alt.ext.toUpperCase()}
          </button>
        )}
      </div>
    </li>
  );
}
