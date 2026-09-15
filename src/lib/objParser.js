// Minimal OBJ parser. Returns Float32Array of triangle vertex positions.
export function parseOBJ(text) {
  const positions = [];
  const verts = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('v ')) {
      const p = t.split(/\s+/);
      verts.push([Number(p[1]), Number(p[2]), Number(p[3])]);
    } else if (t.startsWith('f ')) {
      const parts = t.split(/\s+/).slice(1).map((s) => Number(s.split('/')[0]) - 1);
      // triangulate fan
      for (let i = 1; i < parts.length - 1; i++) {
        const a = verts[parts[0]];
        const b = verts[parts[i]];
        const c = verts[parts[i + 1]];
        if (!a || !b || !c) continue;
        positions.push(...a, ...b, ...c);
      }
    }
  }
  return new Float32Array(positions);
}
