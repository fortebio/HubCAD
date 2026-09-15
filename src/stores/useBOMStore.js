import { create } from 'zustand';
import { api, apiPaths } from '@/lib/api';

export const useBOMStore = create((set) => ({
  header: null,
  items: [],
  cost: null,
  loading: false,
  error: null,

  async fetchByDocument(documentId) {
    set({ loading: true, error: null });
    try {
      const res = await api.get(apiPaths.bomByDoc(documentId));
      set({ header: res.header, items: res.items || [], loading: false });
      if (res.header) {
        const cost = await api.get(apiPaths.bomCost(res.header.id));
        set({ cost });
      } else {
        set({ cost: null });
      }
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  async create({ documentId, assemblyNo, revision = '-', items = [] }) {
    const res = await api.post('/bom', { documentId, assemblyNo, revision, items });
    return res.header;
  },

  async saveItems(bomId, items) {
    const res = await api.put(apiPaths.bomItems(bomId), { items });
    set({ items: res.items });
    const cost = await api.get(apiPaths.bomCost(bomId));
    set({ cost });
    return res.items;
  },
}));
