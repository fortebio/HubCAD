/**
 * The estimator: geometry + material + process + quantity → money.
 *
 * Two layers of price come out of every estimate:
 *   unitCost  — what the job costs the shop (material, machine, setup)
 *   unitPrice — what we quote (cost + overhead + margin, rounded)
 * Keeping both visible is the point: the team can see the margin it is asking
 * for instead of guessing at a single number.
 */

import { PROCESS_META, PROCESS_MODELS, PROCESS_ORDER } from './processes.js';
import { mergeSettings } from './defaults.js';

export const AUTO = 'auto';

export function findMaterial(settings, id) {
  return (settings.materials || []).find((m) => m.id === id) || null;
}

export function materialsFor(settings, categories) {
  if (!categories) return settings.materials || [];
  return (settings.materials || []).filter((m) => categories.includes(m.category));
}

export function findFinish(settings, id) {
  return (settings.finishes || []).find((f) => f.id === id) || null;
}

/** Finishes that make sense for a material — anodising is not for plastic. */
export function finishesFor(settings, material) {
  return (settings.finishes || []).filter(
    (f) => !f.categories || !material || f.categories.includes(material.category)
  );
}

export function processIds(settings) {
  const known = PROCESS_ORDER.filter((id) => settings.processes?.[id]);
  const extra = Object.keys(settings.processes || {}).filter((id) => !PROCESS_ORDER.includes(id));
  return [...known, ...extra];
}

export function isProcessEnabled(settings, id) {
  return settings.processes?.[id]?.enabled !== false;
}

/** The material a process falls back to when the user has not chosen one. */
export function defaultMaterialFor(processId, settings) {
  const meta = PROCESS_META[processId];
  if (!meta) return null;
  if (findMaterial(settings, meta.defaultMaterial)) return meta.defaultMaterial;
  const first = materialsFor(settings, meta.categories)[0];
  return first ? first.id : null;
}

/** Spread a one-off batch fee across the order. */
function perOrder(amount, qty) {
  return amount / Math.max(1, qty);
}

function roundUpTo(value, step) {
  if (!step || step <= 0) return value;
  return Math.ceil(value / step) * step;
}

/**
 * One part, one process, one material, one order quantity.
 * Never throws: an impossible combination comes back with `feasible: false`
 * and the reasons why, so the comparison table can still show it.
 */
export function estimatePart({ stats, materialId, processId, qty = 1, settings, finishId = 'none' }) {
  const s = settings?.materials ? settings : mergeSettings(settings);
  const orderQty = Math.max(1, Math.round(Number(qty) || 1));
  const meta = PROCESS_META[processId];
  const model = PROCESS_MODELS[processId];
  const rates = s.processes?.[processId];
  const material = findMaterial(s, materialId);
  const commercial = s.commercial || {};

  const missing = [];
  if (!meta || !model) missing.push({ en: `Unknown process: ${processId}`, vn: `Không rõ quy trình: ${processId}` });
  if (!rates) missing.push({ en: 'No rates configured for this process', vn: 'Chưa cấu hình đơn giá cho quy trình này' });
  if (!material) missing.push({ en: `Unknown material: ${materialId}`, vn: `Không rõ vật liệu: ${materialId}` });
  if (!stats || !(stats.volumeMm3 >= 0)) missing.push({ en: 'No geometry to estimate from', vn: 'Chưa có hình học để ước tính' });

  if (missing.length) {
    return {
      processId,
      materialId,
      process: meta || null,
      material: material || null,
      feasible: false,
      blockers: missing,
      warnings: [],
      lines: [],
      massG: 0,
      rawMassG: 0,
      timeMinPerPart: 0,
      leadDays: null,
      qty: orderQty,
      unitCost: 0,
      unitPrice: 0,
      lineTotal: 0,
      overhead: 0,
      margin: 0,
      detail: {},
    };
  }

  const out = model({ stats, material, rates, qty: orderQty, commercial });
  const blockers = [...(out.blockers || [])];
  const warnings = [...(out.warnings || [])];

  if (stats.watertight === false) {
    warnings.push({
      en: 'Mesh is not closed — volume, mass and price are approximate',
      vn: 'Lưới không kín — thể tích, khối lượng và giá chỉ là gần đúng',
    });
  }

  // Surface treatment is priced on the part's own area, whatever made it.
  const finish = findFinish(s, finishId);
  const lines = [...(out.lines || [])];
  if (finish && finish.id !== 'none') {
    const areaDm2 = stats.areaMm2 / 10000;
    const finishCost =
      areaDm2 * (Number(finish.pricePerDm2) || 0) + perOrder(Number(finish.setupFee) || 0, orderQty);
    if (finishCost > 0) {
      lines.push({
        key: 'finish',
        en: `Finish — ${finish.en}`,
        vn: `Xử lý bề mặt — ${finish.vn}`,
        amount: finishCost,
      });
    }
  }

  const rawDirect = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const minCharge = Number(rates.minCharge) || 0;
  const minChargeApplied = rawDirect < minCharge;
  const directCost = Math.max(rawDirect, minCharge);

  const overhead = (directCost * (Number(commercial.overheadPct) || 0)) / 100;
  const margin = ((directCost + overhead) * (Number(commercial.marginPct) || 0)) / 100;
  const unitPrice = roundUpTo(directCost + overhead + margin, Number(commercial.roundTo) || 0);

  return {
    processId,
    materialId,
    process: meta,
    material,
    feasible: blockers.length === 0,
    blockers,
    warnings,
    lines,
    finish,
    finishId,
    massG: out.massG || 0,
    rawMassG: out.rawMassG || 0,
    timeMinPerPart: out.timeMinPerPart || 0,
    leadDays: out.leadDays ?? null,
    detail: out.detail || {},
    qty: orderQty,
    rawDirect,
    minChargeApplied,
    unitCost: directCost,
    overhead,
    margin,
    unitPrice,
    lineTotal: unitPrice * orderQty,
  };
}

