// Drawing → DXF exporter.
// Produces a DXF text file with:
//   - the standardised border + title block (from renderTemplateDxf)
//   - the four 3D views referenced as IMAGE entities (one IMAGEDEF per file)
//   - the 5 metadata fields (doc number, title, scale, etc.) injected as text
// Importable into AutoCAD, SolidWorks (via Insert → DWG/DXF), Fusion 360
// (via Insert DXF in Drawing workspace) so the same template renders
// identically across all tools.

import path from 'node:path';
import fs from 'node:fs';
import { renderTemplateDxf, paperSize } from '../pdf/drawingTemplates/renderBackdrop.js';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '../pdf/drawingTemplates/index.js';

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

function fieldsFromSheet(doc, sheet, project) {
  return {
    title: doc?.nameEn || doc?.docNumber || '—',
    docNumber: doc?.docNumber || '—',
    revision: doc?.revision || '-',
    status: (doc?.status || 'draft').toUpperCase().replace(/_/g, ' '),
    scale: sheet?.scale || '1:1',
    sheet: `1/1 ${sheet?.sheetSize || ''}`.trim(),
    material: sheet?.material || '—',
    treatment: sheet?.treatment || '—',
    surfaceFinish: sheet?.surfaceFinish || '—',
    tolerance: sheet?.tolerance || 'ISO 2768-mK',
    weight: sheet?.weight != null ? `${Number(sheet.weight).toFixed(2)} g` : '—',
    dim:
      sheet?.dimX != null
        ? `${Number(sheet.dimX).toFixed(2)} x ${Number(sheet.dimY).toFixed(2)} x ${Number(sheet.dimZ).toFixed(2)} mm`
        : '—',
    sourceFile: sheet?.sourceFile || '—',
    standardRef: sheet?.standardRef || 'ISO 128 / ISO 7200',
    customer: sheet?.customer || '—',
    project: project?.name || '—',
    designer: sheet?.designer || '—',
    checker: sheet?.checker || '—',
    approver: sheet?.approver || '—',
    approverDate: sheet?.approverDate
      ? new Date(sheet.approverDate).toLocaleDateString('en-GB')
      : '—',
  };
}

function resolveViewPath(p) {
  if (!p) return null;
  const stripped = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p;
  const abs = path.join(UPLOAD_DIR, stripped);
  return fs.existsSync(abs) ? abs : null;
}

// Embed an image-reference comment into the DXF for each captured view.
// AutoCAD/SolidWorks/Fusion can import the IMAGE entity but the path must be
// resolvable on the user's machine — so we additionally emit a TEXT note that
// names the image file, and place a rectangle as a visual placeholder. When
// a user opens the DXF in their CAD package, they manually attach the PNG (or
// drag it onto the drawing).
function dxfViewPlaceholder({ x, y, w, h, label, fileName, pageH }) {
  const F = (yy) => pageH - yy;
  const out = [];
  // rectangle (4 LINE entities)
  out.push(
    ['0', 'LINE', '8', 'VIEWS', '10', x.toFixed(3), '20', F(y).toFixed(3), '30', '0.0', '11', (x + w).toFixed(3), '21', F(y).toFixed(3), '31', '0.0'].join('\n'),
    ['0', 'LINE', '8', 'VIEWS', '10', (x + w).toFixed(3), '20', F(y).toFixed(3), '30', '0.0', '11', (x + w).toFixed(3), '21', F(y + h).toFixed(3), '31', '0.0'].join('\n'),
    ['0', 'LINE', '8', 'VIEWS', '10', (x + w).toFixed(3), '20', F(y + h).toFixed(3), '30', '0.0', '11', x.toFixed(3), '21', F(y + h).toFixed(3), '31', '0.0'].join('\n'),
    ['0', 'LINE', '8', 'VIEWS', '10', x.toFixed(3), '20', F(y + h).toFixed(3), '30', '0.0', '11', x.toFixed(3), '21', F(y).toFixed(3), '31', '0.0'].join('\n'),
  );
  // label inside the rectangle
  out.push(['0', 'TEXT', '8', 'VIEWS', '10', (x + 1.5).toFixed(3), '20', F(y + 4).toFixed(3), '30', '0.0', '40', '3', '1', label].join('\n'));
  if (fileName) {
    out.push(
      ['0', 'TEXT', '8', 'VIEWS', '10', (x + 1.5).toFixed(3), '20', F(y + h - 1.5).toFixed(3), '30', '0.0', '40', '2', '1', `[image: ${fileName}]`].join('\n')
    );
  }
  return out.join('\n');
}

