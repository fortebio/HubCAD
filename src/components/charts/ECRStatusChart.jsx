import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useChartTheme } from '@/lib/chartTheme';

const STATUS_COLOR = {
  open: '#f59e0b',
  in_review: '#3b82f6',
  approved: '#10b981',
  rejected: '#ef4444',
  implemented: '#6366f1',
  closed: '#9ca3af',
};

const STATUS_LABEL = {
  open: 'Open',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  implemented: 'Implemented',
  closed: 'Closed',
};

export function ECRStatusChart({ data: byStatus }) {
  const t = useChartTheme();
  const data = (byStatus || []).map((r) => ({
    name: STATUS_LABEL[r.status] || r.status,
    key: r.status,
    value: r.c ?? r.count ?? 0,
  }));
  if (!data.length) {
    return <div className="text-xs text-gray-500 text-center py-10">No ECRs yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: t.tick }} stroke={t.axis} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: t.tick }}
          stroke={t.axis}
          width={70}
        />
        <Tooltip
          contentStyle={t.tooltip}
          itemStyle={{ color: t.tooltip.color }}
          cursor={{ fill: t.cursor }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={STATUS_COLOR[d.key] || '#9ca3af'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
