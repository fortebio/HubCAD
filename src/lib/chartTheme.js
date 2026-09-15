import { useThemeStore } from '@/stores/useThemeStore';

const LIGHT = {
  grid: '#e5e7eb',
  axis: '#6b7280',
  tick: '#4b5563',
  cursor: 'rgba(0, 0, 0, 0.05)',
  tooltip: {
    fontSize: 12,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    color: '#1f2937',
  },
  legendText: '#4b5563',
};

const DARK = {
  grid: '#2a2f37',
  axis: '#7a818a',
  tick: '#a3aab2',
  cursor: 'rgba(255, 255, 255, 0.06)',
  tooltip: {
    fontSize: 12,
    // Recharts renders an opaque white tooltip by default, which leaves the
    // inherited light text unreadable in dark mode.
    backgroundColor: '#22262d',
    border: '1px solid #3a4047',
    borderRadius: 8,
    color: '#e6e8eb',
  },
  legendText: '#a3aab2',
};

/** Chart colours that follow the active theme. */
export function useChartTheme() {
  const effective = useThemeStore((s) => s.effective);
  return effective === 'dark' ? DARK : LIGHT;
}
