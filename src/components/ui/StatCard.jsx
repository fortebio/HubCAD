import { cx } from '@/lib/cx';

const TONES = {
  primary: 'bg-primary-50 text-primary-500',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  info: 'bg-indigo-50 text-indigo-600',
  purple: 'bg-violet-50 text-violet-600',
};

export function StatCard({ icon, value, label, sublabel, tone = 'primary', className = '' }) {
  return (
    <div className={cx('card flex items-center gap-3', className)}>
      <div className={cx('w-11 h-11 rounded-card flex items-center justify-center shrink-0', TONES[tone] || TONES.primary)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[22px] font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-xs text-gray-600 mt-1.5">{label}</div>
        {sublabel && <div className="text-[11px] text-gray-600 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
