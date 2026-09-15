import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, THead, TR, TH } from '@/components/ui/Table';
import { FileUpload } from '@/components/ui/FileUpload';
import { Empty } from '@/components/ui/Empty';
import { QuotePartRow } from '@/components/quote/QuotePartRow';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { useCostStore } from '@/stores/useCostStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { api, apiPaths } from '@/lib/api';
import { postDownload } from '@/lib/pdfDownload';
import { parseCadFile, CAD_ACCEPT } from '@/lib/parseCadFile';
import { computeMeshStats } from '@/lib/massProperties';
import { estimateQuote } from '@/lib/costing/estimate';
import { formatMass, formatMoney, formatMoneyBoth } from '@/lib/costing/format';
import { loadViewerSession, QUOTE_SCOPE_KEY } from '@/lib/viewerSession';
import { usePref } from '@/lib/useLocalMemory';
import { readPref, removePref } from '@/lib/localMemory';
import { parsePartNumber } from '@/lib/partNumber';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { cx } from '@/lib/cx';
import {
  IconCalculator,
  IconCube,
  IconCoin,
  IconWeight,
  IconClock,
  IconDeviceFloppy,
  IconFileText,
  IconFileSpreadsheet,
  IconRefresh,
  IconTrash,
  IconAdjustments,
  IconReceipt2,
  IconAlertTriangle,
  IconStack2,
} from '@tabler/icons-react';

const EMPTY_META = {
  quoteNumber: '',
  title: 'Manufacturing quotation / Báo giá gia công',
  customer: '',
  project: '',
  preparedBy: '',
  documentId: null,
  currency: 'VND',
  applyVat: false,
  sets: 1,
  validDays: 30,
  notesEn: '',
  notesVn: '',
};

const stripExt = (name) => String(name || '').replace(/\.[^.]+$/, '');

let seq = 0;
const nextId = () => `part-${Date.now().toString(36)}-${++seq}`;

