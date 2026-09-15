/**
 * Mass properties from a triangle soup (the same Float32Array the viewer and
 * the parsers already produce: 9 floats = 1 triangle, in millimetres).
 *
 * Everything here is O(triangles) and runs while a file is being parsed, so it
 * stays arithmetic-only — no allocation per triangle.
 */

/** Meshes bigger than this skip the edge-pairing test; it is only a warning. */
const WATERTIGHT_LIMIT = 250000;

/** Signed volume of the mesh in mm³ (absolute value; sign follows normals). */
export function computeVolume(positions) {
  let v = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];
    // a · (b × c) / 6 — the signed tetrahedron back to the origin.
    v +=
      (ax * (by * cz - bz * cy) +
        ay * (bz * cx - bx * cz) +
        az * (bx * cy - by * cx)) /
      6;
  }
  return Math.abs(v);
}

/** Total surface area in mm². */
export function computeSurfaceArea(positions) {
  let area = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ux = positions[i + 3] - positions[i];
    const uy = positions[i + 4] - positions[i + 1];
    const uz = positions[i + 5] - positions[i + 2];
    const vx = positions[i + 6] - positions[i];
    const vy = positions[i + 7] - positions[i + 1];
    const vz = positions[i + 8] - positions[i + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    area += Math.hypot(nx, ny, nz) / 2;
  }
  return area;
}

/**
 * Area seen looking down `axis`, and the area of the walls parallel to it.
 *
 * On a closed mesh the up-facing projected area equals the silhouette area
 * exactly, which makes it a usable sheet footprint. Wall area divided by the
 * sheet thickness estimates the cut perimeter — that is what the laser model
 * uses instead of tracing a real silhouette.
 */
export function computeProjection(positions, axis = 'z') {
  const a = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  let facing = 0;
  let lateral = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ux = positions[i + 3] - positions[i];
    const uy = positions[i + 4] - positions[i + 1];
    const uz = positions[i + 5] - positions[i + 2];
    const vx = positions[i + 6] - positions[i];
    const vy = positions[i + 7] - positions[i + 1];
    const vz = positions[i + 8] - positions[i + 2];
    const n0 = uy * vz - uz * vy;
    const n1 = uz * vx - ux * vz;
    const n2 = ux * vy - uy * vx;
    const len = Math.hypot(n0, n1, n2);
    if (len === 0) continue;
    const component = a === 0 ? n0 : a === 1 ? n1 : n2;
    const along = component / 2; // signed projected area
    if (along > 0) facing += along;
    // Faces whose normal is nearly perpendicular to the axis are the walls.
    if (Math.abs(component / len) < 0.3) lateral += len / 2;
  }
  return { facingMm2: facing, lateralMm2: lateral };
}

/**
 * Every edge of a closed shell is shared by exactly two triangles. Anything
 * else means the volume (and therefore the mass) is only an approximation.
 * Returns null when the mesh is too big to test cheaply.
 */
export function isWatertight(positions) {
  const triangles = positions.length / 9;
  if (triangles === 0 || triangles > WATERTIGHT_LIMIT) return null;

  const index = new Map();
  const ids = new Int32Array(triangles * 3);
  let next = 0;
  for (let i = 0, v = 0; i < positions.length; i += 3, v++) {
    // Quantise to 1 µm so vertices written by different exporters still match.
    const key =
      Math.round(positions[i] * 1000) +
      ',' +
      Math.round(positions[i + 1] * 1000) +
      ',' +
      Math.round(positions[i + 2] * 1000);
    let id = index.get(key);
    if (id === undefined) {
      id = next++;
      index.set(key, id);
    }
    ids[v] = id;
  }

  const edges = new Map();
  for (let t = 0; t < triangles; t++) {
    for (let e = 0; e < 3; e++) {
      const p = ids[t * 3 + e];
      const q = ids[t * 3 + ((e + 1) % 3)];
      if (p === q) return false; // degenerate triangle
      const key = p < q ? p * next + q : q * next + p;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  for (const count of edges.values()) {
    if (count !== 2) return false;
  }
  return true;
}

export function boundingBoxOf(positions) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
  };
}

/**
 * Everything the costing engine needs about one part's geometry.
 * `bbox` may be passed in when the viewer already computed it.
 */
export function computeMeshStats(positions, bbox = null) {
  const box = bbox || boundingBoxOf(positions);
  const size = box.size;
  const dims = [
    { axis: 'x', v: size.x },
    { axis: 'y', v: size.y },
    { axis: 'z', v: size.z },
  ].sort((a, b) => a.v - b.v);

  const volumeMm3 = computeVolume(positions);
  const areaMm2 = computeSurfaceArea(positions);
  const bboxVolumeMm3 = Math.max(size.x * size.y * size.z, 1e-9);
  const thin = dims[0]; // thinnest axis = candidate sheet normal
  const projection = computeProjection(positions, thin.axis);

  // A solid cylinder fills π/4 of its bounding box and has two equal
  // cross-section dimensions — enough to spot a turned part.
  const fillRatio = volumeMm3 / bboxVolumeMm3;
  const rotationAxis = detectRotationAxis(size);

  return {
    triangles: positions.length / 9,
    bbox: box,
    volumeMm3,
    areaMm2,
    bboxVolumeMm3,
    fillRatio,
    /** Sheet-like metrics, taken along the thinnest axis. */
    thinAxis: thin.axis,
    thicknessMm: thin.v,
    footprintMm2: projection.facingMm2,
    wallAreaMm2: projection.lateralMm2,
    /**
     * volume ÷ (footprint × thickness). Near 1 means the part really is a
     * constant-thickness 2D profile — the only thing a laser can cut.
     */
    prismaticRatio:
      projection.facingMm2 > 0 && thin.v > 0
        ? volumeMm3 / (projection.facingMm2 * thin.v)
        : 0,
    /** minDim / maxDim — small means flat, plate-like. */
    aspect: dims[2].v > 0 ? dims[0].v / dims[2].v : 1,
    maxDimMm: dims[2].v,
    rotationAxis,
    cylindrical: !!rotationAxis && fillRatio > 0.5 && fillRatio < 0.95,
    watertight: isWatertight(positions),
  };
}

/** The axis a lathe would spin, if two cross-section dimensions match. */
function detectRotationAxis(size) {
  const pairs = [
    ['x', size.y, size.z],
    ['y', size.x, size.z],
    ['z', size.x, size.y],
  ];
  for (const [axis, a, b] of pairs) {
    const big = Math.max(a, b);
    if (big > 0 && Math.abs(a - b) / big < 0.08) return axis;
  }
  return null;
}

/** Cut length of a flat part, from wall area ÷ thickness. */
export function estimatePerimeterMm(stats) {
  if (stats.thicknessMm > 0 && stats.wallAreaMm2 > 0) {
    return stats.wallAreaMm2 / stats.thicknessMm;
  }
  const s = stats.bbox.size;
  const dims = [s.x, s.y, s.z].sort((a, b) => b - a);
  return 2 * (dims[0] + dims[1]) * 1.4; // rectangle plus an allowance for detail
}

/** Mass in grams from volume (mm³) and density (g/cm³). */
export function massFromVolume(volumeMm3, densityGCm3) {
  return (volumeMm3 / 1000) * densityGCm3;
}
