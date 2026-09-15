import { Router } from 'express';
import { generatePdf } from '../services/pdf/generator.js';

const router = Router();

// GET /api/pdf/:kind/:documentId?watermark=&checklistType=
router.get('/:kind/:documentId', async (req, res, next) => {
  try {
    const { kind, documentId } = req.params;
    const { watermark, checklistType } = req.query;
    const { buffer, fileName } = await generatePdf({
      documentId: Number(documentId),
      kind,
      watermark: watermark || 'auto',
      checklistType,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

export default router;
