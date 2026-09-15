/**
 * Manufacturing processes and their cost models.
 *
 * A model turns geometry + one material + the admin's rates into per-part
 * money. Every model returns the same shape so the estimator, the comparison
 * table and the PDF can all read it without knowing which process ran:
 *
 *   { feasible, blockers[], warnings[], massG, rawMassG, timeMinPerPart,
 *     lines: [{ key, en, vn, amount }], leadDays }
 *
 * `lines` are already per part — batch fees are divided by the order quantity
 * inside the model, because only the model knows what a batch means for it.
 */

import { estimatePerimeterMm } from '../massProperties.js';

const MM3_TO_CM3 = 1 / 1000;

export const PROCESS_META = {
  cnc_milling: {
    id: 'cnc_milling',
    en: 'CNC milling',
    vn: 'Phay CNC',
    short: 'CNC',
    categories: ['metal', 'plastic', 'wood'],
    defaultMaterial: 'al6061',
    tone: 'bg-blue-100 text-blue-800',
    descEn: 'Tight tolerance, strong parts, from solid stock. Best for metal housings and fixtures.',
    descVn: 'Dung sai chặt, chi tiết bền, gia công từ phôi đặc. Phù hợp vỏ kim loại và đồ gá.',
  },
  cnc_turning: {
    id: 'cnc_turning',
    en: 'CNC turning',
    vn: 'Tiện CNC',
    short: 'Lathe',
    categories: ['metal', 'plastic'],
    defaultMaterial: 'al6061',
    tone: 'bg-cyan-100 text-cyan-800',
    descEn: 'For round parts: shafts, bushings, adapters. Much faster than milling on rotational shapes.',
    descVn: 'Cho chi tiết tròn xoay: trục, bạc, đầu nối. Nhanh hơn phay nhiều với hình tròn xoay.',
  },
  fdm: {
    id: 'fdm',
    en: '3D print — FDM',
    vn: 'In 3D — FDM',
    short: 'FDM',
    categories: ['filament'],
    defaultMaterial: 'pla',
    tone: 'bg-emerald-100 text-emerald-800',
    descEn: 'Cheapest prototype route. Layer lines visible, ±0.3 mm typical.',
    descVn: 'Rẻ nhất để làm mẫu. Thấy vân lớp, dung sai thường ±0,3 mm.',
  },
  sla_resin: {
    id: 'sla_resin',
    en: '3D print — Resin (SLA/LCD)',
    vn: 'In 3D — Resin (SLA/LCD)',
    short: 'Resin',
    categories: ['resin'],
    defaultMaterial: 'resin_std',
    tone: 'bg-violet-100 text-violet-800',
    descEn: 'Fine detail and smooth surfaces for appearance models; brittle and UV-sensitive.',
    descVn: 'Chi tiết mịn, bề mặt đẹp cho mẫu trưng bày; giòn và kém bền UV.',
  },
  sls: {
    id: 'sls',
    en: '3D print — SLS (PA12)',
    vn: 'In 3D — SLS (PA12)',
    short: 'SLS',
    categories: ['powder'],
    defaultMaterial: 'pa12',
    tone: 'bg-amber-100 text-amber-800',
    descEn: 'No supports, functional nylon parts, good for complex geometry in small batches.',
    descVn: 'Không cần support, chi tiết nylon dùng được thật, hợp hình phức tạp số lượng ít.',
  },
  laser_cut: {
    id: 'laser_cut',
    en: 'Laser cutting (sheet)',
    vn: 'Cắt laser (tấm)',
    short: 'Laser',
    categories: ['metal', 'plastic', 'wood'],
    defaultMaterial: 'pmma',
    tone: 'bg-orange-100 text-orange-800',
    descEn: 'Flat parts only — brackets, plates, panels. Very cheap per part once nested.',
    descVn: 'Chỉ cho chi tiết phẳng — ke, tấm, mặt panel. Rất rẻ khi xếp nhiều chi tiết.',
  },
  injection_molding: {
    id: 'injection_molding',
    en: 'Injection moulding',
    vn: 'Ép nhựa',
    short: 'IM',
    categories: ['plastic'],
    defaultMaterial: 'abs',
    tone: 'bg-rose-100 text-rose-800',
    descEn: 'Mass production. Tooling is a large one-off cost that only pays back at volume.',
    descVn: 'Sản xuất hàng loạt. Chi phí khuôn lớn, chỉ hoàn vốn khi số lượng nhiều.',
  },
};

