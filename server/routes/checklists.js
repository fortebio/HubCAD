import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checklistResults } from '../db/schema.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/by-document/:documentId', (req, res) => {
  const documentId = Number(req.params.documentId);
  const { type } = req.query;
  const conds = [eq(checklistResults.documentId, documentId)];
  if (type) conds.push(eq(checklistResults.checklistType, type));
  const rows = db
    .select()
    .from(checklistResults)
    .where(and(...conds))
    .orderBy(desc(checklistResults.checkedAt))
    .all();
  res.json({ results: rows.map((r) => ({ ...r, results: safeParse(r.results) })) });
});

router.post('/', optionalAuth, (req, res) => {
  const { documentId, checklistType, revision = '-', results, remarks } = req.body || {};
  if (!documentId || !checklistType || !results) {
    return res.status(400).json({ error: 'documentId, checklistType, results required' });
  }
  const entries = Object.values(results);
  const hasNg = entries.includes('ng');
  const allOk = entries.length > 0 && entries.every((v) => v === 'ok');
  const overall = allOk ? 'pass' : hasNg ? 'fail' : 'conditional';

  const [row] = db
    .insert(checklistResults)
    .values({
      documentId,
      checklistType,
      revision,
      results: JSON.stringify(results),
      overall,
      remarks,
      checkedBy: req.user?.id || null,
    })
    .returning()
    .all();
  res.status(201).json({ result: { ...row, results: safeParse(row.results) } });
});

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export default router;
