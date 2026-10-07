import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { STLViewer } from '@/components/viewer/STLViewer';
import { SaveDrawingModal } from '@/components/viewer/SaveDrawingModal';
import { DrawingPreview } from '@/components/viewer/DrawingPreview';
import { AssemblyBOMModal } from '@/components/viewer/AssemblyBOMModal';
import { CadFolderBrowser } from '@/components/viewer/CadFolderBrowser';
import { computeBoundingBox } from '@/lib/stlParser';
import { computeMeshStats } from '@/lib/massProperties';
import { useCostStore } from '@/stores/useCostStore';
import { suggestForPart } from '@/lib/costing/estimate';
import { formatMass, formatMoney, formatVolume } from '@/lib/costing/format';
import { parseCadParts, CAD_ACCEPT } from '@/lib/parseCadFile';
import { LAYERS, classifyPart, layerById } from '@/lib/assemblyLayers';
import { buildAssemblyTree, pathHasPrefix } from '@/lib/assemblyTree';
import { writePref } from '@/lib/localMemory';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';
import {
  clearViewerSession,
  loadViewerSession,
  saveViewerSession,
  MAX_SESSION_BYTES,
  QUOTE_SCOPE_KEY,
} from '@/lib/viewerSession';
import { cx } from '@/lib/cx';
import {
  IconBoxModel,
  IconRefresh,
  Icon3dCubeSphere,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconStack2,
  IconAlertTriangle,
  IconWeight,
  IconCalculator,
  IconArrowRight,
  IconSearch,
  IconX,
  IconFocus2,
  IconListDetails,
  IconChevronRight,
  IconChevronDown,
  IconFocusCentered,
  IconSitemap,
  IconArrowLeft,
  IconReceipt2,
  IconCornerLeftUp,
} from '@tabler/icons-react';

const VIEWS = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'top', label: 'Top' },
  { key: 'iso', label: 'ISO' },
];

