/**
 * 3D viewer session storage.
 *
 * Geometry is far too big for localStorage (a mid-size STEP part is several MB),
 * so the loaded assembly lives in IndexedDB, which stores Float32Array buffers
 * natively via structured clone — no base64 round-trip.
 */

import { currentUserId } from '@/lib/localMemory';
import { computeBoundingBox } from '@/lib/stlParser';

const DB_NAME = 'drawing-tool';
const DB_VERSION = 1;
const STORE = 'viewer-sessions';

/**
 * Pref key the viewer writes before opening the Quote page: which part ids
 * to price (a focused sub-assembly, or everything) and a label for the quote.
 */
export const QUOTE_SCOPE_KEY = 'quote:viewerScope';

/** Refuse to persist absurdly large assemblies rather than filling the disk. */
export const MAX_SESSION_BYTES = 64 * 1024 * 1024;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open IndexedDB'));
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  });
}

/**
 * A viewer build (2026-09-15) briefly translated each part's vertex array in
 * place while centring geometry, so sessions saved by it hold parts moved to
 * the origin — the assembly appears collapsed. The stored `bbox` was taken
 * before that move, so the original placement is recoverable: shift the
 * vertices back by the difference between the stored and actual centres.
 */
function repairPlacement(m) {
  const actual = computeBoundingBox(m.positions);
  const dx = m.bbox.center.x - actual.center.x;
  const dy = m.bbox.center.y - actual.center.y;
  const dz = m.bbox.center.z - actual.center.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6 && Math.abs(dz) < 1e-6) return m;
  const positions = new Float32Array(m.positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = m.positions[i] + dx;
    positions[i + 1] = m.positions[i + 1] + dy;
    positions[i + 2] = m.positions[i + 2] + dz;
  }
  return { ...m, positions };
}

export function sessionBytes(models = []) {
  return models.reduce((n, m) => n + (m.positions?.byteLength || 0), 0);
}

/**
 * Persist the current assembly. Returns { saved: boolean, reason?: string }
 * instead of throwing — a failed save must never interrupt the viewer.
 */
export async function saveViewerSession({ models = [], selectedId = null }) {
  const bytes = sessionBytes(models);
  if (bytes > MAX_SESSION_BYTES) {
    return { saved: false, reason: 'too-large', bytes };
  }
  try {
    const db = await openDB();
    await tx(db, 'readwrite', (store) =>
      store.put(
        {
          savedAt: new Date().toISOString(),
          selectedId,
          models: models.map((m) => ({
            id: m.id,
            name: m.name,
            path: m.path || [],
            sourceFile: m.sourceFile || null,
            layer: m.layer || null,
            cadColor: m.cadColor || null,
            size: m.size,
            color: m.color,
            visible: m.visible,
            bbox: m.bbox,
            positions: m.positions,
          })),
        },
        currentUserId()
      )
    );
    db.close();
    return { saved: true, bytes };
  } catch (e) {
    return { saved: false, reason: e.message };
  }
}

/** Returns the stored session for this user, or null. */
export async function loadViewerSession() {
  try {
    const db = await openDB();
    const value = await tx(db, 'readonly', (store) => store.get(currentUserId()));
    db.close();
    if (!value || !Array.isArray(value.models) || !value.models.length) return null;
    // Guard against a half-written record from an interrupted save.
    const models = value.models.filter((m) => m?.positions?.length && m.bbox).map(repairPlacement);
    if (!models.length) return null;
    return { ...value, models };
  } catch {
    return null;
  }
}

export async function clearViewerSession() {
  try {
    const db = await openDB();
    await tx(db, 'readwrite', (store) => store.delete(currentUserId()));
    db.close();
    return true;
  } catch {
    return false;
  }
}
