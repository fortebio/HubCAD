import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { api, apiPaths } from '@/lib/api';
import { cx } from '@/lib/cx';
import {
  IconCamera,
  IconRulerMeasure,
  IconRefresh,
  IconBookmark,
  IconDeviceFloppy,
  IconDownload,
  IconChevronDown,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypeHtml,
  IconMarkdown,
  IconFileCode,
  IconVector,
  IconExternalLink,
} from '@tabler/icons-react';

const VIEW_DEFS = [
  { key: 'front', label: 'FRONT', vn: 'Hình chiếu đứng', field: 'viewFront' },
  { key: 'top', label: 'TOP', vn: 'Hình chiếu bằng', field: 'viewTop' },
  { key: 'right', label: 'SIDE', vn: 'Hình chiếu cạnh', field: 'viewSide' },
  { key: 'iso', label: 'ISO', vn: 'Hình chiếu trục đo', field: 'viewIso' },
];

const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: IconFileTypePdf, hint: 'Print-ready, watermark "PRELIMINARY" — chia sẻ với vendor/OEM' },
  { key: 'dxf', label: 'DXF (CAD)', icon: IconVector, hint: 'Mở trong SolidWorks / Fusion 360 / AutoCAD — gửi cho xưởng gia công' },
  { key: 'docx', label: 'Word / Google Docs', icon: IconFileTypeDocx, hint: 'Open in Word or upload to Drive → Google Docs' },
  { key: 'html', label: 'HTML', icon: IconFileTypeHtml, hint: 'Self-contained HTML page (review)' },
  { key: 'md', label: 'Markdown', icon: IconMarkdown, hint: 'Plain text, portable' },
];

function defaultDocNumber(sourceFile) {
  if (!sourceFile) return 'DWG-DRAFT';
  const base = sourceFile.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').toUpperCase();
  return `DWG-${base.slice(0, 20)}`;
}

async function uploadBlob(blob, fileName) {
  const fd = new FormData();
  fd.append('file', new File([blob], fileName, { type: 'image/png' }));
  const res = await api.upload(apiPaths.upload('image'), fd);
  return res.path;
}

