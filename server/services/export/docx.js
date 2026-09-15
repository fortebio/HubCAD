// DOCX generator. Output opens cleanly in MS Word, Google Docs (upload to
// Drive → "Open with Google Docs"), and LibreOffice. Font is set to
// "Be Vietnam Pro" everywhere; Office systems without that font fall back to
// their default sans which still renders Vietnamese correctly (unlike PDF's
// built-in Helvetica).

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ImageRun,
  ShadingType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const UPLOAD_DIR = path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR || './uploads');

const FONT = 'Be Vietnam Pro';
const MONO_FONT = 'JetBrains Mono';

function loadImage(p) {
  if (!p) return null;
  const stripped = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p;
  const abs = path.join(UPLOAD_DIR, stripped);
  if (!fs.existsSync(abs)) return null;
  const ext = path.extname(abs).slice(1).toLowerCase();
  const type = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : ext;
  return { data: fs.readFileSync(abs), type };
}

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 60, ...opts.spacing },
    alignment: opts.align,
    children: [
      new TextRun({
        text: String(text ?? ''),
        font: opts.mono ? MONO_FONT : FONT,
        size: opts.size ?? 22, // half-points: 22 = 11pt
        bold: opts.bold,
        italics: opts.italic,
        color: opts.color,
      }),
    ],
  });
}

function H1(text, sub) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
      children: [new TextRun({ text: String(text ?? ''), font: FONT, size: 44, bold: true })],
    }),
    ...(sub
      ? [
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: String(sub), font: FONT, size: 22, italics: true, color: '6b7280' })],
          }),
        ]
      : []),
  ];
}

function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb', space: 2 } },
    children: [new TextRun({ text: String(text ?? ''), font: FONT, size: 28, bold: true })],
  });
}

function cell(content, opts = {}) {
  const children = Array.isArray(content) ? content : [content];
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.shading }
      : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: children.map((c) =>
      typeof c === 'string'
        ? new Paragraph({
            alignment: opts.align,
            children: [
              new TextRun({
                text: c,
                font: opts.mono ? MONO_FONT : FONT,
                size: opts.size ?? 20,
                bold: opts.bold,
                color: opts.color,
              }),
            ],
          })
        : c
    ),
  });
}

function headerCell(label, opts = {}) {
  return cell(label, { ...opts, shading: 'f3f4f6', bold: true, size: 18, color: '6b7280' });
}

function metaTable(items) {
  // 2 columns x N rows; label + value pairs
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i];
    const b = items[i + 1];
    rows.push(
      new TableRow({
        children: [
          headerCell(a?.label || '', { width: 25 }),
          cell(String(a?.value ?? '—'), { width: 25, mono: a?.mono, bold: true, size: 20 }),
          headerCell(b?.label || '', { width: 25 }),
          cell(String(b?.value ?? '—'), { width: 25, mono: b?.mono, bold: true, size: 20 }),
        ],
      })
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function dataTable({ headers, rows, columnWidths, rowZebra = true }) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      headerCell(h.label || h, {
        width: columnWidths?.[i],
        align: h.align,
      })
    ),
  });
  const dataRows = rows.map((r, idx) =>
    new TableRow({
      children: r.map((c, i) => {
        const opts = {
          width: columnWidths?.[i],
          shading: rowZebra && idx % 2 === 1 ? 'fafafa' : undefined,
          align: headers[i]?.align,
          mono: headers[i]?.mono,
          size: 18,
        };
        if (c && typeof c === 'object' && 'cell' in c) return cell(c.cell, { ...opts, ...c });
        return cell(String(c ?? ''), opts);
      }),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function buildDoc(children) {
  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } },
        },
        children,
      },
    ],
  });
}

