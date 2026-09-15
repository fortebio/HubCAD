/**
 * Default cost book — everything the admin can later override from
 * System → Cost rates. All money is in VND; the display currency is a
 * presentation choice made in `commercial`.
 *
 * Prices are Vietnam market figures for small batches and are meant as a
 * starting point, not a vendor commitment.
 */

export const SETTINGS_VERSION = 1;

/**
 * category drives which processes a material can feed:
 *   metal | plastic → CNC, laser (some), injection (plastic)
 *   filament → FDM · resin → SLA/DLP · powder → SLS · wood → laser
 *
 * density      g/cm³
 * pricePerKg   VND per kg of raw stock
 * machinability 1.0 = aluminium 6061; higher removes metal more slowly
 * laserFactor  cut-speed penalty; 0 means "cannot be laser cut here"
 * pelletPricePerKg  injection-moulding feedstock, when different from stock
 */
export const DEFAULT_MATERIALS = [
  // ── Metals / Kim loại ────────────────────────────────────────────────────
  { id: 'al6061', en: 'Aluminium 6061', vn: 'Nhôm 6061', category: 'metal', density: 2.7, pricePerKg: 120000, machinability: 1.0, laserFactor: 5, wastePct: 8 },
  { id: 'al7075', en: 'Aluminium 7075', vn: 'Nhôm 7075', category: 'metal', density: 2.81, pricePerKg: 260000, machinability: 1.2, laserFactor: 5, wastePct: 8 },
  { id: 'ss304', en: 'Stainless 304', vn: 'Inox 304', category: 'metal', density: 7.93, pricePerKg: 160000, machinability: 2.4, laserFactor: 3.5, wastePct: 8 },
  { id: 'ss316', en: 'Stainless 316', vn: 'Inox 316', category: 'metal', density: 8.0, pricePerKg: 260000, machinability: 2.8, laserFactor: 4, wastePct: 8 },
  { id: 'steel_c45', en: 'Carbon steel C45', vn: 'Thép C45', category: 'metal', density: 7.85, pricePerKg: 45000, machinability: 1.7, laserFactor: 2.5, wastePct: 8 },
  { id: 'steel_spcc', en: 'Steel sheet SPCC', vn: 'Thép tấm SPCC', category: 'metal', density: 7.85, pricePerKg: 30000, machinability: 1.6, laserFactor: 2.2, wastePct: 6 },
  { id: 'brass_c3604', en: 'Brass C3604', vn: 'Đồng thau C3604', category: 'metal', density: 8.5, pricePerKg: 300000, machinability: 0.7, laserFactor: 0, wastePct: 8 },
  { id: 'copper_c1100', en: 'Copper C1100', vn: 'Đồng đỏ C1100', category: 'metal', density: 8.96, pricePerKg: 340000, machinability: 1.3, laserFactor: 0, wastePct: 8 },
  { id: 'ti6al4v', en: 'Titanium Ti-6Al-4V', vn: 'Titan Ti-6Al-4V', category: 'metal', density: 4.43, pricePerKg: 1400000, machinability: 4.5, laserFactor: 0, wastePct: 10 },

  // ── Engineering plastics / Nhựa kỹ thuật ─────────────────────────────────
  { id: 'pom', en: 'POM (Delrin)', vn: 'Nhựa POM', category: 'plastic', density: 1.41, pricePerKg: 140000, machinability: 0.55, laserFactor: 0, pelletPricePerKg: 75000, wastePct: 6 },
  { id: 'pa6', en: 'Nylon PA6', vn: 'Nhựa PA6', category: 'plastic', density: 1.14, pricePerKg: 150000, machinability: 0.65, laserFactor: 0, pelletPricePerKg: 85000, wastePct: 6 },
  { id: 'abs', en: 'ABS', vn: 'Nhựa ABS', category: 'plastic', density: 1.04, pricePerKg: 130000, machinability: 0.55, laserFactor: 1.3, pelletPricePerKg: 55000, wastePct: 6 },
  { id: 'pc', en: 'Polycarbonate', vn: 'Nhựa PC', category: 'plastic', density: 1.2, pricePerKg: 200000, machinability: 0.8, laserFactor: 0, pelletPricePerKg: 95000, wastePct: 6 },
  { id: 'pmma', en: 'Acrylic (PMMA)', vn: 'Mica (PMMA)', category: 'plastic', density: 1.18, pricePerKg: 110000, machinability: 0.6, laserFactor: 1.0, pelletPricePerKg: 70000, wastePct: 6 },
  { id: 'pp', en: 'Polypropylene', vn: 'Nhựa PP', category: 'plastic', density: 0.92, pricePerKg: 90000, machinability: 0.5, laserFactor: 1.4, pelletPricePerKg: 45000, wastePct: 6 },
  { id: 'ptfe', en: 'PTFE (Teflon)', vn: 'Nhựa PTFE', category: 'plastic', density: 2.2, pricePerKg: 520000, machinability: 0.7, laserFactor: 0, wastePct: 8 },
  { id: 'peek', en: 'PEEK', vn: 'Nhựa PEEK', category: 'plastic', density: 1.3, pricePerKg: 3800000, machinability: 1.4, laserFactor: 0, wastePct: 10 },

  // ── FDM filament / Sợi in FDM ────────────────────────────────────────────
  { id: 'pla', en: 'PLA filament', vn: 'Sợi in PLA', category: 'filament', density: 1.24, pricePerKg: 350000, machinability: 0, laserFactor: 0, wastePct: 5 },
  { id: 'petg', en: 'PETG filament', vn: 'Sợi in PETG', category: 'filament', density: 1.27, pricePerKg: 400000, machinability: 0, laserFactor: 0, wastePct: 5 },
  { id: 'abs_fil', en: 'ABS filament', vn: 'Sợi in ABS', category: 'filament', density: 1.04, pricePerKg: 380000, machinability: 0, laserFactor: 0, wastePct: 6 },
  { id: 'tpu', en: 'TPU 95A filament', vn: 'Sợi in TPU 95A', category: 'filament', density: 1.21, pricePerKg: 650000, machinability: 0, laserFactor: 0, wastePct: 8 },
  { id: 'pa_cf', en: 'Nylon-CF filament', vn: 'Sợi in Nylon-CF', category: 'filament', density: 1.2, pricePerKg: 1500000, machinability: 0, laserFactor: 0, wastePct: 8 },

  // ── Resin / Nhựa quang (SLA · DLP · LCD) ─────────────────────────────────
  { id: 'resin_std', en: 'Standard resin', vn: 'Resin tiêu chuẩn', category: 'resin', density: 1.1, pricePerKg: 900000, machinability: 0, laserFactor: 0, wastePct: 8 },
  { id: 'resin_tough', en: 'Tough / ABS-like resin', vn: 'Resin dai (giống ABS)', category: 'resin', density: 1.13, pricePerKg: 1250000, machinability: 0, laserFactor: 0, wastePct: 8 },
  { id: 'resin_clear', en: 'Clear resin', vn: 'Resin trong suốt', category: 'resin', density: 1.11, pricePerKg: 1100000, machinability: 0, laserFactor: 0, wastePct: 8 },

  // ── SLS powder / Bột SLS ─────────────────────────────────────────────────
  { id: 'pa12', en: 'PA12 powder', vn: 'Bột PA12', category: 'powder', density: 1.01, pricePerKg: 1900000, machinability: 0, laserFactor: 0, wastePct: 5 },

  // ── Sheet / Tấm gỗ ───────────────────────────────────────────────────────
  { id: 'plywood', en: 'Plywood', vn: 'Gỗ dán', category: 'wood', density: 0.6, pricePerKg: 35000, machinability: 0.4, laserFactor: 1.2, wastePct: 10 },
  { id: 'mdf', en: 'MDF board', vn: 'Ván MDF', category: 'wood', density: 0.75, pricePerKg: 30000, machinability: 0.4, laserFactor: 1.3, wastePct: 10 },
];

