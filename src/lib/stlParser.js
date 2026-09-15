// Parse STL (binary or ASCII). Returns Float32Array of vertex positions (xyz, 3 per vertex, 3 vertices per triangle).
export function parseSTL(buffer) {
  const view = new DataView(buffer);
  const reader = new TextDecoder('utf-8');
  // ASCII detection: first 5 bytes start with "solid" AND no triangle count match for binary
  const head = reader.decode(new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength))).trim();
  if (head.startsWith('solid')) {
    try {
      return parseAscii(reader.decode(new Uint8Array(buffer)));
    } catch (e) {
      // fall through to binary
    }
  }
  return parseBinary(view);
}

function parseBinary(view) {
  const triangles = view.getUint32(80, true);
  const positions = new Float32Array(triangles * 9);
  let offset = 84;
  for (let i = 0; i < triangles; i++) {
    offset += 12; // skip normal
    for (let v = 0; v < 3; v++) {
      positions[i * 9 + v * 3 + 0] = view.getFloat32(offset, true);
      positions[i * 9 + v * 3 + 1] = view.getFloat32(offset + 4, true);
      positions[i * 9 + v * 3 + 2] = view.getFloat32(offset + 8, true);
      offset += 12;
    }
    offset += 2; // attribute byte count
  }
  return positions;
}

function parseAscii(text) {
  const verts = [];
  const re = /vertex\s+([\-\d\.eE+]+)\s+([\-\d\.eE+]+)\s+([\-\d\.eE+]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    verts.push(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return new Float32Array(verts);
}

export function computeBoundingBox(positions) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
  };
}
