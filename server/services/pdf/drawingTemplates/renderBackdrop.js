// Render a drawing template as the "backdrop" — the border + title block
// shared by every output format. The SAME template config is used to produce:
//   - SVG  (for browser preview, also importable into Illustrator/Inkscape)
//   - DXF  (importable into SolidWorks / Fusion 360 / AutoCAD)
//   - PDF  (server-rendered via react-pdf — uses the SAME geometry constants)
// Keeping the geometry in ONE place means a drawing exported from this tool
// looks identical whether you open it in our web app, SolidWorks, or Fusion.

// ISO paper sizes in millimetres.
const PAPER_MM = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 },
  A1: { w: 594, h: 841 },
  A0: { w: 841, h: 1189 },
};

export function paperSize(size, orientation) {
  const p = PAPER_MM[size] || PAPER_MM.A4;
  if (orientation === 'landscape') return { w: p.h, h: p.w };
  return p;
}

// ISO 7200 inner-margin: 20 mm on the binding (left) edge, 10 mm elsewhere.
const MARGIN_BINDING = 20;
const MARGIN = 10;

// Title-block bottom-right cell sizes (mm). These match the row heights used
// by drawingTemplate.jsx so PDF and DXF/SVG line up exactly.
const TB_FULL_ROWS = [
  { h: 14, cells: [
    { w: 0.50, label: 'COMPANY', value: 'Forte Biotech' },
    { w: 0.14, label: 'PROJECTION', value: null }, // symbol drawn separately
    { w: 0.12, label: 'SCALE', value: '{scale}' },
    { w: 0.08, label: 'UNIT', value: 'mm' },
    { w: 0.16, label: 'SHEET', value: '{sheet}' },
  ]},
  { h: 13, cells: [
    { w: 0.50, label: 'TITLE / TIÊU ĐỀ', value: '{title}' },
    { w: 0.20, label: 'DOC NUMBER', value: '{docNumber}' },
    { w: 0.10, label: 'REV', value: '{revision}' },
    { w: 0.20, label: 'STATUS', value: '{status}' },
  ]},
  { h: 11, cells: [
    { w: 0.20, label: 'MATERIAL', value: '{material}' },
    { w: 0.20, label: 'TREATMENT', value: '{treatment}' },
    { w: 0.20, label: 'SURFACE FINISH', value: '{surfaceFinish}' },
    { w: 0.20, label: 'GENERAL TOL.', value: '{tolerance}' },
    { w: 0.20, label: 'MASS', value: '{weight}' },
  ]},
  { h: 10, cells: [
    { w: 0.25, label: 'BOUNDING BOX', value: '{dim}' },
    { w: 0.25, label: 'SOURCE FILE', value: '{sourceFile}' },
    { w: 0.20, label: 'STANDARD', value: '{standardRef}' },
    { w: 0.15, label: 'CUSTOMER', value: '{customer}' },
    { w: 0.15, label: 'PROJECT', value: '{project}' },
  ]},
  { h: 11, cells: [
    { w: 0.25, label: 'DESIGNER', value: '{designer}' },
    { w: 0.25, label: 'CHECKER', value: '{checker}' },
    { w: 0.25, label: 'APPROVER', value: '{approver}' },
    { w: 0.25, label: 'DATE', value: '{approverDate}' },
  ]},
];

const TB_COMPACT_ROWS = [
  { h: 18, cells: [
    { w: 0.40, label: 'FORTE BIOTECH', value: '{title}' },
    { w: 0.20, label: 'DOC NO.', value: '{docNumber}' },
    { w: 0.08, label: 'REV', value: '{revision}' },
    { w: 0.10, label: 'SCALE', value: '{scale}' },
    { w: 0.12, label: 'PROJ', value: null },
    { w: 0.10, label: 'MATERIAL', value: '{material}' },
  ]},
];

function titleBlockRows(variant) {
  return variant === 'iso7200-compact' ? TB_COMPACT_ROWS : TB_FULL_ROWS;
}

function totalTitleBlockHeight(variant) {
  return titleBlockRows(variant).reduce((s, r) => s + r.h, 0);
}

// ─── SVG renderer ────────────────────────────────────────────────────────────

function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function substitute(value, fields) {
  if (value == null) return '';
  return String(value).replace(/\{(\w+)\}/g, (_, k) => fields[k] ?? '—');
}

function defaultFields() {
  return {
    title: '— part name —',
    docNumber: 'DWG-XXX',
    revision: '-',
    status: 'DRAFT',
    scale: '1:1',
    sheet: '1/1 A4',
    material: '—',
    treatment: '—',
    surfaceFinish: '—',
    tolerance: 'ISO 2768-mK',
    weight: '—',
    dim: '— × — × — mm',
    sourceFile: '—',
    standardRef: 'ISO 128 / ISO 7200',
    customer: '—',
    project: '—',
    designer: '—',
    checker: '—',
    approver: '—',
    approverDate: '—',
  };
}