/**
 * Per-process rates. Every number here is editable by a manager; the cost
 * model that consumes them lives in processes.js.
 */
export const DEFAULT_PROCESS_RATES = {
  cnc_milling: {
    enabled: true,
    machineRate: 250000,        // VND / hour
    setupFee: 350000,           // VND / batch
    programmingFee: 400000,     // VND / part number (one-off)
    mrrCm3PerMin: 8,            // material removal rate at machinability 1.0
    finishRateCm2PerMin: 22,
    stockMarginMm: 4,           // total stock added on each axis
    toolWearPct: 8,
    minCharge: 180000,
    maxSizeMm: [800, 400, 300],
    leadDays: 7,
  },
  cnc_turning: {
    enabled: true,
    machineRate: 200000,
    setupFee: 250000,
    programmingFee: 250000,
    mrrCm3PerMin: 14,
    finishRateCm2PerMin: 40,
    stockMarginMm: 3,
    toolWearPct: 6,
    minCharge: 120000,
    maxDiameterMm: 200,
    maxLengthMm: 500,
    leadDays: 6,
  },
  fdm: {
    enabled: true,
    machineRate: 25000,
    setupFee: 30000,
    handlingPerPart: 15000,     // support removal + inspection
    throughputCm3PerHour: 14,
    minVerticalMmPerHour: 22,   // tall thin parts are limited by height, not volume
    infillPct: 20,
    shellPct: 35,               // share of the volume printed solid
    supportPct: 12,
    minCharge: 30000,
    maxSizeMm: [250, 250, 300],
    leadDays: 2,
  },
  sla_resin: {
    enabled: true,
    machineRate: 35000,
    setupFee: 40000,
    handlingPerPart: 25000,     // wash + cure + support removal
    layerHeightMm: 0.05,
    secondsPerLayer: 7,
    supportPct: 18,
    minCharge: 40000,
    bedMm: [192, 120],
    nestGapMm: 6,
    maxSizeMm: [192, 120, 200],
    leadDays: 2,
  },
  sls: {
    enabled: true,
    machineRate: 110000,
    setupFee: 400000,
    handlingPerPart: 30000,
    throughputCm3PerHour: 22,
    powderRefreshPct: 35,       // fresh powder blended into every build
    minCharge: 150000,
    maxSizeMm: [300, 300, 300],
    leadDays: 5,
  },
  laser_cut: {
    enabled: true,
    machineRate: 160000,
    setupFee: 150000,
    baseCutSpeedMmPerMin: 2600, // at 1 mm thickness, laserFactor 1.0
    pierceSeconds: 1.2,
    piercesPerPart: 3,
    nestWastePct: 25,
    minCharge: 60000,
    maxThicknessMm: 20,
    maxSheetMm: [1200, 900],
    maxFlatAspect: 0.25,        // minDim / maxDim above this is not a flat part
    minPrismaticRatio: 0.8,     // volume ÷ (footprint × thickness): 1.0 = a true 2D profile
    leadDays: 3,
  },
  injection_molding: {
    enabled: true,
    moldCost: 65000000,         // single-cavity aluminium tool, VN
    moldLifeShots: 100000,
    machineRate: 450000,
    cavities: 1,
    cycleBaseSeconds: 14,
    cycleSecondsPerCm3: 0.9,
    wastePct: 6,
    minQty: 500,                // below this the tool dominates the price
    maxShotCm3: 250,
    maxSizeMm: [300, 300, 200],
    leadDays: 35,
  },
};

