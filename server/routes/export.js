import { Router } from 'express';
import { generateExport, generateDrawingFromViews, SUPPORTED_FORMATS, SUPPORTED_KINDS } from '../services/export/index.js';

const router = Router();

router.get('/formats', (_, res) => {
  res.json({ formats: SUPPORTED_FORMATS, kinds: SUPPORTED_KINDS });
});

// POST /api/export/drawing-from-views/:format
// Body: JSON { viewFront, viewTop, viewSide, viewIso, dimX, dimY, dimZ, triangles,
//              sourceFile, notes, scale, projection, tolerance, material, surfaceFinish,
//              docNumber, nameEn, nameVn, revision }
// View paths are URLs under /uploads/images/... (already uploaded via /api/files/upload/image).
router.post('/drawing-from-views/:format', async (req, res, next) => {
  try {
    const { format } = req.params;
    const { buffer, fileName, mimeType, inline } = await generateDrawingFromViews({
      format,
      payload: req.body || {},
    });
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

// GET /api/export/:format/:kind/:documentId?watermark=&checklistType=
router.get('/:format/:kind/:documentId', async (req, res, next) => {
  try {
    const { format, kind, documentId } = req.params;
    const { watermark, checklistType } = req.query;
    const { buffer, fileName, mimeType, inline } = await generateExport({
      format,
      kind,
      documentId: Number(documentId),
      watermark: watermark || 'auto',
      checklistType,
    });
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

export default router;