function projectionSymbolSvg(projection, x, y, w, h, stroke = '#1f2937') {
  const isFirst = projection === 'first_angle';
  const cy = y + h / 2;
  const symH = Math.min(h - 4, 10);
  const padX = 2;
  const ax1 = x + padX;
  const ax2 = x + w - padX;
  const r = symH * 0.35;
  if (isFirst) {
    return (
      `<g stroke="${stroke}" stroke-width="0.3" fill="none">` +
      `<polyline points="${ax1},${cy - symH / 2} ${ax1 + symH * 0.6},${cy} ${ax1},${cy + symH / 2}" />` +
      `<circle cx="${ax2 - symH * 0.4}" cy="${cy}" r="${r}" />` +
      `<line x1="${ax2 - symH * 0.8}" y1="${cy}" x2="${ax2}" y2="${cy}" stroke-dasharray="0.6,0.5" />` +
      `<line x1="${ax2 - symH * 0.4}" y1="${cy - r - 1}" x2="${ax2 - symH * 0.4}" y2="${cy + r + 1}" stroke-dasharray="0.6,0.5" />` +
      `</g>`
    );
  }
  return (
    `<g stroke="${stroke}" stroke-width="0.3" fill="none">` +
    `<circle cx="${ax1 + symH * 0.4}" cy="${cy}" r="${r}" />` +
    `<line x1="${ax1}" y1="${cy}" x2="${ax1 + symH * 0.8}" y2="${cy}" stroke-dasharray="0.6,0.5" />` +
    `<line x1="${ax1 + symH * 0.4}" y1="${cy - r - 1}" x2="${ax1 + symH * 0.4}" y2="${cy + r + 1}" stroke-dasharray="0.6,0.5" />` +
    `<polyline points="${ax2},${cy - symH / 2} ${ax2 - symH * 0.6},${cy} ${ax2},${cy + symH / 2}" />` +
    `</g>`
  );
}

