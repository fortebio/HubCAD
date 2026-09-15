import { create } from 'zustand';

let nextId = 1;

export const useToastStore = create((set, get) => ({
  toasts: [],

  push: (opts) => {
    const id = nextId++;
    const t = { id, type: 'info', duration: 4500, ...opts };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (t.duration > 0) {
      setTimeout(() => get().dismiss(id), t.duration);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Non-blocking replacement for window.alert().
 * Every call takes a short bilingual title and an optional detail line.
 *
 *   toast.success('Saved', 'Đã lưu');
 *   toast.error('Import failed', e.message);
 */
export const toast = {
  success: (title, detail) => useToastStore.getState().push({ type: 'success', title, detail }),
  error: (title, detail) =>
    useToastStore.getState().push({ type: 'error', title, detail, duration: 8000 }),
  warning: (title, detail) =>
    useToastStore.getState().push({ type: 'warning', title, detail, duration: 6000 }),
  info: (title, detail) => useToastStore.getState().push({ type: 'info', title, detail }),
};
