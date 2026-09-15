import { cx } from '@/lib/cx';

export function ProgressBar({ value, max = 100, color = 'primary', className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const colorClass =
    color === 'success'
      ? 'bg-emerald-500'
      : color === 'danger'
        ? 'bg-red-500'
        : color === 'warning'
          ? 'bg-amber-500'
          : 'bg-primary-500';
  return (
    <div className={cx('w-full h-2 bg-gray-100 rounded-full overflow-hidden', className)}>
      <div className={cx('h-full transition-all duration-300', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}
