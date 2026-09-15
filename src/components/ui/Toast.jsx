import {
  IconCircleCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';
import { useToastStore } from '@/stores/useToastStore';
import { cx } from '@/lib/cx';

const TONES = {
  success: {
    icon: IconCircleCheck,
    bar: 'bg-emerald-500',
    iconClass: 'text-emerald-600',
  },
  error: {
    icon: IconAlertCircle,
    bar: 'bg-red-500',
    iconClass: 'text-red-600',
  },
  warning: {
    icon: IconAlertTriangle,
    bar: 'bg-amber-500',
    iconClass: 'text-amber-600',
  },
  info: {
    icon: IconInfoCircle,
    bar: 'bg-primary-500',
    iconClass: 'text-primary-500',
  },
};

/**
 * Toast viewport. Rendered once in the app shell.
 * Errors are announced assertively, everything else politely.
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const tone = TONES[t.type] || TONES.info;
        const Icon = tone.icon;
        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="animate-toast-in pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 rounded-card shadow-modal pl-0 pr-3 py-3 overflow-hidden"
          >
            <div className={cx('w-1 self-stretch shrink-0', tone.bar)} aria-hidden="true" />
            <Icon size={18} className={cx('mt-0.5 shrink-0', tone.iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-gray-900 break-words">{t.title}</div>
              {t.detail && (
                <div className="text-[11px] text-gray-500 mt-0.5 break-words">{t.detail}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="icon-btn shrink-0 -mr-1"
              aria-label="Dismiss notification / Đóng thông báo"
            >
              <IconX size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
