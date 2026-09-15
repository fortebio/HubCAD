import { IconLoader2 } from '@tabler/icons-react';
import { cx } from '@/lib/cx';

const variantClass = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  type = 'button',
  disabled,
  ...rest
}) {
  return (
    <button
      type={type}
      // Busy buttons stay visible but reject further clicks, so a slow save
      // cannot be fired twice.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(variantClass[variant] || 'btn-primary', size === 'sm' && 'btn-sm', className)}
      {...rest}
    >
      {loading && (
        <IconLoader2
          size={size === 'sm' ? 13 : 15}
          className="animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
