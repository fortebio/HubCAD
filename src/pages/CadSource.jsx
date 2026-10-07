import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconFileCode,
  IconFolderOff,
  IconAlertTriangle,
  IconRefresh,
  IconCircleCheck,
  IconCube,
  IconAdjustments,
  IconLoader2,
  IconFileExport,
  IconLayoutColumns,
  IconFileText,
  IconDeviceFloppy,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { CadSourceTree } from '@/components/cadsource/CadSourceTree';
import { SourceView } from '@/components/cadsource/SourceView';
import { ParamTable } from '@/components/cadsource/ParamTable';
import { ModelPanel } from '@/components/cadsource/ModelPanel';
import { DiffModal } from '@/components/cadsource/DiffModal';
import { RebuildPanel } from '@/components/cadsource/RebuildPanel';
import { WorkFolderBar, WorkFolderPicker } from '@/components/cadsource/WorkFolderPicker';
import { Button } from '@/components/ui/Button';
import { api, apiPaths } from '@/lib/api';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';
import { cx } from '@/lib/cx';

/**
 * CAD Source — read the CadQuery scripts that generate the STEP/STL this shop
 * manufactures from, without leaving HubCAD.
 *
 * The files live outside the app, under CAD_ROOT on the workstation; the server
 * owns every path and this page only ever speaks in paths relative to that root.
 */