async function downloadExportedDrawing(format, body) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`/api/export/drawing-from-views/${format}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const disp = res.headers.get('content-disposition') || '';
  const m = /filename="([^"]+)"/.exec(disp);
  const fileName = m ? m[1] : `drawing.${format}`;

  if (format === 'pdf' || format === 'html') {
    window.open(blobUrl, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function DrawingPreview({ viewerRef, modelInfo, sourceFile, onOpenSaveDialog }) {
  const [views, setViews] = useState({ front: null, top: null, right: null, iso: null });
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  const [meta, setMeta] = useState({
    docNumber: '',
    nameEn: '',
    nameVn: '',
    scale: '1:1',
    projection: 'third_angle',
    sheetSize: 'A4',
    templateId: 'iso-a4-landscape',
    material: '',
    treatment: '',
    surfaceFinish: '',
    tolerance: 'ISO 2768-mK',
    weight: '',
    designer: '',
    checker: '',
    approver: '',
    customer: '',
    standardRef: 'ISO 128 / ISO 7200',
    generalNotes: '',
    notes: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState('iso-a4-landscape');

  useEffect(() => {
    api
      .get(apiPaths.drawingTemplates)
      .then((r) => {
        setTemplates(r.templates || []);
        if (r.defaultId) {
          setDefaultTemplateId(r.defaultId);
          setMeta((m) => ({ ...m, templateId: m.templateId || r.defaultId }));
        }
      })
      .catch(() => {
        // server may not have endpoint yet — fall back silently
      });
  }, []);

  useEffect(() => {
    if (sourceFile && !meta.docNumber) {
      setMeta((m) => ({
        ...m,
        docNumber: defaultDocNumber(sourceFile),
        nameEn: sourceFile.replace(/\.[^.]+$/, ''),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFile]);

  useEffect(() => {
    if (!exportOpen) return;
    function onClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [exportOpen]);

  async function generate() {
    if (!viewerRef.current) {
      setError('Viewer not ready');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const next = { ...views };
      for (const v of VIEW_DEFS) {
        const blob = await viewerRef.current.captureView(v.key, { width: 600, height: 480 });
        if (blob) {
          if (next[v.key]) URL.revokeObjectURL(next[v.key]);
          next[v.key] = URL.createObjectURL(blob);
          setViews({ ...next });
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function exportDrawing(format) {
    setExportOpen(false);
    if (!viewerRef.current) {
      setError('Viewer not ready');
      return;
    }
    setExporting(format);
    setError(null);
    try {
      const paths = {};
      for (const v of VIEW_DEFS) {
        const blob = await viewerRef.current.captureView(v.key, { width: 900, height: 700 });
        if (!blob) throw new Error(`Failed to capture ${v.key}`);
        const path = await uploadBlob(blob, `dwg_${v.key}_${Date.now()}.png`);
        paths[v.field] = path;
      }
      const body = {
        ...paths,
        dimX: modelInfo?.dimX,
        dimY: modelInfo?.dimY,
        dimZ: modelInfo?.dimZ,
        triangles: modelInfo?.triangles,
        sourceFile: sourceFile || null,
        docNumber: meta.docNumber || defaultDocNumber(sourceFile),
        nameEn: meta.nameEn || (sourceFile || 'Untitled drawing'),
        nameVn: meta.nameVn || null,
        revision: '-',
        scale: meta.scale,
        projection: meta.projection,
        sheetSize: meta.sheetSize,
        templateId: meta.templateId || defaultTemplateId,
        tolerance: meta.tolerance || 'ISO 2768-mK',
        material: meta.material || null,
        treatment: meta.treatment || null,
        surfaceFinish: meta.surfaceFinish || null,
        weight: meta.weight ? Number(meta.weight) : null,
        designer: meta.designer || null,
        checker: meta.checker || null,
        approver: meta.approver || null,
        customer: meta.customer || null,
        standardRef: meta.standardRef || 'ISO 128 / ISO 7200',
        generalNotes: meta.generalNotes || null,
        notes: meta.notes || null,
      };
      await downloadExportedDrawing(format, body);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(null);
    }
  }

  const hasAny = Object.values(views).some(Boolean);

  return (
    <Card className="mt-4">
      <CardHeader
        title="Drawing / Bản vẽ kỹ thuật"
        subtitle="Xuất bản vẽ trực tiếp từ mô hình 3D — không cần tạo tài liệu trước"
        icon={<IconRulerMeasure size={18} />}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={generate} disabled={generating || !!exporting}>
              {hasAny ? <IconRefresh size={14} /> : <IconCamera size={14} />}
              {generating ? 'Capturing…' : hasAny ? 'Regenerate' : 'Generate views'}
            </Button>

            <div ref={exportRef} className="relative inline-block">
              <Button size="sm" onClick={() => setExportOpen((o) => !o)} disabled={!!exporting}>
                <IconDownload size={14} />
                {exporting ? `Exporting ${exporting.toUpperCase()}…` : 'Export drawing'}
                <IconChevronDown size={12} />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-modal z-30 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    Export as / Xuất dạng
                  </div>
                  {FORMATS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => exportDrawing(f.key)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <f.icon size={20} className="text-gray-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-gray-800">{f.label}</div>
                        <div className="text-[11px] text-gray-500 leading-tight">{f.hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="secondary" size="sm" onClick={onOpenSaveDialog} disabled={!!exporting}>
              <IconDeviceFloppy size={14} /> Save to doc
            </Button>
          </div>
        }
      />

      <div className="mb-3 p-3 border border-primary-200 rounded-lg bg-primary-50/40">
        <div className="flex items-start gap-2 mb-3 pb-3 border-b border-primary-200/60">
          <IconVector size={18} className="text-primary-600 mt-0.5 shrink-0" />
          <div className="text-[11px] text-gray-600 leading-relaxed flex-1">
            <span className="font-semibold text-primary-700">Workflow chuẩn hoá:</span> cùng một template →
            cùng layout, cùng title block khi xuất PDF (chia sẻ) · DXF (gia công) · DOCX/HTML/MD (review).
            Tải DXF/SVG bên dưới để dùng lại trong SolidWorks (Sheet format) hoặc Fusion 360 (Drawing → Import DWG).
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="md:col-span-3">
            <label className="label">Drawing template / Mẫu bản vẽ</label>
            <select
              className="input mt-1"
              value={meta.templateId}
              onChange={(e) => {
                const id = e.target.value;
                const t = templates.find((x) => x.id === id);
                setMeta({
                  ...meta,
                  templateId: id,
                  sheetSize: t?.sheet?.size || meta.sheetSize,
                });
              }}
            >
              {templates.length === 0 && <option value="iso-a4-landscape">ISO A4 Landscape · ISO 7200</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.source === 'custom' ? ' · custom' : ''}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-gray-500 mt-1">
              {templates.find((x) => x.id === meta.templateId)?.description ||
                'Sheet size + view layout + title block (ISO 7200). Manager có thể upload thêm template qua API /api/drawing-templates.'}
            </div>
          </div>
          <div>
            <label className="label">Projection</label>
            <select className="input mt-1" value={meta.projection} onChange={(e) => setMeta({ ...meta, projection: e.target.value })}>
              <option value="third_angle">3rd angle (ISO/US)</option>
              <option value="first_angle">1st angle (EU)</option>
            </select>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-primary-200/60 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Template assets · Tải để dùng trong CAD
          </span>
          <a
            href={`/api/drawing-templates/${meta.templateId}/backdrop.svg?projection=${meta.projection}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-white text-gray-700"
            title="Open SVG preview (Illustrator / Inkscape / browser)"
          >
            <IconFileCode size={13} /> SVG
            <IconExternalLink size={11} />
          </a>
          <a
            href={`/api/drawing-templates/${meta.templateId}/backdrop.dxf?projection=${meta.projection}`}
            className="text-[12px] inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-white text-gray-700"
            title="Download DXF — Insert into SolidWorks Sheet Format, or Fusion 360 Drawing"
          >
            <IconVector size={13} /> DXF · SolidWorks / Fusion / AutoCAD
          </a>
          <a
            href={`/api/drawing-templates/${meta.templateId}`}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-white text-gray-600"
            title="View template JSON config"
          >
            <IconFileCode size={13} /> JSON
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div>
          <label className="label">Doc number</label>
          <input
            className="input mt-1 font-mono"
            value={meta.docNumber}
            onChange={(e) => setMeta({ ...meta, docNumber: e.target.value })}
            placeholder="DWG-DRAFT"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Name (EN)</label>
          <input
            className="input mt-1"
            value={meta.nameEn}
            onChange={(e) => setMeta({ ...meta, nameEn: e.target.value })}
            placeholder="Top cover"
          />
        </div>
        <div>
          <label className="label">Scale</label>
          <select className="input mt-1" value={meta.scale} onChange={(e) => setMeta({ ...meta, scale: e.target.value })}>
            <option>1:1</option><option>1:2</option><option>1:5</option><option>1:10</option>
            <option>2:1</option><option>5:1</option><option>10:1</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Tên (VN)</label>
          <input
            className="input mt-1"
            value={meta.nameVn}
            onChange={(e) => setMeta({ ...meta, nameVn: e.target.value })}
            placeholder="Nắp trên"
          />
        </div>
        <div>
          <label className="label">Material / Vật liệu</label>
          <input
            className="input mt-1"
            value={meta.material}
            onChange={(e) => setMeta({ ...meta, material: e.target.value })}
            placeholder="AL-6061"
          />
        </div>
        <div>
          <label className="label">Sheet</label>
          <input className="input mt-1 font-mono" value={meta.sheetSize} readOnly />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="text-[11px] text-primary-500 hover:underline mb-2"
      >
        {showAdvanced ? '▾ Hide' : '▸ Show'} title-block fields / Khung tên đầy đủ (ISO 7200)
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <div>
            <label className="label">Mass / Khối lượng (g)</label>
            <input
              type="number"
              step="0.01"
              className="input mt-1 font-mono"
              value={meta.weight}
              onChange={(e) => setMeta({ ...meta, weight: e.target.value })}
              placeholder="—"
            />
          </div>
          <div>
            <label className="label">Treatment / Xử lý nhiệt</label>
            <input
              className="input mt-1"
              value={meta.treatment}
              onChange={(e) => setMeta({ ...meta, treatment: e.target.value })}
              placeholder="None / Anneal / Heat-treat"
            />
          </div>
          <div>
            <label className="label">Surface finish / Bề mặt</label>
            <input
              className="input mt-1"
              value={meta.surfaceFinish}
              onChange={(e) => setMeta({ ...meta, surfaceFinish: e.target.value })}
              placeholder="Ra 3.2 / anodized"
            />
          </div>
          <div>
            <label className="label">Tolerance</label>
            <input
              className="input mt-1"
              value={meta.tolerance}
              onChange={(e) => setMeta({ ...meta, tolerance: e.target.value })}
              placeholder="ISO 2768-mK"
            />
          </div>
          <div>
            <label className="label">Standard ref</label>
            <input
              className="input mt-1"
              value={meta.standardRef}
              onChange={(e) => setMeta({ ...meta, standardRef: e.target.value })}
              placeholder="ISO 128 / ISO 7200"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Customer / Khách hàng</label>
            <input
              className="input mt-1"
              value={meta.customer}
              onChange={(e) => setMeta({ ...meta, customer: e.target.value })}
              placeholder="Internal · Forte Biotech"
            />
          </div>
          <div>
            <label className="label">Designer / Thiết kế</label>
            <input
              className="input mt-1"
              value={meta.designer}
              onChange={(e) => setMeta({ ...meta, designer: e.target.value })}
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="label">Checker / Kiểm tra</label>
            <input
              className="input mt-1"
              value={meta.checker}
              onChange={(e) => setMeta({ ...meta, checker: e.target.value })}
              placeholder="Trần Thị B"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Approver / Phê duyệt</label>
            <input
              className="input mt-1"
              value={meta.approver}
              onChange={(e) => setMeta({ ...meta, approver: e.target.value })}
              placeholder="Lê Văn C"
            />
          </div>
          <div className="md:col-span-4">
            <label className="label">General notes / Ghi chú chung (mỗi dòng = 1 mục)</label>
            <textarea
              className="input mt-1 font-mono text-[11px]"
              rows={4}
              value={meta.generalNotes}
              onChange={(e) => setMeta({ ...meta, generalNotes: e.target.value })}
              placeholder={'Vát mép tất cả các cạnh sắc 0.5 mm.\nKhử bavia toàn bộ.\nKhông được có vết xước nhìn thấy bằng mắt thường.\nKiểm tra kích thước theo ISO 2768-mK.'}
            />
          </div>
          <div className="md:col-span-4">
            <label className="label">Free-form notes / Ghi chú tự do</label>
            <textarea
              className="input mt-1"
              rows={2}
              value={meta.notes}
              onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
              placeholder="Additional remarks for this revision"
            />
          </div>
        </div>
      )}

      {!hasAny && !generating ? (
        <Empty
          icon={<IconBookmark size={36} />}
          title="No views yet"
          hint='Bấm "Generate views" để chụp 4 hình chiếu, hoặc bấm thẳng "Export drawing" để app tự capture + xuất file ngay.'
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {VIEW_DEFS.map((v) => (
              <div key={v.key} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex flex-col">
                <div className="aspect-[4/3] flex items-center justify-center bg-white">
                  {views[v.key] ? (
                    <img src={views[v.key]} alt={v.label} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-xs text-gray-400">{generating ? 'Capturing…' : '— pending —'}</div>
                  )}
                </div>
                <div className="px-3 py-1.5 border-t border-gray-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-800">{v.label}</span>
                  <span className="text-gray-500">{v.vn}</span>
                </div>
              </div>
            ))}
          </div>

          {modelInfo && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-[12px] flex-wrap gap-2">
              <div className="flex items-center gap-4 text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  X <span className="mono font-medium text-gray-900">{modelInfo.dimX?.toFixed(2)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Y <span className="mono font-medium text-gray-900">{modelInfo.dimY?.toFixed(2)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Z <span className="mono font-medium text-gray-900">{modelInfo.dimZ?.toFixed(2)}</span>
                </span>
                <span className="text-gray-500">mm</span>
              </div>
              <div className="text-gray-500 mono">{modelInfo.triangles?.toLocaleString()} triangles</div>
            </div>
          )}
        </>
      )}

      <div className={cx('mt-3 text-[11px] text-gray-500 leading-relaxed')}>
        <strong>Export drawing</strong>: xuất file ngay (PDF / Word / HTML / Markdown) mà không cần tạo tài liệu — dùng để gửi nhanh cho vendor / OEM.{' '}
        <strong>Save to doc</strong>: lưu 4 view + metadata vào machining document để theo dõi revision và xuất từ DocTracker.
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-600 border-t border-red-100 pt-2">{error}</div>
      )}
    </Card>
  );
}