export const PROCESS_ORDER = [
  'cnc_milling',
  'cnc_turning',
  'fdm',
  'sla_resin',
  'sls',
  'laser_cut',
  'injection_molding',
];

// ── helpers ────────────────────────────────────────────────────────────────

const sortedDims = (size) => [size.x, size.y, size.z].sort((a, b) => b - a);

/** Does the part fit the machine, in any orientation? */
function fitsEnvelope(size, maxSizeMm) {
  if (!Array.isArray(maxSizeMm) || maxSizeMm.length < 3) return true;
  const part = sortedDims(size);
  const machine = [...maxSizeMm].sort((a, b) => b - a);
  return part.every((d, i) => d <= machine[i]);
}

const fmtSize = (arr) => arr.map((n) => Math.round(n)).join(' × ');

const kgCost = (grams, pricePerKg) => (grams / 1000) * (pricePerKg || 0);

/** Amortise a one-off batch fee over the order quantity. */
const perPart = (amount, qty) => amount / Math.max(1, qty);

// ── cost models ────────────────────────────────────────────────────────────

function cncMilling({ stats, material, rates, qty }) {
  const blockers = [];
  const warnings = [];
  const size = stats.bbox.size;

  if (!PROCESS_META.cnc_milling.categories.includes(material.category)) {
    blockers.push({
      en: `${material.en} cannot be milled from stock`,
      vn: `${material.vn} không phay được từ phôi`,
    });
  }
  if (!fitsEnvelope(size, rates.maxSizeMm)) {
    blockers.push({
      en: `Part exceeds the machine envelope (${fmtSize(rates.maxSizeMm)} mm)`,
      vn: `Chi tiết vượt hành trình máy (${fmtSize(rates.maxSizeMm)} mm)`,
    });
  }

  const m = Number(rates.stockMarginMm) || 0;
  const stockMm3 = (size.x + m) * (size.y + m) * (size.z + m);
  const stockG = stockMm3 * MM3_TO_CM3 * material.density;
  const materialCost = kgCost(stockG, material.pricePerKg) * (1 + (material.wastePct || 0) / 100);

  const removedCm3 = Math.max((stockMm3 - stats.volumeMm3) * MM3_TO_CM3, 0.1);
  const mrr = Math.max(rates.mrrCm3PerMin / Math.max(material.machinability || 1, 0.2), 0.1);
  const cutMin = removedCm3 / mrr;
  const finishMin = stats.areaMm2 / 100 / Math.max(rates.finishRateCm2PerMin, 1);
  const timeMinPerPart = cutMin + finishMin + 2; // 2 min load / unload / deburr

  const machineCost =
    (timeMinPerPart / 60) * rates.machineRate * (1 + (rates.toolWearPct || 0) / 100);

  if (stats.fillRatio < 0.15) {
    warnings.push({
      en: `Only ${(stats.fillRatio * 100).toFixed(0)}% of the stock block remains — most of the price is chips`,
      vn: `Chỉ còn ${(stats.fillRatio * 100).toFixed(0)}% khối phôi — phần lớn giá là phoi bị cắt bỏ`,
    });
  }

  return {
    blockers,
    warnings,
    massG: stats.volumeMm3 * MM3_TO_CM3 * material.density,
    rawMassG: stockG,
    timeMinPerPart,
    leadDays: rates.leadDays,
    detail: {
      stockMm: [size.x + m, size.y + m, size.z + m],
      removedCm3,
      cutMin,
      finishMin,
    },
    lines: [
      { key: 'material', en: 'Stock material', vn: 'Phôi vật liệu', amount: materialCost },
      { key: 'machine', en: 'Machining time', vn: 'Thời gian gia công', amount: machineCost },
      {
        key: 'setup',
        en: 'Setup + CAM programming',
        vn: 'Gá đặt + lập trình CAM',
        amount: perPart((rates.setupFee || 0) + (rates.programmingFee || 0), qty),
      },
    ],
  };
}

