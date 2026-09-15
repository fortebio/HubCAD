import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { catalogContent } from '../db/schema.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

function safeParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

router.get('/by-document/:documentId', (req, res) => {
  const id = Number(req.params.documentId);
  const row = db.select().from(catalogContent).where(eq(catalogContent.documentId, id)).get();
  if (!row) {
    return res.json({ documentId: id, data: {}, updatedAt: null });
  }
  res.json({
    documentId: row.documentId,
    data: safeParse(row.data, {}),
    updatedAt: row.updatedAt,
  });
});

router.put('/by-document/:documentId', optionalAuth, (req, res) => {
  const documentId = Number(req.params.documentId);
  const { data = {} } = req.body || {};
  const existing = db.select().from(catalogContent).where(eq(catalogContent.documentId, documentId)).get();
  const values = {
    documentId,
    data: JSON.stringify(data),
    updatedBy: req.user?.id || null,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (existing) {
    db.update(catalogContent).set(values).where(eq(catalogContent.documentId, documentId)).run();
  } else {
    db.insert(catalogContent).values(values).run();
  }
  res.json({ ok: true });
});

export default router;
