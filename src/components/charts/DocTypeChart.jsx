import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useChartTheme } from '@/lib/chartTheme';

const TYPE_COLOR = {
  machining: '#1a6ff5',
  wi: '#0f6e56',
  catalog: '#d85a30',
  bom: '#7c3aed',
};

const TYPE_LABEL = {
  machining: 'Drawing',
  wi: 'WI',
  catalog: 'Catalog',
  bom: 'BOM',
};

export function DocTypeChart({ byType }) {
  const t = useChartTheme();
  const data = Object.entries(byType || {}).map(([k, v]) => ({
    name: TYPE_LABEL[k] || k,
    key: k,
    value: v,
  }));
  if (!data.length) {
    return <div className="text-xs text-gray-500 text-center py-10">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: t.tick }} stroke={t.axis} />
        <YAxis tick={{ fontSize: 11, fill: t.tick }} stroke={t.axis} allowDecimals={false} />
        <Tooltip
          contentStyle={t.tooltip}
          itemStyle={{ color: t.tooltip.color }}
          cursor={{ fill: t.cursor }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={TYPE_COLOR[d.key] || '#9ca3af'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
