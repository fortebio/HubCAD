import { useEffect, useRef, useState } from 'react';
import { IconSun, IconMoon, IconDeviceDesktop, IconChevronDown } from '@tabler/icons-react';
import { useThemeStore } from '@/stores/useThemeStore';
import { cx } from '@/lib/cx';

const MODES = [
  { value: 'light', icon: IconSun, en: 'Light', vn: 'Sáng' },
  { value: 'dark', icon: IconMoon, en: 'Dark', vn: 'Tối' },
  { value: 'system', icon: IconDeviceDesktop, en: 'System', vn: 'Theo hệ thống' },
];

export function ThemeToggle({ compact = false, className = '' }) {
  const mode = useThemeStore((s) => s.mode);
  const effective = useThemeStore((s) => s.effective);
  const setMode = useThemeStore((s) => s.setMode);
  const toggle = useThemeStore((s) => s.toggle);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ActiveIcon = effective === 'dark' ? IconMoon : IconSun;

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        title={
          effective === 'dark'
            ? 'Switch to light / Chuyển sang sáng'
            : 'Switch to dark / Chuyển sang tối'
        }
        className={cx('icon-btn', className)}
        aria-label={
          effective === 'dark'
            ? 'Switch to light theme / Chuyển sang giao diện sáng'
            : 'Switch to dark theme / Chuyển sang giao diện tối'
        }
      >
        <ActiveIcon size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-[12px] transition-colors min-h-[34px] [@media(pointer:coarse)]:min-h-[44px]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${mode} / Giao diện`}
        title="Theme / Giao diện"
      >
        <ActiveIcon size={16} aria-hidden="true" />
        <span className="hidden sm:inline capitalize">{mode}</span>
        <IconChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Theme / Giao diện"
          className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-modal z-50 py-1 animate-dialog-in"
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setMode(m.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={cx(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-colors min-h-[36px] [@media(pointer:coarse)]:min-h-[44px]',
                  active ? 'text-primary-600 font-semibold' : 'text-gray-700'
                )}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="flex-1 leading-tight">
                  <span className="block">{m.en}</span>
                  <span className="block text-[10px] text-gray-500 font-normal">{m.vn}</span>
                </span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