export function QuoteEstimator() {
  const settings = useCostStore((s) => s.settings);
  const settingsLoaded = useCostStore((s) => s.loaded);
  const isDefaultRates = useCostStore((s) => s.isDefault);
  const fetchSettings = useCostStore((s) => s.fetch);
  const user = useAuthStore((s) => s.user);

  // Remembered on this computer so a reload does not lose the working quote.
  const [parts, setParts] = usePref('quote:parts', []);
  const [meta, setMeta] = usePref('quote:meta', EMPTY_META);
  const [expandedId, setExpandedId] = useState(null);
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [currentQuoteId, setCurrentQuoteId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoImported = useRef(false);

  useEffect(() => {
    fetchSettings();
    refreshSaved();
  }, [fetchSettings]);

  // "/quote?from=viewer" — the 3D viewer's "Quote assembly" button: pull the
  // parts in straight away, then drop the flag so a reload does not re-import.
  useEffect(() => {
    if (searchParams.get('from') !== 'viewer' || autoImported.current) return;
    autoImported.current = true;
    setSearchParams({}, { replace: true });
    importFromViewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per arrival.
  }, [searchParams]);

  // A fresh quote gets the next number and the signed-in engineer's name.
  useEffect(() => {
    if (meta.quoteNumber) return;
    api
      .get(apiPaths.quoteNextNumber)
      .then((r) =>
        setMeta((m) => ({
          ...m,
          quoteNumber: m.quoteNumber || r.quoteNumber,
          preparedBy: m.preparedBy || user?.fullName || user?.username || '',
        }))
      )
      .catch(() => {});
  }, [meta.quoteNumber, setMeta, user]);

  async function refreshSaved() {
    try {
      const res = await api.get(apiPaths.quotes);
      setSavedQuotes(res.quotes || []);
    } catch {
      /* the list is a convenience; quoting still works without it */
    }
  }

  const effectiveSettings = useMemo(
    () => ({
      ...settings,
      commercial: {
        ...settings.commercial,
        currency: meta.currency,
        applyVat: meta.applyVat,
      },
    }),
    [settings, meta.currency, meta.applyVat]
  );
  const commercial = effectiveSettings.commercial;

  const quote = useMemo(
    () => estimateQuote({ parts, settings: effectiveSettings, sets: meta.sets }),
    [parts, effectiveSettings, meta.sets]
  );

  const patchPart = useCallback(
    (id, patch) => setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [setParts]
  );

  const removePart = useCallback(
    (id) => setParts((prev) => prev.filter((p) => p.id !== id)),
    [setParts]
  );

  /** Pull whatever is currently loaded in the 3D viewer on this computer. */
  async function importFromViewer({ quiet = false } = {}) {
    // Importing replaces the list, so never throw away configured parts silently.
    if (parts.length) {
      const ok = await confirmDialog({
        title: 'Replace the parts in this quote? / Thay toàn bộ chi tiết?',
        message: `The ${parts.length} part(s) below — and the materials and processes chosen for them — will be replaced by what is open in the 3D viewer.`,
        detail: `${parts.length} chi tiết hiện có cùng vật liệu và phương án gia công đã chọn sẽ bị thay bằng nội dung đang mở trong 3D Viewer.`,
        confirmLabel: 'Replace / Thay thế',
      });
      if (!ok) return;
    }
    setImporting(true);
    try {
      const session = await loadViewerSession();
      if (!session?.models?.length) {
        if (!quiet) {
          toast.info(
            'Nothing loaded in the 3D viewer',
            'Chưa có mô hình nào trong 3D Viewer — mở 3D Viewer và tải file trước'
          );
        }
        return;
      }
      // The viewer may have asked for just a sub-assembly; honour that once.
      const scope = readPref(QUOTE_SCOPE_KEY, null);
      removePref(QUOTE_SCOPE_KEY);
      const scopeIds = scope?.ids?.length ? new Set(scope.ids) : null;
      const inScope = session.models.filter((m) => !scopeIds || scopeIds.has(m.id));

      // A STEP assembly places the same body many times; the quote wants one
      // line per body with the quantity, and standard hardware is bought, not
      // machined, so it is left out (the BOM keeps it).
      const lines = new Map();
      let hardware = 0;
      for (const m of inScope) {
        if (m.layer === 'fastener') {
          hardware += 1;
          continue;
        }
        const name = stripExt(m.name).trim();
        const key = name.toLowerCase();
        if (!lines.has(key)) {
          const parsed = parsePartNumber(name.split(/[\s_]/)[0]);
          lines.set(key, {
            id: nextId(),
            name,
            partNumber: parsed ? name.split(/[\s_]/)[0] : '',
            stats: computeMeshStats(m.positions, m.bbox),
            materialId: 'auto',
            processId: 'auto',
            finishId: 'none',
            qtyPerSet: 0,
          });
        }
        lines.get(key).qtyPerSet += 1;
      }
      const imported = [...lines.values()];
      if (!imported.length) {
        toast.info(
          'Only standard hardware in the viewer — nothing to price',
          'Trong 3D Viewer chỉ có bu lông/đai ốc tiêu chuẩn — không có gì để báo giá'
        );
        return;
      }
      setParts(imported);
      if (scope?.label) setMeta((mt) => ({ ...mt, project: mt.project || scope.label }));
      const pieces = imported.reduce((n, p) => n + p.qtyPerSet, 0);
      toast.success(
        `Loaded ${imported.length} line${imported.length > 1 ? 's' : ''} (${pieces} pcs) from the 3D viewer${
          hardware ? ` · ${hardware} fasteners skipped` : ''
        }`,
        `Đã lấy ${imported.length} dòng (${pieces} chi tiết) từ 3D Viewer${
          hardware ? ` · bỏ qua ${hardware} bu lông/đai ốc tiêu chuẩn` : ''
        }`
      );
    } catch (e) {
      toast.error('Could not read the viewer session / Không đọc được phiên 3D', e.message);
    } finally {
      setImporting(false);
    }
  }

  /** Add CAD files straight into the quote, without going through the viewer. */
  async function handleFiles(input) {
    const files = Array.isArray(input) ? input : [input];
    if (!files.length) return;
    setImporting(true);
    const added = [];
    const failed = [];
    for (const file of files) {
      try {
        const positions = await parseCadFile(file);
        if (!positions?.length) throw new Error('No geometry found in this file');
        added.push({
          id: nextId(),
          name: stripExt(file.name),
          partNumber: '',
          stats: computeMeshStats(positions),
          materialId: 'auto',
          processId: 'auto',
          finishId: 'none',
          qtyPerSet: 1,
        });
      } catch (e) {
        failed.push(`${file.name}: ${e.message}`);
      }
    }
    setImporting(false);
    if (added.length) {
      setParts((prev) => [...prev, ...added]);
      toast.success(
        `Added ${added.length} part${added.length > 1 ? 's' : ''}`,
        `Đã thêm ${added.length} chi tiết vào báo giá`
      );
    }
    if (failed.length) toast.error('Some files could not be read', failed.join(' · '));
  }

  function buildPayload() {
    return {
      meta: {
        ...meta,
        companyName: settings.commercial.companyName,
        usdRate: settings.commercial.usdRate,
        vatPct: settings.commercial.vatPct,
        createdAt: new Date().toISOString(),
      },
      rows: quote.rows.map((r) => ({
        name: r.name,
        partNumber: r.partNumber,
        processId: r.estimate.processId,
        processEn: r.estimate.process?.en,
        processVn: r.estimate.process?.vn,
        materialId: r.estimate.materialId,
        materialEn: r.estimate.material?.en,
        materialVn: r.estimate.material?.vn,
        finishEn: r.estimate.finish && r.estimate.finish.id !== 'none' ? r.estimate.finish.en : '',
        finishVn: r.estimate.finish && r.estimate.finish.id !== 'none' ? r.estimate.finish.vn : '',
        qtyPerSet: r.qtyPerSet,
        qty: r.qty,
        massG: r.estimate.massG,
        volumeCm3: r.stats.volumeMm3 / 1000,
        dimsMm: [r.stats.bbox.size.x, r.stats.bbox.size.y, r.stats.bbox.size.z],
        timeMin: r.estimate.timeMinPerPart,
        leadDays: r.estimate.leadDays,
        unitCost: r.estimate.unitCost,
        unitPrice: r.estimate.unitPrice,
        lineTotal: r.qtyPerSet > 0 ? r.estimate.lineTotal : 0,
        feasible: r.estimate.feasible,
        lines: r.estimate.lines.map((l) => ({ en: l.en, vn: l.vn, amount: l.amount })),
        warnings: [...r.estimate.blockers, ...r.estimate.warnings],
      })),
      totals: quote.totals,
      parts,
    };
  }

  async function onSave({ asNew = false } = {}) {
    if (!parts.length) {
      toast.warning('Nothing to save / Chưa có gì để lưu', 'Thêm ít nhất một chi tiết vào báo giá');
      return;
    }
    setBusy(asNew ? 'save-new' : 'save');
    try {
      const payload = buildPayload();
      const res =
        currentQuoteId && !asNew
          ? await api.put(apiPaths.quote(currentQuoteId), payload)
          : await api.post(apiPaths.quotes, { ...payload, meta: { ...payload.meta, quoteNumber: asNew ? '' : payload.meta.quoteNumber } });
      setCurrentQuoteId(res.quote.id);
      setMeta((m) => ({ ...m, quoteNumber: res.quote.quoteNumber }));
      toast.success(`Quote ${res.quote.quoteNumber} saved`, 'Đã lưu báo giá');
      refreshSaved();
    } catch (e) {
      toast.error('Save failed / Lưu thất bại', e.message);
    } finally {
      setBusy(null);
    }
  }

  async function onExport(format) {
    if (!parts.length) {
      toast.warning('Nothing to export / Chưa có gì để xuất', 'Thêm chi tiết trước khi xuất file');
      return;
    }
    setBusy(format);
    try {
      await postDownload(apiPaths.quoteExport(format), buildPayload(), { inline: format === 'pdf' });
    } catch (e) {
      toast.error('Export failed / Xuất file thất bại', e.message);
    } finally {
      setBusy(null);
    }
  }

  async function openSaved(id) {
    try {
      const res = await api.get(apiPaths.quote(id));
      const data = res.quote.data || {};
      if (Array.isArray(data.parts) && data.parts.length) {
        setParts(data.parts);
      }
      if (data.meta) {
        setMeta({ ...EMPTY_META, ...data.meta });
      }
      setCurrentQuoteId(res.quote.id);
      toast.success(`Opened ${res.quote.quoteNumber}`, 'Đã mở báo giá đã lưu');
    } catch (e) {
      toast.error('Could not open quote / Không mở được báo giá', e.message);
    }
  }

  async function deleteSaved(q) {
    const ok = await confirmDialog({
      title: 'Delete quote / Xóa báo giá',
      message: `${q.quoteNumber} — ${q.title}`,
      detail: 'Báo giá đã lưu sẽ bị xóa vĩnh viễn.',
      confirmLabel: 'Delete / Xóa',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(apiPaths.quote(q.id));
      if (currentQuoteId === q.id) setCurrentQuoteId(null);
      refreshSaved();
    } catch (e) {
      toast.error('Delete failed / Xóa thất bại', e.message);
    }
  }

  async function clearAll() {
    const ok = await confirmDialog({
      title: 'Clear this quote / Xóa báo giá đang soạn',
      message: 'All parts and prices on this page will be removed.',
      detail: 'Toàn bộ chi tiết và giá trên trang này sẽ bị xóa (báo giá đã lưu không bị ảnh hưởng).',
      confirmLabel: 'Clear / Xóa hết',
      tone: 'danger',
    });
    if (!ok) return;
    setParts([]);
    setCurrentQuoteId(null);
    setMeta({ ...EMPTY_META, preparedBy: user?.fullName || '' });
  }

  const totals = quote.totals;

  return (
    <PageWrapper
      title="Cost & Quote"
      subtitle="Ước tính khối lượng · phương án gia công · báo giá"
      breadcrumb="Design / Thiết kế"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => importFromViewer()}
            loading={importing}
          >
            <IconCube size={14} aria-hidden="true" /> From 3D viewer / Lấy từ 3D
          </Button>
          {parts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <IconTrash size={14} aria-hidden="true" /> Clear / Xóa
            </Button>
          )}
        </div>
      }
    >
      {settingsLoaded && isDefaultRates && (
        <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800 flex items-start gap-2">
          <IconAlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Quoting with the built-in default rates.{' '}
            <Link to="/pricing" className="underline font-medium">
              Set your shop rates
            </Link>{' '}
            for prices that match your vendors.
            <span className="block text-amber-700">
              Đang dùng đơn giá mặc định — vào System · Cost rates để nhập đơn giá thực tế của xưởng.
            </span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              icon={<IconStack2 size={20} />}
              value={totals.partCount}
              label="Parts / Chi tiết"
              sublabel={`${totals.totalQty} pcs total`}
            />
            <Stat
              icon={<IconWeight size={20} />}
              value={formatMass(totals.massPerSetG)}
              label="Mass per set"
              sublabel="Khối lượng mỗi bộ"
              tone="info"
            />
            <Stat
              icon={<IconClock size={20} />}
              value={`${totals.leadDays || 0} d`}
              label="Lead time"
              sublabel="Thời gian giao"
              tone="warning"
            />
            <Stat
              icon={<IconCoin size={20} />}
              value={formatMoney(totals.grandTotal, commercial, { compact: true })}
              label="Quote total"
              sublabel="Tổng báo giá"
              tone="success"
            />
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center">
                  <IconCalculator size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-800">
                    Parts &amp; manufacturing
                  </h2>
                  <div className="text-xs text-gray-600">
                    Chi tiết &amp; phương án gia công — giá tự động theo số lượng
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-gray-600 flex items-center gap-1.5">
                  Sets / Số bộ
                  <input
                    type="number"
                    min="1"
                    className="input h-8 py-0 w-20 text-right"
                    value={meta.sets}
                    onChange={(e) => setMeta({ ...meta, sets: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {['VND', 'USD'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setMeta({ ...meta, currency: c })}
                      aria-pressed={meta.currency === c}
                      className={cx(
                        'px-2.5 py-1 text-[11px] font-medium transition-colors',
                        meta.currency === c
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {parts.length === 0 ? (
              <div className="p-6">
                <Empty
                  icon={<IconCalculator size={40} />}
                  title="No parts yet / Chưa có chi tiết"
                  hint="Load the assembly you have open in the 3D viewer, or drop STL / STEP / OBJ files here to price them."
                  action={
                    <Button size="sm" onClick={() => importFromViewer()} loading={importing}>
                      <IconCube size={14} aria-hidden="true" /> Load from 3D viewer
                    </Button>
                  }
                />
                <div className="max-w-md mx-auto">
                  <FileUpload
                    multiple
                    onFiles={handleFiles}
                    accept={CAD_ACCEPT}
                    hint="STL · OBJ · STEP · IGES · BREP — kéo thả file để tính giá"
                  />
                </div>
              </div>
            ) : (
              <>
                <Table label="Parts and prices / Chi tiết và giá">
                  <THead>
                    <TR>
                      <TH>Part / Chi tiết</TH>
                      <TH>Material / Vật liệu</TH>
                      <TH>Process / Gia công</TH>
                      <TH>Finish / Bề mặt</TH>
                      <TH className="text-right">Mass · time</TH>
                      <TH className="text-right">Qty/set</TH>
                      <TH className="text-right">Unit price</TH>
                      <TH className="text-right">Line total</TH>
                      <TH />
                    </TR>
                  </THead>
                  <tbody>
                    {quote.rows.map((row, i) => (
                      <QuotePartRow
                        key={row.id}
                        row={row}
                        index={i}
                        settings={effectiveSettings}
                        commercial={commercial}
                        expanded={expandedId === row.id}
                        onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        onChange={(patch) => patchPart(row.id, patch)}
                        onRemove={() => removePart(row.id)}
                      />
                    ))}
                  </tbody>
                </Table>
                <div className="p-4 border-t border-gray-200">
                  <FileUpload
                    multiple
                    compact
                    onFiles={handleFiles}
                    accept={CAD_ACCEPT}
                    hint="Thêm chi tiết vào báo giá"
                  />
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Quote details"
              subtitle="Thông tin báo giá"
              icon={<IconReceipt2 size={18} aria-hidden="true" />}
            />
            <div className="space-y-2.5">
              <Field label="Quote No. / Số báo giá">
                <input
                  className="input mt-1 font-mono"
                  value={meta.quoteNumber}
                  onChange={(e) => setMeta({ ...meta, quoteNumber: e.target.value })}
                />
              </Field>
              <Field label="Title / Tiêu đề">
                <input
                  className="input mt-1"
                  value={meta.title}
                  onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                />
              </Field>
              <Field label="Customer / Khách hàng">
                <input
                  className="input mt-1"
                  value={meta.customer}
                  onChange={(e) => setMeta({ ...meta, customer: e.target.value })}
                  placeholder="Vendor or internal team"
                />
              </Field>
              <Field label="Project / Dự án">
                <input
                  className="input mt-1"
                  value={meta.project}
                  onChange={(e) => setMeta({ ...meta, project: e.target.value })}
                />
              </Field>
              <Field label="Link to document / Gắn với tài liệu">
                <DocumentPicker
                  className="mt-1"
                  value={meta.documentId}
                  onChange={(id) => setMeta({ ...meta, documentId: id })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Prepared by / Người lập">
                  <input
                    className="input mt-1"
                    value={meta.preparedBy}
                    onChange={(e) => setMeta({ ...meta, preparedBy: e.target.value })}
                  />
                </Field>
                <Field label="Valid / Hiệu lực (days)">
                  <input
                    type="number"
                    min="0"
                    className="input mt-1"
                    value={meta.validDays}
                    onChange={(e) => setMeta({ ...meta, validDays: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={meta.applyVat}
                  onChange={(e) => setMeta({ ...meta, applyVat: e.target.checked })}
                />
                <span className="text-[13px]">
                  Add VAT {settings.commercial.vatPct}% / Cộng thuế GTGT
                </span>
              </label>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Totals"
              subtitle="Tổng hợp"
              icon={<IconCoin size={18} aria-hidden="true" />}
            />
            <div className="space-y-1.5">
              <TotalLine
                label="Shop cost / Giá thành xưởng"
                value={formatMoney(totals.cost, commercial)}
                muted
              />
              <TotalLine
                label={`Margin ${totals.marginPct.toFixed(0)}% / Lợi nhuận`}
                value={formatMoney(totals.marginValue, commercial)}
                muted
              />
              <div className="border-t border-gray-200 my-1.5" />
              <TotalLine label="Subtotal / Tạm tính" value={formatMoney(totals.subtotal, commercial)} />
              {meta.applyVat && (
                <TotalLine
                  label={`VAT ${settings.commercial.vatPct}%`}
                  value={formatMoney(totals.vat, commercial)}
                />
              )}
              <div className="border-t border-gray-200 my-1.5" />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-gray-900">Total / Tổng cộng</span>
                <span className="font-mono text-[17px] font-bold text-primary-600">
                  {formatMoney(totals.grandTotal, commercial)}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 text-right">
                {formatMoneyBoth(totals.grandTotal, commercial)}
              </div>
              <div className="border-t border-gray-200 my-1.5" />
              <TotalLine
                label={`Per set / Mỗi bộ (× ${quote.sets})`}
                value={formatMoney(totals.pricePerSet, commercial)}
              />
              <TotalLine label="Mass per set / KL mỗi bộ" value={formatMass(totals.massPerSetG)} />
              {totals.blockedCount > 0 && (
                <div className="text-[11px] text-red-600 flex items-start gap-1.5 pt-1">
                  <IconAlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    {totals.blockedCount} part(s) have no workable process — open the row to see why.
                    <span className="block text-gray-600">
                      {totals.blockedCount} chi tiết chưa có phương án khả thi — mở dòng để xem lý do.
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button size="sm" onClick={() => onSave()} loading={busy === 'save'}>
                <IconDeviceFloppy size={14} aria-hidden="true" />
                {currentQuoteId ? 'Update' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onSave({ asNew: true })}
                loading={busy === 'save-new'}
                disabled={!currentQuoteId}
              >
                Save as new
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onExport('pdf')}
                loading={busy === 'pdf'}
              >
                <IconFileText size={14} aria-hidden="true" /> PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onExport('excel')}
                loading={busy === 'excel'}
              >
                <IconFileSpreadsheet size={14} aria-hidden="true" /> Excel
              </Button>
            </div>
            <Link
              to="/pricing"
              className="mt-3 flex items-center gap-1.5 text-[12px] text-primary-600 hover:underline"
            >
              <IconAdjustments size={14} aria-hidden="true" /> Cost rates / Đơn giá gia công
            </Link>
          </Card>

          <Card>
            <CardHeader
              title={`Saved quotes (${savedQuotes.length})`}
              subtitle="Báo giá đã lưu"
              icon={<IconReceipt2 size={18} aria-hidden="true" />}
              action={
                <button type="button" className="icon-btn" onClick={refreshSaved} aria-label="Refresh saved quotes / Tải lại">
                  <IconRefresh size={15} aria-hidden="true" />
                </button>
              }
            />
            {savedQuotes.length === 0 ? (
              <div className="text-xs text-gray-600 text-center py-4">
                No saved quotes yet / Chưa có báo giá nào
              </div>
            ) : (
              <ul className="space-y-1 max-h-72 overflow-y-auto">
                {savedQuotes.map((q) => (
                  <li key={q.id}>
                    <div
                      className={cx(
                        'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                        currentQuoteId === q.id
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => openSaved(q.id)}
                      >
                        <span className="block text-[12px] font-mono text-primary-600 truncate">
                          {q.quoteNumber}
                        </span>
                        <span className="block text-[11px] text-gray-600 truncate">
                          {q.customer || q.title}
                        </span>
                        <span className="block text-[10px] text-gray-500">
                          {q.partCount} parts ·{' '}
                          {formatMoney(q.totalPrice || 0, { currency: q.currency, usdRate: settings.commercial.usdRate }, { compact: true })}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => deleteSaved(q)}
                        aria-label={`Delete ${q.quoteNumber} / Xóa`}
                      >
                        <IconTrash size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}

function Stat({ icon, value, label, sublabel, tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary-50 text-primary-500',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    info: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="card flex items-center gap-3 py-3">
      <div
        className={cx(
          'w-10 h-10 rounded-card flex items-center justify-center shrink-0',
          tones[tone] || tones.primary
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[17px] font-bold text-gray-900 leading-tight break-words">{value}</div>
        <div className="text-[11px] text-gray-600 mt-1">{label}</div>
        {sublabel && <div className="text-[10px] text-gray-500">{sublabel}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function TotalLine({ label, value, muted = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className={muted ? 'text-gray-600' : 'text-gray-700'}>{label}</span>
      <span className={cx('font-mono', muted ? 'text-gray-600' : 'text-gray-900 font-medium')}>
        {value}
      </span>
    </div>
  );
}
