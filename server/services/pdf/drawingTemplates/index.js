// Drawing template registry — analogous to SolidWorks .drwdot templates.
// Each template defines:
//   - sheet (size + orientation)
//   - view layout per projection (1st angle ISO/EU vs 3rd angle US)
//   - title block placement and rows
//   - revision table on/off + position
//   - notes block on/off
//
// Built-in templates are plain JS objects; user-uploaded templates live in
// uploads/templates/drawing/*.json and are merged in at runtime.
//
// View layout convention:
//   First angle  (ISO/EU):  view located OPPOSITE to where the eye is.
//     - Top view BELOW front, Right side LEFT of front
//   Third angle (US):       view located on the SAME side as the eye.
//     - Top view ABOVE front, Right side RIGHT of front
// Both: ISO/axonometric goes in the upper-right corner.

import path from 'node:path';
import fs from 'node:fs';

const TEMPLATE_DIR = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || './uploads',
  'templates',
  'drawing'
);

// ─── View layout grid presets ────────────────────────────────────────────────
// Coordinates are 0..1 of the drawing area (excluding title block region).
// {x, y, w, h, viewKey}

const layoutThirdAngle = [
  // Top view (top-left), Iso (top-right)
  { viewKey: 'viewTop',   x: 0.05, y: 0.05, w: 0.42, h: 0.42 },
  { viewKey: 'viewIso',   x: 0.53, y: 0.05, w: 0.42, h: 0.42 },
  // Front view (bottom-left), Right side (bottom-right)
  { viewKey: 'viewFront', x: 0.05, y: 0.52, w: 0.42, h: 0.42 },
  { viewKey: 'viewSide',  x: 0.53, y: 0.52, w: 0.42, h: 0.42 },
];

const layoutFirstAngle = [
  // Front view (top-left), Right side (top — but in 1st angle, side is to the LEFT
  //   of front, so we put side ABOVE-LEFT and front to its right). In a simple
  //   2x2 grid we approximate: Front on top-left, Iso top-right; Side on
  //   bottom-left, Top view on bottom-right (mirror of 3rd-angle layout).
  { viewKey: 'viewFront', x: 0.05, y: 0.05, w: 0.42, h: 0.42 },
  { viewKey: 'viewIso',   x: 0.53, y: 0.05, w: 0.42, h: 0.42 },
  { viewKey: 'viewSide',  x: 0.05, y: 0.52, w: 0.42, h: 0.42 },
  { viewKey: 'viewTop',   x: 0.53, y: 0.52, w: 0.42, h: 0.42 },
];

// Strict ISO layouts (front-centred, side aligned horizontally, top aligned
// vertically). Used by templates that want pure orthographic alignment.

const layoutThirdAngleAligned = [
  // 3rd angle: top above front, right side right of front
  { viewKey: 'viewTop',   x: 0.05, y: 0.04, w: 0.45, h: 0.28 },
  { viewKey: 'viewIso',   x: 0.56, y: 0.04, w: 0.40, h: 0.28 },
  { viewKey: 'viewFront', x: 0.05, y: 0.36, w: 0.45, h: 0.45 },
  { viewKey: 'viewSide',  x: 0.56, y: 0.36, w: 0.40, h: 0.45 },
];

const layoutFirstAngleAligned = [
  // 1st angle: top below front, right side left of front
  { viewKey: 'viewSide',  x: 0.05, y: 0.04, w: 0.40, h: 0.45 },
  { viewKey: 'viewFront', x: 0.51, y: 0.04, w: 0.45, h: 0.45 },
  { viewKey: 'viewIso',   x: 0.05, y: 0.53, w: 0.40, h: 0.28 },
  { viewKey: 'viewTop',   x: 0.51, y: 0.53, w: 0.45, h: 0.28 },
];

const layoutPortraitStack = [
  // single column for A4 portrait — useful for small parts
  { viewKey: 'viewIso',   x: 0.05, y: 0.04, w: 0.90, h: 0.22 },
  { viewKey: 'viewFront', x: 0.05, y: 0.30, w: 0.90, h: 0.22 },
  { viewKey: 'viewTop',   x: 0.05, y: 0.56, w: 0.43, h: 0.22 },
  { viewKey: 'viewSide',  x: 0.52, y: 0.56, w: 0.43, h: 0.22 },
];

// ─── Built-in templates ──────────────────────────────────────────────────────

