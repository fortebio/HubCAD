// HTML generator for each doc kind. Self-contained: inline CSS, no external
// resources. Bilingual-aware. Works in any browser and is safe to "Save as"
// from File menu, or paste into Word/Google Docs.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const UPLOAD_DIR = path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR || './uploads');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Encode an image referenced by /uploads/... as a data URL so the HTML file
// can be saved/emailed without losing pictures.
function imageDataUrl(p) {
  if (!p) return null;
  const stripped = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p;
  const abs = path.join(UPLOAD_DIR, stripped);
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'png'}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const CSS = `
  :root {
    --primary: #1a6ff5;
    --text: #1f2937;
    --muted: #6b7280;
    --border: #e5e7eb;
    --row-zebra: #f9fafb;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Be Vietnam Pro', 'DM Sans', -apple-system, 'Segoe UI', sans-serif;
    color: var(--text);
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    background: #f5f7fa;
  }
  .page {
    max-width: 820px;
    margin: 24px auto;
    background: white;
    padding: 32px 40px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .brand { display: flex; align-items: center; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
  .brand-badge { width: 26px; height: 26px; border-radius: 5px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; }
  .brand-name { font-weight: 700; }
  .brand-sub { color: var(--muted); font-size: 11px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .h1-sub { color: var(--muted); margin-bottom: 16px; }
  h2 { font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
  .meta-cell { padding: 8px 10px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .meta-cell:nth-child(4n) { border-right: none; }
  .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 2px; }
  .meta-value { font-weight: 600; font-size: 11px; }
  .meta-value.mono { font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--primary); }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--border); font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--muted); background: var(--row-zebra); }
  td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:nth-child(even) td { background: var(--row-zebra); }
  .mono { font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--primary); font-weight: 500; }
  .muted { color: var(--muted); }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .pill.ok { background: #d1fae5; color: #065f46; }
  .pill.ng { background: #fee2e2; color: #991b1b; }
  .watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 84px; font-weight: 800; opacity: 0.12; transform: rotate(-22deg); letter-spacing: 4px; pointer-events: none; z-index: 1; }
  .watermark.preliminary { color: #f59e0b; }
  .watermark.for_production { color: #ef4444; }
  .watermark.approved { color: #10b981; }
  .watermark.obsolete { color: #9ca3af; }
  .step { display: flex; gap: 12px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
  .step:last-child { border-bottom: none; }
  .step-num { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0; }
  .step-img { width: 160px; max-height: 110px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px; }
  .feature { display: flex; gap: 8px; margin-bottom: 4px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); }
  @media print { body { background: white; } .page { border: none; max-width: none; margin: 0; padding: 12mm 16mm; } }
`;