export async function bomDocx({ doc, header, items, watermark }) {
  const totalCost = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);
  const children = [
    ...H1(doc.nameEn || `BOM — ${header?.assemblyNo || doc.docNumber}`, doc.nameVn),
    metaTable([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Assembly No.', value: header?.assemblyNo, mono: true },
      { label: 'Revision', value: header?.revision || doc.revision, mono: true },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
      { label: 'Total items', value: String(items.length) },
      { label: 'Total cost', value: `$${totalCost.toFixed(2)}` },
      { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
      { label: 'Watermark', value: watermark === 'none' ? '—' : watermark?.toUpperCase() },
    ]),
    P(' ', { size: 12 }),
    H2('Items / Danh mục vật liệu'),
    dataTable({
      headers: [
        { label: '#', align: AlignmentType.RIGHT },
        { label: 'Lv' },
        { label: 'Part No.', mono: true },
        { label: 'Description' },
        { label: 'Qty', align: AlignmentType.RIGHT, mono: true },
        { label: 'Unit' },
        { label: 'Material' },
        { label: 'Vendor' },
        { label: '$/u', align: AlignmentType.RIGHT, mono: true },
        { label: 'Sub', align: AlignmentType.RIGHT, mono: true },
      ],
      columnWidths: [4, 5, 14, 28, 7, 6, 12, 12, 6, 6],
      rows: items.map((it, idx) => {
        const sub = (Number(it.unitCost) || 0) * (Number(it.qty) || 0);
        const descPara = new Paragraph({
          children: [
            new TextRun({ text: it.descEn || '', font: FONT, size: 18 }),
            ...(it.descVn ? [new TextRun({ text: '\n' + it.descVn, font: FONT, size: 16, color: '6b7280' })] : []),
          ],
        });
        return [
          String(idx + 1),
          String(it.level ?? ''),
          it.partNumber || '',
          { cell: descPara },
          String(it.qty ?? ''),
          it.unit || '',
          it.material || '—',
          it.vendor || '—',
          it.unitCost != null ? Number(it.unitCost).toFixed(2) : '—',
          sub.toFixed(2),
        ];
      }),
    }),
    P(' ', { size: 10 }),
    P(`Total: $${totalCost.toFixed(2)}`, { bold: true, align: AlignmentType.RIGHT, size: 24 }),
  ];
  return Packer.toBuffer(buildDoc(children));
}

export async function wiDocx({ doc, meta, steps, watermark }) {
  const stepChildren = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    stepChildren.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, font: FONT, size: 24, color: '1a6ff5' }),
          new TextRun({ text: s.titleEn || '', bold: true, font: FONT, size: 24 }),
        ],
      })
    );
    if (s.titleVn) stepChildren.push(P(s.titleVn, { italic: true, color: '6b7280', size: 20 }));
    if (s.bodyEn) stepChildren.push(P(s.bodyEn));
    if (s.bodyVn) stepChildren.push(P(s.bodyVn, { italic: true, color: '6b7280' }));
    if (s.tools) stepChildren.push(P(`Tools / Dụng cụ: ${s.tools}`, { size: 18, color: '6b7280' }));
    if (s.caution) stepChildren.push(P(`⚠ Caution / Lưu ý: ${s.caution}`, { size: 18, color: 'b91c1c', bold: true }));
    const img = loadImage(s.imagePath);
    if (img) {
      stepChildren.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new ImageRun({ data: img.data, transformation: { width: 280, height: 200 } })],
        })
      );
    }
  }

  const children = [
    ...H1(meta.titleEn || doc.nameEn || `WI — ${doc.docNumber}`, meta.titleVn || doc.nameVn),
    metaTable([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Revision', value: doc.revision, mono: true },
      { label: 'Station', value: meta.station },
      { label: 'Cycle time', value: meta.cycleTime },
      { label: 'Steps', value: String(steps.length) },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
      { label: 'Watermark', value: watermark === 'none' ? '—' : watermark?.toUpperCase() },
      { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
    ]),
    H2('Procedure / Trình tự'),
    ...(steps.length === 0 ? [P('No steps defined yet.', { italic: true, color: '9ca3af' })] : stepChildren),
  ];
  return Packer.toBuffer(buildDoc(children));
}

export async function catalogDocx({ doc, data, watermark }) {
  const features = (data.features || []).filter((f) => f.en);
  const specs = (data.specs || []).filter((s) => s.key);
  const hero = loadImage(data.heroImage);

  const children = [
    ...H1(data.productNameEn || doc.nameEn || `Catalog — ${doc.docNumber}`, data.productNameVn || doc.nameVn),
  ];
  if (hero) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new ImageRun({ data: hero.data, transformation: { width: 320, height: 220 } })],
      })
    );
  }
  if (data.tagline) children.push(P(data.tagline, { italic: true, color: '1a6ff5' }));
  if (data.description) children.push(P(data.description));
  children.push(
    metaTable([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Revision', value: doc.revision, mono: true },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
      { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
    ])
  );
  if (features.length > 0) {
    children.push(H2('Key features / Tính năng nổi bật'));
    for (const f of features) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: '• ', bold: true, color: '1a6ff5', font: FONT }),
            new TextRun({ text: f.en, font: FONT, size: 22 }),
            ...(f.vn ? [new TextRun({ text: ` — ${f.vn}`, italic: true, color: '6b7280', font: FONT, size: 20 })] : []),
          ],
        })
      );
    }
  }
  if (specs.length > 0) {
    children.push(H2('Specifications / Thông số kỹ thuật'));
    children.push(
      dataTable({
        headers: [{ label: 'Spec' }, { label: 'Value (EN)' }, { label: 'Value (VN)' }],
        columnWidths: [32, 36, 32],
        rows: specs.map((s) => [s.key, s.valueEn || '—', s.valueVn || '']),
      })
    );
  }
  if (data.certifications || data.warranty) {
    children.push(P(' ', { size: 12 }));
    if (data.certifications) children.push(P(`Certifications: ${data.certifications}`, { size: 18, color: '6b7280' }));
    if (data.warranty) children.push(P(`Warranty / Bảo hành: ${data.warranty}`, { size: 18, color: '6b7280' }));
  }
  return Packer.toBuffer(buildDoc(children));
}

