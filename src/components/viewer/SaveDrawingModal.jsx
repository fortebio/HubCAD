import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { api, apiPaths } from '@/lib/api';
import {
  IconCamera,
  IconAlertCircle,
  IconCircleCheck,
} from '@tabler/icons-react';

const VIEW_KEYS = ['front', 'top', 'right', 'iso'];
const VIEW_FIELDS = {
  front: 'viewFront',
  top: 'viewTop',
  right: 'viewSide',
  iso: 'viewIso',
};

async function uploadBlob(blob, fileName) {
  const fd = new FormData();
  fd.append('file', new File([blob], fileName, { type: 'image/png' }));
  const res = await api.upload(apiPaths.upload('image'), fd);
  return res.path;
}

export function SaveDrawingModal({ open, onClose, viewerRef, sourceFile, modelInfo }) {
  const [docId, setDocId] = useState(null);
  const [createNew, setCreateNew] = useState(false);
  const [newDoc, setNewDoc] = useState({
    docNumber: '',
    nameEn: '',
    nameVn: '',
    revision: '-',
  });
  const [meta, setMeta] = useState({
    scale: '1:1',
    projection: 'third_angle',
    tolerance: 'ISO 2768-mK',
    material: '',
    surfaceFinish: '',
    notes: '',
    templateId: 'iso-a4-landscape',
  });
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!open) return;
    api.get(apiPaths.drawingTemplates).then((r) => setTemplates(r.templates || [])).catch(() => {});
  }, [open]);

  // Carry the material picked for the mass estimate into the title block.
  useEffect(() => {
    if (!open || !modelInfo?.material) return;
    setMeta((m) => (m.material ? m : { ...m, material: modelInfo.material }));
  }, [open, modelInfo?.material]);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  function reset() {
    setDocId(null);
    setCreateNew(false);
    setNewDoc({ docNumber: '', nameEn: '', nameVn: '', revision: '-' });
    setMeta({
      scale: '1:1',
      projection: 'third_angle',
      tolerance: 'ISO 2768-mK',
      material: '',
      surfaceFinish: '',
      notes: '',
      templateId: 'iso-a4-landscape',
    });
    setProgress('');
    setError(null);
    setBusy(false);
  }

  async function onSave() {
    setError(null);
    if (!viewerRef.current) {
      setError('Viewer not ready');
      return;
    }
    let targetDocId = docId;

    setBusy(true);
    try {
      if (createNew) {
        if (!newDoc.docNumber || !newDoc.nameEn) {
          throw new Error('Doc number and English name are required');
        }
        setProgress('Creating document…');
        const res = await api.post(apiPaths.documents, {
          ...newDoc,
          docType: 'machining',
        });
        targetDocId = res.document.id;
      }
      if (!targetDocId) throw new Error('Pick a document or create a new one');

      const viewPaths = {};
      for (let i = 0; i < VIEW_KEYS.length; i++) {
        const k = VIEW_KEYS[i];
        setProgress(`Capturing ${k.toUpperCase()} view (${i + 1}/4)…`);
        const blob = await viewerRef.current.captureView(k, { width: 900, height: 700 });
        if (!blob) throw new Error(`Failed to capture ${k} view`);
        setProgress(`Uploading ${k.toUpperCase()} view…`);
        const path = await uploadBlob(blob, `view_${k}.png`);
        viewPaths[VIEW_FIELDS[k]] = path;
      }

      setProgress('Saving drawing sheet…');
      const tpl = templates.find((x) => x.id === meta.templateId);
      await api.put(`/drawings/sheet/by-document/${targetDocId}`, {
        ...viewPaths,
        dimX: modelInfo?.dimX,
        dimY: modelInfo?.dimY,
        dimZ: modelInfo?.dimZ,
        triangles: modelInfo?.triangles,
        // Mass comes from the viewer's volume × the chosen material density.
        weight: modelInfo?.weight ?? null,
        sourceFile,
        scale: meta.scale,
        projection: meta.projection,
        tolerance: meta.tolerance,
        material: meta.material || null,
        surfaceFinish: meta.surfaceFinish || null,
        notes: meta.notes || null,
        templateId: meta.templateId,
        sheetSize: tpl?.sheet?.size || 'A4',
      });

      setProgress('Done!');
      setBusy(false);
      setTimeout(() => {
        reset();
        onClose();
        nav('/tracker');
      }, 500);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) {
          reset();
          onClose();
        }
      }}
      title="Save as drawing"
      subtitle="Lưu thành bản vẽ — capture 4 hình chiếu (front / top / side / iso)"
      maxWidth="640px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => { reset(); onClose(); }} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={busy}>
            <IconCamera size={14} /> {busy ? 'Capturing…' : 'Capture & save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={!createNew}
              onChange={() => setCreateNew(false)}
            />
            <span>Attach to existing document</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              checked={createNew}
              onChange={() => setCreateNew(true)}
            />
            <span>Create new machining document</span>
          </label>
        </div>

        {createNew ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Doc number *</label>
              <input
                className="input mt-1 font-mono"
                value={newDoc.docNumber}
                onChange={(e) => setNewDoc({ ...newDoc, docNumber: e.target.value })}
                placeholder="DWG-HSG-005"
              />
            </div>
            <div>
              <label className="label">Name (EN) *</label>
              <input
                className="input mt-1"
                value={newDoc.nameEn}
                onChange={(e) => setNewDoc({ ...newDoc, nameEn: e.target.value })}
                placeholder="Top cover"
              />
            </div>
            <div>
              <label className="label">Tên (VN)</label>
              <input
                className="input mt-1"
                value={newDoc.nameVn}
                onChange={(e) => setNewDoc({ ...newDoc, nameVn: e.target.value })}
                placeholder="Nắp trên"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="label">Target document / Tài liệu bản vẽ</label>
            <DocumentPicker value={docId} onChange={setDocId} filterType="machining" className="mt-1" />
          </div>
        )}

        <div>
          <label className="label">Drawing template / Mẫu bản vẽ</label>
          <select
            className="input mt-1"
            value={meta.templateId}
            onChange={(e) => setMeta({ ...meta, templateId: e.target.value })}
          >
            {templates.length === 0 && <option value="iso-a4-landscape">ISO A4 Landscape · ISO 7200</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.source === 'custom' ? ' · custom' : ''}</option>
            ))}
          </select>
          <div className="text-[11px] text-gray-500 mt-1">
            {templates.find((x) => x.id === meta.templateId)?.description || ''}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Scale</label>
            <select className="input mt-1" value={meta.scale} onChange={(e) => setMeta({ ...meta, scale: e.target.value })}>
              <option>1:1</option><option>1:2</option><option>1:5</option><option>1:10</option>
              <option>2:1</option><option>5:1</option><option>10:1</option>
            </select>
          </div>
          <div>
            <label className="label">Projection</label>
            <select className="input mt-1" value={meta.projection} onChange={(e) => setMeta({ ...meta, projection: e.target.value })}>
              <option value="third_angle">3rd angle (ISO)</option>
              <option value="first_angle">1st angle</option>
            </select>
          </div>
          <div>
            <label className="label">Tolerance</label>
            <input className="input mt-1" value={meta.tolerance} onChange={(e) => setMeta({ ...meta, tolerance: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Material / Vật liệu</label>
            <input className="input mt-1" value={meta.material} onChange={(e) => setMeta({ ...meta, material: e.target.value })} placeholder="AL-6061, ABS, ..." />
          </div>
          <div>
            <label className="label">Surface finish / Xử lý bề mặt</label>
            <input className="input mt-1" value={meta.surfaceFinish} onChange={(e) => setMeta({ ...meta, surfaceFinish: e.target.value })} placeholder="Ra 3.2, anodized, ..." />
          </div>
        </div>

        <div>
          <label className="label">Notes / Ghi chú</label>
          <textarea
            className="input mt-1"
            rows={2}
            value={meta.notes}
            onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            placeholder="General notes for the drawing sheet"
          />
        </div>

        {modelInfo && (
          <div className="text-[11px] text-gray-500 border-t border-gray-200 pt-2">
            Model: <span className="mono">{modelInfo.dimX?.toFixed(2)} × {modelInfo.dimY?.toFixed(2)} × {modelInfo.dimZ?.toFixed(2)} mm</span>
            {' · '}
            <span className="mono">{modelInfo.triangles?.toLocaleString()} triangles</span>
          </div>
        )}

        {progress && (
          <div className="text-xs text-primary-600 flex items-center gap-1.5">
            <IconCircleCheck size={14} /> {progress}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 flex items-center gap-1.5">
            <IconAlertCircle size={14} /> {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
