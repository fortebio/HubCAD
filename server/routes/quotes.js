import React from 'react';
import { Router } from 'express';
import { renderToBuffer } from '@react-pdf/renderer';
import { desc, eq, like } from 'drizzle-orm';
import { db } from '../db/client.js';
import { quotes, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { normalizeQuote, quoteFileStem } from '../services/quote/payload.js';
import { buildQuoteWorkbook } from '../services/quote/workbook.js';
import { QuotePdf } from '../services/pdf/quoteTemplate.jsx';

const router = Router();

const STATUSES = ['draft', 'sent', 'accepted', 'rejected'];

/** QT-YYMM-001, continuing the current month's sequence. */
function nextQuoteNumber() {
  const now = new Date();
  const prefix = `QT-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const existing = db
    .select({ quoteNumber: quotes.quoteNumber })
    .from(quotes)
    .where(like(quotes.quoteNumber, `${prefix}%`))
    .all();
  const highest = existing.reduce((max, r) => {
    const n = Number(String(r.quoteNumber).slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

function rowToSummary(row, authorName) {
  return {
    id: row.id,
    quoteNumber: row.quoteNumber,
    title: row.title,
    customer: row.customer,
    documentId: row.documentId,
    currency: row.currency,
    sets: row.sets,
    partCount: row.partCount,
    totalCost: row.totalCost,
    totalPrice: row.totalPrice,
    status: row.status,
    createdBy: authorName || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function authorOf(row) {
  if (!row?.createdBy) return null;
  const u = db.select().from(users).where(eq(users.id, row.createdBy)).get();
  return u ? u.fullName || u.username : null;
}

// GET /api/quotes → newest first
router.get('/', requireAuth, (_req, res) => {
  const rows = db.select().from(quotes).orderBy(desc(quotes.createdAt)).all();
  res.json({ quotes: rows.map((r) => rowToSummary(r, authorOf(r))) });
});

// GET /api/quotes/next-number → reserve nothing, just suggest one
router.get('/next-number', requireAuth, (_req, res) => {
  res.json({ quoteNumber: nextQuoteNumber() });
});

// GET /api/quotes/:id → full payload, ready to reopen in the estimator
router.get('/:id', requireAuth, (req, res) => {
  const row = db.select().from(quotes).where(eq(quotes.id, Number(req.params.id))).get();
  if (!row) return res.status(404).json({ error: 'Quote not found' });
  let data = {};
  try {
    data = JSON.parse(row.data);
  } catch {
    data = {};
  }
  res.json({ quote: { ...rowToSummary(row, authorOf(row)), data } });
});

// POST /api/quotes → save a new quote
router.post('/', requireAuth, (req, res, next) => {
  try {
    const quote = normalizeQuote(req.body);
    const quoteNumber =
      quote.meta.quoteNumber && quote.meta.quoteNumber !== 'QT-DRAFT'
        ? quote.meta.quoteNumber
        : nextQuoteNumber();
    quote.meta.quoteNumber = quoteNumber;

    const taken = db.select().from(quotes).where(eq(quotes.quoteNumber, quoteNumber)).get();
    if (taken) {
      return res.status(409).json({ error: `Quote number ${quoteNumber} already exists` });
    }

    const [row] = db
      .insert(quotes)
      .values({
        quoteNumber,
        title: quote.meta.title,
        customer: quote.meta.customer || null,
        documentId: quote.meta.documentId || null,
        currency: quote.meta.currency,
        sets: quote.meta.sets,
        partCount: quote.totals.partCount,
        totalCost: quote.totals.cost,
        totalPrice: quote.totals.grandTotal,
        status: STATUSES.includes(quote.meta.status) ? quote.meta.status : 'draft',
        data: JSON.stringify(quote),
        createdBy: req.user.id,
      })
      .returning()
      .all();

    recordAudit({
      user: req.user,
      action: 'quote.create',
      entityType: 'quote',
      entityId: row.id,
      summary: `Created quote ${quoteNumber} — ${quote.totals.partCount} parts, ${quote.meta.sets} set(s)`,
      meta: { totalPrice: quote.totals.grandTotal, currency: quote.meta.currency },
    });

    res.status(201).json({ quote: { ...rowToSummary(row, authorOf(row)), data: quote } });
  } catch (e) {
    next(e);
  }
});

// PUT /api/quotes/:id → replace a saved quote
router.put('/:id', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!existing) return res.status(404).json({ error: 'Quote not found' });

    const quote = normalizeQuote(req.body);
    quote.meta.quoteNumber = existing.quoteNumber; // the number is the identity
    const now = new Date().toISOString();

    const [row] = db
      .update(quotes)
      .set({
        title: quote.meta.title,
        customer: quote.meta.customer || null,
        documentId: quote.meta.documentId || null,
        currency: quote.meta.currency,
        sets: quote.meta.sets,
        partCount: quote.totals.partCount,
        totalCost: quote.totals.cost,
        totalPrice: quote.totals.grandTotal,
        status: STATUSES.includes(quote.meta.status) ? quote.meta.status : existing.status,
        data: JSON.stringify(quote),
        updatedAt: now,
      })
      .where(eq(quotes.id, id))
      .returning()
      .all();

    recordAudit({
      user: req.user,
      action: 'quote.update',
      entityType: 'quote',
      entityId: id,
      summary: `Updated quote ${existing.quoteNumber}`,
      meta: { totalPrice: quote.totals.grandTotal },
    });

    res.json({ quote: { ...rowToSummary(row, authorOf(row)), data: quote } });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/quotes/:id — the author or a manager may remove a quote
router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = db.select().from(quotes).where(eq(quotes.id, id)).get();
  if (!row) return res.status(404).json({ error: 'Quote not found' });
  if (req.user.role !== 'manager' && row.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Only the author or a manager can delete this quote' });
  }
  db.delete(quotes).where(eq(quotes.id, id)).run();
  recordAudit({
    user: req.user,
    action: 'quote.delete',
    entityType: 'quote',
    entityId: id,
    summary: `Deleted quote ${row.quoteNumber}`,
  });
  res.json({ ok: true });
});

// POST /api/quotes/export/pdf — renders whatever is on screen, saved or not
router.post('/export/pdf', requireAuth, async (req, res, next) => {
  try {
    const quote = normalizeQuote(req.body);
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote, watermark: req.body?.watermark || 'none' })
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quoteFileStem(quote)}.pdf"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

// POST /api/quotes/export/excel
router.post('/export/excel', requireAuth, (req, res, next) => {
  try {
    const quote = normalizeQuote(req.body);
    const buffer = buildQuoteWorkbook(quote);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${quoteFileStem(quote)}.xlsx"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

export default router;