function cncTurning({ stats, material, rates, qty }) {
  const blockers = [];
  const warnings = [];
  const size = stats.bbox.size;

  if (!PROCESS_META.cnc_turning.categories.includes(material.category)) {
    blockers.push({
      en: `${material.en} cannot be turned from bar stock`,
      vn: `${material.vn} không tiện được từ phôi thanh`,
    });
  }
  if (!stats.rotationAxis) {
    blockers.push({
      en: 'Part is not rotational — no axis with a round cross-section',
      vn: 'Chi tiết không tròn xoay — không có trục nào có tiết diện tròn',
    });
  }

  const axis = stats.rotationAxis || 'z';
  const length = size[axis];
  const diameter = Math.max(...['x', 'y', 'z'].filter((a) => a !== axis).map((a) => size[a]));
  const m = Number(rates.stockMarginMm) || 0;
  const barD = diameter + m;
  const barL = length + m;

  if (barD > rates.maxDiameterMm) {
    blockers.push({
      en: `Ø${barD.toFixed(0)} mm exceeds the lathe capacity (Ø${rates.maxDiameterMm} mm)`,
      vn: `Ø${barD.toFixed(0)} mm vượt năng lực máy tiện (Ø${rates.maxDiameterMm} mm)`,
    });
  }
  if (barL > rates.maxLengthMm) {
    blockers.push({
      en: `Length ${barL.toFixed(0)} mm exceeds the lathe capacity (${rates.maxLengthMm} mm)`,
      vn: `Chiều dài ${barL.toFixed(0)} mm vượt năng lực máy tiện (${rates.maxLengthMm} mm)`,
    });
  }

  const stockMm3 = (Math.PI / 4) * barD * barD * barL;
  const stockG = stockMm3 * MM3_TO_CM3 * material.density;
  const materialCost = kgCost(stockG, material.pricePerKg) * (1 + (material.wastePct || 0) / 100);

  const removedCm3 = Math.max((stockMm3 - stats.volumeMm3) * MM3_TO_CM3, 0.1);
  const mrr = Math.max(rates.mrrCm3PerMin / Math.max(material.machinability || 1, 0.2), 0.1);
  const cutMin = removedCm3 / mrr;
  const finishMin = stats.areaMm2 / 100 / Math.max(rates.finishRateCm2PerMin, 1);
  const timeMinPerPart = cutMin + finishMin + 1;

  const machineCost =
    (timeMinPerPart / 60) * rates.machineRate * (1 + (rates.toolWearPct || 0) / 100);

  return {
    blockers,
    warnings,
    massG: stats.volumeMm3 * MM3_TO_CM3 * material.density,
    rawMassG: stockG,
    timeMinPerPart,
    leadDays: rates.leadDays,
    detail: { barD, barL, removedCm3, cutMin, finishMin },
    lines: [
      { key: 'material', en: 'Bar stock', vn: 'Phôi thanh', amount: materialCost },
      { key: 'machine', en: 'Turning time', vn: 'Thời gian tiện', amount: machineCost },
      {
        key: 'setup',
        en: 'Setup + CAM programming',
        vn: 'Gá đặt + lập trình CAM',
        amount: perPart((rates.setupFee || 0) + (rates.programmingFee || 0), qty),
      },
    ],
  };
}

function fdmPrint({ stats, material, rates, qty }) {
  const blockers = [];
  const warnings = [];
  const size = stats.bbox.size;

  if (material.category !== 'filament') {
    blockers.push({
      en: `${material.en} is not an FDM filament`,
      vn: `${material.vn} không phải sợi in FDM`,
    });
  }
  if (!fitsEnvelope(size, rates.maxSizeMm)) {
    blockers.push({
      en: `Part exceeds the build volume (${fmtSize(rates.maxSizeMm)} mm) — split it or print in parts`,
      vn: `Chi tiết vượt khổ in (${fmtSize(rates.maxSizeMm)} mm) — cần chia nhỏ hoặc in ghép`,
    });
  }

  const solidCm3 = stats.volumeMm3 * MM3_TO_CM3;
  const shell = (rates.shellPct || 0) / 100;
  const infill = (rates.infillPct || 0) / 100;
  const printedCm3 = solidCm3 * (shell + (1 - shell) * infill);
  const withSupport = printedCm3 * (1 + (rates.supportPct || 0) / 100);
  const feedCm3 = withSupport * (1 + (material.wastePct || 0) / 100);

  const massG = printedCm3 * material.density;
  const rawMassG = feedCm3 * material.density;
  const materialCost = kgCost(rawMassG, material.pricePerKg);

  const height = Math.min(size.x, size.y, size.z); // printed lying down
  const timeHr = Math.max(
    feedCm3 / Math.max(rates.throughputCm3PerHour, 0.1),
    height / Math.max(rates.minVerticalMmPerHour, 1)
  );
  const machineCost = timeHr * rates.machineRate;

  if (stats.thicknessMm < 1.2) {
    warnings.push({
      en: `Thinnest wall ≈ ${stats.thicknessMm.toFixed(1)} mm — close to the FDM minimum, expect warping`,
      vn: `Thành mỏng nhất ≈ ${stats.thicknessMm.toFixed(1)} mm — sát giới hạn FDM, dễ cong vênh`,
    });
  }

  return {
    blockers,
    warnings,
    massG,
    rawMassG,
    timeMinPerPart: timeHr * 60,
    leadDays: rates.leadDays,
    detail: { printedCm3, solidCm3, timeHr, infillPct: rates.infillPct },
    lines: [
      { key: 'material', en: 'Filament', vn: 'Sợi nhựa', amount: materialCost },
      { key: 'machine', en: 'Printer time', vn: 'Thời gian máy in', amount: machineCost },
      {
        key: 'handling',
        en: 'Support removal + finishing',
        vn: 'Gỡ support + hoàn thiện',
        amount: rates.handlingPerPart || 0,
      },
      { key: 'setup', en: 'Batch setup', vn: 'Chuẩn bị lô', amount: perPart(rates.setupFee || 0, qty) },
    ],
  };
}

