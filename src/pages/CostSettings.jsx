import { useEffect, useMemo, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { Empty } from '@/components/ui/Empty';
import { useCostStore } from '@/stores/useCostStore';
import { useHasRole } from '@/lib/roles';
import { cloneSettings } from '@/lib/costing/defaults';
import { PROCESS_META, PROCESS_ORDER } from '@/lib/costing/processes';
import { formatMoney } from '@/lib/costing/format';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { cx } from '@/lib/cx';
import {
  IconLock,
  IconDeviceFloppy,
  IconRestore,
  IconTrash,
  IconPlus,
  IconCoin,
  IconTools,
  IconPackage,
} from '@tabler/icons-react';

/** Bilingual labels + units for the numeric rate fields. */
const FIELD = {
  machineRate: ['Machine rate', 'Đơn giá máy', '₫/h'],
  setupFee: ['Setup fee (per batch)', 'Phí gá đặt (mỗi lô)', '₫'],
  programmingFee: ['CAM programming (one-off)', 'Lập trình CAM (một lần)', '₫'],
  mrrCm3PerMin: ['Material removal rate', 'Tốc độ bóc vật liệu', 'cm³/min'],
  finishRateCm2PerMin: ['Finishing rate', 'Tốc độ hoàn thiện', 'cm²/min'],
  stockMarginMm: ['Stock margin', 'Dư phôi', 'mm'],
  toolWearPct: ['Tool wear', 'Hao mòn dao', '%'],
  minCharge: ['Minimum charge', 'Giá tối thiểu', '₫'],
  maxSizeMm: ['Max part size', 'Kích thước tối đa', 'mm'],
  maxDiameterMm: ['Max diameter', 'Đường kính tối đa', 'mm'],
  maxLengthMm: ['Max length', 'Chiều dài tối đa', 'mm'],
  leadDays: ['Lead time', 'Thời gian giao', 'days'],
  handlingPerPart: ['Handling per part', 'Xử lý mỗi chi tiết', '₫'],
  throughputCm3PerHour: ['Throughput', 'Năng suất', 'cm³/h'],
  minVerticalMmPerHour: ['Vertical build speed', 'Tốc độ theo chiều cao', 'mm/h'],
  infillPct: ['Infill', 'Mật độ điền đầy', '%'],
  shellPct: ['Solid shell share', 'Tỷ lệ vỏ đặc', '%'],
  supportPct: ['Support material', 'Vật liệu đỡ', '%'],
  layerHeightMm: ['Layer height', 'Chiều cao lớp', 'mm'],
  secondsPerLayer: ['Time per layer', 'Thời gian mỗi lớp', 's'],
  bedMm: ['Build plate', 'Khay in', 'mm'],
  nestGapMm: ['Gap between parts', 'Khoảng cách chi tiết', 'mm'],
  powderRefreshPct: ['Fresh powder per build', 'Bột mới mỗi mẻ', '%'],
  baseCutSpeedMmPerMin: ['Cut speed at 1 mm', 'Tốc độ cắt ở 1 mm', 'mm/min'],
  pierceSeconds: ['Pierce time', 'Thời gian đâm xuyên', 's'],
  piercesPerPart: ['Pierces per part', 'Số lần đâm xuyên', 'x'],
  nestWastePct: ['Nesting waste', 'Hao hụt xếp hình', '%'],
  maxThicknessMm: ['Max thickness', 'Chiều dày tối đa', 'mm'],
  maxSheetMm: ['Max sheet', 'Khổ tấm tối đa', 'mm'],
  maxFlatAspect: ['Max flatness ratio', 'Tỷ lệ phẳng tối đa', '—'],
  minPrismaticRatio: ['Min constant-thickness ratio', 'Tỷ lệ dày đều tối thiểu', '—'],
  moldCost: ['Mould cost', 'Chi phí khuôn', '₫'],
  moldLifeShots: ['Mould life', 'Tuổi thọ khuôn', 'shots'],
  cavities: ['Cavities', 'Số lòng khuôn', 'x'],
  cycleBaseSeconds: ['Base cycle time', 'Chu kỳ cơ bản', 's'],
  cycleSecondsPerCm3: ['Cycle per cm³', 'Chu kỳ theo cm³', 's/cm³'],
  wastePct: ['Process waste', 'Hao hụt quy trình', '%'],
  minQty: ['Economic minimum qty', 'Số lượng tối thiểu kinh tế', 'pcs'],
  maxShotCm3: ['Max shot volume', 'Thể tích ép tối đa', 'cm³'],
};

const CATEGORIES = [
  { id: 'metal', label: 'Metal / Kim loại' },
  { id: 'plastic', label: 'Plastic / Nhựa kỹ thuật' },
  { id: 'filament', label: 'FDM filament / Sợi in FDM' },
  { id: 'resin', label: 'Resin / Nhựa quang' },
  { id: 'powder', label: 'SLS powder / Bột SLS' },
  { id: 'wood', label: 'Wood / Gỗ & ván' },
];

const TABS = [
  { id: 'commercial', en: 'Commercial', vn: 'Thương mại', icon: IconCoin },
  { id: 'processes', en: 'Process rates', vn: 'Đơn giá gia công', icon: IconTools },
  { id: 'materials', en: 'Materials & finishes', vn: 'Vật liệu & bề mặt', icon: IconPackage },
];

export function CostSettings() {
  const canEdit = useHasRole('manager');
  const { settings, updatedAt, updatedBy, isDefault, fetch, save, resetToDefaults } = useCostStore();
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('commercial');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    setDraft(cloneSettings(settings));
  }, [settings]);

  const dirty = useMemo(
    () => !!draft && JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  );

  if (!canEdit) {
    return (
      <PageWrapper
        title="Cost rates"
        subtitle="Đơn giá gia công"
        breadcrumb="System / Hệ thống"
      >
        <Card>
          <Empty
            icon={<IconLock size={40} />}
            title="Manager only / Chỉ quản lý"
            hint="Chỉ tài khoản manager mới sửa được bảng đơn giá. Bạn vẫn dùng được trang Cost & Quote với đơn giá hiện hành."
          />
        </Card>
      </PageWrapper>
    );
  }

  if (!draft) return null;

  const patchCommercial = (patch) =>
    setDraft((d) => ({ ...d, commercial: { ...d.commercial, ...patch } }));

  const patchProcess = (id, patch) =>
    setDraft((d) => ({ ...d, processes: { ...d.processes, [id]: { ...d.processes[id], ...patch } } }));

  const patchMaterial = (index, patch) =>
    setDraft((d) => ({
      ...d,
      materials: d.materials.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));

  const patchFinish = (index, patch) =>
    setDraft((d) => ({
      ...d,
      finishes: d.finishes.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));

  async function onSave() {
    // Two materials with the same id would make one of them unreachable.
    const ids = draft.materials.map((m) => m.id.trim());
    const dupe = ids.find((id, i) => id && ids.indexOf(id) !== i);
    if (dupe) {
      toast.error('Duplicate material code / Trùng mã vật liệu', dupe);
      return;
    }
    if (ids.some((id) => !id)) {
      toast.error('Every material needs a code / Mỗi vật liệu cần một mã', 'e.g. al6061');
      return;
    }
    setSaving(true);
    try {
      await save(draft);
      toast.success('Cost rates saved', 'Đã lưu bảng đơn giá — mọi báo giá mới sẽ dùng giá này');
    } catch (e) {
      toast.error('Save failed / Lưu thất bại', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    const ok = await confirmDialog({
      title: 'Reset to defaults / Khôi phục mặc định',
      message: 'All rates go back to the values the tool ships with.',
      detail: 'Toàn bộ đơn giá sẽ trở về giá trị mặc định của phần mềm.',
      confirmLabel: 'Reset / Khôi phục',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await resetToDefaults();
      toast.success('Rates reset to defaults', 'Đã khôi phục đơn giá mặc định');
    } catch (e) {
      toast.error('Reset failed / Khôi phục thất bại', e.message);
    }
  }

  return (
    <PageWrapper
      title="Cost rates"
      subtitle="Đơn giá gia công — dùng cho mọi báo giá"
      breadcrumb="System / Hệ thống"
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <IconRestore size={14} aria-hidden="true" /> Defaults / Mặc định
          </Button>
          <Button size="sm" onClick={onSave} loading={saving} disabled={!dirty}>
            <IconDeviceFloppy size={14} aria-hidden="true" /> Save / Lưu
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={cx(
                  'px-3 py-1.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition-colors',
                  tab === t.id ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon size={14} aria-hidden="true" />
                <span>
                  {t.en} <span className="opacity-80">· {t.vn}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-gray-600">
          {isDefault
            ? 'Using built-in defaults / Đang dùng giá mặc định'
            : `Last updated ${updatedAt ? new Date(updatedAt).toLocaleString() : ''}${
                updatedBy ? ` · ${updatedBy}` : ''
              }`}
          {dirty && <span className="ml-2 text-amber-600 font-medium">Unsaved changes</span>}
        </div>
      </div>

      {tab === 'commercial' && (
        <Card>
          <CardHeader
            title="Commercial settings"
            subtitle="Tiền tệ, chi phí chung, lợi nhuận, thuế"
            icon={<IconCoin size={18} aria-hidden="true" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Num
              label="Overhead / Chi phí chung"
              unit="%"
              value={draft.commercial.overheadPct}
              onChange={(v) => patchCommercial({ overheadPct: v })}
              hint="Added to the shop cost of every part."
            />
            <Num
              label="Margin / Lợi nhuận"
              unit="%"
              value={draft.commercial.marginPct}
              onChange={(v) => patchCommercial({ marginPct: v })}
              hint="Applied after overhead to get the quoted price."
            />
            <Num
              label="VAT / Thuế GTGT"
              unit="%"
              value={draft.commercial.vatPct}
              onChange={(v) => patchCommercial({ vatPct: v })}
            />
            <Num
              label="Round unit price up to / Làm tròn đơn giá"
              unit="₫"
              value={draft.commercial.roundTo}
              onChange={(v) => patchCommercial({ roundTo: v })}
            />
            <Num
              label="USD rate / Tỷ giá USD"
              unit="₫/$"
              value={draft.commercial.usdRate}
              onChange={(v) => patchCommercial({ usdRate: v })}
            />
            <Num
              label="Quote validity / Hiệu lực báo giá"
              unit="days"
              value={draft.commercial.validDays}
              onChange={(v) => patchCommercial({ validDays: v })}
            />
            <div>
              <label className="label">Display currency / Tiền tệ hiển thị</label>
              <select
                className="input mt-1"
                value={draft.commercial.currency}
                onChange={(e) => patchCommercial({ currency: e.target.value })}
              >
                <option value="VND">VND — Việt Nam đồng</option>
                <option value="USD">USD — US dollar</option>
              </select>
              <div className="hint">Rates are always stored in VND.</div>
            </div>
            <div>
              <label className="label">Company / Công ty</label>
              <input
                className="input mt-1"
                value={draft.commercial.companyName || ''}
                onChange={(e) => patchCommercial({ companyName: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-6">
              <input
                type="checkbox"
                checked={!!draft.commercial.applyVat}
                onChange={(e) => patchCommercial({ applyVat: e.target.checked })}
              />
              <span className="text-[13px]">Add VAT by default / Mặc định cộng VAT</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Quote note (EN)</label>
              <textarea
                className="input mt-1 h-20"
                value={draft.commercial.quoteNotesEn || ''}
                onChange={(e) => patchCommercial({ quoteNotesEn: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ghi chú báo giá (VN)</label>
              <textarea
                className="input mt-1 h-20"
                value={draft.commercial.quoteNotesVn || ''}
                onChange={(e) => patchCommercial({ quoteNotesVn: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 rounded-card bg-gray-50 border border-gray-200 px-4 py-3 text-[12px] text-gray-700">
            Example / Ví dụ: a part costing {formatMoney(100000, draft.commercial)} to make is quoted
            at{' '}
            <span className="font-mono font-semibold text-primary-600">
              {formatMoney(
                Math.ceil(
                  (100000 *
                    (1 + (Number(draft.commercial.overheadPct) || 0) / 100) *
                    (1 + (Number(draft.commercial.marginPct) || 0) / 100)) /
                    Math.max(Number(draft.commercial.roundTo) || 1, 1)
                ) * Math.max(Number(draft.commercial.roundTo) || 1, 1),
                draft.commercial
              )}
            </span>
            .
          </div>
        </Card>
      )}

      {tab === 'processes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PROCESS_ORDER.filter((id) => draft.processes[id]).map((id) => {
            const meta = PROCESS_META[id];
            const rates = draft.processes[id];
            return (
              <Card key={id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cx('badge', meta.tone)}>{meta.short}</span>
                      <h2 className="text-[15px] font-semibold text-gray-800">{meta.en}</h2>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{meta.vn}</div>
                    <div className="text-[11px] text-gray-500 mt-1 max-w-md">{meta.descVn}</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={rates.enabled !== false}
                      onChange={(e) => patchProcess(id, { enabled: e.target.checked })}
                    />
                    <span className="text-[12px]">On / Bật</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(rates)
                    .filter(([key]) => key !== 'enabled')
                    .map(([key, value]) => {
                      const [en, vn, unit] = FIELD[key] || [key, '', ''];
                      if (Array.isArray(value)) {
                        return (
                          <div key={key} className="col-span-2">
                            <label className="label">
                              {en} <span className="text-gray-500">· {vn}</span>{' '}
                              {unit && <span className="text-gray-500">({unit})</span>}
                            </label>
                            <div className="flex gap-2 mt-1">
                              {value.map((v, i) => (
                                <input
                                  key={i}
                                  type="number"
                                  className="input"
                                  value={v}
                                  aria-label={`${en} ${['X', 'Y', 'Z'][i] || i + 1}`}
                                  onChange={(e) => {
                                    const next = [...value];
                                    next[i] = Number(e.target.value);
                                    patchProcess(id, { [key]: next });
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <Num
                          key={key}
                          label={
                            <>
                              {en} <span className="text-gray-500">· {vn}</span>
                            </>
                          }
                          unit={unit}
                          value={value}
                          onChange={(v) => patchProcess(id, { [key]: v })}
                        />
                      );
                    })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'materials' && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-800">
                  Materials ({draft.materials.length})
                </h2>
                <div className="text-xs text-gray-600">
                  Vật liệu — khối lượng riêng, đơn giá, độ khó gia công
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    materials: [
                      ...d.materials,
                      {
                        id: '',
                        en: 'New material',
                        vn: 'Vật liệu mới',
                        category: 'metal',
                        density: 1,
                        pricePerKg: 0,
                        machinability: 1,
                        laserFactor: 0,
                        wastePct: 5,
                      },
                    ],
                  }))
                }
              >
                <IconPlus size={14} aria-hidden="true" /> Add / Thêm
              </Button>
            </div>
            <Table label="Materials / Vật liệu" maxHeight="60vh" stickyHeader>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name (EN)</TH>
                  <TH>Tên (VN)</TH>
                  <TH>Category</TH>
                  <TH className="text-right">Density g/cm³</TH>
                  <TH className="text-right">Price ₫/kg</TH>
                  <TH className="text-right">Pellet ₫/kg</TH>
                  <TH className="text-right">Machinability</TH>
                  <TH className="text-right">Laser factor</TH>
                  <TH className="text-right">Waste %</TH>
                  <TH />
                </TR>
              </THead>
              <tbody>
                {draft.materials.map((m, i) => (
                  <TR key={`${m.id}-${i}`}>
                    <TD>
                      <input
                        className="input h-7 py-0 text-[12px] w-24 font-mono"
                        value={m.id}
                        onChange={(e) => patchMaterial(i, { id: e.target.value })}
                        aria-label={`Material code ${i + 1}`}
                      />
                    </TD>
                    <TD>
                      <input
                        className="input h-7 py-0 text-[12px] min-w-[140px]"
                        value={m.en}
                        onChange={(e) => patchMaterial(i, { en: e.target.value })}
                        aria-label={`Material name EN ${i + 1}`}
                      />
                    </TD>
                    <TD>
                      <input
                        className="input h-7 py-0 text-[12px] min-w-[140px]"
                        value={m.vn || ''}
                        onChange={(e) => patchMaterial(i, { vn: e.target.value })}
                        aria-label={`Tên vật liệu VN ${i + 1}`}
                      />
                    </TD>
                    <TD>
                      <select
                        className="input h-7 py-0 text-[12px]"
                        value={m.category}
                        onChange={(e) => patchMaterial(i, { category: e.target.value })}
                        aria-label={`Material category ${i + 1}`}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </TD>
                    <CellNum value={m.density} step="0.01" onChange={(v) => patchMaterial(i, { density: v })} label={`Density ${i + 1}`} />
                    <CellNum value={m.pricePerKg} step="1000" onChange={(v) => patchMaterial(i, { pricePerKg: v })} label={`Price ${i + 1}`} />
                    <CellNum value={m.pelletPricePerKg ?? ''} step="1000" onChange={(v) => patchMaterial(i, { pelletPricePerKg: v })} label={`Pellet price ${i + 1}`} />
                    <CellNum value={m.machinability} step="0.05" onChange={(v) => patchMaterial(i, { machinability: v })} label={`Machinability ${i + 1}`} />
                    <CellNum value={m.laserFactor} step="0.1" onChange={(v) => patchMaterial(i, { laserFactor: v })} label={`Laser factor ${i + 1}`} />
                    <CellNum value={m.wastePct} step="1" onChange={(v) => patchMaterial(i, { wastePct: v })} label={`Waste ${i + 1}`} />
                    <TD>
                      <button
                        type="button"
                        className="icon-btn text-red-500 hover:text-red-700"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            materials: d.materials.filter((_, idx) => idx !== i),
                          }))
                        }
                        aria-label={`Remove ${m.en} / Xóa vật liệu`}
                      >
                        <IconTrash size={14} aria-hidden="true" />
                      </button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[15px] font-semibold text-gray-800">
                Surface finishes ({draft.finishes.length})
              </h2>
              <div className="text-xs text-gray-600">Xử lý bề mặt — tính theo dm² bề mặt chi tiết</div>
            </div>
            <Table label="Finishes / Xử lý bề mặt">
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name (EN)</TH>
                  <TH>Tên (VN)</TH>
                  <TH className="text-right">₫/dm²</TH>
                  <TH className="text-right">Setup ₫</TH>
                  <TH>Applies to / Áp dụng cho</TH>
                </TR>
              </THead>
              <tbody>
                {draft.finishes.map((f, i) => (
                  <TR key={`${f.id}-${i}`}>
                    <TD mono>{f.id}</TD>
                    <TD>
                      <input
                        className="input h-7 py-0 text-[12px] min-w-[160px]"
                        value={f.en}
                        onChange={(e) => patchFinish(i, { en: e.target.value })}
                        aria-label={`Finish name EN ${i + 1}`}
                      />
                    </TD>
                    <TD>
                      <input
                        className="input h-7 py-0 text-[12px] min-w-[160px]"
                        value={f.vn || ''}
                        onChange={(e) => patchFinish(i, { vn: e.target.value })}
                        aria-label={`Tên xử lý bề mặt VN ${i + 1}`}
                      />
                    </TD>
                    <CellNum value={f.pricePerDm2} step="1000" onChange={(v) => patchFinish(i, { pricePerDm2: v })} label={`Finish price ${i + 1}`} />
                    <CellNum value={f.setupFee} step="1000" onChange={(v) => patchFinish(i, { setupFee: v })} label={`Finish setup ${i + 1}`} />
                    <TD className="text-[11px] text-gray-600">
                      {f.categories ? f.categories.join(', ') : 'all / tất cả'}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </PageWrapper>
  );
}

function Num({ label, unit, value, onChange, hint }) {
  return (
    <div>
      <label className="label">
        {label} {unit && <span className="text-gray-500">({unit})</span>}
      </label>
      <input
        type="number"
        className="input mt-1"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function CellNum({ value, onChange, step = '1', label }) {
  return (
    <TD className="text-right">
      <input
        type="number"
        step={step}
        className="input h-7 py-0 text-[12px] w-24 text-right"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        aria-label={label}
      />
    </TD>
  );
}