const BUILT_IN = [
  {
    id: 'iso-a4-landscape',
    name: 'ISO A4 Landscape · ISO 7200',
    description: 'A4 ngang theo ISO 7200, khung tên đầy đủ, lịch sử sửa đổi bên phải.',
    sheet: { size: 'A4', orientation: 'landscape' },
    layouts: {
      third_angle: layoutThirdAngleAligned,
      first_angle: layoutFirstAngleAligned,
    },
    titleBlock: {
      variant: 'iso7200-full',
      position: 'bottom',
    },
    revisionTable: { enabled: true, position: 'right', maxRows: 6 },
    notesBlock: { enabled: true, position: 'bottom-left' },
    showProjectionSymbol: true,
    showWatermark: true,
    viewGrid: { framed: true, labeled: true, dimensionsOnViews: true },
  },
  {
    id: 'iso-a3-landscape',
    name: 'ISO A3 Landscape · ISO 7200',
    description: 'A3 ngang, layout cùng A4 nhưng rộng hơn cho chi tiết phức tạp.',
    sheet: { size: 'A3', orientation: 'landscape' },
    layouts: {
      third_angle: layoutThirdAngleAligned,
      first_angle: layoutFirstAngleAligned,
    },
    titleBlock: { variant: 'iso7200-full', position: 'bottom' },
    revisionTable: { enabled: true, position: 'right', maxRows: 8 },
    notesBlock: { enabled: true, position: 'bottom-left' },
    showProjectionSymbol: true,
    showWatermark: true,
    viewGrid: { framed: true, labeled: true, dimensionsOnViews: true },
  },
  {
    id: 'iso-a2-landscape',
    name: 'ISO A2 Landscape · ISO 7200',
    description: 'A2 ngang, dành cho assembly hoặc chi tiết lớn.',
    sheet: { size: 'A2', orientation: 'landscape' },
    layouts: {
      third_angle: layoutThirdAngleAligned,
      first_angle: layoutFirstAngleAligned,
    },
    titleBlock: { variant: 'iso7200-full', position: 'bottom' },
    revisionTable: { enabled: true, position: 'right', maxRows: 10 },
    notesBlock: { enabled: true, position: 'bottom-left' },
    showProjectionSymbol: true,
    showWatermark: true,
    viewGrid: { framed: true, labeled: true, dimensionsOnViews: true },
  },
  {
    id: 'iso-a4-portrait',
    name: 'ISO A4 Portrait · Simple',
    description: 'A4 dọc, layout dạng cột — phù hợp chi tiết nhỏ, in nhanh.',
    sheet: { size: 'A4', orientation: 'portrait' },
    layouts: {
      third_angle: layoutPortraitStack,
      first_angle: layoutPortraitStack,
    },
    titleBlock: { variant: 'iso7200-compact', position: 'bottom' },
    revisionTable: { enabled: false },
    notesBlock: { enabled: true, position: 'bottom' },
    showProjectionSymbol: true,
    showWatermark: true,
    viewGrid: { framed: true, labeled: true, dimensionsOnViews: true },
  },
  {
    id: 'quick-2x2',
    name: 'Quick 2×2 · Vendor preview',
    description: 'Bố cục 2×2 đơn giản gửi nhanh cho vendor — không tuân thủ ISO chiếu.',
    sheet: { size: 'A4', orientation: 'landscape' },
    layouts: {
      third_angle: layoutThirdAngle,
      first_angle: layoutFirstAngle,
    },
    titleBlock: { variant: 'iso7200-compact', position: 'bottom' },
    revisionTable: { enabled: true, position: 'right', maxRows: 4 },
    notesBlock: { enabled: true, position: 'bottom-left' },
    showProjectionSymbol: true,
    showWatermark: true,
    viewGrid: { framed: true, labeled: true, dimensionsOnViews: false },
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

function ensureDir() {
  try { fs.mkdirSync(TEMPLATE_DIR, { recursive: true }); } catch (_) {}
}

function loadCustom() {
  ensureDir();
  let files;
  try {
    files = fs.readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith('.json'));
  } catch (_) { return []; }
  const out = [];
  for (const f of files) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8'));
      if (!json.id) json.id = path.basename(f, '.json');
      json._source = 'custom';
      json._file = f;
      out.push(json);
    } catch (e) {
      // skip invalid templates
    }
  }
  return out;
}

export function listTemplates() {
  return [
    ...BUILT_IN.map((t) => ({ ...t, _source: 'built-in' })),
    ...loadCustom(),
  ];
}

export function getTemplate(id) {
  if (!id) return BUILT_IN[0];
  const all = listTemplates();
  return all.find((t) => t.id === id) || BUILT_IN[0];
}

export function saveCustomTemplate(template) {
  if (!template.id) throw new Error('Template requires an id');
  if (!/^[a-z0-9_-]+$/i.test(template.id)) {
    throw new Error('Template id may only contain letters, numbers, dash, underscore');
  }
  ensureDir();
  const file = path.join(TEMPLATE_DIR, `${template.id}.json`);
  const payload = { ...template };
  delete payload._source;
  delete payload._file;
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return getTemplate(template.id);
}

export function deleteCustomTemplate(id) {
  ensureDir();
  const file = path.join(TEMPLATE_DIR, `${id}.json`);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}

export const DEFAULT_TEMPLATE_ID = 'iso-a4-landscape';
