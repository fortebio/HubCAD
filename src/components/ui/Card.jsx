import { cx } from '@/lib/cx';

export function Card({ children, className = '', interactive = false, onClick, ...rest }) {
  return (
    <div
      onClick={onClick}
      className={cx('card', interactive && 'card-interactive', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action, className = '' }) {
  return (
    <div className={cx('flex items-start justify-between mb-4', className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          {subtitle && <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}
