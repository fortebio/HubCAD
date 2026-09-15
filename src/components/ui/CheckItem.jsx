import { cx } from '@/lib/cx';

const toggleBase =
  'h-8 [@media(pointer:coarse)]:h-11 rounded-md border text-xs font-semibold transition-colors';

export function CheckItem({ index, en, vn, value, onChange }) {
  const no = String(index).padStart(2, '0');
  return (
    <div className="grid grid-cols-[28px_1fr_56px_56px] md:grid-cols-[32px_1fr_1fr_64px_64px] items-center gap-2 md:gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="text-xs text-gray-500 mono">{no}</div>
      <div className="md:hidden text-[13px] leading-tight">
        <div className="text-gray-800">{en}</div>
        <div className="text-[11px] text-gray-500">{vn}</div>
      </div>
      <div className="hidden md:block text-[13px] text-gray-800">{en}</div>
      <div className="hidden md:block text-[12px] text-gray-500">{vn}</div>
      <button
        type="button"
        onClick={() => onChange?.(value === 'ok' ? null : 'ok')}
        // Screen readers announce which check is being marked, not a bare "OK".
        aria-label={`Mark item ${no} OK — ${en}`}
        aria-pressed={value === 'ok'}
        className={cx(
          toggleBase,
          value === 'ok'
            ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
        )}
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => onChange?.(value === 'ng' ? null : 'ng')}
        aria-label={`Mark item ${no} NG — ${en}`}
        aria-pressed={value === 'ng'}
        className={cx(
          toggleBase,
          value === 'ng'
            ? 'bg-red-100 border-red-500 text-red-800'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
        )}
      >
        NG
      </button>
    </div>
  );
}
