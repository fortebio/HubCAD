import { create } from 'zustand';
import { api, apiPaths } from '@/lib/api';

export const useDocStore = create((set, get) => ({
  documents: [],
  recent: [],
  stats: null,
  loading: false,
  error: null,
  filters: { status: '', type: '', q: '' },

  setFilters(patch) {
    set({ filters: { ...get().filters, ...patch } });
  },

  async fetchAll() {
    set({ loading: true, error: null });
    try {
      const { status, type, q } = get().filters;
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (q) params.set('q', q);
      const qs = params.toString();
      const res = await api.get(`${apiPaths.documents}${qs ? '?' + qs : ''}`);
      set({ documents: res.documents, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  // Deliberately ignores `filters`: the dashboard shows recent activity,
  // not whatever the Doc Tracker is currently filtered to.
  async fetchRecent(limit = 6) {
    try {
      const res = await api.get(apiPaths.documents);
      set({ recent: res.documents.slice(0, limit) });
    } catch (e) {
      set({ error: e.message });
    }
  },

  async fetchStats() {
    try {
      const res = await api.get(apiPaths.documentStats);
      set({ stats: res });
    } catch (e) {
      set({ error: e.message });
    }
  },

  async create(payload) {
    const res = await api.post(apiPaths.documents, payload);
    await get().fetchAll();
    return res.document;
  },

  async update(id, payload) {
    const res = await api.patch(apiPaths.document(id), payload);
    await get().fetchAll();
    return res.document;
  },

  async changeStatus(id, status, comment) {
    const res = await api.patch(apiPaths.documentStatus(id), { status, comment });
    await get().fetchAll();
    return res.document;
  },

  async getOne(id) {
    return api.get(apiPaths.document(id));
  },
}));
