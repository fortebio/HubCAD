/**
 * Systems ("layers") an assembly is sorted into for the 3D explorer — the
 * same idea as the categories in src/lib/partNumber.js, extended with the
 * things a STEP tree actually contains (fasteners, purchased parts, bodies
 * nobody named). A part's layer drives its colour, the Systems panel toggles
 * and the grouping of the exploded inventory.
 */

import { CATEGORIES, parsePartNumber } from '@/lib/partNumber';

// Colours are mid-light so parts still read as solid under the viewer's
// lighting (a dark swatch renders nearly black on a lit mesh).
export const LAYERS = [
  { id: 'housing', en: 'Housings & covers', vn: 'Vỏ & nắp', color: '#b7c1cc', category: 'HSG' },
  { id: 'bracket', en: 'Brackets & frames', vn: 'Giá đỡ & khung', color: '#8d97a8', category: 'BRK' },
  { id: 'pcb', en: 'Boards & electronics', vn: 'Bo mạch & điện tử', color: '#35a072', category: 'PCB' },
  { id: 'fastener', en: 'Fasteners', vn: 'Bu lông · đai ốc · vít', color: '#d19a4a', category: 'FAS' },
  { id: 'cable', en: 'Cables & wiring', vn: 'Dây cáp', color: '#a78bfa', category: 'CAB' },
  { id: 'purchased', en: 'Purchased parts', vn: 'Linh kiện mua ngoài', color: '#4fb3c9', category: null },
  { id: 'label', en: 'Labels', vn: 'Nhãn', color: '#f082b5', category: 'LBL' },
  { id: 'packaging', en: 'Packaging', vn: 'Bao bì', color: '#d4b65c', category: 'PKG' },
  { id: 'other', en: 'Other bodies', vn: 'Chi tiết khác', color: '#5b93f5', category: null },
];

const LAYER_BY_ID = new Map(LAYERS.map((l) => [l.id, l]));
const LAYER_BY_CATEGORY = new Map(LAYERS.filter((l) => l.category).map((l) => [l.category, l.id]));

export function layerById(id) {
  return LAYER_BY_ID.get(id) || LAYER_BY_ID.get('other');
}

// Keyword lists become "whole word" tests that also respect Vietnamese
// letters — JS's \b only knows ASCII, so `\bvỏ\b` would never match "vỏ".
function words(list) {
  const alts = list.map((w) => w.replace(/-/g, '[-]').replace(/\s+/g, '\\s?')).join('|');
  return new RegExp(`(?<![\\p{L}\\d])(?:${alts})(?![\\p{L}\\d])`, 'iu');
}

// Ordered from most to least specific: a "PCB mounting bracket" is a bracket,
// but an "M3 screw for PCB" is a fastener, so fasteners are tested first.
// Generic CAD names ("Body1", "Part2") deliberately match nothing.
const RULES = [
  ['fastener', /(?:DIN|ISO)\s*\d{3,5}(?!\d)|(?<![\p{L}\d])M\d+(?:\.\d+)?\s*[x×X-]\s*\d+/iu],
  ['fastener', words(['screw', 'bolt', 'nut', 'washer', 'rivet', 'insert', 'standoff', 'spacer', 'dowel', 'circlip', 'e-clip', 'vít', 'bu lông', 'bulong', 'đai ốc', 'long đen', 'đinh tán', 'ốc'])],
  ['pcb', words(['pcb', 'pcba', 'board', 'bo mạch', 'mạch in', 'mạch'])],
  ['cable', words(['cable', 'wire', 'harness', 'ffc', 'fpc', 'ribbon', 'dây', 'cáp'])],
  ['label', words(['label', 'sticker', 'decal', 'nameplate', 'nhãn', 'tem'])],
  ['packaging', words(['carton', 'foam', 'package', 'packaging', 'bao bì', 'thùng', 'hộp giấy'])],
  ['purchased', words(['bearing', 'motor', 'actuator', 'servo', 'sensor', 'connector', 'switch', 'button', 'led', 'battery', 'fan', 'magnet', 'spring', 'o-ring', 'oring', 'gasket', 'seal', 'lens', 'display', 'lcd', 'oled', 'speaker', 'microphone', 'antenna', 'encoder', 'gear', 'pulley', 'belt', 'pump', 'valve', 'heatsink', 'vòng bi', 'động cơ', 'cảm biến', 'pin', 'lò xo', 'quạt', 'nam châm'])],
  ['housing', words(['housing', 'cover', 'shell', 'case', 'casing', 'enclosure', 'lid', 'cap', 'panel', 'door', 'bezel', 'vỏ', 'nắp', 'thân máy'])],
  ['bracket', words(['bracket', 'mount', 'mounting', 'holder', 'support', 'frame', 'plate', 'rail', 'clamp', 'base', 'chassis', 'giá', 'giá đỡ', 'gá', 'khung', 'đế', 'tấm'])],
];

/**
 * Best-guess layer for a part from its name and the assembly names above it.
 * A part number in the house convention (HSG-001…) wins outright; otherwise
 * keywords in the body name are tried, then in the parent assemblies.
 */
export function classifyPart({ name = '', path = [] } = {}) {
  const parsed = parsePartNumber(String(name).trim().split(/[\s_]/)[0]);
  if (parsed && LAYER_BY_CATEGORY.has(parsed.category)) return LAYER_BY_CATEGORY.get(parsed.category);
  for (const text of [name, ...[...path].reverse()]) {
    for (const [id, re] of RULES) {
      if (re.test(text)) return id;
    }
  }
  return 'other';
}

/** Bilingual category label for a layer, reusing the part-number categories. */
export function layerCategoryLabel(id) {
  const layer = layerById(id);
  const cat = layer.category ? CATEGORIES[layer.category] : null;
  return cat ? `${cat.en} / ${cat.vn}` : `${layer.en} / ${layer.vn}`;
}
