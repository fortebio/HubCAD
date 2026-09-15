import { useEffect, useRef, useState } from 'react';
import { readDraft, readPref, removeDraft, writeDraft, writePref } from '@/lib/localMemory';

/**
 * A piece of UI state that survives a reload on this computer — a filter, a
 * selected document, a display toggle. Same shape as useState.
 */
// readPref's own default kicks in for an `undefined` fallback, so "nothing
// stored" needs a value that cannot be confused with a stored one.
const MISSING = Symbol('missing-pref');

export function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    const stored = readPref(key, MISSING);
    return stored === MISSING ? initial : stored;
  });

  useEffect(() => {
    writePref(key, value);
  }, [key, value]);

  return [value, setValue];
}

/**
 * Autosaves `value` under `key` while `enabled`, and reports any draft that was
 * already on disk when the page (or the selected document) loaded, so the page
 * can offer to restore it.
 *
 * Pass a falsy `key` to disable entirely — e.g. before a document is chosen.
 */
export function useDraft(key, value, { enabled = true, delay = 800 } = {}) {
  const [pending, setPending] = useState(() => (key ? readDraft(key) : null));
  // The first value seen after a key change is whatever was just loaded from
  // the server; writing it back would immediately mask the stored draft.
  const skipNext = useRef(true);

  useEffect(() => {
    setPending(key ? readDraft(key) : null);
    skipNext.current = true;
  }, [key]);

  useEffect(() => {
    if (!key || !enabled) return undefined;
    if (skipNext.current) {
      skipNext.current = false;
      return undefined;
    }
    const timer = setTimeout(() => writeDraft(key, value), delay);
    return () => clearTimeout(timer);
  }, [key, enabled, value, delay]);

  return {
    /** { savedAt, value } found on disk at load time, or null. */
    pending,
    /** Forget the stored draft (after restoring it, or on the user's request). */
    discard: () => {
      if (key) removeDraft(key);
      setPending(null);
    },
    /** Call after a successful server save so the draft stops being offered. */
    clear: () => {
      if (key) removeDraft(key);
      setPending(null);
      skipNext.current = true;
    },
  };
}
