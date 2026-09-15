import { Router } from 'express';
import { listTemplates, getTemplate, saveCustomTemplate, deleteCustomTemplate, DEFAULT_TEMPLATE_ID } from '../services/pdf/drawingTemplates/index.js';
import { renderTemplateSvg, renderTemplateDxf } from '../services/pdf/drawingTemplates/renderBackdrop.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/drawing-templates → list all (built-in + custom)
router.get('/', (_req, res) => {
  res.json({
    defaultId: DEFAULT_TEMPLATE_ID,
    templates: listTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      sheet: t.sheet,
      titleBlockVariant: t.titleBlock?.variant,
      source: t._source,
      hasFirstAngle: !!t.layouts?.first_angle,
      hasThirdAngle: !!t.layouts?.third_angle,
    })),
  });
});

// GET /api/drawing-templates/:id → full config
router.get('/:id', (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  res.json(t);
});

// GET /api/drawing-templates/:id/backdrop.svg → SVG asset (preview + Illustrator/Inkscape)
router.get('/:id/backdrop.svg', (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const projection = req.query.projection || 'third_angle';
  const svg = renderTemplateSvg(t, { projection });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${t.id}.svg"`);
  res.send(svg);
});

// GET /api/drawing-templates/:id/backdrop.dxf → DXF asset for SolidWorks / Fusion 360 / AutoCAD
router.get('/:id/backdrop.dxf', (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const projection = req.query.projection || 'third_angle';
  const dxf = renderTemplateDxf(t, { projection });
  res.setHeader('Content-Type', 'application/dxf; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${t.id}.dxf"`);
  res.send(dxf);
});

// POST /api/drawing-templates → upload custom template (JSON body)
// Requires manager role (templates affect all users).
router.post('/', requireAuth, requireRole('manager'), (req, res, next) => {
  try {
    const t = saveCustomTemplate(req.body || {});
    res.status(201).json(t);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/drawing-templates/:id → remove a custom template
router.delete('/:id', requireAuth, requireRole('manager'), (req, res, next) => {
  try {
    const ok = deleteCustomTemplate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Template not found or built-in' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
