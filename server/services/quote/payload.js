/**
 * The quote payload the browser posts for saving, PDF and Excel.
 *
 * The costing engine itself lives in the client (src/lib/costing) and stays
 * the single source of truth for prices — the server never re-derives money,
 * it only validates the shape and lays it out. That keeps one engine, not two.
 */

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

function normalizeBilingualList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x) => x && (x.en || x.vn))
    .map((x) => ({ en: str(x.en), vn: str(x.vn), amount: x.amount != null ? num(x.amount) : undefined }));
}

export function normalizeQuote(body = {}) {
  const meta = body.meta || {};
  const rows = Array.isArray(body.rows) ? body.rows : [];

  if (!rows.length) {
    throw Object.assign(new Error('A quote needs at least one part'), { status: 400 });
  }

  const normalizedRows = rows.map((r, i) => ({
    index: i + 1,
    name: str(r.name, `Part ${i + 1}`),
    partNumber: str(r.partNumber),
    processId: str(r.processId),
    processEn: str(r.processEn, '—'),
    processVn: str(r.processVn, ''),
    materialId: str(r.materialId),
    materialEn: str(r.materialEn, '—'),
    materialVn: str(r.materialVn, ''),
    finishEn: str(r.finishEn),
    finishVn: str(r.finishVn),
    qtyPerSet: num(r.qtyPerSet, 1),
    qty: num(r.qty, 1),
    massG: num(r.massG),
    volumeCm3: num(r.volumeCm3),
    dimsMm: Array.isArray(r.dimsMm) ? r.dimsMm.map((d) => num(d)) : [],
    timeMin: num(r.timeMin),
    leadDays: r.leadDays == null ? null : num(r.leadDays),
    unitCost: num(r.unitCost),
    unitPrice: num(r.unitPrice),
    lineTotal: num(r.lineTotal),
    lines: normalizeBilingualList(r.lines),
    warnings: normalizeBilingualList(r.warnings),
    feasible: r.feasible !== false,
  }));

  const totals = body.totals || {};

  return {
    meta: {
      quoteNumber: str(meta.quoteNumber, 'QT-DRAFT'),
      title: str(meta.title, 'Manufacturing quotation'),
      customer: str(meta.customer),
      project: str(meta.project),
      preparedBy: str(meta.preparedBy),
      companyName: str(meta.companyName, 'Forte Biotech'),
      currency: meta.currency === 'USD' ? 'USD' : 'VND',
      usdRate: num(meta.usdRate, 25400),
      sets: Math.max(1, Math.round(num(meta.sets, 1))),
      validDays: Math.max(0, Math.round(num(meta.validDays, 30))),
      vatPct: num(meta.vatPct, 0),
      applyVat: !!meta.applyVat,
      notesEn: str(meta.notesEn),
      notesVn: str(meta.notesVn),
      documentId: meta.documentId == null ? null : num(meta.documentId, null),
      status: str(meta.status, 'draft'),
      createdAt: str(meta.createdAt, new Date().toISOString()),
    },
    rows: normalizedRows,
    totals: {
      partCount: num(totals.partCount, normalizedRows.length),
      totalQty: num(totals.totalQty),
      cost: num(totals.cost),
      subtotal: num(totals.subtotal),
      vat: num(totals.vat),
      grandTotal: num(totals.grandTotal),
      pricePerSet: num(totals.pricePerSet),
      massPerSetG: num(totals.massPerSetG),
      marginPct: num(totals.marginPct),
      leadDays: num(totals.leadDays),
    },
    /** Opaque state the quote page uses to reopen the quote. */
    parts: Array.isArray(body.parts) ? body.parts : [],
  };
}

/** File-name stem shared by the PDF and the Excel export. */
export function quoteFileStem(quote) {
  const safe = (quote.meta.quoteNumber || 'QUOTE').replace(/[^A-Za-z0-9_-]+/g, '-');
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${safe}_QUOTE_${ymd}`;
}
