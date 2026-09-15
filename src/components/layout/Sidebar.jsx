import { NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  IconLayoutDashboard,
  Icon3dCubeSphere,
  IconListDetails,
  IconCalculator,
  IconAdjustments,
  IconChecklist,
  IconSettingsCheck,
  IconFileDescription,
  IconPresentation,
  IconRocket,
  IconReplace,
  IconTimeline,
  IconChevronLeft,
  IconChevronRight,
  IconDatabaseExport,
  IconUsers,
  IconHistory,
  IconMenu2,
  IconX,
} from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const COLLAPSE_KEY = 'app_sidebar_collapsed';

const SECTIONS = [
  {
    label: { en: 'Overview', vn: 'Tổng quan' },
    items: [{ to: '/', icon: IconLayoutDashboard, en: 'Dashboard', vn: 'Bảng điều khiển' }],
  },
  {
    label: { en: 'Design', vn: 'Thiết kế' },
    items: [
      { to: '/viewer', icon: Icon3dCubeSphere, en: '3D Viewer', vn: 'Xem 3D' },
      { to: '/bom', icon: IconListDetails, en: 'BOM Manager', vn: 'Quản lý BOM' },
      { to: '/quote', icon: IconCalculator, en: 'Cost & Quote', vn: 'Ước tính & Báo giá' },
    ],
  },
  {
    label: { en: 'Review', vn: 'Kiểm tra' },
    items: [
      { to: '/checklist', icon: IconChecklist, en: 'Drawing Checklist', vn: 'Checklist bản vẽ' },
      { to: '/dfm', icon: IconSettingsCheck, en: 'DFM / DFA Review', vn: 'Đánh giá DFM/DFA' },
    ],
  },
  {
    label: { en: 'Publish', vn: 'Phát hành' },
    items: [
      { to: '/wi', icon: IconFileDescription, en: 'WI Document', vn: 'Hướng dẫn lắp ráp' },
      { to: '/catalog', icon: IconPresentation, en: 'Catalog / Datasheet', vn: 'Catalog / Tờ thông số' },
      { to: '/release', icon: IconRocket, en: 'Release', vn: 'Phát hành' },
    ],
  },
  {
    label: { en: 'Change', vn: 'Thay đổi' },
    items: [
      { to: '/ecr', icon: IconReplace, en: 'ECR / ECO / ECN', vn: 'Yêu cầu thay đổi' },
      { to: '/tracker', icon: IconTimeline, en: 'Doc Tracker', vn: 'Theo dõi tài liệu' },
    ],
  },
  {
    label: { en: 'System', vn: 'Hệ thống' },
    items: [
      { to: '/users', icon: IconUsers, en: 'Users', vn: 'Người dùng' },
      { to: '/pricing', icon: IconAdjustments, en: 'Cost rates', vn: 'Đơn giá gia công' },
      { to: '/audit', icon: IconHistory, en: 'Activity log', vn: 'Nhật ký' },
      { to: '/backup', icon: IconDatabaseExport, en: 'Backup', vn: 'Sao lưu' },
    ],
  },
];

const linkClass = ({ isActive }) =>
  cx(
    'flex items-center gap-3 px-4 py-2 text-[13px] border-r-[3px] transition-colors',
    // Touch devices get a full 44px row; a mouse keeps the denser rhythm.
    'min-h-[38px] [@media(pointer:coarse)]:min-h-[44px]',
    isActive
      ? 'bg-primary-100 text-primary-700 font-semibold border-primary-500'
      : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900'
  );

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable — collapse state is not critical */
    }
  }, [collapsed]);

  // Mobile drawer: lock the page behind it, close on Escape, and put focus
  // in the drawer on open / back on the menu button on close.
  useEffect(() => {
    if (!mobileOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);

    drawerRef.current?.querySelector('a, button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      menuBtnRef.current?.focus();
    };
  }, [mobileOpen]);

  const renderItems = (sec, onNavigate) =>
    sec.items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={linkClass}
          title={collapsed ? `${item.en} / ${item.vn}` : undefined}
        >
          <Icon size={18} className="shrink-0" aria-hidden="true" />
          {(!collapsed || onNavigate) && (
            <span className="leading-tight">
              <span className="block">{item.en}</span>
              {/* Inherit the link colour: a fixed grey fails contrast on the
                  tinted active row. Hierarchy comes from the smaller size. */}
              <span className="block text-[11px] font-normal opacity-90">{item.vn}</span>
            </span>
          )}
        </NavLink>
      );
    });

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary-500 text-white flex items-center justify-center font-bold text-xs">
            DT
          </div>
          <span className="text-[13px] font-semibold text-gray-900">Drawing Tool</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="icon-btn"
            aria-label="Open navigation menu / Mở menu"
            aria-expanded={mobileOpen}
          >
            <IconMenu2 size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-overlay-in" />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation / Điều hướng"
            onClick={(e) => e.stopPropagation()}
            className="relative w-72 max-w-[80%] bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold text-sm">
                  DT
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold text-gray-900">Drawing Tool</div>
                  <div className="text-[11px] text-gray-500">Forte Biotech</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="icon-btn"
                aria-label="Close navigation menu / Đóng menu"
              >
                <IconX size={18} aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 py-2" aria-label="Main / Chính">
              {SECTIONS.map((sec) => (
                <div key={sec.label.en} className="mb-2">
                  <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {sec.label.en} · {sec.label.vn}
                  </div>
                  {renderItems(sec, () => setMobileOpen(false))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cx(
          'hidden md:flex h-screen sticky top-0 shrink-0 bg-white border-r border-gray-200 transition-[width] duration-200 overflow-hidden flex-col',
          collapsed ? 'w-14' : 'w-60'
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
            DT
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-gray-900">Drawing Tool</div>
              <div className="text-[11px] text-gray-500">Forte Biotech</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2" aria-label="Main / Chính">
          {SECTIONS.map((sec) => (
            <div key={sec.label.en} className="mb-2">
              {!collapsed && (
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {sec.label.en} · {sec.label.vn}
                </div>
              )}
              {renderItems(sec)}
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-200 py-2 flex items-center justify-center gap-1">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="icon-btn"
            aria-label={
              collapsed ? 'Expand sidebar / Mở rộng thanh bên' : 'Collapse sidebar / Thu gọn thanh bên'
            }
            aria-pressed={collapsed}
            title={collapsed ? 'Expand / Mở rộng' : 'Collapse / Thu gọn'}
          >
            {collapsed ? (
              <IconChevronRight size={16} aria-hidden="true" />
            ) : (
              <IconChevronLeft size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