const DRAWING_VIEWS = [
  { key: 'viewFront', label: 'FRONT', vn: 'Hình chiếu đứng' },
  { key: 'viewTop', label: 'TOP', vn: 'Hình chiếu bằng' },
  { key: 'viewSide', label: 'SIDE', vn: 'Hình chiếu cạnh' },
  { key: 'viewIso', label: 'ISO', vn: 'Hình chiếu trục đo' },
];

function viewCellDocx(sheet, v) {
  const img = loadImage(sheet?.[v.key]);
  const children = [];
  if (img) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: img.data, transformation: { width: 220, height: 170 } })],
      })
    );
  } else {
    children.push(P('— no view —', { italic: true, color: '9ca3af', align: AlignmentType.CENTER }));
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60 },
      children: [
        new TextRun({ text: v.label, font: FONT, size: 18, bold: true }),
        new TextRun({ text: ` · ${v.vn}`, font: FONT, size: 16, color: '6b7280' }),
      ],
    })
  );
  return cell(children, { width: 50 });
}

export async function drawingDocx({ doc, revisions, project, sheet, watermark }) {
  const hasViews = sheet && (sheet.viewFront || sheet.viewTop || sheet.viewSide || sheet.viewIso);
  const children = [...H1(doc.nameEn || doc.docNumber, doc.nameVn)];

  if (hasViews) {
    children.push(H2('Views / Hình chiếu'));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [viewCellDocx(sheet, DRAWING_VIEWS[0]), viewCellDocx(sheet, DRAWING_VIEWS[1])] }),
          new TableRow({ children: [viewCellDocx(sheet, DRAWING_VIEWS[2]), viewCellDocx(sheet, DRAWING_VIEWS[3])] }),
        ],
      })
    );
    children.push(P(' ', { size: 12 }));

    // ISO 7200 title block
    children.push(H2('Title block / Khung tên (ISO 7200)'));
    children.push(
      metaTable([
        { label: 'Company / Công ty', value: 'Forte Biotech' },
        { label: 'Doc number', value: doc.docNumber, mono: true },
        { label: 'Title (EN)', value: doc.nameEn },
        { label: 'Title (VN)', value: doc.nameVn },
        { label: 'Revision', value: doc.revision, mono: true },
        { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
        { label: 'Scale', value: sheet.scale || '1:1' },
        { label: 'Projection', value: sheet.projection === 'first_angle' ? '1st angle (ISO)' : '3rd angle (ISO)' },
        { label: 'Sheet size', value: sheet.sheetSize || 'A4' },
        { label: 'Unit', value: 'mm' },
        { label: 'Standard', value: sheet.standardRef || 'ISO 128 / ISO 7200' },
        { label: 'Customer', value: sheet.customer },
        {
          label: 'Bounding box',
          value: sheet.dimX != null ? `${sheet.dimX.toFixed(2)} × ${sheet.dimY.toFixed(2)} × ${sheet.dimZ.toFixed(2)} mm` : '—',
          mono: true,
        },
        { label: 'Mass / Khối lượng', value: sheet.weight != null ? `${Number(sheet.weight).toFixed(2)} g` : '—' },
        { label: 'Material / Vật liệu', value: sheet.material },
        { label: 'Treatment / Xử lý nhiệt', value: sheet.treatment },
        { label: 'Surface finish / Bề mặt', value: sheet.surfaceFinish },
        { label: 'General tolerance', value: sheet.tolerance || 'ISO 2768-mK' },
        { label: 'Triangles', value: sheet.triangles != null ? sheet.triangles.toLocaleString() : '—' },
        { label: 'Source file', value: sheet.sourceFile, mono: true },
        { label: 'Project', value: project?.name },
        { label: 'Designer / Thiết kế', value: sheet.designer },
        { label: 'Checker / Kiểm tra', value: sheet.checker },
        { label: 'Approver / Phê duyệt', value: sheet.approver },
        {
          label: 'Approval date',
          value: sheet.approverDate ? new Date(sheet.approverDate).toLocaleDateString('en-GB') : null,
          mono: true,
        },
      ])
    );

    if (sheet.generalNotes) {
      children.push(H2('General notes / Ghi chú chung'));
      const lines = String(sheet.generalNotes).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        children.push(P(`${String(i + 1).padStart(2, '0')}.  ${lines[i]}`, { size: 20 }));
      }
    }
    if (sheet.notes) {
      children.push(H2('Notes / Ghi chú'));
      children.push(P(sheet.notes));
    }
  } else {
    children.push(
      metaTable([
        { label: 'Doc number', value: doc.docNumber, mono: true },
        { label: 'Revision', value: doc.revision, mono: true },
        { label: 'Type', value: doc.docType?.toUpperCase() },
        { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
        { label: 'Project', value: project?.name || '—' },
        { label: 'Project code', value: project?.code, mono: true },
        { label: 'Created', value: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-GB') : '—' },
        { label: 'Updated', value: doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('en-GB') : '—' },
      ])
    );
  }

  children.push(H2('Revision history / Lịch sử sửa đổi'));
  if (revisions.length === 0) {
    children.push(P('No revision history yet.', { italic: true, color: '9ca3af' }));
  } else {
    children.push(
      dataTable({
        headers: [{ label: 'Rev', mono: true }, { label: 'Change description' }, { label: 'Date' }],
        columnWidths: [10, 65, 25],
        rows: revisions.map((r) => [
          r.revision,
          r.changeDesc || '—',
          r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : '',
        ]),
      })
    );
  }

  children.push(H2('Signoff / Phê duyệt'));
  children.push(
    dataTable({
      headers: [{ label: 'Role' }, { label: 'Name' }, { label: 'Date' }],
      columnWidths: [30, 50, 20],
      rows: [
        ['Designer / Thiết kế', '', ''],
        ['Reviewer / Kiểm tra', '', ''],
        ['Approver / Phê duyệt', '', ''],
      ],
    })
  );

  return Packer.toBuffer(buildDoc(children));
}

const TITLE_BY_TYPE = {
  drawing: 'Drawing checklist',
  dfm: 'DFM / DFA review',
  release: 'Release checklist',
};

export async function checklistDocx({ doc, checklistType, sections, result, watermark }) {
  const results = result?.results || {};
  let ok = 0, ng = 0, total = 0;
  for (let s = 0; s < sections.length; s++) {
    for (let i = 0; i < sections[s].items.length; i++) {
      const k = `${sections[s].audience ?? s}-${i}`;
      if (results[k] === 'ok') ok++;
      else if (results[k] === 'ng') ng++;
      total++;
    }
  }

  const children = [
    ...H1(TITLE_BY_TYPE[checklistType] || 'Checklist', `${doc.docNumber}${doc.nameEn ? ' — ' + doc.nameEn : ''}`),
    metaTable([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Revision', value: doc.revision, mono: true },
      { label: 'Checklist type', value: checklistType?.toUpperCase() },
      { label: 'Overall', value: (result?.overall || '—').toUpperCase() },
      { label: 'OK', value: String(ok) },
      { label: 'NG', value: String(ng) },
      { label: 'Total items', value: String(total) },
      { label: 'Checked at', value: result?.checkedAt ? new Date(result.checkedAt).toLocaleString('en-GB') : '—' },
    ]),
  ];

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const sec = sections[sIdx];
    children.push(H2(`${sec.title?.en || ''}${sec.title?.vn ? ` · ${sec.title.vn}` : ''}`));
    children.push(
      dataTable({
        headers: [
          { label: '#', align: AlignmentType.CENTER },
          { label: 'English' },
          { label: 'Tiếng Việt' },
          { label: 'Result', align: AlignmentType.CENTER },
        ],
        columnWidths: [5, 47, 40, 8],
        rows: (sec.items || []).map((it, iIdx) => {
          const k = `${sec.audience ?? sIdx}-${iIdx}`;
          const v = results[k];
          return [
            String(iIdx + 1),
            it.en,
            it.vn,
            v ? v.toUpperCase() : '—',
          ];
        }),
      })
    );
  }
  if (result?.remarks) {
    children.push(H2('Remarks / Ghi chú'));
    children.push(P(result.remarks));
  }
  return Packer.toBuffer(buildDoc(children));
}

export async function renderDocx(payload) {
  switch (payload.kind) {
    case 'bom': return bomDocx(payload);
    case 'wi': return wiDocx(payload);
    case 'catalog': return catalogDocx(payload);
    case 'drawing': return drawingDocx(payload);
    case 'checklist': return checklistDocx(payload);
    default: throw new Error(`Unknown kind: ${payload.kind}`);
  }
}