function resinPrint({ stats, material, rates, qty }) {
  const blockers = [];
  const warnings = [];
  const size = stats.bbox.size;

  if (material.category !== 'resin') {
    blockers.push({
      en: `${material.en} is not a photopolymer resin`,
      vn: `${material.vn} không phải resin quang`,
    });
  }
  if (!fitsEnvelope(size, rates.maxSizeMm)) {
    blockers.push({
      en: `Part exceeds the vat size (${fmtSize(rates.maxSizeMm)} mm)`,
      vn: `Chi tiết vượt khổ máy resin (${fmtSize(rates.maxSizeMm)} mm)`,
    });
  }

  const solidCm3 = stats.volumeMm3 * MM3_TO_CM3;
  const resinCm3 = solidCm3 * (1 + (rates.supportPct || 0) / 100) * (1 + (material.wastePct || 0) / 100);
  const massG = solidCm3 * material.density;
  const materialCost = kgCost(resinCm3 * material.density, material.pricePerKg);

  // Laid flat: the smallest dimension becomes the build height, and the two
  // larger ones decide how many parts share one build.
  const dims = sortedDims(size);
  const height = dims[2];
  const gap = rates.nestGapMm || 5;
  const bed = rates.bedMm || [180, 120];
  const perBuild = Math.max(
    1,
    Math.floor(bed[0] / (dims[0] + gap)) * Math.floor(bed[1] / (dims[1] + gap))
  );
  const buildHr = ((height / Math.max(rates.layerHeightMm, 0.01)) * rates.secondsPerLayer) / 3600;
  const shared = Math.min(Math.max(1, qty), perBuild);
  const timeHr = buildHr / shared;
  const machineCost = timeHr * rates.machineRate;

  return {
    blockers,
    warnings,
    massG,
    rawMassG: resinCm3 * material.density,
    timeMinPerPart: timeHr * 60,
    leadDays: rates.leadDays,
    detail: { buildHr, perBuild, shared, height },
    lines: [
      { key: 'material', en: 'Resin', vn: 'Nhựa resin', amount: materialCost },
      { key: 'machine', en: 'Printer time', vn: 'Thời gian máy in', amount: machineCost },
      {
        key: 'handling',
        en: 'Wash + UV cure + supports',
        vn: 'Rửa + sấy UV + gỡ support',
        amount: rates.handlingPerPart || 0,
      },
      { key: 'setup', en: 'Batch setup', vn: 'Chuẩn bị lô', amount: perPart(rates.setupFee || 0, qty) },
    ],
  };
}