/**
 * Surface treatment, priced by the part's own surface area (dm²) plus a
 * batch fee. `categories` limits where a finish may be offered.
 */
export const DEFAULT_FINISHES = [
  { id: 'none', en: 'As machined / as printed', vn: 'Để nguyên sau gia công', pricePerDm2: 0, setupFee: 0, categories: null },
  { id: 'deburr', en: 'Deburr + edge break', vn: 'Bavia + vát cạnh', pricePerDm2: 6000, setupFee: 0, categories: null },
  { id: 'bead_blast', en: 'Bead blasting', vn: 'Phun cát', pricePerDm2: 12000, setupFee: 50000, categories: ['metal', 'plastic'] },
  { id: 'anodize_clear', en: 'Clear anodising', vn: 'Anod hóa trong', pricePerDm2: 25000, setupFee: 150000, categories: ['metal'] },
  { id: 'anodize_black', en: 'Black anodising', vn: 'Anod hóa đen', pricePerDm2: 30000, setupFee: 150000, categories: ['metal'] },
  { id: 'powder_coat', en: 'Powder coating / paint', vn: 'Sơn tĩnh điện', pricePerDm2: 20000, setupFee: 120000, categories: ['metal', 'wood'] },
  { id: 'polish', en: 'Hand polishing', vn: 'Đánh bóng tay', pricePerDm2: 45000, setupFee: 60000, categories: ['metal', 'plastic'] },
  { id: 'vapor_smooth', en: 'Vapour smoothing (3D print)', vn: 'Làm mịn bằng hơi (in 3D)', pricePerDm2: 25000, setupFee: 80000, categories: ['filament', 'powder'] },
  { id: 'paint_print', en: 'Primer + spray paint (3D print)', vn: 'Lót + sơn xịt (in 3D)', pricePerDm2: 35000, setupFee: 90000, categories: ['filament', 'resin', 'powder'] },
];

