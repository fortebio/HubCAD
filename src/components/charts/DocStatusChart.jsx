import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChartTheme } from '@/lib/chartTheme';

const STATUS_COLOR = {
  draft: '#f59e0b',
  in_review: '#3b82f6',
  approved: '#10b981',
  released: '#6366f1',
  obsolete: '#ef4444',
};

const STATUS_LABEL = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  released: 'Released',
  obsolete: 'Obsolete',
};

export function DocStatusChart({ byStatus }) {
  const t = useChartTheme();
  const data = Object.entries(byStatus || {}).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k,
    key: k,
    value: v,
  }));
  if (!data.length) {
    return <div className="text-xs text-gray-500 text-center py-10">No data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={75} innerRadius={45} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={STATUS_COLOR[d.key] || '#9ca3af'} />
          ))}
        </Pie>
        <Tooltip contentStyle={t.tooltip} itemStyle={{ color: t.tooltip.color }} />
        {/* Recharts colours legend labels with the series colour, which is not
            guaranteed to be readable on either surface; force the text tone. */}
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => <span style={{ color: t.legendText }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