const COLORS = ['#1a6ff5', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#374151'];

const ACCEPT = CAD_ACCEPT;
const LAYER_ORDER = LAYERS.map((l) => l.id);
// Part lists longer than this start with every system collapsed.
const COLLAPSE_ABOVE = 24;

let modelSeq = 0;
const nextId = () => `model-${Date.now().toString(36)}-${++modelSeq}`;

// What the mesh is painted: an operator's own pick, else the CAD file's
// colour when asked for, else the colour of the system it belongs to.
function effectiveColor(m, colorMode) {
  if (m.color) return m.color;
  if (colorMode === 'file' && m.cadColor) return m.cadColor;
  return layerById(m.layer).color;
}

export function Viewer3D() {
  // One entry per placed body. Adding files appends; it never replaces.
  const [models, setModels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [wireframe, setWireframe] = usePref('viewer:wireframe', false);
  const [colorMode, setColorMode] = usePref('viewer:colorMode', 'system');
  // Which material the mass estimate assumes, remembered per operator.
  const [materialId, setMaterialId] = usePref('viewer:material', 'al6061');
  const [view, setView] = usePref('viewer:view', 'iso');
  // Explorer state: 0–100 explosion, a single isolated part, hidden systems.
  const [explode, setExplode] = useState(0);
  const [isolate, setIsolate] = useState(false);
  const [hiddenLayers, setHiddenLayers] = useState([]);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});
  // Drill-down: only parts under this assembly path stay visible.
  const [focusPath, setFocusPath] = useState(null);
  const [treeOpen, setTreeOpen] = useState({});
  const [hover, setHover] = useState(null);
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null); // { done, total, current }
  const [fileErrors, setFileErrors] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [restoredAt, setRestoredAt] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const viewerRef = useRef(null);
  const tooLargeWarned = useRef(false);
  // Volume and area are O(triangles); compute once per model, not per render.
  const statsCache = useRef(new Map());

  const settings = useCostStore((s) => s.settings);
  const fetchCostSettings = useCostStore((s) => s.fetch);

  useEffect(() => {
    fetchCostSettings();
  }, [fetchCostSettings]);

  // Bring back whatever this operator had loaded last time, from this browser.
  useEffect(() => {
    let cancelled = false;
    loadViewerSession()
      .then((session) => {
        if (cancelled) return;
        if (session) {
          // Sessions saved before parts carried a system still need one.
          const restored = session.models.map((m) => ({
            ...m,
            path: m.path || [],
            layer: m.layer || classifyPart(m),
          }));
          setModels(restored);
          setSelectedId(session.selectedId || restored[0].id);
          setRestoredAt(session.savedAt);
          toast.info(
            `Restored ${restored.length} part${restored.length > 1 ? 's' : ''} from your last session`,
            'Đã khôi phục phiên làm việc trước trên máy này'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after edits settle. Guarded by `hydrated` so the empty initial
  // state cannot wipe a stored session before it is read back.
  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setTimeout(async () => {
      if (!models.length) {
        await clearViewerSession();
        return;
      }
      const res = await saveViewerSession({ models, selectedId });
      if (!res.saved && res.reason === 'too-large' && !tooLargeWarned.current) {
        tooLargeWarned.current = true;
        toast.warning(
          'Assembly too large to remember',
          `${(res.bytes / 1048576).toFixed(0)} MB vượt giới hạn ${MAX_SESSION_BYTES / 1048576} MB — phiên này sẽ không được lưu lại`
        );
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [hydrated, models, selectedId]);

  const selected = models.find((m) => m.id === selectedId) || null;
  const hidden = useMemo(() => new Set(hiddenLayers), [hiddenLayers]);

  // A part is on screen when its own eye is on, its system is on, and no
  // other part is being isolated.
  const inFocus = (m) => !focusPath || pathHasPrefix(m.path, focusPath);
  const isShown = (m) =>
    m.visible && inFocus(m) && !hidden.has(m.layer) && (!isolate || m.id === selectedId);
  const visibleModels = useMemo(
    () => models.filter(isShown),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isShown closes over the same deps.
    [models, hidden, isolate, selectedId, focusPath]
  );
  // Everything inside the focused sub-assembly, whether currently shown or not.
  const scopedModels = useMemo(
    () => (focusPath ? models.filter(inFocus) : models),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models, focusPath]
  );

  // The viewer keeps every mesh and only flips visibility, so toggles are free.
  const viewerModels = useMemo(
    () => models.map((m) => ({ ...m, visible: isShown(m), color: effectiveColor(m, colorMode) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models, hidden, isolate, selectedId, focusPath, colorMode]
  );

  const tree = useMemo(() => buildAssemblyTree(models), [models]);
  const hovered = hover ? models.find((m) => m.id === hover.id) : null;

  // Parts per system, for the Systems panel.
  const layerRows = useMemo(() => {
    const counts = new Map();
    for (const m of scopedModels) counts.set(m.layer, (counts.get(m.layer) || 0) + 1);
    return LAYERS.filter((l) => counts.has(l.id)).map((l) => ({ ...l, count: counts.get(l.id) }));
  }, [scopedModels]);

  const instanceCount = useMemo(() => {
    if (!selected) return 0;
    const key = selected.name.trim().toLowerCase();
    return models.filter((m) => m.name.trim().toLowerCase() === key).length;
  }, [models, selected]);

  // Assembly totals span every visible part, so the info panel matches what
  // the viewport actually shows.
  const totals = useMemo(() => {
    if (!visibleModels.length) return null;
    const triangles = visibleModels.reduce((n, m) => n + m.positions.length / 9, 0);
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const m of visibleModels) {
      for (const axis of ['x', 'y', 'z']) {
        if (m.bbox.min[axis] < min[axis]) min[axis] = m.bbox.min[axis];
        if (m.bbox.max[axis] > max[axis]) max[axis] = m.bbox.max[axis];
      }
    }
    return {
      triangles,
      size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    };
  }, [visibleModels]);

  // Mass properties for every loaded model, cached by model id.
  const statsById = useMemo(() => {
    const map = {};
    for (const m of models) {
      if (!statsCache.current.has(m.id)) {
        statsCache.current.set(m.id, computeMeshStats(m.positions, m.bbox));
      }
      map[m.id] = statsCache.current.get(m.id);
    }
    return map;
  }, [models]);

  const material = (settings.materials || []).find((m) => m.id === materialId) || null;
  const selectedStats = selected ? statsById[selected.id] : null;

  // What the selected part would cost as a one-off, in the chosen material.
  const quickQuote = useMemo(() => {
    if (!selectedStats) return null;
    return suggestForPart({ stats: selectedStats, qty: 1, settings, materialId });
  }, [selectedStats, settings, materialId]);

  const assemblyMassG = useMemo(() => {
    if (!material) return 0;
    return visibleModels.reduce(
      (sum, m) => sum + ((statsById[m.id]?.volumeMm3 || 0) / 1000) * material.density,
      0
    );
  }, [visibleModels, statsById, material]);

  // Search matches the body name, its part code and the assemblies above it.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.path.some((p) => p.toLowerCase().includes(q))
    );
  }, [models, search]);

  async function handleFiles(input) {
    const files = Array.isArray(input) ? input : [input];
    if (!files.length) return;

    setFileErrors([]);
    const added = [];
    const failed = [];
    let assemblies = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ done: i, total: files.length, current: file.name });
      // Yield so the progress line repaints before a synchronous STL parse.
      await new Promise((r) => setTimeout(r, 0));
      try {
        const parts = await parseCadParts(file);
        if (!parts.length) throw new Error('No geometry found in this file');
        if (parts.length > 1) assemblies += 1;
        for (const part of parts) {
          added.push({
            id: nextId(),
            name: part.name,
            path: part.path,
            sourceFile: file.name,
            size: file.size,
            positions: part.positions,
            bbox: computeBoundingBox(part.positions),
            layer: classifyPart(part),
            cadColor: part.color,
            color: null,
            visible: true,
          });
        }
      } catch (e) {
        // One bad file must not abort the rest of the batch.
        failed.push({ name: file.name, message: e.message });
      }
    }

    setProgress(null);

    if (added.length) {
      setModels((prev) => [...prev, ...added]);
      setSelectedId(added[0].id);
      setIsolate(false);
      if (added.length > COLLAPSE_ABOVE) {
        setCollapsed(Object.fromEntries(LAYER_ORDER.map((id) => [id, true])));
      }
      toast.success(
        assemblies
          ? `Loaded ${added.length} parts from ${files.length} file${files.length > 1 ? 's' : ''}`
          : `Loaded ${added.length} model${added.length > 1 ? 's' : ''}`,
        assemblies
          ? `Đã tách cụm lắp ráp thành ${added.length} chi tiết`
          : `Đã tải ${added.length} mô hình vào khung nhìn`
      );
    }
    if (failed.length) {
      setFileErrors(failed);
      toast.error(
        `${failed.length} file${failed.length > 1 ? 's' : ''} could not be loaded`,
        failed.map((f) => f.name).join(', ')
      );
    }
  }

  function patchModel(id, patch) {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function toggleVisible(id) {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)));
  }

  function removeModel(id) {
    setModels((prev) => prev.filter((m) => m.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function selectPart(id) {
    setSelectedId(id);
    if (id) {
      const m = models.find((x) => x.id === id);
      // Selecting from search must reveal the part even if its system is off.
      if (m && hidden.has(m.layer)) setHiddenLayers((prev) => prev.filter((l) => l !== m.layer));
      if (m && !m.visible) patchModel(id, { visible: true });
      if (m && focusPath && !pathHasPrefix(m.path, focusPath)) setFocusPath(null);
    } else {
      setIsolate(false);
    }
  }

  function toggleLayer(id) {
    setHiddenLayers((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
    setIsolate(false);
  }

  function onlyLayer(id) {
    setHiddenLayers(LAYER_ORDER.filter((l) => l !== id));
    setIsolate(false);
  }

  function showAllLayers() {
    setHiddenLayers([]);
    setIsolate(false);
  }

  function hideAllLayers() {
    setHiddenLayers([...LAYER_ORDER]);
    setIsolate(false);
  }

  function toggleIsolate() {
    if (!selected) return;
    setIsolate((v) => !v);
  }

  function focusAssembly(path) {
    setFocusPath(path && path.length ? path : null);
    setIsolate(false);
    setSearch('');
  }

  function focusUp() {
    if (!focusPath) return;
    focusAssembly(focusPath.slice(0, -1));
  }

  // Price what is on screen: the whole assembly, or just the focused
  // sub-assembly. The session is flushed first because the autosave is
  // debounced and would be cancelled by navigating away.
  async function quoteAssembly() {
    const ids = scopedModels.map((m) => m.id);
    await saveViewerSession({ models, selectedId });
    writePref(QUOTE_SCOPE_KEY, {
      savedAt: new Date().toISOString(),
      ids,
      label: focusPath ? focusPath.join(' › ') : sourceFiles.length === 1 ? sourceFiles[0] : null,
    });
    navigate('/quote?from=viewer');
  }

  function clearAll() {
    setModels([]);
    setSelectedId(null);
    setFileErrors([]);
    setRestoredAt(null);
    setExplode(0);
    setIsolate(false);
    setHiddenLayers([]);
    setSearch('');
    setFocusPath(null);
    setHover(null);
    clearViewerSession();
  }

  // Esc backs out one step: selection, then isolation, then the focused assembly.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (isolate) setIsolate(false);
      else if (selectedId) setSelectedId(null);
      else if (focusPath) focusUp();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isolate, selectedId, focusPath]);

  // Re-frame once the slider settles so the whole inventory (or the whole
  // assembly) is in view without the operator zooming by hand.
  useEffect(() => {
    if (!models.length) return undefined;
    const timer = setTimeout(() => viewerRef.current?.fitVisible(), 250);
    return () => clearTimeout(timer);
  }, [explode, isolate, focusPath, models.length]);

  const explodeAmount = explode / 100;
  const sceneCaption = isolate
    ? { en: 'ISOLATED PART', vn: 'CHI TIẾT ĐƯỢC TÁCH RIÊNG' }
    : explodeAmount > 0.95
      ? { en: 'COMPONENT INVENTORY', vn: 'KHO LINH KIỆN' }
      : explodeAmount > 0.01
        ? { en: 'SEPARATED PARTS', vn: 'ĐANG TÁCH RỜI' }
        : { en: 'ASSEMBLED', vn: 'LẮP RÁP' };

  // Name handed to the drawing export. A single part keeps its filename; an
  // assembly gets a stable, sanitisable label.
  const sourceFiles = [...new Set(models.map((m) => m.sourceFile).filter(Boolean))];
  const sourceFile =
    models.length === 1
      ? models[0].sourceFile || models[0].name
      : sourceFiles.length === 1
        ? sourceFiles[0]
        : `assembly_${models.length}_parts`;
  const drawingInfo = totals
    ? {
        dimX: totals.size.x,
        dimY: totals.size.y,
        dimZ: totals.size.z,
        triangles: totals.triangles,
        // ISO 7200 title block wants a mass; the viewer now knows it.
        weight: assemblyMassG ? assemblyMassG / 1000 : null,
        material: material ? `${material.en} / ${material.vn}` : null,
      }
    : null;

  const listGroups = useMemo(() => {
    if (matches) return null;
    const byLayer = new Map();
    for (const m of scopedModels) {
      if (!byLayer.has(m.layer)) byLayer.set(m.layer, []);
      byLayer.get(m.layer).push(m);
    }
    return LAYER_ORDER.filter((id) => byLayer.has(id)).map((id) => ({
      layer: layerById(id),
      items: byLayer.get(id),
    }));
  }, [scopedModels, matches]);

  return (
    <PageWrapper
      title="3D Viewer"
      subtitle="Xem mô hình 3D — STL · OBJ · STEP · IGES · BREP"
      breadcrumb="Design / Thiết kế"
      action={
        models.length > 0 && (
          <>
            <Button variant="secondary" size="sm" onClick={() => setBomOpen(true)}>
              <IconListDetails size={14} aria-hidden="true" /> BOM from assembly / BOM
            </Button>
            <Button variant="secondary" size="sm" onClick={quoteAssembly}>
              <IconReceipt2 size={14} aria-hidden="true" />{' '}
              {focusPath ? 'Quote sub-assembly / Báo giá cụm con' : 'Quote assembly / Báo giá cụm'}
            </Button>
            <Button variant="secondary" size="sm" onClick={clearAll}>
              <IconRefresh size={14} aria-hidden="true" /> Clear all / Xóa hết
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card
          className={cx(
            'p-0 overflow-hidden h-[640px] flex flex-col relative',
            dragOver && 'ring-2 ring-primary-500'
          )}
          // Files can be dropped straight onto the viewport, even while a
          // model is already loaded.
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = Array.from(e.dataTransfer.files || []);
            if (dropped.length) handleFiles(dropped);
          }}
        >
          {progress ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center" role="status" aria-live="polite">
                <div className="text-[14px] font-medium text-gray-700">
                  Parsing {progress.done + 1} / {progress.total} — {progress.current}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  STEP/IGES uses OpenCascade WASM (~5MB) — first load may take a few seconds.
                </div>
              </div>
            </div>
          ) : models.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-md space-y-3">
                <FileUpload
                  multiple
                  onFiles={handleFiles}
                  accept={ACCEPT}
                  hint="Supported: .stl, .obj, .step / .stp, .iges / .igs, .brep — chọn hoặc kéo thả nhiều file. A STEP assembly is split into its parts / Cụm STEP sẽ được tách thành từng chi tiết"
                />
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex-1 h-px bg-gray-200" />
                  or / hoặc
                  <span className="flex-1 h-px bg-gray-200" />
                </div>
                <CadFolderBrowser onOpenFiles={handleFiles} busy={!!progress} />
              </div>
            </div>
          ) : (
            <div className="flex-1 relative">
              <STLViewer
                ref={viewerRef}
                models={viewerModels}
                wireframe={wireframe}
                view={view}
                explode={explodeAmount}
                selectedId={selectedId}
                onPick={selectPart}
                onHover={setHover}
                groupOrder={LAYER_ORDER}
              />

              {/* Name of the part under the pointer, like a CAD tree tooltip. */}
              {hovered && hover.id !== selectedId && (
                <div
                  role="tooltip"
                  className="absolute pointer-events-none bg-gray-900/90 text-white text-[11px] rounded-md px-2 py-1 shadow-card max-w-[240px]"
                  style={{ left: hover.x + 14, top: hover.y + 14 }}
                >
                  <div className="font-medium truncate">{hovered.name}</div>
                  <div className="text-gray-300 truncate">
                    {layerById(hovered.layer).en} · {layerById(hovered.layer).vn}
                  </div>
                </div>
              )}

              {/* Scene caption + hint, like a drawing's view label. */}
              <div className="absolute top-3 left-3 pointer-events-none">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-gray-600">
                  {sceneCaption.en}
                </div>
                <div className="text-[10px] tracking-wide text-gray-500">{sceneCaption.vn}</div>
              </div>

              {/* Drill-down breadcrumb — each segment steps back up the tree. */}
              {focusPath && (
                <nav
                  aria-label="Focused sub-assembly / Cụm con đang xem"
                  className="absolute top-11 left-3 flex items-center gap-1 bg-white/95 border border-gray-200 rounded-lg shadow-card px-2 py-1 text-[11px] max-w-[70%]"
                >
                  <button
                    type="button"
                    onClick={focusUp}
                    className="flex items-center gap-1 text-primary-600 hover:underline shrink-0"
                    title="Back to parent assembly / Về cụm cha"
                  >
                    <IconArrowLeft size={12} aria-hidden="true" /> Back
                  </button>
                  <span className="text-gray-400" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={() => focusAssembly(null)}
                    className="text-gray-600 hover:text-gray-900 shrink-0"
                  >
                    All
                  </button>
                  {focusPath.map((seg, i) => (
                    <span key={i} className="flex items-center gap-1 min-w-0">
                      <IconChevronRight size={11} className="text-gray-400 shrink-0" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => focusAssembly(focusPath.slice(0, i + 1))}
                        aria-current={i === focusPath.length - 1 ? 'location' : undefined}
                        className={cx(
                          'truncate',
                          i === focusPath.length - 1
                            ? 'font-semibold text-gray-900'
                            : 'text-gray-600 hover:text-gray-900'
                        )}
                        title={seg}
                      >
                        {seg}
                      </button>
                    </span>
                  ))}
                </nav>
              )}
              <div className="absolute top-3 right-3 text-[11px] text-gray-600 bg-white/85 border border-gray-200 rounded-md px-2 py-1 pointer-events-none">
                {visibleModels.length.toLocaleString()} / {scopedModels.length.toLocaleString()} parts visible
                <span className="block text-[10px] text-gray-500">chi tiết đang hiển thị</span>
              </div>

              {/* Explode + camera controls */}
              <div className="absolute bottom-3 left-3 right-3 flex flex-col sm:flex-row sm:items-end gap-2 pointer-events-none">
                <div className="pointer-events-auto bg-white/95 border border-gray-200 rounded-xl shadow-card px-3 py-2 flex-1 max-w-md">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="viewer-explode" className="text-[12px] font-medium text-gray-800">
                      Explode assembly
                      <span className="text-gray-500 font-normal"> / Tách rời cụm</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-gray-900 w-9 text-right">{explode}%</span>
                      <button
                        type="button"
                        onClick={() => setExplode(0)}
                        disabled={explode === 0}
                        className="text-[11px] text-primary-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <input
                    id="viewer-explode"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={explode}
                    onChange={(e) => {
                      setExplode(Number(e.target.value));
                      setIsolate(false);
                    }}
                    className="w-full mt-1 accent-primary-500"
                    aria-valuetext={`${explode}% — ${sceneCaption.en}`}
                  />
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <button type="button" onClick={() => setExplode(0)} className="hover:text-gray-800">
                      Assembled / Lắp ráp
                    </button>
                    <button type="button" onClick={() => setExplode(100)} className="hover:text-gray-800">
                      Inventory / Kho linh kiện
                    </button>
                  </div>
                </div>
                <div className="pointer-events-auto flex items-center gap-1 bg-white/95 border border-gray-200 rounded-full shadow-card p-1 self-center sm:self-auto">
                  {VIEWS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      aria-pressed={view === v.key}
                      className={cx(
                        'px-3 py-1 text-[11px] font-medium rounded-full transition-colors',
                        view === v.key ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => viewerRef.current?.fitVisible()}
                    className="icon-btn !min-w-[30px] !min-h-[30px]"
                    aria-label="Fit visible parts / Vừa khung các chi tiết đang hiện"
                    title="Fit visible / Vừa khung"
                  >
                    <IconFocusCentered size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {dragOver && (
                <div className="absolute inset-0 bg-primary-50/80 border-2 border-dashed border-primary-500 flex items-center justify-center pointer-events-none">
                  <div className="text-[14px] font-semibold text-primary-700">
                    Drop to add / Thả để thêm vào cụm
                  </div>
                </div>
              )}
            </div>
          )}

          {fileErrors.length > 0 && (
            <div className="px-4 py-2 border-t border-red-200 bg-red-50">
              {fileErrors.map((f) => (
                <div key={f.name} className="text-xs text-red-700 flex items-start gap-1.5">
                  <IconAlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-medium">{f.name}</span> — {f.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {/* Systems panel — one switch per kind of part, like layers in CAD. */}
          <Card>
            <CardHeader
              title={`Systems · ${models.length} parts`}
              subtitle="Hệ thống — bật/tắt theo nhóm chi tiết"
              icon={<IconStack2 size={18} aria-hidden="true" />}
              action={
                models.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={showAllLayers}
                      className="text-[11px] px-2 py-1 rounded-md text-primary-600 hover:bg-primary-50"
                    >
                      All / Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={hideAllLayers}
                      className="text-[11px] px-2 py-1 rounded-md text-gray-600 hover:bg-gray-100"
                    >
                      Hide all / Ẩn hết
                    </button>
                  </div>
                )
              }
            />
            {restoredAt && models.length > 0 && (
              <div className="text-[11px] text-gray-600 mb-2">
                Restored from this computer · {new Date(restoredAt).toLocaleString()}
              </div>
            )}
            {models.length === 0 ? (
              <div className="text-xs text-gray-600 text-center py-4">
                No models loaded / Chưa có mô hình
              </div>
            ) : (
              <ul className="space-y-1 mb-3">
                {layerRows.map((l) => {
                  const on = !hidden.has(l.id);
                  return (
                    <li key={l.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-50">
                      <button
                        type="button"
                        onClick={() => onlyLayer(l.id)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        title="Show only this system / Chỉ hiện nhóm này"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: l.color }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className={cx('block text-[12px] truncate', on ? 'text-gray-800' : 'text-gray-500')}>
                            {l.en}
                          </span>
                          <span className="block text-[10px] text-gray-500 truncate">{l.vn}</span>
                        </span>
                      </button>
                      <span className="font-mono text-[11px] text-gray-600 tabular-nums">{l.count}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${on ? 'Hide' : 'Show'} ${l.en} / ${on ? 'Ẩn' : 'Hiện'} ${l.vn}`}
                        onClick={() => toggleLayer(l.id)}
                        className={cx(
                          'relative w-8 h-[18px] rounded-full transition-colors shrink-0',
                          on ? 'bg-primary-500' : 'bg-gray-300'
                        )}
                      >
                        <span
                          className={cx(
                            'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform',
                            on ? 'translate-x-[16px]' : 'translate-x-[2px]'
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {models.length > 0 && (
              <>
                <div className="relative mb-2">
                  <IconSearch
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a part / Tìm chi tiết…"
                    aria-label="Find a part by name or assembly / Tìm chi tiết theo tên"
                    className="input !pl-8 !pr-8 text-[12px]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn !min-w-[28px] !min-h-[28px]"
                      aria-label="Clear search / Xóa tìm kiếm"
                    >
                      <IconX size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="max-h-[260px] overflow-y-auto -mx-1 px-1">
                  {matches ? (
                    matches.length === 0 ? (
                      <div className="text-xs text-gray-600 text-center py-3">
                        No part matches / Không tìm thấy chi tiết
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {matches.slice(0, 60).map((m) => (
                          <PartRow
                            key={m.id}
                            model={m}
                            active={selectedId === m.id}
                            color={effectiveColor(m, colorMode)}
                            onSelect={() => selectPart(m.id)}
                            onToggle={() => toggleVisible(m.id)}
                            onRemove={() => removeModel(m.id)}
                            showPath
                          />
                        ))}
                        {matches.length > 60 && (
                          <li className="text-[11px] text-gray-600 text-center py-1">
                            +{matches.length - 60} more — refine the search / thu hẹp tìm kiếm
                          </li>
                        )}
                      </ul>
                    )
                  ) : (
                    listGroups.map(({ layer, items }) => {
                      const isCollapsed = !!collapsed[layer.id];
                      return (
                        <div key={layer.id} className="mb-1">
                          <button
                            type="button"
                            onClick={() => setCollapsed((c) => ({ ...c, [layer.id]: !isCollapsed }))}
                            aria-expanded={!isCollapsed}
                            className="w-full flex items-center gap-1.5 px-1 py-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                          >
                            {isCollapsed ? (
                              <IconChevronRight size={12} aria-hidden="true" />
                            ) : (
                              <IconChevronDown size={12} aria-hidden="true" />
                            )}
                            <span className="truncate">{layer.en}</span>
                            <span className="font-mono normal-case tracking-normal text-gray-500">{items.length}</span>
                          </button>
                          {!isCollapsed && (
                            <ul className="space-y-1">
                              {items.map((m) => (
                                <PartRow
                                  key={m.id}
                                  model={m}
                                  active={selectedId === m.id}
                                  color={effectiveColor(m, colorMode)}
                                  onSelect={() => selectPart(m.id)}
                                  onToggle={() => toggleVisible(m.id)}
                                  onRemove={() => removeModel(m.id)}
                                />
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Always available: adding files never clears what is loaded. */}
            <div className="mt-3">
              <FileUpload
                multiple
                compact
                onFiles={handleFiles}
                accept={ACCEPT}
                hint="Thêm file vào cụm lắp ráp"
              />
            </div>
          </Card>

          <CadFolderBrowser onOpenFiles={handleFiles} busy={!!progress} />

          {tree.roots.length > 0 && (
            <Card>
              <CardHeader
                title="Assembly tree"
                subtitle="Cây lắp ráp — nhấn để xem riêng một cụm con"
                icon={<IconSitemap size={18} aria-hidden="true" />}
                action={
                  focusPath && (
                    <button
                      type="button"
                      onClick={() => focusAssembly(null)}
                      className="text-[11px] px-2 py-1 rounded-md text-primary-600 hover:bg-primary-50"
                    >
                      Show all / Tất cả
                    </button>
                  )
                }
              />
              <ul className="space-y-0.5 max-h-[220px] overflow-y-auto -mx-1 px-1">
                {tree.roots.map((node) => (
                  <TreeNode
                    key={node.path.join('/')}
                    node={node}
                    depth={0}
                    focusPath={focusPath}
                    open={treeOpen}
                    onToggle={(key) => setTreeOpen((o) => ({ ...o, [key]: !o[key] }))}
                    onFocus={focusAssembly}
                  />
                ))}
              </ul>
              {tree.loose > 0 && (
                <div className="text-[11px] text-gray-600 mt-2">
                  +{tree.loose} loose part{tree.loose > 1 ? 's' : ''} (STL/OBJ) outside the tree
                  <span className="block">chi tiết rời không thuộc cây</span>
                </div>
              )}
            </Card>
          )}

          <Card>
            <CardHeader
              title="Selected part"
              subtitle="Chi tiết đang chọn"
              icon={<Icon3dCubeSphere size={18} aria-hidden="true" />}
              action={
                selected && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={toggleIsolate}
                      aria-pressed={isolate}
                      className={cx(
                        'text-[11px] px-2 py-1 rounded-md flex items-center gap-1',
                        isolate ? 'bg-primary-500 text-white' : 'text-primary-600 hover:bg-primary-50'
                      )}
                      title={isolate ? 'Show everything / Hiện tất cả' : 'Isolate this part / Chỉ hiện chi tiết này'}
                    >
                      <IconFocus2 size={13} aria-hidden="true" />
                      {isolate ? 'Show all' : 'Isolate'}
                    </button>
                    {selected.path.length > 0 && (
                      <button
                        type="button"
                        onClick={() => focusAssembly(selected.path)}
                        className="icon-btn !min-w-[28px] !min-h-[28px]"
                        aria-label="Focus this part's assembly / Xem cụm chứa chi tiết này"
                        title="Focus assembly / Xem cụm chứa"
                      >
                        <IconCornerLeftUp size={14} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => selectPart(null)}
                      className="icon-btn !min-w-[28px] !min-h-[28px]"
                      aria-label="Clear selection / Bỏ chọn"
                    >
                      <IconX size={14} aria-hidden="true" />
                    </button>
                  </div>
                )
              }
            />
            {!selected ? (
              <div className="text-xs text-gray-600 text-center py-6">
                Click a part in the viewport or the list
                <span className="block">Nhấn vào chi tiết trong khung nhìn hoặc danh sách</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[13px] font-semibold text-gray-900 break-words">{selected.name}</div>
                  {selected.path.length > 0 && (
                    <div className="text-[11px] text-gray-600 mt-0.5 break-words">
                      {selected.path.join(' › ')}
                    </div>
                  )}
                  {selected.sourceFile && selected.sourceFile !== selected.name && (
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate" title={selected.sourceFile}>
                      {selected.sourceFile}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="viewer-layer">
                    System / Hệ thống
                  </label>
                  <select
                    id="viewer-layer"
                    className="input mt-1 text-[12px]"
                    value={selected.layer}
                    onChange={(e) => patchModel(selected.id, { layer: e.target.value })}
                  >
                    {LAYERS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.en} / {l.vn}
                      </option>
                    ))}
                  </select>
                </div>

                {instanceCount > 1 && (
                  <Row label="Instances / Số lần dùng" value={`×${instanceCount} in assembly`} mono />
                )}
                <Row
                  label="Triangles"
                  value={(selected.positions.length / 9).toLocaleString()}
                  mono
                />
                <div>
                  <div className="label mb-2">Dimensions (mm)</div>
                  <div className="space-y-1.5">
                    <DimRow color="#ef4444" axis="X" value={selected.bbox.size.x} />
                    <DimRow color="#10b981" axis="Y" value={selected.bbox.size.y} />
                    <DimRow color="#1a6ff5" axis="Z" value={selected.bbox.size.z} />
                  </div>
                </div>
                <Row
                  label="Diagonal"
                  value={`${Math.hypot(
                    selected.bbox.size.x,
                    selected.bbox.size.y,
                    selected.bbox.size.z
                  ).toFixed(2)} mm`}
                  mono
                />
                {selectedStats && (
                  <>
                    <Row label="Volume" value={formatVolume(selectedStats.volumeMm3)} mono />
                    <Row label="Surface" value={`${(selectedStats.areaMm2 / 100).toFixed(1)} cm²`} mono />
                    {selectedStats.watertight === false && (
                      <div className="text-[11px] text-amber-600 flex items-start gap-1.5">
                        <IconAlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          Mesh is not closed — volume is approximate
                          <span className="block text-gray-600">Lưới hở — thể tích chỉ gần đúng</span>
                        </span>
                      </div>
                    )}
                  </>
                )}

                {models.length > 1 && totals && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="label mb-2">
                      Assembly · {visibleModels.length}/{models.length} visible
                    </div>
                    <Row label="Total triangles" value={totals.triangles.toLocaleString()} mono />
                    <Row
                      label="Overall size"
                      value={`${totals.size.x.toFixed(1)} × ${totals.size.y.toFixed(
                        1
                      )} × ${totals.size.z.toFixed(1)}`}
                      mono
                    />
                    {!!assemblyMassG && (
                      <Row label="Total mass" value={formatMass(assemblyMassG)} mono />
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          {selected && selectedStats && (
            <Card>
              <CardHeader
                title="Mass & cost"
                subtitle="Khối lượng & chi phí ước tính"
                icon={<IconWeight size={18} aria-hidden="true" />}
              />
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="viewer-material">
                    Material / Vật liệu
                  </label>
                  <select
                    id="viewer-material"
                    className="input mt-1 text-[12px]"
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                  >
                    {(settings.materials || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.en} / {m.vn}
                      </option>
                    ))}
                  </select>
                </div>

                <Row
                  label="Mass · this part"
                  value={
                    material
                      ? formatMass((selectedStats.volumeMm3 / 1000) * material.density)
                      : '—'
                  }
                  mono
                />
                {models.length > 1 && (
                  <Row label="Mass · assembly" value={formatMass(assemblyMassG)} mono />
                )}

                {quickQuote?.recommended ? (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="label mb-1.5">Suggested route · 1 pc</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-gray-800">
                        {quickQuote.recommended.process.en}
                        <span className="block text-[10px] text-gray-500">
                          {quickQuote.recommended.process.vn}
                        </span>
                      </span>
                      <span className="font-mono text-[13px] font-semibold text-primary-600 whitespace-nowrap">
                        {formatMoney(quickQuote.recommended.unitPrice, settings.commercial)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-gray-200 text-[11px] text-amber-700">
                    No workable process for this material — open Cost &amp; Quote to compare.
                    <span className="block text-gray-600">
                      Chưa có phương án khả thi với vật liệu này — mở trang Báo giá để so sánh.
                    </span>
                  </div>
                )}

                <Link
                  to="/quote"
                  className="flex items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[12px] font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <IconCalculator size={14} aria-hidden="true" />
                    Full quote / Báo giá chi tiết
                  </span>
                  <IconArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          )}

          {models.length > 0 && (
            <Card>
              <CardHeader
                title="Display"
                subtitle="Hiển thị"
                icon={<IconBoxModel size={18} aria-hidden="true" />}
              />
              <div className="space-y-3">
                <div>
                  <div className="label mb-2">Colour by / Tô màu theo</div>
                  <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
                    {[
                      { key: 'system', en: 'System', vn: 'Hệ thống' },
                      { key: 'file', en: 'CAD file', vn: 'Màu file' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setColorMode(opt.key)}
                        aria-pressed={colorMode === opt.key}
                        className={cx(
                          'flex-1 px-2 py-1 rounded-md text-[11px] transition-colors',
                          colorMode === opt.key ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {opt.en} <span className="opacity-80">/ {opt.vn}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {selected && (
                  <div>
                    <div className="label mb-2">Colour · {selected.name}</div>
                    <div className="flex gap-2 flex-wrap items-center">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => patchModel(selected.id, { color: c })}
                          aria-label={`Set colour ${c} for ${selected.name}`}
                          aria-pressed={selected.color === c}
                          className={cx(
                            'w-7 h-7 rounded-full border-2 transition-transform',
                            selected.color === c ? 'border-gray-800 scale-110' : 'border-white shadow'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      {selected.color && (
                        <button
                          type="button"
                          onClick={() => patchModel(selected.id, { color: null })}
                          className="text-[11px] text-primary-600 hover:underline"
                        >
                          Auto / Tự động
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => setWireframe(e.target.checked)}
                  />
                  <span className="text-[13px]">Wireframe / Khung dây</span>
                </label>
              </div>
            </Card>
          )}
        </div>
      </div>

      {visibleModels.length > 0 && (
        <DrawingPreview
          viewerRef={viewerRef}
          modelInfo={drawingInfo}
          sourceFile={sourceFile}
          onOpenSaveDialog={() => setSaveOpen(true)}
        />
      )}

      <SaveDrawingModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        viewerRef={viewerRef}
        sourceFile={sourceFile}
        modelInfo={drawingInfo}
      />

      <AssemblyBOMModal
        open={bomOpen}
        onClose={() => setBomOpen(false)}
        models={scopedModels}
        statsById={statsById}
        material={material}
        sourceFile={focusPath ? focusPath.join(' › ') : sourceFiles.length === 1 ? sourceFiles[0] : null}
      />
    </PageWrapper>
  );
}

function TreeNode({ node, depth, focusPath, open, onToggle, onFocus }) {
  const key = node.path.join('/');
  const hasChildren = node.children.length > 0;
  // Nodes start open down to the second level so a small tree is visible at once.
  const isOpen = open[key] ?? depth < 1;
  const isFocused =
    !!focusPath && focusPath.length === node.path.length && pathHasPrefix(node.path, focusPath);
  return (
    <li>
      <div
        className={cx(
          'flex items-center gap-1 rounded-md pr-1',
          isFocused ? 'bg-primary-50' : 'hover:bg-gray-50'
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(key)}
          className={cx('icon-btn !min-w-[22px] !min-h-[22px]', !hasChildren && 'invisible')}
          aria-label={isOpen ? 'Collapse / Thu gọn' : 'Expand / Mở rộng'}
          aria-expanded={hasChildren ? isOpen : undefined}
          tabIndex={hasChildren ? 0 : -1}
        >
          {isOpen ? (
            <IconChevronDown size={12} aria-hidden="true" />
          ) : (
            <IconChevronRight size={12} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onFocus(node.path)}
          aria-pressed={isFocused}
          className={cx(
            'flex-1 min-w-0 flex items-center justify-between gap-2 py-1 text-left text-[12px]',
            isFocused ? 'text-primary-700 font-semibold' : 'text-gray-800'
          )}
          title={`Focus ${node.name} / Xem riêng cụm ${node.name}`}
        >
          <span className="truncate">{node.name}</span>
          <span className="font-mono text-[10px] text-gray-600 shrink-0">{node.count}</span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.path.join('/')}
              node={child}
              depth={depth + 1}
              focusPath={focusPath}
              open={open}
              onToggle={onToggle}
              onFocus={onFocus}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function PartRow({ model: m, active, color, onSelect, onToggle, onRemove, showPath = false }) {
  return (
    <li>
      <div
        className={cx(
          'flex items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors',
          active ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="icon-btn shrink-0 !min-w-[28px] !min-h-[28px]"
          aria-pressed={m.visible}
          aria-label={`${m.visible ? 'Hide' : 'Show'} ${m.name} / ${m.visible ? 'Ẩn' : 'Hiện'}`}
        >
          {m.visible ? (
            <IconEye size={14} aria-hidden="true" />
          ) : (
            <IconEyeOff size={14} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          aria-current={active ? 'true' : undefined}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span
              className={cx(
                'block text-[12px] truncate',
                m.visible ? 'text-gray-800' : 'text-gray-500 line-through'
              )}
              title={m.name}
            >
              {m.name}
            </span>
            <span className="block text-[10px] text-gray-600 font-mono truncate">
              {showPath && m.path.length ? m.path.join(' › ') : `${(m.positions.length / 9).toLocaleString()} tri`}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="icon-btn shrink-0 !min-w-[28px] !min-h-[28px] text-red-500 hover:text-red-700"
          aria-label={`Remove ${m.name} / Xóa`}
        >
          <IconTrash size={13} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between text-[12px] gap-3">
      <span className="text-gray-600 shrink-0">{label}</span>
      <span className={cx('truncate', mono ? 'font-mono font-medium text-gray-900' : 'text-gray-900')}>
        {value}
      </span>
    </div>
  );
}

function DimRow({ color, axis, value }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="text-gray-600 w-4">{axis}</span>
      <span className="flex-1 font-mono font-medium text-gray-900">{value.toFixed(2)}</span>
      <span className="text-gray-600 text-[11px]">mm</span>
    </div>
  );
}