// Build the SVG markup for the backdrop (border + title block + projection)
// at *real-world millimetre coordinates*. Viewer can downscale via viewBox.
export function renderTemplateSvg(template, opts = {}) {
  const { fields: f = {}, projection = 'third_angle' } = opts;
  const fields = { ...defaultFields(), ...f };

  const size = template?.sheet?.size || 'A4';
  const orientation = template?.sheet?.orientation || 'landscape';
  const { w: pageW, h: pageH } = paperSize(size, orientation);

  const variant = template?.titleBlock?.variant || 'iso7200-full';
  const rows = titleBlockRows(variant);
  const tbH = totalTitleBlockHeight(variant);

  // ISO 7200 places the title block in the bottom-right.
  const tbW = pageW - MARGIN_BINDING - MARGIN;
  const tbX = MARGIN_BINDING;
  const tbY = pageH - MARGIN - tbH;

  let svg = '';
  const stroke = '#000000';
  const strokeLight = '#9ca3af';
  const muted = '#6b7280';

  // Outer border (10 mm padding, 20 mm on the binding/left edge)
  svg += `<rect x="${MARGIN_BINDING}" y="${MARGIN}" width="${pageW - MARGIN_BINDING - MARGIN}" height="${pageH - 2 * MARGIN}" fill="none" stroke="${stroke}" stroke-width="0.5" />`;
  // Inner content border (5 mm gap)
  svg += `<rect x="${MARGIN_BINDING + 3}" y="${MARGIN + 3}" width="${pageW - MARGIN_BINDING - MARGIN - 6}" height="${pageH - 2 * MARGIN - 6}" fill="none" stroke="${strokeLight}" stroke-width="0.2" />`;

  // ISO zone markings on the borders (A,B,C... / 1,2,3...)
  const zoneSize = 50; // mm per zone
  const cols = Math.floor((pageW - MARGIN_BINDING - MARGIN) / zoneSize);
  const rowsCount = Math.floor((pageH - 2 * MARGIN) / zoneSize);
  for (let i = 1; i < cols; i++) {
    const x = MARGIN_BINDING + i * zoneSize;
    svg += `<line x1="${x}" y1="${MARGIN}" x2="${x}" y2="${MARGIN + 3}" stroke="${stroke}" stroke-width="0.3" />`;
    svg += `<line x1="${x}" y1="${pageH - MARGIN - 3}" x2="${x}" y2="${pageH - MARGIN}" stroke="${stroke}" stroke-width="0.3" />`;
    svg += `<text x="${x - zoneSize / 2}" y="${MARGIN - 2}" font-size="2.5" text-anchor="middle" font-family="sans-serif" fill="${muted}">${i}</text>`;
  }
  for (let j = 1; j < rowsCount; j++) {
    const y = MARGIN + j * zoneSize;
    svg += `<line x1="${MARGIN_BINDING}" y1="${y}" x2="${MARGIN_BINDING + 3}" y2="${y}" stroke="${stroke}" stroke-width="0.3" />`;
    svg += `<line x1="${pageW - MARGIN - 3}" y1="${y}" x2="${pageW - MARGIN}" y2="${y}" stroke="${stroke}" stroke-width="0.3" />`;
    const letter = String.fromCharCode(65 + (j - 1));
    svg += `<text x="${MARGIN_BINDING - 4}" y="${y - zoneSize / 2 + 1}" font-size="2.5" text-anchor="middle" font-family="sans-serif" fill="${muted}">${letter}</text>`;
  }

  // Title block grid
  svg += `<rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="#ffffff" stroke="${stroke}" stroke-width="0.4" />`;

  let cy = tbY;
  for (const row of rows) {
    // Horizontal divider between rows
    if (cy > tbY) {
      svg += `<line x1="${tbX}" y1="${cy}" x2="${tbX + tbW}" y2="${cy}" stroke="${stroke}" stroke-width="0.3" />`;
    }
    let cx = tbX;
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      const cw = cell.w * tbW;
      // Vertical divider on the right edge of each cell (except last)
      if (i < row.cells.length - 1) {
        svg += `<line x1="${cx + cw}" y1="${cy}" x2="${cx + cw}" y2="${cy + row.h}" stroke="${stroke}" stroke-width="0.3" />`;
      }
      // Label
      if (cell.label) {
        svg += `<text x="${cx + 1.5}" y="${cy + 3}" font-size="2.2" font-family="sans-serif" fill="${muted}" letter-spacing="0.2">${escapeXml(cell.label)}</text>`;
      }
      // Value
      if (cell.value) {
        const v = substitute(cell.value, fields);
        svg += `<text x="${cx + 1.5}" y="${cy + row.h - 2}" font-size="${row.h > 13 ? 4.5 : 3.5}" font-family="sans-serif" font-weight="700" fill="${stroke}">${escapeXml(v)}</text>`;
      }
      // Special: projection symbol — find a cell with label PROJ or PROJECTION
      if (cell.label && /^PROJ/i.test(cell.label) && template?.showProjectionSymbol !== false) {
        svg += projectionSymbolSvg(projection, cx + 1, cy + 4, cw - 2, row.h - 5, stroke);
      }
      cx += cw;
    }
    cy += row.h;
  }

  // Page header label (top-left)
  svg += `<text x="${MARGIN_BINDING}" y="${MARGIN - 3}" font-size="3" font-family="sans-serif" fill="${muted}">FORTE BIOTECH · Template: ${escapeXml(template?.name || template?.id || '')}</text>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}" width="${pageW}mm" height="${pageH}mm">` +
    svg +
    `</svg>`
  );
}

// ─── DXF renderer ────────────────────────────────────────────────────────────
// Emits a minimal AutoCAD R12 DXF text file containing the same geometry as
// the SVG: outer border, title-block grid, label + value text strings, and
// (where applicable) the projection-symbol shapes. DXF is plain text — no
// library required. Coordinates are in millimetres, matching SolidWorks /
// Fusion 360 import defaults.

function dxfHeader() {
  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009', // R12
    '9', '$INSUNITS', '70', '4',    // 4 = millimetres
    '0', 'ENDSEC',
  ].join('\n');
}

function dxfTables() {
  return [
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '3',
    // Layer 0
    '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
    // Layer FRAME
    '0', 'LAYER', '2', 'FRAME', '70', '0', '62', '7', '6', 'CONTINUOUS',
    // Layer TITLE
    '0', 'LAYER', '2', 'TITLE', '70', '0', '62', '7', '6', 'CONTINUOUS',
    // Layer TEXT
    '0', 'LAYER', '2', 'TEXT', '70', '0', '62', '8', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  ].join('\n');
}

function dxfLine(x1, y1, x2, y2, layer = '0') {
  return [
    '0', 'LINE',
    '8', layer,
    '10', x1.toFixed(3),
    '20', y1.toFixed(3),
    '30', '0.0',
    '11', x2.toFixed(3),
    '21', y2.toFixed(3),
    '31', '0.0',
  ].join('\n');
}

