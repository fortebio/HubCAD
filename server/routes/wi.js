import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { wiContent } from '../db/schema.js';
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
  const row = db.select().from(wiContent).where(eq(wiContent.documentId, id)).get();
  if (!row) {
    return res.json({ documentId: id, meta: {}, steps: [], updatedAt: null });
  }
  res.json({
    documentId: row.documentId,
    meta: safeParse(row.meta, {}),
    steps: safeParse(row.steps, []),
    updatedAt: row.updatedAt,
  });
});

router.put('/by-document/:documentId', optionalAuth, (req, res) => {
  const documentId = Number(req.params.documentId);
  const { meta = {}, steps = [] } = req.body || {};
  const existing = db.select().from(wiContent).where(eq(wiContent.documentId, documentId)).get();
  const values = {
    documentId,
    meta: JSON.stringify(meta),
    steps: JSON.stringify(steps),
    updatedBy: req.user?.id || null,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (existing) {
    db.update(wiContent).set(values).where(eq(wiContent.documentId, documentId)).run();
  } else {
    db.insert(wiContent).values(values).run();
  }
  res.json({ ok: true });
});

export default router;
