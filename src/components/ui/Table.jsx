import { cx } from '@/lib/cx';

/**
 * Scrollable table shell. The wrapper is focusable so a keyboard user can
 * scroll a wide table without a mouse, and the header can stick to the top
 * of the scroll area so column meaning survives long lists.
 */
export function Table({ children, className = '', stickyHeader = false, label, maxHeight }) {
  return (
    <div
      className={cx('w-full overflow-auto', stickyHeader && 'table-sticky', className)}
      style={maxHeight ? { maxHeight } : undefined}
      role={label ? 'region' : undefined}
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return <thead>{children}</thead>;
}

export function TR({ children, onClick, className = '', ...rest }) {
  const interactive = typeof onClick === 'function';
  return (
    <tr
      onClick={onClick}
      // A clickable row must also be reachable and activatable by keyboard.
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={cx(
        interactive && 'hover:bg-gray-50 cursor-pointer transition-colors',
        className
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({ children, className = '', scope = 'col', ...rest }) {
  return (
    <th
      scope={scope}
      className={cx(
        'text-left px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b-2 border-gray-200',
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({ children, mono = false, className = '', ...rest }) {
  return (
    <td
      className={cx(
        'px-2.5 py-2.5 border-b border-gray-200 align-middle',
        mono && 'font-mono font-medium text-primary-500',
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