export function CadSource() {
  const [caps, setCaps] = useState(null);
  const [capsError, setCapsError] = useState(null);
  const [selected, setSelected] = usePref('cadsource:selected', null);
  // Where the tree opens. Per browser on purpose: which job someone is on is
  // their business, and the server should not decide it for everyone.
  const [workFolder, setWorkFolder] = usePref('cadsource:workFolder', '');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const [files, setFiles] = useState({}); // rel -> { text, lineCount, ... }
  const [activeFile, setActiveFile] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [jumpTo, setJumpTo] = useState(null);

  const [modelRel, setModelRel] = useState(null);
  const [pickedPart, setPickedPart] = useState(null);
  const [pane, setPane] = usePref('cadsource:pane', 'split');

  // Edited literals, keyed by param id, until they are written or discarded.
  const [pending, setPending] = useState({});
  const [diffOpen, setDiffOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [writing, setWriting] = useState(false);

  const [intro, setIntro] = useState(null);
  const [introError, setIntroError] = useState(null);
  const [introBusy, setIntroBusy] = useState(false);
  const jumpSeq = useRef(0);

  useEffect(() => {
    api
      .get(apiPaths.cadCapabilities)
      .then(setCaps)
      .catch((e) => setCapsError(e.message));
  }, []);

  /** Fetch a file once and keep it — the import graph is read back and forth. */
  const loadFile = useCallback(
    async (rel, { force = false } = {}) => {
      if (!force && files[rel]) return files[rel];
      const data = await api.get(apiPaths.cadFile(rel));
      setFiles((f) => ({ ...f, [rel]: data }));
      return data;
    },
    [files]
  );

  const openScript = useCallback(
    async (rel, { force = false } = {}) => {
      setLoadingFile(true);
      setIntro(null);
      setIntroError(null);
      setPending({});
      try {
        await loadFile(rel, { force });
        setActiveFile(rel);
        setJumpTo(null);
      } catch (e) {
        setActiveFile(null);
        toast.error(`Could not open ${rel.split('/').pop()}`, e.message);
        setLoadingFile(false);
        return;
      }
      setLoadingFile(false);

      if (!rel.toLowerCase().endsWith('.py')) return;
      setIntroBusy(true);
      try {
        const data = await api.get(apiPaths.cadIntrospect(rel));
        setIntro(data);
        // Show what this script actually produced, if it is on disk.
        const assembly = data.exports?.find((e) => e.assembly?.exists)?.assembly;
        setModelRel(assembly ? assembly.rel : null);
        setPickedPart(null);
      } catch (e) {
        setIntroError(e.message);
      } finally {
        setIntroBusy(false);
      }
    },
    [loadFile]
  );

  // Re-open whatever was being read last time, once we know the root is there.
  // Only text files: a remembered .step would hit /file and come back 415.
  useEffect(() => {
    if (!caps?.configured || !selected || activeFile || loadingFile) return;
    if (/\.(py|md|txt|json|cfg|ini|toml)$/i.test(selected)) openScript(selected);
    else setModelRel(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first capability load
  }, [caps?.configured]);

  function handleSelect(entry) {
    setSelected(entry.rel);
    if (entry.kind === 'script' || entry.kind === 'doc') {
      openScript(entry.rel);
      return;
    }
    if (entry.kind === 'model' || entry.kind === 'mesh') {
      // A STEP picked on its own: show it, but keep whatever script is open —
      // the two panes are independent until a script claims the model.
      setModelRel(entry.rel);
      setPickedPart(null);
      if (pane === 'source') setPane('split');
      return;
    }
    setActiveFile(null);
    setIntro(null);
  }

  /**
   * A pick in the viewport is a STEP PRODUCT name, which is the key CadQuery
   * wrote from the dict `build()` returns — so the parts index resolves it to
   * the line that declares the body.
   */
  async function jumpToPart(name) {
    setPickedPart(name);
    if (!name) return;
    const hit = intro?.parts?.find((p) => p.name === name);
    if (!hit) {
      toast.info(`No source site for ${name}`, 'Không tìm thấy dòng khai báo cho chi tiết này');
      return;
    }
    if (pane === 'model') setPane('split');
    jumpSeq.current += 1;
    const nonce = jumpSeq.current;
    if (hit.file !== activeFile) {
      try {
        await loadFile(hit.file);
        setActiveFile(hit.file);
      } catch (e) {
        toast.error(`Could not open ${hit.file.split('/').pop()}`, e.message);
        return;
      }
    }
    setJumpTo({ line: hit.lineno, nonce });
  }

  /** Jump to a parameter's declaration, switching file if it lives elsewhere. */
  async function jumpToParam(p) {
    jumpSeq.current += 1;
    const nonce = jumpSeq.current;
    if (p.file !== activeFile) {
      try {
        await loadFile(p.file);
        setActiveFile(p.file);
      } catch (e) {
        toast.error(`Could not open ${p.file.split('/').pop()}`, e.message);
        return;
      }
    }
    setJumpTo({ line: p.lineno, nonce });
  }

  // ------------------------------------------------------------- editing
  const paramById = useMemo(() => {
    const map = new Map();
    for (const p of intro?.params || []) map.set(p.id, p);
    return map;
  }, [intro]);

  /** Edits that actually differ from what is in the file. */
  const dirtyEdits = useMemo(
    () =>
      Object.entries(pending)
        .filter(([id, value]) => paramById.get(id) && value !== paramById.get(id).literal)
        .map(([id, value]) => {
          const p = paramById.get(id);
          return {
            file: p.file,
            name: p.name,
            lineno: p.lineno,
            colByte: p.colByte,
            endColByte: p.endColByte,
            expect: p.literal,
            newLiteral: value,
          };
        }),
    [pending, paramById]
  );

  function editParam(p, value) {
    setPending((d) => ({ ...d, [p.id]: value }));
  }

  async function openDiff() {
    setDiffOpen(true);
    setPreview(null);
    try {
      setPreview(
        await api.post(apiPaths.cadPreview, { entry: intro.entry, edits: dirtyEdits })
      );
    } catch (e) {
      setDiffOpen(false);
      toast.error('Could not prepare the change', e.message);
    }
  }

  async function writeEdits() {
    setWriting(true);
    try {
      const res = await api.post(apiPaths.cadWrite, { entry: intro.entry, edits: dirtyEdits });
      toast.success(
        `Wrote ${res.written.length} file${res.written.length > 1 ? 's' : ''}`,
        `Đã lưu bản sao vào ${res.written[0]?.backup?.split('/')[0] || '.hubcad-bak'}`
      );
      setDiffOpen(false);
      setPending({});
      // Re-read from disk: byte offsets move when a literal changes length.
      // Forced rather than cache-cleared — clearing races loadFile's closure,
      // which would then hand back the stale copy and blank the source pane.
      await openScript(intro.entry, { force: true });
    } catch (e) {
      toast.error('Write failed', e.message);
    } finally {
      setWriting(false);
    }
  }

  /**
   * The script just rewrote its STEP; drop the viewer's copy so it re-fetches.
   * A cache-busting suffix is enough — /raw answers with an ETag.
   */
  function reloadAfterRebuild(res) {
    const assembly = res.outputs?.find((o) => o.rel.endsWith('_assembly.step') && o.changed);
    if (assembly) {
      setModelRel(null);
      setTimeout(() => setModelRel(assembly.rel), 50);
    }
  }

  // ---------------------------------------------------------------- states
  if (capsError) {
    return (
      <Shell>
        <Card>
          <Empty
            icon={<IconAlertTriangle size={40} className="text-amber-500" />}
            title="Could not reach the CAD service"
            hint={`Không gọi được API: ${capsError}`}
          />
        </Card>
      </Shell>
    );
  }

  if (!caps) {
    return (
      <Shell>
        <Card>
          <div className="py-10 text-center text-[13px] text-gray-500">Loading… / Đang tải…</div>
        </Card>
      </Shell>
    );
  }

  if (!caps.configured) {
    return (
      <Shell>
        <Card>
          <Empty
            icon={<IconFolderOff size={40} />}
            title="CAD folder not configured / Chưa cấu hình thư mục CAD"
            hint="Set CAD_ROOT in the server .env to the folder holding your CAD projects, then restart the API. Đặt CAD_ROOT trong .env trỏ tới thư mục chứa các dự án CAD rồi khởi động lại server."
          />
        </Card>
      </Shell>
    );
  }

  const file = activeFile ? files[activeFile] : null;
  const graph = intro?.graph || [];

  return (
    <Shell action={<PythonChip python={caps.python} />}>
      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_330px] lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <Card className="lg:sticky lg:top-4">
          <CardHeader
            title="Project tree"
            subtitle={workFolder ? `${caps.cadRoot} › ${workFolder}` : caps.cadRoot}
            icon={<IconFileCode size={18} aria-hidden="true" />}
          />
          <WorkFolderBar
            folder={workFolder}
            cadRoot={caps.cadRoot}
            onChange={() => setFolderPickerOpen(true)}
            onClear={() => setWorkFolder('')}
          />
          <CadSourceTree
            selected={selected}
            onSelect={handleSelect}
            root={workFolder}
            className="max-h-[calc(100vh-290px)] -mx-1"
          />
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-1 px-2 pt-2 border-b border-gray-200">
            <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
              {graph.length > 1 &&
                graph.map((g) => (
                  <button
                    key={g.rel}
                    type="button"
                    onClick={() => loadFile(g.rel).then(() => setActiveFile(g.rel))}
                    className={cx(
                      'px-2 py-1 text-[11px] font-mono rounded-t-md whitespace-nowrap border-b-2 -mb-px transition-colors',
                      activeFile === g.rel
                        ? 'border-primary-500 text-primary-700 bg-primary-50/50'
                        : 'border-transparent text-gray-600 hover:bg-gray-50'
                    )}
                    title={g.rel}
                  >
                    {g.rel.split('/').pop()}
                  </button>
                ))}
            </div>
            <PaneSwitch value={pane} onChange={setPane} hasModel={!!modelRel} />
          </div>

          {pane !== 'source' && (
            <ModelPanel
              rel={modelRel}
              onPickPart={jumpToPart}
              selectedName={pickedPart}
              className={pane === 'model' ? 'h-[calc(100vh-290px)]' : 'h-[42vh] border-b border-gray-200'}
            />
          )}

          {pane !== 'model' &&
            (loadingFile ? (
              <div className="py-20 text-center text-[13px] text-gray-500">Reading… / Đang đọc…</div>
            ) : file ? (
              <SourceView
                text={file.text}
                fileName={activeFile}
                jumpTo={jumpTo}
                className={pane === 'split' ? 'h-[calc(100vh-290px-42vh)]' : 'h-[calc(100vh-290px)]'}
              />
            ) : (
              <Empty
                icon={<IconFileCode size={40} />}
                title="Pick a script to read / Chọn một script để xem"
                hint="Mở thư mục bên trái rồi chọn file .py — ví dụ 02. LCD › F_Pebble › enclosure_f.py"
              />
            ))}
        </Card>

        <Card className="p-0 overflow-hidden xl:sticky xl:top-4">
          <div className="px-3 pt-3 pb-1">
            <CardHeader
              title="Parameters"
              subtitle="Tham số — nhấn để tới dòng khai báo"
              icon={<IconAdjustments size={18} aria-hidden="true" />}
            />
          </div>
          {introBusy ? (
            <div className="py-10 text-center text-[12px] text-gray-500 flex items-center justify-center gap-2">
              <IconLoader2 size={14} className="animate-spin" aria-hidden="true" />
              Đang phân tích script…
            </div>
          ) : introError ? (
            <div className="px-3 pb-4">
              <Empty
                icon={<IconAlertTriangle size={32} className="text-amber-500" />}
                title="Could not read parameters"
                hint={introError}
              />
            </div>
          ) : intro ? (
            <>
              <ParamTable
                data={intro}
                entryFile={intro.entry}
                onJump={jumpToParam}
                canEdit={caps.you?.canEdit}
                pending={pending}
                onEdit={editParam}
                className="h-[calc(100vh-430px)]"
              />
              {dirtyEdits.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-2 border-t border-gray-200 bg-primary-50/60">
                  <span className="text-[11px] text-primary-800 flex-1">
                    <strong>{dirtyEdits.length}</strong> giá trị đã đổi, chưa ghi
                  </span>
                  <button
                    type="button"
                    onClick={() => setPending({})}
                    className="text-[11px] px-2 py-1 rounded-md text-gray-600 hover:bg-white"
                  >
                    <IconArrowBackUp size={12} className="inline -mt-0.5 mr-0.5" aria-hidden="true" />
                    Discard / Bỏ
                  </button>
                  <Button size="sm" onClick={openDiff}>
                    <IconDeviceFloppy size={13} />
                    Review / Xem diff
                  </Button>
                </div>
              )}
              <ExportsStrip exports={intro.exports} />
              <RebuildPanel
                script={intro.entry}
                canEdit={caps.you?.canEdit}
                isManager={caps.you?.role === 'manager'}
                onFinished={reloadAfterRebuild}
              />
            </>
          ) : (
            <div className="px-3 pb-4">
              <Empty
                icon={<IconAdjustments size={32} />}
                title="No script selected / Chưa chọn script"
                hint="Chọn một file .py để xem tham số dựng hình."
              />
            </div>
          )}
        </Card>
      </div>

      <WorkFolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        current={workFolder}
        cadRoot={caps.cadRoot}
        onPick={(res) => {
          setWorkFolder(res.rel);
          toast.success(
            `Working in ${res.name}`,
            `${res.counts.scripts} script · ${res.counts.models} mô hình · ${res.counts.folders} thư mục con`
          );
        }}
      />

      <DiffModal
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        preview={preview}
        busy={writing}
        edits={dirtyEdits}
        onConfirm={writeEdits}
      />
    </Shell>
  );
}