function slsPrint({ stats, material, rates, qty }) {
  const blockers = [];
  const size = stats.bbox.size;

  if (material.category !== 'powder') {
    blockers.push({
      en: `${material.en} is not an SLS powder`,
      vn: `${material.vn} không phải bột SLS`,
    });
  }
  if (!fitsEnvelope(size, rates.maxSizeMm)) {
    blockers.push({
      en: `Part exceeds the build volume (${fmtSize(rates.maxSizeMm)} mm)`,
      vn: `Chi tiết vượt khổ in (${fmtSize(rates.maxSizeMm)} mm)`,
    });
  }

  const solidCm3 = stats.volumeMm3 * MM3_TO_CM3;
  const massG = solidCm3 * material.density;
  const powderG = massG * (1 + (rates.powderRefreshPct || 0) / 100);
  const materialCost = kgCost(powderG, material.pricePerKg);

  const timeHr = solidCm3 / Math.max(rates.throughputCm3PerHour, 0.1);
  const machineCost = timeHr * rates.machineRate;

  return {
    blockers,
    warnings: [],
    massG,
    rawMassG: powderG,
    timeMinPerPart: timeHr * 60,
    leadDays: rates.leadDays,
    detail: { timeHr },
    lines: [
      { key: 'material', en: 'Powder (incl. refresh)', vn: 'Bột (gồm bột mới)', amount: materialCost },
      { key: 'machine', en: 'Machine time', vn: 'Thời gian máy', amount: machineCost },
      {
        key: 'handling',
        en: 'Depowdering + finishing',
        vn: 'Làm sạch bột + hoàn thiện',
        amount: rates.handlingPerPart || 0,
      },
      { key: 'setup', en: 'Build setup', vn: 'Chuẩn bị mẻ in', amount: perPart(rates.setupFee || 0, qty) },
    ],
  };
}

function laserCut({ stats, material, rates, qty }) {
  const blockers = [];
  const warnings = [];
  const dims = sortedDims(stats.bbox.size);

  if (!PROCESS_META.laser_cut.categories.includes(material.category) || !material.laserFactor) {
    blockers.push({
      en: `${material.en} is not laser cut in-house`,
      vn: `${material.vn} không cắt laser tại xưởng`,
    });
  }
  if (stats.aspect > (rates.maxFlatAspect ?? 0.25)) {
    blockers.push({
      en: 'Not a flat part — laser cutting only makes 2D profiles from sheet',
      vn: 'Không phải chi tiết phẳng — cắt laser chỉ tạo biên dạng 2D từ tấm',
    });
  } else if (stats.prismaticRatio > 0 && stats.prismaticRatio < (rates.minPrismaticRatio ?? 0.8)) {
    // Flat overall, but the thickness is not constant (pockets, ribs, draft):
    // a laser cannot make that shape, whatever its footprint says.
    blockers.push({
      en: `Thickness is not constant (${(stats.prismaticRatio * 100).toFixed(0)}% of a solid profile) — needs milling or moulding`,
      vn: `Chiều dày không đồng nhất (${(stats.prismaticRatio * 100).toFixed(0)}% so với biên dạng đặc) — cần phay hoặc ép khuôn`,
    });
  }
  if (stats.thicknessMm > rates.maxThicknessMm) {
    blockers.push({
      en: `Thickness ${stats.thicknessMm.toFixed(1)} mm exceeds the ${rates.maxThicknessMm} mm limit`,
      vn: `Dày ${stats.thicknessMm.toFixed(1)} mm vượt giới hạn ${rates.maxThicknessMm} mm`,
    });
  }
  const sheet = [...(rates.maxSheetMm || [1200, 900])].sort((a, b) => b - a);
  if (dims[0] > sheet[0] || dims[1] > sheet[1]) {
    blockers.push({
      en: `Profile ${dims[0].toFixed(0)} × ${dims[1].toFixed(0)} mm exceeds the sheet (${fmtSize(sheet)} mm)`,
      vn: `Biên dạng ${dims[0].toFixed(0)} × ${dims[1].toFixed(0)} mm vượt khổ tấm (${fmtSize(sheet)} mm)`,
    });
  }

  const thickness = Math.max(stats.thicknessMm, 0.1);
  const perimeterMm = estimatePerimeterMm(stats);
  const speed = Math.max(
    rates.baseCutSpeedMmPerMin / Math.max(thickness * (material.laserFactor || 1), 0.5),
    20
  );
  const cutMin = perimeterMm / speed + ((rates.piercesPerPart || 0) * (rates.pierceSeconds || 0)) / 60;
  const machineCost = (cutMin / 60) * rates.machineRate;

  // Sheet is bought by the rectangle the profile occupies, plus nesting waste.
  const sheetMm3 = dims[0] * dims[1] * thickness * (1 + (rates.nestWastePct || 0) / 100);
  const rawMassG = sheetMm3 * MM3_TO_CM3 * material.density;
  const materialCost = kgCost(rawMassG, material.pricePerKg);

  warnings.push({
    en: 'Bends, taps and countersinks are not included in a laser price',
    vn: 'Chưa gồm chấn gấp, taro ren và khoét côn',
  });

  return {
    blockers,
    warnings,
    massG: stats.volumeMm3 * MM3_TO_CM3 * material.density,
    rawMassG,
    timeMinPerPart: cutMin,
    leadDays: rates.leadDays,
    detail: { perimeterMm, speed, thickness },
    lines: [
      { key: 'material', en: 'Sheet (nested)', vn: 'Tấm (đã xếp hình)', amount: materialCost },
      { key: 'machine', en: 'Cutting time', vn: 'Thời gian cắt', amount: machineCost },
      { key: 'setup', en: 'Nesting + setup', vn: 'Xếp hình + gá đặt', amount: perPart(rates.setupFee || 0, qty) },
    ],
  };
}

