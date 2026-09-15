import { useAuthStore } from '@/stores/useAuthStore';
import { IconLogout, IconUserCircle } from '@tabler/icons-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const ROLE_BADGE = {
  manager: 'badge bg-violet-100 text-violet-800 py-0 px-1.5',
  reviewer: 'badge bg-blue-100 text-blue-800 py-0 px-1.5',
  designer: 'badge bg-gray-100 text-gray-700 py-0 px-1.5',
};

export function Header({ title, subtitle, breadcrumb, action }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    // Sticky from md up: the page title and primary action stay reachable
    // while scrolling long tables. On mobile the sidebar's own bar is sticky.
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:sticky md:top-0 md:z-20">
      <div className="min-w-0">
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="text-xs text-gray-500 mb-1">
            {breadcrumb}
          </nav>
        )}
        <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {action}
        <ThemeToggle />
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <IconUserCircle size={28} className="text-gray-400" aria-hidden="true" />
          <div className="text-right leading-tight">
            <div className="text-[13px] font-medium text-gray-800">
              {user?.fullName || 'Guest'}
            </div>
            {user?.role && (
              <div className="text-[11px] inline-flex items-center gap-1">
                <span className={ROLE_BADGE[user.role] || ROLE_BADGE.designer}>{user.role}</span>
              </div>
            )}
          </div>
          {user && (
            <button
              type="button"
              onClick={logout}
              className="icon-btn"
              aria-label="Sign out / Đăng xuất"
              title="Sign out / Đăng xuất"
            >
              <IconLogout size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