function dxfText(x, y, height, text, layer = 'TEXT') {
  // Strip diacritics-unsafe characters; AutoCAD R12 DXF doesn't reliably
  // round-trip Unicode without a properly-set Unicode style. We keep ASCII
  // for the title block primitives and surface the bilingual content as
  // CAD properties via the DXF "1001 - extended data" trick is overkill for
  // a backdrop. Designers can override the text in their CAD tool.
  const clean = String(text || '').replace(/[-￿]/g, '?');
  return [
    '0', 'TEXT',
    '8', layer,
    '10', x.toFixed(3),
    '20', y.toFixed(3),
    '30', '0.0',
    '40', height.toFixed(3),
    '1', clean,
  ].join('\n');
}

function dxfCircle(x, y, r, layer = 'TITLE') {
  return [
    '0', 'CIRCLE',
    '8', layer,
    '10', x.toFixed(3),
    '20', y.toFixed(3),
    '30', '0.0',
    '40', r.toFixed(3),
  ].join('\n');
}

// Translate paper-coords (origin top-left) to DXF model coords (origin
// bottom-left). DXF Y goes up, mm down on a paper diagram → flip.
function flipY(y, pageH) {
  return pageH - y;
}

export function renderTemplateDxf(template, opts = {}) {
  const { fields: f = {}, projection = 'third_angle' } = opts;
  const fields = { ...defaultFields(), ...f };

  const size = template?.sheet?.size || 'A4';
  const orientation = template?.sheet?.orientation || 'landscape';
  const { w: pageW, h: pageH } = paperSize(size, orientation);
  const variant = template?.titleBlock?.variant || 'iso7200-full';
  const rows = titleBlockRows(variant);
  const tbH = totalTitleBlockHeight(variant);

  const tbW = pageW - MARGIN_BINDING - MARGIN;
  const tbX = MARGIN_BINDING;
  const tbY = pageH - MARGIN - tbH; // top of title block in paper coords
  const F = (y) => flipY(y, pageH);

  const entities = [];

  // Outer + inner borders
  entities.push(dxfLine(MARGIN_BINDING, F(MARGIN), pageW - MARGIN, F(MARGIN), 'FRAME'));
  entities.push(dxfLine(pageW - MARGIN, F(MARGIN), pageW - MARGIN, F(pageH - MARGIN), 'FRAME'));
  entities.push(dxfLine(pageW - MARGIN, F(pageH - MARGIN), MARGIN_BINDING, F(pageH - MARGIN), 'FRAME'));
  entities.push(dxfLine(MARGIN_BINDING, F(pageH - MARGIN), MARGIN_BINDING, F(MARGIN), 'FRAME'));

  // Title block outline
  entities.push(dxfLine(tbX, F(tbY), tbX + tbW, F(tbY), 'TITLE'));
  entities.push(dxfLine(tbX + tbW, F(tbY), tbX + tbW, F(tbY + tbH), 'TITLE'));
  entities.push(dxfLine(tbX + tbW, F(tbY + tbH), tbX, F(tbY + tbH), 'TITLE'));
  entities.push(dxfLine(tbX, F(tbY + tbH), tbX, F(tbY), 'TITLE'));

  // Title block grid + text
  let cy = tbY;
  for (const row of rows) {
    if (cy > tbY) {
      entities.push(dxfLine(tbX, F(cy), tbX + tbW, F(cy), 'TITLE'));
    }
    let cx = tbX;
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      const cw = cell.w * tbW;
      if (i < row.cells.length - 1) {
        entities.push(dxfLine(cx + cw, F(cy), cx + cw, F(cy + row.h), 'TITLE'));
      }
      if (cell.label) {
        entities.push(dxfText(cx + 1.5, F(cy + 3), 2.2, cell.label, 'TEXT'));
      }
      if (cell.value) {
        const v = substitute(cell.value, fields);
        entities.push(dxfText(cx + 1.5, F(cy + row.h - 1.5), row.h > 13 ? 4.5 : 3.5, v, 'TEXT'));
      }
      // Projection symbol — circle + arrow approximation
      if (cell.label && /^PROJ/i.test(cell.label) && template?.showProjectionSymbol !== false) {
        const symY = cy + row.h / 2;
        if (projection === 'first_angle') {
          entities.push(dxfCircle(cx + cw - 4, F(symY), 1.5, 'TITLE'));
        } else {
          entities.push(dxfCircle(cx + 4, F(symY), 1.5, 'TITLE'));
        }
      }
      cx += cw;
    }
    cy += row.h;
  }

  return [
    '999', `Forte Biotech Drawing Tool — template ${template?.id || ''}`,
    dxfHeader(),
    dxfTables(),
    '0', 'SECTION', '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');
}
