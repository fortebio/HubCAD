import { Router } from 'express';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { action, entityType, entityId, limit = '100' } = req.query;
  const conds = [];
  if (action) conds.push(eq(auditLog.action, action));
  if (entityType) conds.push(eq(auditLog.entityType, entityType));
  if (entityId) conds.push(eq(auditLog.entityId, Number(entityId)));
  let q = db.select().from(auditLog);
  if (conds.length) q = q.where(and(...conds));
  const rows = q.orderBy(desc(auditLog.createdAt)).limit(Number(limit)).all();
  res.json({
    events: rows.map((r) => ({ ...r, meta: r.meta ? safeParse(r.meta) : null })),
  });
});

router.get('/stats', requireAuth, (_req, res) => {
  // Group by action — useful for a header chip "X events today"
  const today = new Date().toISOString().slice(0, 10);
  const allCount = db.select().from(auditLog).all().length;
  const todayCount = db.select().from(auditLog).all().filter((r) => (r.createdAt || '').startsWith(today)).length;
  res.json({ all: allCount, today: todayCount });
});

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default router;
