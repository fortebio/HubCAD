import { Router } from 'express';
import { eq, asc, desc } from 'drizzle-orm';
import multer from 'multer';
import { db } from '../db/client.js';
import { bomHeaders, bomItems, bomSnapshots, documents } from '../db/schema.js';
import { buildBOMWorkbook, workbookToBuffer, parseBOMWorkbook, diffBOMItems } from '../services/bom.js';
import { optionalAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

router.get('/by-document/:documentId', (req, res) => {
  const documentId = Number(req.params.documentId);
  const header = db.select().from(bomHeaders).where(eq(bomHeaders.documentId, documentId)).get();
  if (!header) return res.json({ header: null, items: [] });
  const items = db.select().from(bomItems).where(eq(bomItems.bomId, header.id)).orderBy(asc(bomItems.itemNo)).all();
  res.json({ header, items });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const header = db.select().from(bomHeaders).where(eq(bomHeaders.id, id)).get();
  if (!header) return res.status(404).json({ error: 'Not found' });
  const items = db.select().from(bomItems).where(eq(bomItems.bomId, id)).orderBy(asc(bomItems.itemNo)).all();
  res.json({ header, items });
});

router.post('/', (req, res) => {
  const { documentId, assemblyNo, revision = '-', items = [] } = req.body || {};
  if (!documentId || !assemblyNo) {
    return res.status(400).json({ error: 'documentId, assemblyNo required' });
  }
  const [header] = db
    .insert(bomHeaders)
    .values({ documentId, assemblyNo, revision, totalItems: items.length })
    .returning()
    .all();
  if (items.length) {
    db.insert(bomItems)
      .values(items.map((it, idx) => ({ ...it, bomId: header.id, itemNo: it.itemNo || idx + 1 })))
      .run();
  }
  res.status(201).json({ header });
});

router.put('/:id/items', (req, res) => {
  const bomId = Number(req.params.id);
  const { items = [] } = req.body || {};
  db.delete(bomItems).where(eq(bomItems.bomId, bomId)).run();
  if (items.length) {
    db.insert(bomItems)
      .values(items.map((it, idx) => ({
        bomId,
        itemNo: it.itemNo || idx + 1,
        level: it.level ?? 1,
        partNumber: it.partNumber,
        descEn: it.descEn,
        descVn: it.descVn,
        qty: it.qty ?? 1,
        unit: it.unit || 'pcs',
        material: it.material,
        vendor: it.vendor,
        unitCost: it.unitCost,
        leadTime: it.leadTime,
        remarks: it.remarks,
      })))
      .run();
  }
  db.update(bomHeaders).set({ totalItems: items.length }).where(eq(bomHeaders.id, bomId)).run();
  const refreshed = db.select().from(bomItems).where(eq(bomItems.bomId, bomId)).orderBy(asc(bomItems.itemNo)).all();
  res.json({ items: refreshed });
});

router.get('/:id/export-excel', (req, res) => {
  const id = Number(req.params.id);
  const header = db.select().from(bomHeaders).where(eq(bomHeaders.id, id)).get();
  if (!header) return res.status(404).json({ error: 'BOM not found' });
  const items = db.select().from(bomItems).where(eq(bomItems.bomId, id)).orderBy(asc(bomItems.itemNo)).all();
  const document = header.documentId
    ? db.select().from(documents).where(eq(documents.id, header.documentId)).get()
    : null;
  const wb = buildBOMWorkbook({ header, items, document });
  const buffer = workbookToBuffer(wb);
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `${header.assemblyNo}_BOM_Rev${header.revision}_${ymd}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});

router.post('/:id/import-excel', upload.single('file'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const header = db.select().from(bomHeaders).where(eq(bomHeaders.id, id)).get();
    if (!header) return res.status(404).json({ error: 'BOM not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { items } = parseBOMWorkbook(req.file.buffer);

    db.delete(bomItems).where(eq(bomItems.bomId, id)).run();
    if (items.length) {
      db.insert(bomItems)
        .values(items.map((it, idx) => ({
          bomId: id,
          itemNo: it.itemNo || idx + 1,
          level: it.level ?? 1,
          partNumber: it.partNumber || '',
          descEn: it.descEn || '',
          descVn: it.descVn || null,
          qty: it.qty ?? 1,
          unit: it.unit || 'pcs',
          material: it.material || null,
          vendor: it.vendor || null,
          unitCost: it.unitCost ?? null,
          leadTime: it.leadTime || null,
          remarks: it.remarks || null,
        })))
        .run();
    }
    db.update(bomHeaders).set({ totalItems: items.length }).where(eq(bomHeaders.id, id)).run();
    res.json({ imported: items.length, items });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/snapshot', optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  const { revision, note } = req.body || {};
  if (!revision) return res.status(400).json({ error: 'revision required' });
  const header = db.select().from(bomHeaders).where(eq(bomHeaders.id, id)).get();
  if (!header) return res.status(404).json({ error: 'BOM not found' });
  const items = db.select().from(bomItems).where(eq(bomItems.bomId, id)).orderBy(asc(bomItems.itemNo)).all();
  const totalCost = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);
  const [snap] = db
    .insert(bomSnapshots)
    .values({
      bomId: id,
      revision,
      items: JSON.stringify(items),
      totalCost,
      note: note || null,
      snapshottedBy: req.user?.id || null,
    })
    .returning()
    .all();
  // bump current BOM revision label
  db.update(bomHeaders).set({ revision }).where(eq(bomHeaders.id, id)).run();
  recordAudit({
    user: req.user,
    action: 'bom.snapshot',
    entityType: 'bom',
    entityId: id,
    summary: `BOM ${header.assemblyNo} snapshot Rev ${revision} (${items.length} items, $${totalCost.toFixed(2)})`,
    meta: { revision, itemCount: items.length, totalCost, note },
  });
  res.status(201).json({ snapshot: snap });
});

router.get('/:id/snapshots', (req, res) => {
  const id = Number(req.params.id);
  const rows = db.select().from(bomSnapshots).where(eq(bomSnapshots.bomId, id)).orderBy(desc(bomSnapshots.snapshottedAt)).all();
  res.json({
    snapshots: rows.map((r) => ({
      id: r.id,
      revision: r.revision,
      note: r.note,
      totalCost: r.totalCost,
      snapshottedAt: r.snapshottedAt,
      itemCount: safeCount(r.items),
    })),
  });
});

router.get('/:id/compare', (req, res) => {
  const id = Number(req.params.id);
  const { base, target } = req.query;
  const header = db.select().from(bomHeaders).where(eq(bomHeaders.id, id)).get();
  if (!header) return res.status(404).json({ error: 'BOM not found' });

  function loadSide(side) {
    if (!side || side === 'current') {
      return {
        revision: header.revision,
        items: db.select().from(bomItems).where(eq(bomItems.bomId, id)).orderBy(asc(bomItems.itemNo)).all(),
        kind: 'current',
      };
    }
    const snap = db.select().from(bomSnapshots).where(eq(bomSnapshots.id, Number(side))).get();
    if (!snap) throw Object.assign(new Error(`Snapshot ${side} not found`), { status: 404 });
    return { revision: snap.revision, items: JSON.parse(snap.items || '[]'), kind: 'snapshot', id: snap.id };
  }

  try {
    const b = loadSide(base);
    const t = loadSide(target);
    const diff = diffBOMItems(b.items, t.items);
    res.json({
      base: { revision: b.revision, kind: b.kind, id: b.id || null, itemCount: b.items.length },
      target: { revision: t.revision, kind: t.kind, id: t.id || null, itemCount: t.items.length },
      diff,
      costDelta:
        t.items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0) -
        b.items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0),
    });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

function safeCount(s) {
  try {
    return JSON.parse(s || '[]').length;
  } catch {
    return 0;
  }
}

router.get('/:id/cost', (req, res) => {
  const id = Number(req.params.id);
  const items = db.select().from(bomItems).where(eq(bomItems.bomId, id)).all();
  const totalCost = items.reduce((sum, it) => sum + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);
  const byLevel = items.reduce((acc, it) => {
    acc[it.level] = (acc[it.level] || 0) + (Number(it.unitCost) || 0) * (Number(it.qty) || 0);
    return acc;
  }, {});
  res.json({ totalCost, byLevel, itemCount: items.length });
});

export default router;