/** Source, model, or both — "both" is the pairing this page exists for. */
function PaneSwitch({ value, onChange, hasModel }) {
  const options = [
    { key: 'source', label: 'Source', icon: IconFileText },
    { key: 'split', label: 'Split', icon: IconLayoutColumns, needsModel: true },
    { key: 'model', label: '3D', icon: IconCube, needsModel: true },
  ];
  return (
    <div className="flex items-center gap-0.5 shrink-0 pb-1">
      {options.map((o) => {
        const Icon = o.icon;
        const disabled = o.needsModel && !hasModel;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            disabled={disabled}
            aria-pressed={value === o.key}
            title={disabled ? 'No model loaded / Chưa có mô hình' : o.label}
            className={cx(
              'flex items-center gap-1 px-1.5 py-1 text-[10px] rounded border transition-colors',
              value === o.key
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50',
              disabled && 'opacity-40 cursor-default'
            )}
          >
            <Icon size={12} aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Shell({ children, action = null }) {
  return (
    <PageWrapper
      title="CAD Source"
      subtitle="Mã nguồn CAD — đọc script dựng mô hình và tham số"
      breadcrumb="Design / Thiết kế"
      action={action}
    >
      {children}
    </PageWrapper>
  );
}

/** Which STEP/STL this script writes, and whether they are on disk right now. */
function ExportsStrip({ exports }) {
  if (!exports?.length) return null;
  return (
    <div className="border-t border-gray-200 px-2 py-2">
      {exports.map((ex) => (
        <div key={ex.prefix} className="text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-600 mb-1">
            <IconFileExport size={13} aria-hidden="true" />
            <span className="font-mono">{ex.prefix}</span>
            <span className="text-gray-400">· dòng {ex.call.lineno}</span>
          </div>
          <ul className="space-y-0.5 pl-4">
            <OutputRow label="assembly" art={ex.assembly} />
            {ex.printable.map((p) => (
              <OutputRow key={p.key} label={p.key} art={p.step} alt={p.stl} />
            ))}
          </ul>
          {ex.unmatched.length > 0 && (
            <p className="pl-4 text-[10px] text-amber-700 mt-1">
              {ex.unmatched.length} file không khớp quy tắc đặt tên
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function OutputRow({ label, art, alt = null }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={cx('w-1.5 h-1.5 rounded-full shrink-0', art.exists ? 'bg-emerald-500' : 'bg-gray-300')}
        aria-hidden="true"
      />
      <span className="font-mono text-gray-700 truncate min-w-0 flex-1" title={art.rel}>
        {label}
      </span>
      <span className="text-gray-400 shrink-0">
        {art.exists ? 'step' : '—'}
        {alt?.exists ? ' + stl' : ''}
      </span>
    </li>
  );
}

/** Tells the operator plainly whether the rebuild half of this page can work. */
function PythonChip({ python }) {
  const ok = python?.available;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border',
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
      title={ok ? python.path : python?.detail || 'Python not found'}
    >
      {ok ? (
        <IconCircleCheck size={13} aria-hidden="true" />
      ) : (
        <IconRefresh size={13} aria-hidden="true" />
      )}
      {ok
        ? `Python ${python.version} · cadquery ${python.cadquery || '—'}`
        : 'Python không khả dụng — chỉ đọc'}
    </span>
  );
}
