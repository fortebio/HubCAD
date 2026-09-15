import { cx } from '@/lib/cx';
import { formatMoney, formatMass, formatMinutes } from '@/lib/costing/format';
import { IconCheck, IconAlertTriangle, IconSparkles } from '@tabler/icons-react';

/**
 * Every route this part could take, cheapest first. Clicking a workable row
 * pins that process + material onto the part, so the comparison is also the
 * way you change your mind.
 */
export function ProcessComparison({ candidates, commercial, activeProcessId, onPick }) {
  if (!candidates?.length) return null;
  const best = candidates.find((c) => c.feasible);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left font-semibold py-1.5 pr-3">Process / Phương án</th>
            <th className="text-left font-semibold py-1.5 pr-3">Material / Vật liệu</th>
            <th className="text-right font-semibold py-1.5 pr-3">Mass</th>
            <th className="text-right font-semibold py-1.5 pr-3">Time</th>
            <th className="text-right font-semibold py-1.5 pr-3">Lead</th>
            <th className="text-right font-semibold py-1.5 pr-3">Unit price</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const active = c.processId === activeProcessId;
            return (
              <tr
                key={`${c.processId}-${c.materialId}`}
                className={cx(
                  'border-t border-gray-100',
                  c.feasible ? 'hover:bg-gray-50' : 'opacity-70'
                )}
              >
                <td className="py-1.5 pr-3">
                  <button
                    type="button"
                    disabled={!c.feasible}
                    onClick={() => onPick?.(c)}
                    className={cx(
                      'text-left',
                      c.feasible ? 'hover:text-primary-600' : 'cursor-not-allowed'
                    )}
                    title={
                      c.feasible
                        ? `Use ${c.process.en} / Dùng ${c.process.vn}`
                        : c.blockers.map((b) => b.en).join('; ')
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={cx('badge', c.process.tone)}>{c.process.short}</span>
                      <span className="font-medium text-gray-800">{c.process.en}</span>
                      {c === best && (
                        <IconSparkles size={13} className="text-emerald-600" aria-label="Cheapest" />
                      )}
                      {active && <IconCheck size={13} className="text-primary-500" aria-label="Selected" />}
                    </span>
                    <span className="block text-[10px] text-gray-500">{c.process.vn}</span>
                  </button>
                </td>
                <td className="py-1.5 pr-3">
                  <span className="text-gray-800">{c.material?.en || '—'}</span>
                  <span className="block text-[10px] text-gray-500">{c.material?.vn}</span>
                </td>
                {c.feasible ? (
                  <>
                    <td className="py-1.5 pr-3 text-right font-mono">{formatMass(c.massG)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {formatMinutes(c.timeMinPerPart)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{c.leadDays ?? '—'} d</td>
                    <td className="py-1.5 pr-3 text-right font-mono font-semibold text-gray-900">
                      {formatMoney(c.unitPrice, commercial)}
                    </td>
                    <td className="py-1.5 text-right">
                      {c.minChargeApplied && (
                        <span title="Minimum charge applied / Đã áp mức tối thiểu" className="text-[10px] text-amber-600">
                          min
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="py-1.5 text-[11px] text-gray-600">
                    <span className="flex items-start gap-1">
                      <IconAlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                      <span>
                        {c.blockers.map((b) => b.en).join(' · ')}
                        <span className="block text-gray-500">
                          {c.blockers.map((b) => b.vn).join(' · ')}
                        </span>
                      </span>
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
