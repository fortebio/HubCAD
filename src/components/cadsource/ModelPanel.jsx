import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconCube,
  IconLoader2,
  IconAlertTriangle,
  IconFocusCentered,
  IconGridDots,
  IconEye,
  IconEyeOff,
  IconCode,
} from '@tabler/icons-react';
import { STLViewer } from '@/components/viewer/STLViewer';
import { Empty } from '@/components/ui/Empty';
import { api, apiPaths } from '@/lib/api';
import { parseCadParts } from '@/lib/parseCadFile';
import { classifyPart, layerById, LAYERS } from '@/lib/assemblyLayers';
import { toast } from '@/stores/useToastStore';
import { cx } from '@/lib/cx';

const VIEWS = [
  { key: 'iso', label: 'ISO' },
  { key: 'front', label: 'Front' },
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
];

const LAYER_ORDER = LAYERS.map((l) => l.id);

/**
 * The model a script produces, beside the script itself.
 *
 * Part ids are the STEP `PRODUCT` names, which CadQuery writes from the keys of
 * the dict `build()` returns — so a pick in the viewport is directly the name
 * the parameter index can resolve to a source line.
 */
export function ModelPanel({ rel, onPickPart, selectedName = null, className = '' }) {
  const [state, setState] = useState({ status: 'idle', parts: [], error: null, ms: 0 });
  const [view, setView] = useState('iso');
  const [wireframe, setWireframe] = useState(false);
  const [hidden, setHidden] = useState([]);
  const viewerRef = useRef(null);
  const loadedRel = useRef(null);

  const load = useCallback(async (target) => {
    loadedRel.current = target;
    setState({ status: 'loading', parts: [], error: null, ms: 0 });
    const t0 = performance.now();
    try {
      const blob = await api.blob(apiPaths.cadRaw(target));
      const file = new File([blob], target.split('/').pop(), { type: '' });
      const parsed = await parseCadParts(file);
      if (loadedRel.current !== target) return; // a newer load won
      if (!parsed.length) throw new Error('No geometry found in this file');

      const parts = parsed.map((p, i) => ({
        id: `${p.name}::${i}`,
        name: p.name,
        path: p.path,
        positions: p.positions,
        color: p.color,
        layer: classifyPart(p),
        visible: true,
      }));
      setState({ status: 'ready', parts, error: null, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      if (loadedRel.current !== target) return;
      setState({ status: 'error', parts: [], error: e.message, ms: 0 });
    }
  }, []);

  useEffect(() => {
    if (!rel) {
      loadedRel.current = null;
      setState({ status: 'idle', parts: [], error: null, ms: 0 });
      return;
    }
    load(rel);
  }, [rel, load]);

  // Selection comes from the parameter side as a name; the viewer wants an id.
  const selectedId = selectedName
    ? state.parts.find((p) => p.name === selectedName)?.id || null
    : null;

  const hiddenSet = new Set(hidden);
  const models = state.parts.map((p) => ({
    id: p.id,
    positions: p.positions,
    color: p.color || layerById(p.layer).color,
    visible: !hiddenSet.has(p.layer),
    layer: p.layer,
  }));

  // One row per system present, so a 66-body assembly stays manageable.
  const layerRows = LAYERS.map((l) => ({
    ...l,
    count: state.parts.filter((p) => p.layer === l.id).length,
  })).filter((l) => l.count > 0);

  function handlePick(id) {
    const part = state.parts.find((p) => p.id === id);
    onPickPart?.(part ? part.name : null);
  }

  if (!rel) {
    return (
      <div className={cx('flex items-center justify-center', className)}>
        <Empty
          icon={<IconCube size={32} />}
          title="No model yet / Chưa có mô hình"
          hint="Chọn một file STEP, hoặc mở script đã xuất assembly."
        />
      </div>
    );
  }

  return (
    <div className={cx('flex flex-col min-h-0', className)}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-200 shrink-0 flex-wrap">
        <IconCube size={14} className="text-primary-600 shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-mono text-gray-700 truncate min-w-0" title={rel}>
          {rel.split('/').pop()}
        </span>
        {state.status === 'ready' && (
          <span className="text-[11px] text-gray-500 shrink-0">
            {state.parts.length} body · {(state.ms / 1000).toFixed(1)}s
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cx(
                'px-2 py-1 text-[10px] rounded border transition-colors min-h-[24px]',
                view === v.key
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {v.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setWireframe((w) => !w)}
            aria-pressed={wireframe}
            className={cx(
              'icon-btn !min-w-[24px] !min-h-[24px]',
              wireframe && 'text-primary-600 bg-primary-50'
            )}
            aria-label="Wireframe / Khung dây"
          >
            <IconGridDots size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => viewerRef.current?.fitVisible()}
            className="icon-btn !min-w-[24px] !min-h-[24px]"
            aria-label="Fit visible / Vừa khung"
          >
            <IconFocusCentered size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {layerRows.length > 1 && state.status === 'ready' && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 overflow-x-auto shrink-0">
          {layerRows.map((l) => {
            const off = hiddenSet.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  setHidden((h) => (h.includes(l.id) ? h.filter((x) => x !== l.id) : [...h, l.id]))
                }
                aria-pressed={!off}
                className={cx(
                  'flex items-center gap-1 px-2 py-1 rounded text-[10px] border whitespace-nowrap transition-colors min-h-[24px]',
                  off ? 'border-gray-200 text-gray-500' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                )}
                title={`${l.en} / ${l.vn}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: off ? '#d1d5db' : l.color }}
                  aria-hidden="true"
                />
                {l.en}
                <span className="font-mono text-gray-500">{l.count}</span>
                {off ? <IconEyeOff size={9} aria-hidden="true" /> : <IconEye size={9} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        {state.status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <IconLoader2 size={20} className="animate-spin mx-auto text-primary-600" aria-hidden="true" />
              <p className="text-[12px] text-gray-600 mt-2">Parsing model… / Đang đọc mô hình…</p>
              <p className="text-[11px] text-gray-500">STEP dùng OpenCascade WASM — lần đầu hơi lâu</p>
            </div>
          </div>
        )}
        {state.status === 'error' ? (
          <Empty
            icon={<IconAlertTriangle size={32} className="text-amber-500" />}
            title="Could not open the model"
            hint={state.error}
          />
        ) : (
          <STLViewer
            ref={viewerRef}
            models={models}
            wireframe={wireframe}
            view={view}
            explode={0}
            selectedId={selectedId}
            onPick={handlePick}
            groupOrder={LAYER_ORDER}
          />
        )}

        {selectedName && (
          <div className="absolute left-2 bottom-2 px-2 py-1 rounded-md bg-white/95 border border-gray-200 shadow-sm max-w-[80%]">
            <div className="flex items-center gap-1.5">
              <IconCode size={12} className="text-primary-600 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-mono truncate">{selectedName}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
