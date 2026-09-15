import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, sqlite } from '../db/client.js';
import { documents, documentRevisions } from '../db/schema.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { assertWorkflowTransition, getWorkflowReadiness } from '../services/workflow.js';

const router = Router();

const STATUSES = ['draft', 'in_review', 'approved', 'released', 'obsolete'];

router.get('/', optionalAuth, (req, res) => {
  const { status, type, project_id, q } = req.query;
  const conds = [];
  if (status) conds.push(eq(documents.status, status));
  if (type) conds.push(eq(documents.docType, type));
  if (project_id) conds.push(eq(documents.projectId, Number(project_id)));
  let query = db.select().from(documents);
  if (conds.length) query = query.where(and(...conds));
  let rows = query.orderBy(desc(documents.updatedAt)).all();
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (d) =>
        d.docNumber.toLowerCase().includes(needle) ||
        d.nameEn.toLowerCase().includes(needle) ||
        (d.nameVn || '').toLowerCase().includes(needle)
    );
  }
  res.json({ documents: rows });
});

router.get('/stats', (_, res) => {
  const rows = sqlite
    .prepare('SELECT status, doc_type as docType, COUNT(*) as count FROM documents GROUP BY status, doc_type')
    .all();
  const byStatus = {};
  const byType = {};
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + r.count;
    byType[r.docType] = (byType[r.docType] || 0) + r.count;
    total += r.count;
  }
  res.json({ total, byStatus, byType });
});

// The same source of truth powers the UI and the status mutation below.
// This makes it possible to show the next required action before the user
// presses Apply, while still keeping the rule authoritative on the server.
router.get('/:id/workflow', optionalAuth, (req, res) => {
  const doc = db.select().from(documents).where(eq(documents.id, Number(req.params.id))).get();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(getWorkflowReadiness(doc, req.user));
});

router.get('/:id', (req, res) => {
  const doc = db.select().from(documents).where(eq(documents.id, Number(req.params.id))).get();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const revisions = db
    .select()
    .from(documentRevisions)
    .where(eq(documentRevisions.documentId, doc.id))
    .orderBy(desc(documentRevisions.createdAt))
    .all();
  res.json({ document: doc, revisions });
});

router.post('/', optionalAuth, (req, res) => {
  const { docNumber, nameEn, nameVn, docType, projectId, revision = '-' } = req.body || {};
  if (!docNumber || !nameEn || !docType) {
    return res.status(400).json({ error: 'docNumber, nameEn, docType required' });
  }
  try {
    const [doc] = db
      .insert(documents)
      .values({
        docNumber,
        nameEn,
        nameVn,
        docType,
        revision,
        projectId: projectId || null,
        createdBy: req.user?.id || null,
      })
      .returning()
      .all();
    res.status(201).json({ document: doc });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Doc number already exists' });
    }
    throw e;
  }
});

router.patch('/:id', optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['nameEn', 'nameVn', 'docType', 'revision', 'projectId', 'filePath'];
  const update = {};
  for (const k of allowed) {
    if (k in req.body) update[k] = req.body[k];
  }
  update.updatedAt = sql`CURRENT_TIMESTAMP`;
  const [doc] = db.update(documents).set(update).where(eq(documents.id, id)).returning().all();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ document: doc });
});

router.patch('/:id/status', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status: newStatus, comment } = req.body || {};
  if (!STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` });
  }
  const doc = db.select().from(documents).where(eq(documents.id, id)).get();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const gate = assertWorkflowTransition(doc, newStatus, req.user);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error, blockers: gate.blockers });
  const [updated] = db
    .update(documents)
    .set({ status: newStatus, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(documents.id, id))
    .returning()
    .all();
  db.insert(documentRevisions)
    .values({
      documentId: id,
      revision: doc.revision,
      changeDesc: `Status: ${doc.status} → ${newStatus}${comment ? ' — ' + comment : ''}`,
      createdBy: req.user?.id || null,
    })
    .run();
  recordAudit({
    user: req.user,
    action: 'document.status_change',
    entityType: 'document',
    entityId: id,
    summary: `${doc.docNumber}: ${doc.status} → ${newStatus}`,
    meta: { from: doc.status, to: newStatus, comment },
  });
  res.json({ document: updated });
});

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.delete(documents).where(eq(documents.id, id)).run();
  res.json({ ok: true });
});

export default router;
