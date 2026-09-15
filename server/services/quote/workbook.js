import XLSX from 'xlsx';
// Shared with the browser so a price never formats two different ways.
import { toDisplay } from '../../../src/lib/costing/format.js';

const COLUMNS = [
  { key: 'index', label: 'No.', width: 5 },
  { key: 'name', label: 'Part / Chi tiết', width: 28 },
  { key: 'partNumber', label: 'Part No.', width: 14 },
  { key: 'process', label: 'Process / Phương án gia công', width: 26 },
  { key: 'material', label: 'Material / Vật liệu', width: 22 },
  { key: 'finish', label: 'Finish / Xử lý bề mặt', width: 22 },
  { key: 'dims', label: 'Size (mm)', width: 20 },
  { key: 'volume', label: 'Volume (cm³)', width: 13 },
  { key: 'mass', label: 'Mass (g)', width: 11 },
  { key: 'qtyPerSet', label: 'Qty / set', width: 10 },
  { key: 'qty', label: 'Total qty', width: 10 },
  { key: 'unitCost', label: 'Unit cost', width: 14 },
  { key: 'unitPrice', label: 'Unit price', width: 14 },
  { key: 'lineTotal', label: 'Line total', width: 16 },
  { key: 'leadDays', label: 'Lead (days)', width: 11 },
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function buildQuoteWorkbook(quote) {
  const { meta, rows, totals } = quote;
  const commercial = { currency: meta.currency, usdRate: meta.usdRate };
  const money = (vnd) => round2(toDisplay(vnd, commercial));
  const cur = meta.currency;

  const sheet = [
    [`QUOTATION / BÁO GIÁ — ${meta.quoteNumber}`],
    [meta.title],
    [],
    ['Customer / Khách hàng', meta.customer || '', 'Project / Dự án', meta.project || ''],
    ['Prepared by / Người lập', meta.preparedBy || '', 'Date / Ngày', new Date(meta.createdAt).toLocaleDateString('en-GB')],
    ['Sets / Số bộ', meta.sets, 'Currency / Tiền tệ', cur],
    ['Valid / Hiệu lực (days)', meta.validDays, 'Lead time / Giao hàng (days)', totals.leadDays],
    [],
    COLUMNS.map((c) => c.label),
  ];

  for (const r of rows) {
    sheet.push([
      r.index,
      r.name,
      r.partNumber,
      `${r.processEn}${r.processVn ? ` / ${r.processVn}` : ''}`,
      `${r.materialEn}${r.materialVn ? ` / ${r.materialVn}` : ''}`,
      r.finishEn ? `${r.finishEn}${r.finishVn ? ` / ${r.finishVn}` : ''}` : '—',
      r.dimsMm.length === 3 ? r.dimsMm.map((d) => round2(d)).join(' × ') : '',
      round2(r.volumeCm3),
      round2(r.massG),
      r.qtyPerSet,
      r.qty,
      money(r.unitCost),
      money(r.unitPrice),
      money(r.lineTotal),
      r.leadDays ?? '',
    ]);
  }

  sheet.push([]);
  sheet.push(['', '', '', '', '', '', '', '', '', '', 'Shop cost', money(totals.cost)]);
  sheet.push(['', '', '', '', '', '', '', '', '', '', 'Subtotal', money(totals.subtotal)]);
  if (meta.applyVat) {
    sheet.push(['', '', '', '', '', '', '', '', '', '', `VAT ${meta.vatPct}%`, money(totals.vat)]);
  }
  sheet.push(['', '', '', '', '', '', '', '', '', '', `TOTAL (${cur})`, money(totals.grandTotal)]);
  sheet.push(['', '', '', '', '', '', '', '', '', '', 'Price per set', money(totals.pricePerSet)]);
  sheet.push(['', '', '', '', '', '', '', '', '', '', 'Mass per set (g)', round2(totals.massPerSetG)]);
  sheet.push([]);
  if (meta.notesEn) sheet.push(['Notes', meta.notesEn]);
  if (meta.notesVn) sheet.push(['Ghi chú', meta.notesVn]);

  const ws = XLSX.utils.aoa_to_sheet(sheet);
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));

  // Second sheet: the cost breakdown behind every unit price.
  const breakdown = [['Part / Chi tiết', 'Cost line / Khoản mục', 'Khoản mục (VN)', `Amount (${cur})`]];
  for (const r of rows) {
    for (const line of r.lines) {
      breakdown.push([r.name, line.en, line.vn, money(line.amount || 0)]);
    }
    breakdown.push([r.name, 'Unit cost (shop)', 'Giá thành xưởng', money(r.unitCost)]);
    breakdown.push([r.name, 'Unit price (quoted)', 'Đơn giá báo', money(r.unitPrice)]);
    breakdown.push([]);
  }
  const wsBreakdown = XLSX.utils.aoa_to_sheet(breakdown);
  wsBreakdown['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 32 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
  XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Cost breakdown');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