function injectionMolding({ stats, material, rates, qty }) {
  const blockers = [];
  const warnings = [];
  const size = stats.bbox.size;
  const shotCm3 = stats.volumeMm3 * MM3_TO_CM3;

  if (material.category !== 'plastic') {
    blockers.push({
      en: `${material.en} cannot be injection moulded`,
      vn: `${material.vn} không ép nhựa được`,
    });
  }
  if (shotCm3 > rates.maxShotCm3) {
    blockers.push({
      en: `Shot ${shotCm3.toFixed(0)} cm³ exceeds the machine (${rates.maxShotCm3} cm³)`,
      vn: `Thể tích ép ${shotCm3.toFixed(0)} cm³ vượt năng lực máy (${rates.maxShotCm3} cm³)`,
    });
  }
  if (!fitsEnvelope(size, rates.maxSizeMm)) {
    blockers.push({
      en: `Part exceeds the mould envelope (${fmtSize(rates.maxSizeMm)} mm)`,
      vn: `Chi tiết vượt khổ khuôn (${fmtSize(rates.maxSizeMm)} mm)`,
    });
  }

  const massG = shotCm3 * material.density;
  const pelletPrice =
    material.pelletPricePerKg || Math.round((material.pricePerKg || 0) * 0.45);
  const materialCost = kgCost(massG, pelletPrice) * (1 + (rates.wastePct || 0) / 100);

  const cycleSec = (rates.cycleBaseSeconds || 0) + shotCm3 * (rates.cycleSecondsPerCm3 || 0);
  const partsPerHour = (3600 / Math.max(cycleSec, 1)) * Math.max(rates.cavities || 1, 1);
  const machineCost = rates.machineRate / partsPerHour;

  const tools = Math.max(1, Math.ceil(qty / Math.max(rates.moldLifeShots || 1, 1)));
  const toolingCost = perPart((rates.moldCost || 0) * tools, qty);

  if (qty < (rates.minQty || 0)) {
    warnings.push({
      en: `Below ${rates.minQty} pcs the tool dominates the price — compare with CNC or printing`,
      vn: `Dưới ${rates.minQty} chiếc, tiền khuôn chiếm phần lớn giá — nên so với CNC hoặc in 3D`,
    });
  }
  if (tools > 1) {
    warnings.push({
      en: `${tools} tools needed for ${qty} pcs at ${rates.moldLifeShots} shots per tool`,
      vn: `Cần ${tools} bộ khuôn cho ${qty} chiếc với tuổi thọ ${rates.moldLifeShots} lần ép/khuôn`,
    });
  }
  if (stats.thicknessMm > 4) {
    warnings.push({
      en: `Wall ≈ ${stats.thicknessMm.toFixed(1)} mm is thick for moulding — expect sink marks`,
      vn: `Thành dày ≈ ${stats.thicknessMm.toFixed(1)} mm là dày với ép nhựa — dễ bị lõm co`,
    });
  }

  return {
    blockers,
    warnings,
    massG,
    rawMassG: massG * (1 + (rates.wastePct || 0) / 100),
    timeMinPerPart: cycleSec / 60,
    leadDays: rates.leadDays,
    detail: { cycleSec, partsPerHour, tools, moldCost: rates.moldCost },
    lines: [
      { key: 'material', en: 'Pellets', vn: 'Hạt nhựa', amount: materialCost },
      { key: 'machine', en: 'Moulding cycle', vn: 'Chu kỳ ép', amount: machineCost },
      { key: 'tooling', en: 'Tooling (amortised)', vn: 'Khuôn (phân bổ)', amount: toolingCost },
    ],
  };
}

export const PROCESS_MODELS = {
  cnc_milling: cncMilling,
  cnc_turning: cncTurning,
  fdm: fdmPrint,
  sla_resin: resinPrint,
  sls: slsPrint,
  laser_cut: laserCut,
  injection_molding: injectionMolding,
};