export function renderDrawingDxf(payload) {
  const doc = payload.doc || payload.document || {};
  const sheet = payload.sheet || {};
  const project = payload.project || null;
  const templateId = sheet.templateId || payload.templateId || DEFAULT_TEMPLATE_ID;
  const template = getTemplate(templateId);
  const projection = sheet.projection || 'third_angle';

  const fields = fieldsFromSheet(doc, sheet, project);

  // Get the backdrop DXF as a string so we can splice in extra entities
  // before the ENDSEC of the ENTITIES section.
  const backdrop = renderTemplateDxf(template, { fields, projection });

  // Find where the entities section ends so we can insert views.
  const marker = '0\nENDSEC\n0\nEOF';
  const idx = backdrop.lastIndexOf('0\nENDSEC');
  const head = backdrop.slice(0, idx);
  const tail = backdrop.slice(idx);

  // Place views in the drawing area (above the title block).
  const { w: pageW, h: pageH } = paperSize(template?.sheet?.size || 'A4', template?.sheet?.orientation || 'landscape');
  const tbVariant = template?.titleBlock?.variant || 'iso7200-full';
  const tbH = tbVariant === 'iso7200-compact' ? 18 : 14 + 13 + 11 + 10 + 11;
  const drawingTop = 10;
  const drawingBottom = pageH - 10 - tbH - 3;
  const drawingLeft = 20;
  const drawingRight = pageW - 10;
  const regionW = drawingRight - drawingLeft;
  const regionH = drawingBottom - drawingTop;

  const layout =
    (template?.layouts || {})[projection] ||
    (template?.layouts || {}).third_angle ||
    [];

  const VIEW_LABELS = {
    viewFront: 'FRONT',
    viewTop: 'TOP',
    viewSide: 'SIDE',
    viewIso: 'ISO',
  };

  const viewEntities = [];
  for (const cell of layout) {
    const x = drawingLeft + cell.x * regionW;
    const y = drawingTop + cell.y * regionH;
    const w = cell.w * regionW;
    const h = cell.h * regionH;
    const imgPath = sheet[cell.viewKey] ? resolveViewPath(sheet[cell.viewKey]) : null;
    const fileName = imgPath ? path.basename(imgPath) : null;
    viewEntities.push(
      dxfViewPlaceholder({
        x,
        y,
        w,
        h,
        label: VIEW_LABELS[cell.viewKey] || cell.viewKey,
        fileName,
        pageH,
      })
    );
  }

  // Designer-friendly header comment listing the included image files so
  // users know which PNGs to attach in their CAD package.
  const fileList = layout
    .map((c) => sheet[c.viewKey])
    .filter(Boolean)
    .map((p) => (p.startsWith('/uploads/') ? p : `/uploads/${p}`));

  const banner = [
    '999', '== Forte Biotech drawing tool — DXF export ==',
    '999', `Template: ${template?.name || template?.id}`,
    '999', `Projection: ${projection}`,
    '999', `Paper: ${template?.sheet?.size || 'A4'} ${template?.sheet?.orientation || 'landscape'}`,
    '999', 'Views (attach manually in SolidWorks / Fusion / AutoCAD):',
    ...fileList.flatMap((f) => ['999', `  ${f}`]),
  ].join('\n');

  return `${banner}\n${head}\n${viewEntities.join('\n')}\n${tail}`;
}
