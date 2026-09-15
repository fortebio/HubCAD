import { create } from 'zustand';
import { api, apiPaths } from '@/lib/api';
import { DEFAULT_SETTINGS, mergeSettings } from '@/lib/costing/defaults';

/**
 * The shop rate card. Until a manager saves one, everybody quotes with the
 * shipped defaults — the estimator must never be blocked on configuration.
 */
export const useCostStore = create((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
  loading: false,
  loaded: false,
  error: null,

  async fetch({ force = false } = {}) {
    if (get().loaded && !force) return get().settings;
    set({ loading: true, error: null });
    try {
      const res = await api.get(apiPaths.costSettings);
      const settings = res.settings ? mergeSettings(res.settings) : DEFAULT_SETTINGS;
      set({
        settings,
        isDefault: !res.settings,
        updatedAt: res.updatedAt || null,
        updatedBy: res.updatedBy || null,
        loading: false,
        loaded: true,
      });
      return settings;
    } catch (e) {
      // A cost book that cannot be read must not stop anyone quoting.
      set({ error: e.message, loading: false, loaded: true, settings: DEFAULT_SETTINGS, isDefault: true });
      return DEFAULT_SETTINGS;
    }
  },

  async save(settings) {
    const res = await api.put(apiPaths.costSettings, { settings });
    const merged = mergeSettings(res.settings || settings);
    set({ settings: merged, isDefault: false, updatedAt: res.updatedAt || null, loaded: true });
    return merged;
  },

  async resetToDefaults() {
    await api.del(apiPaths.costSettings);
    set({ settings: DEFAULT_SETTINGS, isDefault: true, updatedAt: null, updatedBy: null, loaded: true });
    return DEFAULT_SETTINGS;
  },
}));
