import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/client.js';
import { ecr, ecrAffectedItems, ecrApprovals, ecnNotifications } from '../db/schema.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendEcnNotification, notifierStatus } from '../services/notifier.js';
import { recordAudit } from '../services/audit.js';

const router = Router();

router.get('/', (req, res) => {
  const { status, priority } = req.query;
  const conds = [];
  if (status) conds.push(eq(ecr.status, status));
  if (priority) conds.push(eq(ecr.priority, priority));
  let q = db.select().from(ecr);
  if (conds.length) q = q.where(and(...conds));
  const rows = q.orderBy(desc(ecr.createdAt)).all();
  res.json({ ecrs: rows });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.select().from(ecr).where(eq(ecr.id, id)).get();
  if (!row) return res.status(404).json({ error: 'Not found' });
  const affected = db.select().from(ecrAffectedItems).where(eq(ecrAffectedItems.ecrId, id)).all();
  const approvals = db.select().from(ecrApprovals).where(eq(ecrApprovals.ecrId, id)).all();
  const notifs = db.select().from(ecnNotifications).where(eq(ecnNotifications.ecrId, id)).all();
  res.json({ ecr: row, affected, approvals, notifications: notifs });
});

router.post('/', optionalAuth, (req, res) => {
  const { ecrNumber, title, reason, description, changeType, priority = 'normal', projectId, affected = [] } = req.body || {};
  if (!ecrNumber || !title || !reason || !changeType) {
    return res.status(400).json({ error: 'ecrNumber, title, reason, changeType required' });
  }
  try {
    const [row] = db
      .insert(ecr)
      .values({
        ecrNumber,
        title,
        reason,
        description,
        changeType,
        priority,
        projectId: projectId || null,
        originatedBy: req.user?.id || null,
      })
      .returning()
      .all();
    if (affected.length) {
      db.insert(ecrAffectedItems).values(affected.map((a) => ({ ...a, ecrId: row.id }))).run();
    }
    res.status(201).json({ ecr: row });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'ECR number already exists' });
    }
    throw e;
  }
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['title', 'reason', 'description', 'changeType', 'priority', 'status'];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];
  const [row] = db.update(ecr).set(update).where(eq(ecr.id, id)).returning().all();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ecr: row });
});

router.post('/:id/approve', optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  const { role, decision, comment } = req.body || {};
  if (!role || !decision) return res.status(400).json({ error: 'role, decision required' });
  db.insert(ecrApprovals)
    .values({
      ecrId: id,
      userId: req.user?.id || null,
      role,
      decision,
      comment,
      decidedAt: sql`CURRENT_TIMESTAMP`,
    })
    .run();
  if (decision === 'approved') {
    const all = db.select().from(ecrApprovals).where(eq(ecrApprovals.ecrId, id)).all();
    const allApproved = all.length >= 3 && all.every((a) => a.decision === 'approved');
    if (allApproved) {
      db.update(ecr).set({ status: 'approved' }).where(eq(ecr.id, id)).run();
    }
  } else if (decision === 'rejected') {
    db.update(ecr).set({ status: 'rejected' }).where(eq(ecr.id, id)).run();
  }
  const ecrRow = db.select().from(ecr).where(eq(ecr.id, id)).get();
  recordAudit({
    user: req.user,
    action: 'ecr.approve',
    entityType: 'ecr',
    entityId: id,
    summary: `${ecrRow?.ecrNumber || 'ECR#' + id}: ${role} → ${decision}`,
    meta: { role, decision, comment },
  });
  res.json({ ok: true });
});

router.post('/:id/notify', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { recipients = [] } = req.body || {};
    const row = db.select().from(ecr).where(eq(ecr.id, id)).get();
    if (!row) return res.status(404).json({ error: 'ECR not found' });

    const results = [];
    for (const r of recipients) {
      const result = await sendEcnNotification({ ecr: row, recipient: r });
      db.insert(ecnNotifications)
        .values({ ecrId: id, recipient: r, sentAt: sql`CURRENT_TIMESTAMP` })
        .run();
      results.push({ recipient: r, ...result });
    }
    recordAudit({
      user: req.user,
      action: 'ecr.notify',
      entityType: 'ecr',
      entityId: id,
      summary: `${row.ecrNumber}: ECN sent to ${recipients.join(', ')}`,
      meta: { recipients, mode: notifierStatus().mode },
    });
    res.json({ ok: true, sent: results.length, results, notifier: notifierStatus() });
  } catch (e) {
    next(e);
  }
});

router.get('/notifier/status', (_, res) => {
  res.json(notifierStatus());
});

router.get('/stats/summary', (_, res) => {
  const byStatus = sqlite.prepare('SELECT status, COUNT(*) AS c FROM ecr GROUP BY status').all();
  const byPriority = sqlite.prepare('SELECT priority, COUNT(*) AS c FROM ecr GROUP BY priority').all();
  res.json({ byStatus, byPriority });
});

export default router;
