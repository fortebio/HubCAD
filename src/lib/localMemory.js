/**
 * Local memory — everything the tool remembers on the operator's own computer.
 *
 * Keys are scoped per signed-in user (`dt:<userId>:<kind>:<key>`) so two people
 * sharing one workstation never see each other's filters or drafts.
 *
 * Every access is wrapped: storage can be unavailable (private windows, browser
 * policy) or full (quota), and none of this is important enough to break a page.
 */

const PREFIX = 'dt';

export function currentUserId() {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return 'anon';
    const user = JSON.parse(raw);
    return user?.id != null ? String(user.id) : 'anon';
  } catch {
    return 'anon';
  }
}

function scopedKey(kind, key) {
  return `${PREFIX}:${currentUserId()}:${kind}:${key}`;
}

// ── Preferences (filters, selected document, display options) ───────────────

export function readPref(key, fallback = null) {
  try {
    const raw = localStorage.getItem(scopedKey('pref', key));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(scopedKey('pref', key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removePref(key) {
  try {
    localStorage.removeItem(scopedKey('pref', key));
  } catch {
    /* nothing to do */
  }
}

// ── Drafts (work typed but not yet saved to the server) ─────────────────────

export function readDraft(key) {
  try {
    const raw = localStorage.getItem(scopedKey('draft', key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) return null;
    return parsed; // { savedAt, value }
  } catch {
    return null;
  }
}

export function writeDraft(key, value) {
  try {
    localStorage.setItem(
      scopedKey('draft', key),
      JSON.stringify({ savedAt: new Date().toISOString(), value })
    );
    return true;
  } catch {
    // Most likely a quota error on a very large BOM — losing the draft is
    // acceptable, breaking the editor is not.
    return false;
  }
}

export function removeDraft(key) {
  try {
    localStorage.removeItem(scopedKey('draft', key));
  } catch {
    /* nothing to do */
  }
}

// ── Housekeeping ────────────────────────────────────────────────────────────

function ownKeys() {
  const mine = `${PREFIX}:${currentUserId()}:`;
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(mine)) keys.push(k);
    }
  } catch {
    /* storage unavailable */
  }
  return keys;
}

/** What this browser is currently remembering for the signed-in user. */
export function localMemoryStats() {
  let prefs = 0;
  let drafts = 0;
  let bytes = 0;
  for (const k of ownKeys()) {
    let size = 0;
    try {
      size = (localStorage.getItem(k) || '').length;
    } catch {
      size = 0;
    }
    bytes += size + k.length;
    if (k.includes(':pref:')) prefs += 1;
    else if (k.includes(':draft:')) drafts += 1;
  }
  return { prefs, drafts, bytes };
}

/** Forget every preference and draft stored for the signed-in user. */
export function clearLocalMemory() {
  const keys = ownKeys();
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  return keys.length;
}
