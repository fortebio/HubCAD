/**
 * "Component inventory" layout for the exploded view.
 *
 * Instead of pushing parts radially away from the centre (which piles small
 * parts on top of each other), every part gets its own slot on a flat sheet —
 * the way a technician lays parts out on a bench before assembly. Parts are
 * grouped by system so all fasteners sit together, all housings together, and
 * each group is shelf-packed: rows of parts sorted by height, wrapping when a
 * row is full. The sheet is 2D; the caller places it in the plane facing the
 * camera.
 *
 * All sizes are in model units (mm). Output positions are 2D sheet
 * coordinates (u right, v up) centred on the origin.
 */

/** Shelf-pack one group. Returns { width, height } and fills item.slot = [u, v]. */
export function packItems(items, gap) {
  if (!items.length) return { width: 0, height: 0 };
  const area = items.reduce((a, p) => a + (p.w + gap) * (p.h + gap), 0);
  // Aim for a slightly-wide rectangle; never narrower than the widest part.
  const width = Math.max(...items.map((p) => p.w + gap), Math.sqrt(area) * 1.15);
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  let u = 0;
  let v = 0;
  let rowH = 0;
  for (const p of sorted) {
    if (u + p.w + gap > width && u > 0) {
      u = 0;
      v += rowH;
      rowH = 0;
    }
    p.slot = [u + p.w / 2, -(v + p.h / 2)];
    u += p.w + gap;
    rowH = Math.max(rowH, p.h + gap);
  }
  const height = v + rowH;
  // Re-centre the block on its own origin.
  for (const p of items) {
    p.slot[0] -= width / 2;
    p.slot[1] += height / 2;
  }
  return { width, height };
}

/**
 * Lay out `parts` ([{ id, w, h, group }]) as one sheet: each group is packed
 * into a block, blocks are placed on a grid ordered by `groupOrder`.
 * Returns a Map id → [u, v].
 */
export function layoutInventory(parts, { gap, groupOrder = [] } = {}) {
  const result = new Map();
  if (!parts.length) return result;

  const g = gap ?? Math.max(1, Math.max(...parts.map((p) => Math.max(p.w, p.h))) * 0.08);

  const groups = new Map();
  for (const p of parts) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push({ ...p });
  }
  const rank = (id) => {
    const i = groupOrder.indexOf(id);
    return i < 0 ? groupOrder.length : i;
  };
  const blocks = [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([group, items]) => ({ group, items, ...packItems(items, g) }));

  // Blocks flow left-to-right and wrap, like the parts inside them, so a
  // 3-system assembly is a single row and a 9-system one is a 3×3 grid.
  const blockGap = g * 4;
  const cols = Math.max(1, Math.ceil(Math.sqrt(blocks.length)));
  const rows = [];
  for (let i = 0; i < blocks.length; i += cols) rows.push(blocks.slice(i, i + cols));

  const rowHeights = rows.map((r) => Math.max(...r.map((b) => b.height)));
  const totalH = rowHeights.reduce((a, h) => a + h, 0) + blockGap * (rows.length - 1);
  let vCursor = totalH / 2;
  rows.forEach((row, ri) => {
    const rowW = row.reduce((a, b) => a + b.width, 0) + blockGap * (row.length - 1);
    let uCursor = -rowW / 2;
    const vCenter = vCursor - rowHeights[ri] / 2;
    for (const b of row) {
      const uCenter = uCursor + b.width / 2;
      for (const p of b.items) result.set(p.id, [p.slot[0] + uCenter, p.slot[1] + vCenter]);
      uCursor += b.width + blockGap;
    }
    vCursor -= rowHeights[ri] + blockGap;
  });
  return result;
}
