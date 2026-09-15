import { cx } from '@/lib/cx';

const STATUS_STYLES = {
  draft: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  in_review: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  released: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  obsolete: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  open: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  implemented: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  pass: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  fail: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  conditional: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
};

const STATUS_LABELS = {
  draft: { en: 'Draft', vn: 'Bản nháp' },
  in_review: { en: 'In Review', vn: 'Đang duyệt' },
  approved: { en: 'Approved', vn: 'Đã duyệt' },
  released: { en: 'Released', vn: 'Phát hành' },
  obsolete: { en: 'Obsolete', vn: 'Lỗi thời' },
  open: { en: 'Open', vn: 'Mở' },
  rejected: { en: 'Rejected', vn: 'Từ chối' },
  implemented: { en: 'Implemented', vn: 'Đã thực hiện' },
  closed: { en: 'Closed', vn: 'Đã đóng' },
  pass: { en: 'Pass', vn: 'Đạt' },
  fail: { en: 'Fail', vn: 'Không đạt' },
  conditional: { en: 'Conditional', vn: 'Có điều kiện' },
};

export function Badge({ status, children, className = '', bilingual = false }) {
  const style = STATUS_STYLES[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const label = STATUS_LABELS[status];
  return (
    <span className={cx('badge', style.bg, style.text, className)}>
      {children || (bilingual && label ? `${label.en} / ${label.vn}` : label?.en || status)}
    </span>
  );
}

export { STATUS_LABELS };