/**
 * Price the part through every enabled process and rank the ones that work.
 * With no material chosen, each process is costed in its own default material
 * so the comparison answers "which route is cheapest for this shape?".
 */
export function suggestForPart({ stats, qty = 1, settings, materialId = null, finishId = 'none' }) {
  const s = settings?.materials ? settings : mergeSettings(settings);
  const candidates = [];

  for (const pid of processIds(s)) {
    if (!isProcessEnabled(s, pid)) continue;
    const mid = materialId && materialId !== AUTO ? materialId : defaultMaterialFor(pid, s);
    if (!mid) continue;
    candidates.push(
      estimatePart({ stats, materialId: mid, processId: pid, qty, settings: s, finishId })
    );
  }

  const feasible = candidates.filter((c) => c.feasible).sort((a, b) => a.unitPrice - b.unitPrice);
  const rejected = candidates.filter((c) => !c.feasible);
  const best = feasible[0] || null;

  // "Why this one" — cheapest is the headline, with the runner-up as context.
  const reasons = [];
  if (best) {
    reasons.push({
      en: `Lowest unit price of ${feasible.length} workable route${feasible.length > 1 ? 's' : ''} at ${qty} pcs`,
      vn: `Đơn giá thấp nhất trong ${feasible.length} phương án khả thi với ${qty} chiếc`,
    });
    if (feasible[1]) {
      const gap = ((feasible[1].unitPrice - best.unitPrice) / Math.max(best.unitPrice, 1)) * 100;
      reasons.push({
        en: `${gap.toFixed(0)}% cheaper than ${feasible[1].process.en}`,
        vn: `Rẻ hơn ${gap.toFixed(0)}% so với ${feasible[1].process.vn}`,
      });
    }
    if (best.leadDays != null) {
      reasons.push({
        en: `Typical lead time ${best.leadDays} days`,
        vn: `Thời gian giao hàng thường ${best.leadDays} ngày`,
      });
    }
  }

  return { recommended: best, reasons, feasible, rejected, candidates: [...feasible, ...rejected] };
}

/**
 * A whole quote: every part, times the number of sets being built.
 * `parts` carry the user's choices; `auto` entries resolve to the suggestion.
 */
export function estimateQuote({ parts = [], settings, sets = 1 }) {
  const s = settings?.materials ? settings : mergeSettings(settings);
  const setCount = Math.max(1, Math.round(Number(sets) || 1));
  const commercial = s.commercial || {};

  const rows = parts.map((part) => {
    const qtyPerSet = Math.max(0, Number(part.qtyPerSet ?? 1) || 0);
    const qty = Math.max(1, Math.round(qtyPerSet * setCount));
    const wantsAutoProcess = !part.processId || part.processId === AUTO;
    const wantsAutoMaterial = !part.materialId || part.materialId === AUTO;

    const finishId = part.finishId || 'none';
    const suggestion = suggestForPart({
      stats: part.stats,
      qty,
      settings: s,
      materialId: wantsAutoMaterial ? null : part.materialId,
      finishId,
    });

    let estimate;
    if (wantsAutoProcess) {
      estimate = suggestion.recommended
        || suggestion.candidates[0]
        || estimatePart({
          stats: part.stats,
          materialId: part.materialId,
          processId: 'cnc_milling',
          qty,
          settings: s,
          finishId,
        });
    } else {
      const materialId = wantsAutoMaterial
        ? defaultMaterialFor(part.processId, s)
        : part.materialId;
      estimate = estimatePart({
        stats: part.stats,
        materialId,
        processId: part.processId,
        qty,
        settings: s,
        finishId,
      });
    }

    return {
      ...part,
      qtyPerSet,
      qty,
      autoProcess: wantsAutoProcess,
      autoMaterial: wantsAutoMaterial,
      suggestion,
      estimate,
      // A part set to 0 per set is kept in the list but priced out of the quote.
      lineTotal: qtyPerSet > 0 ? estimate.lineTotal : 0,
    };
  });

  const subtotal = rows.reduce((sum, r) => sum + (r.qtyPerSet > 0 ? r.estimate.lineTotal : 0), 0);
  const cost = rows.reduce((sum, r) => sum + (r.qtyPerSet > 0 ? r.estimate.unitCost * r.qty : 0), 0);
  const massPerSetG = rows.reduce((sum, r) => sum + r.estimate.massG * r.qtyPerSet, 0);
  const vat = commercial.applyVat ? (subtotal * (Number(commercial.vatPct) || 0)) / 100 : 0;
  const leadDays = rows.reduce((max, r) => Math.max(max, r.estimate.leadDays || 0), 0);
  const blocked = rows.filter((r) => !r.estimate.feasible);

  return {
    rows,
    sets: setCount,
    totals: {
      partCount: rows.length,
      totalQty: rows.reduce((sum, r) => sum + r.qty, 0),
      cost,
      subtotal,
      vat,
      grandTotal: subtotal + vat,
      pricePerSet: subtotal / setCount,
      massPerSetG,
      marginValue: subtotal - cost,
      marginPct: subtotal > 0 ? ((subtotal - cost) / subtotal) * 100 : 0,
      leadDays,
      blockedCount: blocked.length,
    },
  };
}