function shellHtml({ title, watermark, content, docNumber }) {
  const wm = watermark && watermark !== 'none'
    ? `<div class="watermark ${watermark}">${watermark.replace('_', ' ').toUpperCase()}</div>`
    : '';
  const now = new Date().toLocaleString('en-GB');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  ${wm}
  <div class="page">
    <div class="brand">
      <div class="brand-badge">DT</div>
      <div>
        <div class="brand-name">Drawing Tool</div>
        <div class="brand-sub">Forte Biotech${docNumber ? ` · ${escapeHtml(docNumber)}` : ''}</div>
      </div>
    </div>
    ${content}
    <div class="footer">
      <span>${escapeHtml(docNumber || '')}</span>
      <span>Generated ${now}</span>
    </div>
  </div>
</body>
</html>`;
}

function metaGrid(items) {
  return `<div class="meta">${items
    .map(
      (it) => `<div class="meta-cell">
        <div class="meta-label">${escapeHtml(it.label)}</div>
        <div class="meta-value ${it.mono ? 'mono' : ''}">${escapeHtml(it.value ?? '—')}</div>
      </div>`
    )
    .join('')}</div>`;
}

export function bomHtml({ doc, header, items, watermark }) {
  const totalCost = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);
  const title = `BOM — ${header?.assemblyNo || doc.docNumber}`;

  const rows = items.map((it, idx) => {
    const sub = (Number(it.unitCost) || 0) * (Number(it.qty) || 0);
    const indent = (it.level || 0) * 12;
    return `<tr>
      <td>${idx + 1}</td>
      <td>${it.level ?? ''}</td>
      <td class="mono" style="padding-left:${6 + indent}px">${escapeHtml(it.partNumber)}</td>
      <td>${escapeHtml(it.descEn)}${it.descVn ? `<div class="muted">${escapeHtml(it.descVn)}</div>` : ''}</td>
      <td style="text-align:right" class="mono">${it.qty ?? ''}</td>
      <td>${escapeHtml(it.unit || '')}</td>
      <td>${escapeHtml(it.material || '—')}</td>
      <td>${escapeHtml(it.vendor || '—')}</td>
      <td style="text-align:right" class="mono">${it.unitCost != null ? Number(it.unitCost).toFixed(2) : '—'}</td>
      <td style="text-align:right" class="mono"><strong>${sub.toFixed(2)}</strong></td>
    </tr>`;
  }).join('');

  const content = `
    <h1>${escapeHtml(doc.nameEn || title)}</h1>
    ${doc.nameVn ? `<div class="h1-sub">${escapeHtml(doc.nameVn)}</div>` : ''}
    ${metaGrid([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Assembly No.', value: header?.assemblyNo, mono: true },
      { label: 'Revision', value: header?.revision || doc.revision, mono: true },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
      { label: 'Total items', value: items.length },
      { label: 'Total cost', value: `$${totalCost.toFixed(2)}` },
      { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
      { label: 'Watermark', value: watermark === 'none' ? '—' : watermark?.toUpperCase() },
    ])}
    <h2>Items / Danh mục vật liệu</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Lv</th><th>Part No.</th><th>Description</th>
          <th style="text-align:right">Qty</th><th>Unit</th><th>Material</th><th>Vendor</th>
          <th style="text-align:right">$/u</th><th style="text-align:right">Sub</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:#eff6ff">
          <td colspan="9" style="text-align:right"><strong>Total</strong></td>
          <td style="text-align:right" class="mono"><strong>${totalCost.toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>
  `;

  return shellHtml({ title, watermark, content, docNumber: doc.docNumber });
}

export function wiHtml({ doc, meta, steps, watermark }) {
  const title = meta.titleEn || doc.nameEn || `WI — ${doc.docNumber}`;
  const stepHtml = steps.length === 0
    ? '<p class="muted">No steps defined yet.</p>'
    : steps.map((s, i) => {
        const img = imageDataUrl(s.imagePath);
        return `<div class="step">
          <div class="step-num">${i + 1}</div>
          <div style="flex:1">
            ${s.titleEn ? `<div><strong>${escapeHtml(s.titleEn)}</strong></div>` : ''}
            ${s.titleVn ? `<div class="muted">${escapeHtml(s.titleVn)}</div>` : ''}
            ${s.bodyEn ? `<div style="margin-top:4px">${escapeHtml(s.bodyEn)}</div>` : ''}
            ${s.bodyVn ? `<div class="muted">${escapeHtml(s.bodyVn)}</div>` : ''}
            <div style="margin-top:6px; font-size:10px;">
              ${s.tools ? `<span class="muted">Tools / Dụng cụ: <strong style="color:var(--text)">${escapeHtml(s.tools)}</strong></span>` : ''}
              ${s.caution ? `<span style="color:#b91c1c; margin-left:12px">⚠ Caution / Lưu ý: <strong>${escapeHtml(s.caution)}</strong></span>` : ''}
            </div>
          </div>
          ${img ? `<img src="${img}" class="step-img" alt="Step ${i + 1}" />` : ''}
        </div>`;
      }).join('');

  const content = `
    <h1>${escapeHtml(title)}</h1>
    ${meta.titleVn || doc.nameVn ? `<div class="h1-sub">${escapeHtml(meta.titleVn || doc.nameVn)}</div>` : ''}
    ${metaGrid([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Revision', value: doc.revision, mono: true },
      { label: 'Station', value: meta.station },
      { label: 'Cycle time', value: meta.cycleTime },
      { label: 'Steps', value: steps.length },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
      { label: 'Watermark', value: watermark === 'none' ? '—' : watermark?.toUpperCase() },
      { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
    ])}
    <h2>Procedure / Trình tự</h2>
    ${stepHtml}
  `;
  return shellHtml({ title, watermark, content, docNumber: doc.docNumber });
}

export function catalogHtml({ doc, data, watermark }) {
  const title = data.productNameEn || doc.nameEn || `Catalog — ${doc.docNumber}`;
  const hero = imageDataUrl(data.heroImage);
  const features = (data.features || []).filter((f) => f.en);
  const specs = (data.specs || []).filter((s) => s.key);

  const content = `
    <div style="display:flex; gap:16px; margin-bottom:14px">
      <div style="flex:1">
        <h1 style="font-size:24px">${escapeHtml(title)}</h1>
        ${data.productNameVn || doc.nameVn ? `<div class="h1-sub">${escapeHtml(data.productNameVn || doc.nameVn)}</div>` : ''}
        ${data.tagline ? `<div style="color:var(--primary); font-style:italic; margin:6px 0 8px">${escapeHtml(data.tagline)}</div>` : ''}
        ${data.description ? `<p>${escapeHtml(data.description)}</p>` : ''}
      </div>
      ${hero ? `<img src="${hero}" style="width:200px; height:140px; object-fit:contain" alt="Product" />` : ''}
    </div>
    ${features.length > 0 ? `
      <h2>Key features / Tính năng nổi bật</h2>
      <ul style="list-style:none; padding-left:0">
        ${features.map((f) => `<li class="feature"><strong style="color:var(--primary)">•</strong>
          <div><div>${escapeHtml(f.en)}</div>${f.vn ? `<div class="muted">${escapeHtml(f.vn)}</div>` : ''}</div></li>`).join('')}
      </ul>
    ` : ''}
    ${specs.length > 0 ? `
      <h2>Specifications / Thông số kỹ thuật</h2>
      <table>
        <tbody>
          ${specs.map((s) => `<tr>
            <td style="width:32%" class="muted">${escapeHtml(s.key)}</td>
            <td style="width:36%"><strong>${escapeHtml(s.valueEn || '—')}</strong></td>
            <td style="width:32%" class="muted">${escapeHtml(s.valueVn || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    ` : ''}
    ${data.certifications || data.warranty ? `
      <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border)">
        ${data.certifications ? `<div class="muted">Certifications: <strong style="color:var(--text)">${escapeHtml(data.certifications)}</strong></div>` : ''}
        ${data.warranty ? `<div class="muted">Warranty / Bảo hành: <strong style="color:var(--text)">${escapeHtml(data.warranty)}</strong></div>` : ''}
      </div>
    ` : ''}
  `;
  return shellHtml({ title, watermark, content, docNumber: doc.docNumber });
}

const DRAWING_VIEWS = [
  { key: 'viewFront', label: 'FRONT', vn: 'Hình chiếu đứng' },
  { key: 'viewTop', label: 'TOP', vn: 'Hình chiếu bằng' },
  { key: 'viewSide', label: 'SIDE', vn: 'Hình chiếu cạnh' },
  { key: 'viewIso', label: 'ISO', vn: 'Hình chiếu trục đo' },
];

function viewGridHtml(sheet) {
  return `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
    ${DRAWING_VIEWS.map((v) => {
      const img = imageDataUrl(sheet?.[v.key]);
      return `<div style="border:1px solid var(--border); padding:6px; min-height:170px; display:flex; flex-direction:column; align-items:center; background:#fafafa;">
        <div style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; min-height:140px;">
          ${img ? `<img src="${img}" style="max-width:100%; max-height:160px; object-fit:contain" alt="${v.label}" />` : `<div class="muted" style="font-size:10px">— no view —</div>`}
        </div>
        <div style="font-weight:600; font-size:10px; margin-top:4px;">${v.label} <span class="muted">· ${escapeHtml(v.vn)}</span></div>
      </div>`;
    }).join('')}
  </div>`;
}

function projectionSymbolSvg(projection) {
  const isFirst = projection === 'first_angle';
  return `<svg width="56" height="20" viewBox="0 0 56 20" xmlns="http://www.w3.org/2000/svg">
    ${isFirst
      ? `<polygon points="2,4 14,10 2,16" fill="none" stroke="#1f2937" stroke-width="0.8" />
         <line x1="2" y1="10" x2="14" y2="10" stroke="#1f2937" stroke-width="0.4" stroke-dasharray="1.5,1" />
         <circle cx="44" cy="10" r="6" fill="none" stroke="#1f2937" stroke-width="0.8" />
         <line x1="36" y1="10" x2="52" y2="10" stroke="#1f2937" stroke-width="0.4" stroke-dasharray="1.5,1" />
         <line x1="44" y1="2" x2="44" y2="18" stroke="#1f2937" stroke-width="0.4" stroke-dasharray="1.5,1" />`
      : `<circle cx="12" cy="10" r="6" fill="none" stroke="#1f2937" stroke-width="0.8" />
         <line x1="4" y1="10" x2="20" y2="10" stroke="#1f2937" stroke-width="0.4" stroke-dasharray="1.5,1" />
         <line x1="12" y1="2" x2="12" y2="18" stroke="#1f2937" stroke-width="0.4" stroke-dasharray="1.5,1" />
         <polygon points="54,4 42,10 54,16" fill="none" stroke="#1f2937" stroke-width="0.8" />
         <line x1="42" y1="10" x2="54" y2="10" stroke="#1f2937" stroke-width="0.4" stroke-dasharray="1.5,1" />`}
  </svg>`;
}

function titleBlockHtml({ doc, sheet, project }) {
  const projection = sheet?.projection || 'third_angle';
  const dim =
    sheet && sheet.dimX != null
      ? `${sheet.dimX.toFixed(2)} × ${sheet.dimY.toFixed(2)} × ${sheet.dimZ.toFixed(2)} mm`
      : '—';
  const cell = (label, value, mono, width) =>
    `<td style="border:0.5px solid var(--border-strong, #9ca3af); padding:4px 6px; width:${width || 'auto'}; vertical-align:top;">
      <div style="font-size:8px; color:var(--muted); text-transform:uppercase; letter-spacing:0.3px;">${label}</div>
      <div style="font-size:${mono ? '11px' : '10px'}; font-weight:600; font-family:${mono ? "'JetBrains Mono', monospace" : "inherit"}; color:${mono ? 'var(--primary)' : 'var(--text)'};">${escapeHtml(value ?? '—')}</div>
    </td>`;
  return `<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid var(--border-strong, #9ca3af);">
    <tr>
      <td colspan="2" style="background:#f8fafc; padding:6px; border:0.5px solid var(--border-strong, #9ca3af);">
        <div style="font-size:8px; color:var(--muted); text-transform:uppercase;">Company / Công ty</div>
        <div style="font-size:13px; font-weight:700;">Forte Biotech</div>
        <div style="font-size:8px; color:var(--muted);">Drawing Tool — Technical drawing</div>
      </td>
      <td style="border:0.5px solid var(--border-strong, #9ca3af); padding:4px; text-align:center;">
        <div style="font-size:8px; color:var(--muted); text-transform:uppercase;">Projection</div>
        ${projectionSymbolSvg(projection)}
        <div style="font-size:7px; color:var(--muted); margin-top:1px;">${projection === 'first_angle' ? '1st angle / Góc 1' : '3rd angle / Góc 3'}</div>
      </td>
      ${cell('Scale', sheet?.scale || '1:1', true, '12%')}
      ${cell('Unit', 'mm', false, '8%')}
      ${cell('Sheet', `1 / 1 · ${sheet?.sheetSize || 'A4'}`, false, '14%')}
    </tr>
    <tr>
      <td colspan="2" style="border:0.5px solid var(--border-strong, #9ca3af); padding:4px 6px;">
        <div style="font-size:8px; color:var(--muted); text-transform:uppercase;">Title / Tiêu đề</div>
        <div style="font-size:12px; font-weight:700;">${escapeHtml(doc.nameEn || doc.docNumber)}</div>
        ${doc.nameVn ? `<div style="font-size:10px; color:var(--muted); font-style:italic;">${escapeHtml(doc.nameVn)}</div>` : ''}
      </td>
      ${cell('Doc number', doc.docNumber, true, '20%')}
      ${cell('Revision', doc.revision, true, '10%')}
      ${cell('Status', doc.status?.replace('_', ' ').toUpperCase(), false, '20%')}
    </tr>
    <tr>
      ${cell('Material / Vật liệu', sheet?.material, false, '20%')}
      ${cell('Treatment / Xử lý nhiệt', sheet?.treatment, false, '20%')}
      ${cell('Surface finish / Bề mặt', sheet?.surfaceFinish, false, '20%')}
      ${cell('General tolerance', sheet?.tolerance || 'ISO 2768-mK', false, '20%')}
      ${cell('Mass / Khối lượng', sheet?.weight != null ? `${Number(sheet.weight).toFixed(2)} g` : '—', false, '20%')}
    </tr>
    <tr>
      ${cell('Bounding box', dim, true, '25%')}
      ${cell('Source file', sheet?.sourceFile, true, '25%')}
      ${cell('Standard / Tiêu chuẩn', sheet?.standardRef || 'ISO 128 / ISO 7200', false, '20%')}
      ${cell('Customer / Khách hàng', sheet?.customer, false, '15%')}
      ${cell('Project', project?.name, false, '15%')}
    </tr>
    <tr>
      ${cell('Designer / Thiết kế', sheet?.designer, false, '25%')}
      ${cell('Checker / Kiểm tra', sheet?.checker, false, '25%')}
      ${cell('Approver / Phê duyệt', sheet?.approver, false, '25%')}
      ${cell('Approval date', sheet?.approverDate ? new Date(sheet.approverDate).toLocaleDateString('en-GB') : '—', true, '25%')}
    </tr>
  </table>`;
}

function generalNotesHtml(notes) {
  if (!notes) return '';
  const lines = String(notes).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  return `<div style="margin-top:8px; border:0.5px solid var(--border-strong, #9ca3af); padding:6px 8px;">
    <div style="font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">General notes / Ghi chú chung</div>
    <ol style="margin:0; padding-left:18px; font-size:10px;">
      ${lines.map((l) => `<li style="margin-bottom:2px;">${escapeHtml(l)}</li>`).join('')}
    </ol>
  </div>`;
}

export function drawingHtml({ doc, revisions, project, sheet, watermark }) {
  const title = doc.nameEn || doc.docNumber;
  const hasViews = sheet && (sheet.viewFront || sheet.viewTop || sheet.viewSide || sheet.viewIso);
  const viewsSection = hasViews
    ? `<h2>Views / Hình chiếu</h2>
       <div style="display:flex; gap:12px; margin-bottom:14px">
         <div style="flex:1">${viewGridHtml(sheet)}</div>
         <div style="width:240px">
           <div style="border:1px solid var(--border); padding:8px; margin-bottom:8px;">
             <div class="meta-label">Bounding box / Kích thước bao</div>
             <div class="mono" style="font-size:13px; font-weight:700; margin-top:2px;">${sheet.dimX != null ? `${sheet.dimX.toFixed(2)} × ${sheet.dimY.toFixed(2)} × ${sheet.dimZ.toFixed(2)} mm` : '—'}</div>
             ${sheet.triangles != null ? `<div class="muted" style="font-size:10px; margin-top:4px;">Triangles: ${sheet.triangles.toLocaleString()}</div>` : ''}
           </div>
           ${metaGrid([
             { label: 'Scale', value: sheet.scale || '1:1' },
             { label: 'Projection', value: sheet.projection === 'first_angle' ? '1st angle' : '3rd angle' },
             { label: 'Sheet size', value: sheet.sheetSize || 'A4' },
             { label: 'Mass', value: sheet.weight != null ? `${Number(sheet.weight).toFixed(2)} g` : null },
             { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
             { label: 'Standard', value: sheet.standardRef || 'ISO 128 / ISO 7200' },
           ])}
         </div>
       </div>
       ${generalNotesHtml(sheet.generalNotes)}
       ${titleBlockHtml({ doc, sheet, project })}
       ${sheet.notes ? `<div style="border:0.5px solid var(--border-strong, #9ca3af); padding:6px 8px; margin-top:8px;">
         <div class="meta-label">Notes / Ghi chú</div>
         <p style="font-size:10px;">${escapeHtml(sheet.notes)}</p>
       </div>` : ''}`
    : metaGrid([
        { label: 'Doc number', value: doc.docNumber, mono: true },
        { label: 'Revision', value: doc.revision, mono: true },
        { label: 'Type', value: doc.docType?.toUpperCase() },
        { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
        { label: 'Project', value: project?.name || '—' },
        { label: 'Project code', value: project?.code, mono: true },
        { label: 'Created', value: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-GB') : '—' },
        { label: 'Updated', value: doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('en-GB') : '—' },
      ]);

  const content = `
    <h1>${escapeHtml(title)}</h1>
    ${doc.nameVn ? `<div class="h1-sub">${escapeHtml(doc.nameVn)}</div>` : ''}
    ${viewsSection}
    <h2>Revision history / Lịch sử sửa đổi</h2>
    ${revisions.length === 0 ? '<p class="muted">No revision history yet.</p>' : `
      <table>
        <thead><tr><th>Rev</th><th>Change description</th><th>Date</th></tr></thead>
        <tbody>
          ${revisions.map((r) => `<tr>
            <td class="mono">${escapeHtml(r.revision)}</td>
            <td>${escapeHtml(r.changeDesc || '—')}</td>
            <td>${r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `}
    <h2>Signoff / Phê duyệt</h2>
    <table>
      <thead><tr><th>Role</th><th>Name</th><th>Date</th></tr></thead>
      <tbody>
        <tr><td>Designer / Thiết kế</td><td style="height:32px"></td><td></td></tr>
        <tr><td>Reviewer / Kiểm tra</td><td style="height:32px"></td><td></td></tr>
        <tr><td>Approver / Phê duyệt</td><td style="height:32px"></td><td></td></tr>
      </tbody>
    </table>
  `;
  return shellHtml({ title, watermark, content, docNumber: doc.docNumber });
}

const TITLE_BY_TYPE = {
  drawing: 'Drawing checklist',
  dfm: 'DFM / DFA review',
  release: 'Release checklist',
};

export function checklistHtml({ doc, checklistType, sections, result, watermark }) {
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
  const title = `${TITLE_BY_TYPE[checklistType] || 'Checklist'} — ${doc.docNumber}`;

  const sectionHtml = sections.map((sec, sIdx) => {
    const rows = (sec.items || []).map((it, iIdx) => {
      const k = `${sec.audience ?? sIdx}-${iIdx}`;
      const v = results[k];
      return `<tr>
        <td style="text-align:center">${iIdx + 1}</td>
        <td>${escapeHtml(it.en)}</td>
        <td class="muted">${escapeHtml(it.vn)}</td>
        <td style="text-align:center">${v ? `<span class="pill ${v}">${v.toUpperCase()}</span>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');
    return `
      <h2>${escapeHtml(sec.title?.en || '')}${sec.title?.vn ? ` <span class="muted">· ${escapeHtml(sec.title.vn)}</span>` : ''}</h2>
      <table>
        <thead><tr><th style="width:6%">#</th><th>English</th><th>Tiếng Việt</th><th style="width:10%; text-align:center">Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }).join('');

  const content = `
    <h1>${escapeHtml(TITLE_BY_TYPE[checklistType] || 'Checklist')}</h1>
    <div class="h1-sub">${escapeHtml(doc.nameEn || '')}${doc.nameVn ? ` · ${escapeHtml(doc.nameVn)}` : ''}</div>
    ${metaGrid([
      { label: 'Doc number', value: doc.docNumber, mono: true },
      { label: 'Revision', value: doc.revision, mono: true },
      { label: 'Checklist type', value: checklistType?.toUpperCase() },
      { label: 'Overall', value: (result?.overall || '—').toUpperCase() },
      { label: 'OK', value: ok },
      { label: 'NG', value: ng },
      { label: 'Total items', value: total },
      { label: 'Checked at', value: result?.checkedAt ? new Date(result.checkedAt).toLocaleString('en-GB') : '—' },
    ])}
    ${sectionHtml}
    ${result?.remarks ? `
      <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border)">
        <div class="meta-label">Remarks / Ghi chú</div>
        <p>${escapeHtml(result.remarks)}</p>
      </div>
    ` : ''}
  `;
  return shellHtml({ title, watermark, content, docNumber: doc.docNumber });
}

export function renderHtml(payload) {
  switch (payload.kind) {
    case 'bom': return bomHtml(payload);
    case 'wi': return wiHtml(payload);
    case 'catalog': return catalogHtml(payload);
    case 'drawing': return drawingHtml(payload);
    case 'checklist': return checklistHtml(payload);
    default: throw new Error(`Unknown kind: ${payload.kind}`);
  }
}
