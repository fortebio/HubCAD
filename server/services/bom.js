import XLSX from 'xlsx';

const COL_ORDER = [
  'itemNo',
  'level',
  'partNumber',
  'descEn',
  'descVn',
  'qty',
  'unit',
  'material',
  'vendor',
  'unitCost',
  'leadTime',
  'remarks',
];

const COL_LABELS = {
  itemNo: 'Item #',
  level: 'Level',
  partNumber: 'Part No.',
  descEn: 'Description (EN)',
  descVn: 'Mô tả (VN)',
  qty: 'Qty',
  unit: 'Unit',
  material: 'Material',
  vendor: 'Vendor',
  unitCost: 'Unit cost',
  leadTime: 'Lead time',
  remarks: 'Remarks',
};

const LABEL_TO_FIELD = (() => {
  const map = {};
  for (const [field, label] of Object.entries(COL_LABELS)) {
    map[label.toLowerCase()] = field;
    map[field.toLowerCase()] = field;
  }
  // common aliases for excel imports
  map['part number'] = 'partNumber';
  map['part no'] = 'partNumber';
  map['description'] = 'descEn';
  map['quantity'] = 'qty';
  map['cost'] = 'unitCost';
  map['unit cost'] = 'unitCost';
  return map;
})();

export function buildBOMWorkbook({ header, items, document }) {
  const totalCost = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);

  const rows = [
    [`BOM — ${header?.assemblyNo || document?.docNumber || ''}`],
    [
      'Doc number',
      document?.docNumber || '',
      'Assembly',
      header?.assemblyNo || '',
      'Revision',
      header?.revision || document?.revision || '',
    ],
    ['Total items', String(items.length), 'Total cost (USD)', totalCost.toFixed(2)],
    [],
    COL_ORDER.map((k) => COL_LABELS[k]),
    ...items.map((it, idx) => [
      it.itemNo ?? idx + 1,
      it.level ?? 1,
      it.partNumber || '',
      it.descEn || '',
      it.descVn || '',
      Number(it.qty) || 0,
      it.unit || '',
      it.material || '',
      it.vendor || '',
      it.unitCost != null ? Number(it.unitCost) : '',
      it.leadTime || '',
      it.remarks || '',
    ]),
    [],
    ['', '', '', '', '', '', '', '', 'Total', totalCost.toFixed(2)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = COL_ORDER.map(() => ({ wch: 16 }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COL_ORDER.length - 1 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');
  return wb;
}

export function workbookToBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function parseBOMWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Workbook has no sheets');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  if (!rows.length) return { items: [] };

  // Find header row: the first row that contains "part" + ("desc" or "description")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i].map((c) => String(c).toLowerCase());
    if (cells.some((c) => c.includes('part')) && cells.some((c) => c.includes('desc'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error('Could not find header row (expected columns like "Part No.", "Description")');

  const headerRow = rows[headerIdx].map((c) => String(c).trim());
  const fieldByCol = headerRow.map((label) => LABEL_TO_FIELD[label.toLowerCase()] || null);

  const items = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    // skip footer total row (col 9 == 'Total')
    if (String(row[8]).toLowerCase() === 'total') continue;

    const item = {};
    for (let c = 0; c < row.length; c++) {
      const field = fieldByCol[c];
      if (!field) continue;
      let v = row[c];
      if (v === '' || v == null) continue;
      if (['itemNo', 'level'].includes(field)) v = Number(v);
      else if (['qty', 'unitCost'].includes(field)) v = Number(v);
      item[field] = v;
    }
    if (!item.partNumber && !item.descEn) continue;
    items.push(item);
  }
  return { items };
}

export function diffBOMItems(baseItems = [], compareItems = []) {
  const keyOf = (it) => it.partNumber || `${it.descEn}__${it.itemNo}`;
  const baseMap = new Map(baseItems.map((it) => [keyOf(it), it]));
  const compareMap = new Map(compareItems.map((it) => [keyOf(it), it]));

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  const TRACKED = ['qty', 'unit', 'level', 'material', 'vendor', 'unitCost', 'leadTime', 'descEn', 'descVn'];

  for (const [k, b] of baseMap) {
    if (!compareMap.has(k)) {
      removed.push(b);
      continue;
    }
    const c = compareMap.get(k);
    const fields = {};
    for (const f of TRACKED) {
      const bv = b[f] ?? null;
      const cv = c[f] ?? null;
      if (String(bv) !== String(cv)) fields[f] = { before: bv, after: cv };
    }
    if (Object.keys(fields).length) changed.push({ partNumber: k, before: b, after: c, fields });
    else unchanged.push(c);
  }
  for (const [k, c] of compareMap) {
    if (!baseMap.has(k)) added.push(c);
  }

  return { added, removed, changed, unchanged };
}