export const DEFAULT_COMMERCIAL = {
  currency: 'VND',       // display currency: VND | USD
  usdRate: 25400,        // VND per 1 USD
  overheadPct: 8,        // shop overhead on direct cost
  marginPct: 25,         // margin on cost + overhead
  vatPct: 8,
  applyVat: false,
  roundTo: 1000,         // round each unit price up to this many VND
  minOrderValue: 0,
  validDays: 30,
  companyName: 'Forte Biotech',
  quoteNotesEn: 'Estimate generated from 3D geometry. Final price is confirmed after DFM review.',
  quoteNotesVn: 'Báo giá ước tính từ mô hình 3D. Giá chính thức được xác nhận sau khi đánh giá DFM.',
};

export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  commercial: DEFAULT_COMMERCIAL,
  materials: DEFAULT_MATERIALS,
  processes: DEFAULT_PROCESS_RATES,
  finishes: DEFAULT_FINISHES,
};

/** Deep-ish clone so callers can edit a settings draft without side effects. */
export function cloneSettings(settings = DEFAULT_SETTINGS) {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Fill in anything a stored settings row is missing — a cost book saved before
 * a new process or rate existed must still load.
 */
export function mergeSettings(stored) {
  if (!stored || typeof stored !== 'object') return cloneSettings(DEFAULT_SETTINGS);
  const processes = {};
  for (const [id, rates] of Object.entries(DEFAULT_PROCESS_RATES)) {
    processes[id] = { ...rates, ...(stored.processes?.[id] || {}) };
  }
  // Keep processes the admin added that we do not know about.
  for (const [id, rates] of Object.entries(stored.processes || {})) {
    if (!processes[id]) processes[id] = rates;
  }
  return {
    version: SETTINGS_VERSION,
    commercial: { ...DEFAULT_COMMERCIAL, ...(stored.commercial || {}) },
    materials:
      Array.isArray(stored.materials) && stored.materials.length
        ? stored.materials
        : cloneSettings(DEFAULT_MATERIALS),
    finishes:
      Array.isArray(stored.finishes) && stored.finishes.length
        ? stored.finishes
        : cloneSettings(DEFAULT_FINISHES),
    processes,
  };
}
