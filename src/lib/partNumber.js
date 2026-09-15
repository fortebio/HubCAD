export const CATEGORIES = {
  HSG: { en: 'Housing', vn: 'Vỏ' },
  PCB: { en: 'Circuit board', vn: 'Bo mạch' },
  BRK: { en: 'Bracket', vn: 'Giá đỡ' },
  FAS: { en: 'Fastener', vn: 'Phụ kiện kết nối' },
  CAB: { en: 'Cable', vn: 'Dây cáp' },
  LBL: { en: 'Label', vn: 'Nhãn' },
  PKG: { en: 'Packaging', vn: 'Bao bì' },
};

// Skip I, O, Q, S, X, Z to avoid confusion with digits and obscure letters
const PART_REV_SEQUENCE = 'ABCDEFGHJKLMNPRTUVWY';

export function nextPartRev(rev) {
  if (!rev || rev === '-') return 'A';
  const idx = PART_REV_SEQUENCE.indexOf(rev.toUpperCase());
  if (idx < 0 || idx === PART_REV_SEQUENCE.length - 1) return rev;
  return PART_REV_SEQUENCE[idx + 1];
}

export function nextDocRev(rev) {
  if (!rev || rev === '-') return '01';
  const n = Number(rev);
  if (!Number.isFinite(n)) return '01';
  return String(n + 1).padStart(2, '0');
}

export function formatFileName({ partNo, docType, rev, ext, date = new Date() }) {
  const ymd =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  return `${partNo}_${docType}_Rev${rev}_${ymd}.${ext}`;
}

export function parsePartNumber(part) {
  const m = /^([A-Z]+)-(\d+)(?:-([A-Z0-9]+))?$/.exec(part || '');
  if (!m) return null;
  return { category: m[1], sequence: m[2], rev: m[3] || null };
}
