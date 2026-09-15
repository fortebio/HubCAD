import { TR, TD } from '@/components/ui/Table';
import { cx } from '@/lib/cx';
import { ProcessComparison } from './ProcessComparison';
import { finishesFor } from '@/lib/costing/estimate';
import { PROCESS_META, PROCESS_ORDER } from '@/lib/costing/processes';
import {
  formatMoney,
  formatMass,
  formatVolume,
  formatMinutes,
} from '@/lib/costing/format';
import {
  IconChevronDown,
  IconChevronUp,
  IconTrash,
  IconAlertTriangle,
  IconSparkles,
} from '@tabler/icons-react';

const CATEGORY_LABEL = {
  metal: 'Metal / Kim loại',
  plastic: 'Plastic / Nhựa kỹ thuật',
  filament: 'FDM filament / Sợi in FDM',
  resin: 'Resin / Nhựa quang',
  powder: 'SLS powder / Bột SLS',
  wood: 'Wood & board / Gỗ & ván',
};

export function QuotePartRow({
  row,
  index,
  settings,
  commercial,
  expanded,
  onToggle,
  onChange,
  onRemove,
}) {
  const est = row.estimate;
  const stats = row.stats;
  const size = stats.bbox.size;
  const materials = settings.materials || [];
  const categories = [...new Set(materials.map((m) => m.category))];
  const finishes = finishesFor(settings, est.material);
  const feasibleIds = new Set(row.suggestion.feasible.map((c) => c.processId));

  return (
    <>
      <TR className={cx(!est.feasible && 'bg-red-50/40')}>
        <TD className="align-top">
          <div className="flex items-start gap-2">
            <span className="text-[11px] text-gray-500 font-mono mt-0.5">{index + 1}</span>
            <div className="min-w-0">
              <input
                className="input h-7 py-0 text-[12px] w-full min-w-[140px]"
                value={row.name}
                onChange={(e) => onChange({ name: e.target.value })}
                aria-label={`Part name ${index + 1} / Tên chi tiết`}
              />
              <div className="text-[10px] text-gray-500 font-mono mt-1">
                {size.x.toFixed(1)} × {size.y.toFixed(1)} × {size.z.toFixed(1)} mm ·{' '}
                {formatVolume(stats.volumeMm3)}
              </div>
              {stats.watertight === false && (
                <div className="text-[10px] text-amber-600 flex items-center gap-1">
                  <IconAlertTriangle size={11} aria-hidden="true" /> open mesh / lưới hở
                </div>
              )}
            </div>
          </div>
        </TD>

        <TD className="align-top">
          <select
            className="input h-7 py-0 text-[12px] min-w-[150px]"
            value={row.materialId || 'auto'}
            onChange={(e) => onChange({ materialId: e.target.value })}
            aria-label={`Material for ${row.name} / Vật liệu`}
          >
            <option value="auto">Auto / Tự động</option>
            {categories.map((cat) => (
              <optgroup key={cat} label={CATEGORY_LABEL[cat] || cat}>
                {materials
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.en} / {m.vn}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {row.autoMaterial && est.material && (
            <div className="text-[10px] text-gray-500 mt-1 truncate max-w-[160px]">
              → {est.material.en}
            </div>
          )}
        </TD>

        <TD className="align-top">
          <select
            className="input h-7 py-0 text-[12px] min-w-[150px]"
            value={row.processId || 'auto'}
            onChange={(e) => onChange({ processId: e.target.value })}
            aria-label={`Process for ${row.name} / Phương án gia công`}
          >
            <option value="auto">Auto — best price / Tự động</option>
            {PROCESS_ORDER.filter((id) => settings.processes?.[id]?.enabled !== false).map((id) => (
              <option key={id} value={id}>
                {feasibleIds.has(id) ? '' : '⚠ '}
                {PROCESS_META[id].en} / {PROCESS_META[id].vn}
              </option>
            ))}
          </select>
          <div className="text-[10px] mt-1 flex items-center gap-1">
            {row.autoProcess && est.process && (
              <>
                <IconSparkles size={11} className="text-emerald-600" aria-hidden="true" />
                <span className="text-gray-600 truncate max-w-[140px]">{est.process.en}</span>
              </>
            )}
          </div>
        </TD>

        <TD className="align-top">
          <select
            className="input h-7 py-0 text-[12px] min-w-[130px]"
            value={row.finishId || 'none'}
            onChange={(e) => onChange({ finishId: e.target.value })}
            aria-label={`Surface finish for ${row.name} / Xử lý bề mặt`}
          >
            {finishes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.en} / {f.vn}
              </option>
            ))}
          </select>
        </TD>

        <TD className="align-top text-right whitespace-nowrap">
          <div className="font-mono text-[12px] text-gray-900">{formatMass(est.massG)}</div>
          <div className="text-[10px] text-gray-500">{formatMinutes(est.timeMinPerPart)}</div>
        </TD>

        <TD className="align-top text-right">
          <input
            type="number"
            min="0"
            step="1"
            className="input h-7 py-0 text-[12px] w-16 text-right"
            value={row.qtyPerSet}
            onChange={(e) => onChange({ qtyPerSet: Number(e.target.value) })}
            aria-label={`Quantity per set for ${row.name} / Số lượng mỗi bộ`}
          />
          <div className="text-[10px] text-gray-500 mt-1">= {row.qty} pcs</div>
        </TD>

        <TD className="align-top text-right whitespace-nowrap">
          <div className="font-mono text-[12px] font-semibold text-gray-900">
            {est.feasible ? formatMoney(est.unitPrice, commercial) : '—'}
          </div>
          <div className="text-[10px] text-gray-500">
            cost {formatMoney(est.unitCost, commercial)}
          </div>
        </TD>

        <TD className="align-top text-right whitespace-nowrap">
          <div className="font-mono text-[13px] font-semibold text-primary-600">
            {est.feasible && row.qtyPerSet > 0 ? formatMoney(est.lineTotal, commercial) : '—'}
          </div>
          {est.leadDays != null && (
            <div className="text-[10px] text-gray-500">{est.leadDays} days</div>
          )}
        </TD>

        <TD className="align-top">
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              className="icon-btn"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} cost breakdown for ${row.name} / Chi tiết giá`}
            >
              {expanded ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />}
            </button>
            <button
              type="button"
              className="icon-btn text-red-500 hover:text-red-700"
              onClick={onRemove}
              aria-label={`Remove ${row.name} / Xóa chi tiết`}
            >
              <IconTrash size={14} />
            </button>
          </div>
        </TD>
      </TR>

      {expanded && (
        <tr>
          {/* The row detail lives inside a horizontally scrolling table, so it
              is pinned to the left edge of the viewport to stay readable. */}
          <td colSpan={9} className="border-b border-gray-200 bg-gray-50 p-0">
            <div className="sticky left-0 w-[min(1100px,88vw)] px-4 py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-5">
              <div>
                <div className="label mb-2">Cost breakdown / Cấu thành giá</div>
                <div className="space-y-1">
                  {est.lines.map((l) => (
                    <div key={l.key} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="text-gray-700">
                        {l.en}
                        <span className="block text-[10px] text-gray-500">{l.vn}</span>
                      </span>
                      <span className="font-mono text-gray-900 whitespace-nowrap">
                        {formatMoney(l.amount, commercial)}
                      </span>
                    </div>
                  ))}
                  <Divider />
                  <Line label="Shop cost / Giá thành" value={formatMoney(est.unitCost, commercial)} />
                  <Line
                    label={`Overhead ${settings.commercial.overheadPct}% / Chi phí chung`}
                    value={formatMoney(est.overhead, commercial)}
                  />
                  <Line
                    label={`Margin ${settings.commercial.marginPct}% / Lợi nhuận`}
                    value={formatMoney(est.margin, commercial)}
                  />
                  <Divider />
                  <Line
                    label="Unit price / Đơn giá"
                    value={formatMoney(est.unitPrice, commercial)}
                    strong
                  />
                  {est.minChargeApplied && (
                    <div className="text-[10px] text-amber-600 mt-1">
                      Minimum charge applied — the calculated cost was lower.
                      <span className="block text-gray-500">
                        Đã áp mức tối thiểu — chi phí tính ra thấp hơn mức tối thiểu.
                      </span>
                    </div>
                  )}
                </div>

                {(est.warnings.length > 0 || !est.feasible) && (
                  <div className="mt-3 space-y-1">
                    {[...est.blockers, ...est.warnings].map((w, i) => (
                      <div key={i} className="text-[11px] flex items-start gap-1.5 text-amber-700">
                        <IconAlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          {w.en}
                          <span className="block text-gray-600">{w.vn}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="label mb-2">
                  Compare routes / So sánh phương án — {row.qty} pcs
                </div>
                <ProcessComparison
                  candidates={row.suggestion.candidates}
                  commercial={commercial}
                  activeProcessId={est.processId}
                  onPick={(c) => onChange({ processId: c.processId, materialId: c.materialId })}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Line({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className={cx('text-gray-700', strong && 'font-semibold text-gray-900')}>{label}</span>
      <span
        className={cx(
          'font-mono whitespace-nowrap',
          strong ? 'font-semibold text-primary-600' : 'text-gray-900'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 my-1.5" />;
}
