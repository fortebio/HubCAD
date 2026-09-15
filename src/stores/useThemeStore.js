import { create } from 'zustand';

const STORAGE_KEY = 'app_theme';
const MODES = ['light', 'dark', 'system'];

function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readMode() {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return MODES.includes(v) ? v : 'system';
}

function applyTheme(mode) {
  if (typeof document === 'undefined') return;
  const effective = mode === 'system' ? systemTheme() : mode;
  const root = document.documentElement;
  if (effective === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = effective;
  root.setAttribute('data-theme', effective);
}

export const useThemeStore = create((set, get) => ({
  mode: readMode(),
  effective: readMode() === 'system' ? systemTheme() : readMode(),

  setMode(mode) {
    if (!MODES.includes(mode)) return;
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    set({ mode, effective: mode === 'system' ? systemTheme() : mode });
  },

  toggle() {
    const cur = get().effective;
    get().setMode(cur === 'dark' ? 'light' : 'dark');
  },

  init() {
    const mode = readMode();
    applyTheme(mode);
    set({ mode, effective: mode === 'system' ? systemTheme() : mode });
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (get().mode === 'system') {
          applyTheme('system');
          set({ effective: systemTheme() });
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  },
}));

// Apply immediately on module load to avoid FOUC.
applyTheme(readMode());
