import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { drawingSheets, documents } from '../db/schema.js';
import { optionalAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

const router = Router();

const ALLOWED = [
  'viewFront',
  'viewTop',
  'viewSide',
  'viewIso',
  'dimX',
  'dimY',
  'dimZ',
  'triangles',
  'sourceFile',
  'notes',
  'scale',
  'projection',
  'tolerance',
  'material',
  'surfaceFinish',
  'weight',
  'sheetSize',
  'designer',
  'checker',
  'approver',
  'approverDate',
  'generalNotes',
  'treatment',
  'standardRef',
  'customer',
  'templateId',
];

router.get('/sheet/by-document/:documentId', (req, res) => {
  const id = Number(req.params.documentId);
  const sheet = db.select().from(drawingSheets).where(eq(drawingSheets.documentId, id)).get();
  res.json({ sheet: sheet || null });
});

router.put('/sheet/by-document/:documentId', optionalAuth, (req, res) => {
  const documentId = Number(req.params.documentId);
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const patch = { documentId, updatedAt: sql`CURRENT_TIMESTAMP` };
  for (const k of ALLOWED) {
    if (k in (req.body || {})) patch[k] = req.body[k];
  }

  const existing = db.select().from(drawingSheets).where(eq(drawingSheets.documentId, documentId)).get();
  if (existing) {
    db.update(drawingSheets).set(patch).where(eq(drawingSheets.documentId, documentId)).run();
  } else {
    patch.createdBy = req.user?.id || null;
    db.insert(drawingSheets).values(patch).run();
  }
  // bump document.updatedAt to surface the change in lists
  db.update(documents).set({ updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(documents.id, documentId)).run();

  recordAudit({
    user: req.user,
    action: 'drawing.save_views',
    entityType: 'document',
    entityId: documentId,
    summary: `Saved drawing views for ${doc.docNumber}`,
    meta: {
      dim: patch.dimX != null ? `${patch.dimX}×${patch.dimY}×${patch.dimZ}` : null,
      triangles: patch.triangles,
      scale: patch.scale,
    },
  });

  const refreshed = db.select().from(drawingSheets).where(eq(drawingSheets.documentId, documentId)).get();
  res.json({ sheet: refreshed });
});

export default router;
