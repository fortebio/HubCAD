import { create } from 'zustand';
import { api, apiPaths } from '@/lib/api';

export const useECRStore = create((set, get) => ({
  ecrs: [],
  loading: false,
  error: null,
  filter: { status: '', priority: '' },

  setFilter(patch) {
    set({ filter: { ...get().filter, ...patch } });
  },

  async fetchAll() {
    set({ loading: true, error: null });
    try {
      const { status, priority } = get().filter;
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      const qs = params.toString();
      const res = await api.get(`${apiPaths.ecrs}${qs ? '?' + qs : ''}`);
      set({ ecrs: res.ecrs, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  async create(payload) {
    const res = await api.post(apiPaths.ecrs, payload);
    await get().fetchAll();
    return res.ecr;
  },

  async update(id, payload) {
    const res = await api.patch(apiPaths.ecr(id), payload);
    await get().fetchAll();
    return res.ecr;
  },

  async approve(id, payload) {
    const res = await api.post(apiPaths.ecrApprove(id), payload);
    await get().fetchAll();
    return res;
  },

  async getOne(id) {
    return api.get(apiPaths.ecr(id));
  },
}));
