import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { api, apiPaths } from '@/lib/api';
import { cx } from '@/lib/cx';
import { IconHistory, IconUser, IconFileStack, IconReplace, IconListDetails, IconRocket, IconCircleCheck } from '@tabler/icons-react';

const ACTION_TONE = {
  'login': 'bg-gray-100 text-gray-700',
  'user.register': 'bg-blue-100 text-blue-800',
  'user.update': 'bg-amber-100 text-amber-800',
  'user.deactivate': 'bg-red-100 text-red-800',
  'document.status_change': 'bg-violet-100 text-violet-800',
  'ecr.approve': 'bg-emerald-100 text-emerald-800',
  'ecr.notify': 'bg-blue-100 text-blue-800',
  'bom.snapshot': 'bg-indigo-100 text-indigo-800',
};

const ENTITY_ICON = {
  user: IconUser,
  document: IconFileStack,
  ecr: IconReplace,
  bom: IconListDetails,
};

const ACTION_FILTERS = [
  { v: '', l: 'All actions' },
  { v: 'login', l: 'Logins' },
  { v: 'document.status_change', l: 'Status changes' },
  { v: 'ecr.approve', l: 'ECR approvals' },
  { v: 'ecr.notify', l: 'ECN sent' },
  { v: 'bom.snapshot', l: 'BOM snapshots' },
  { v: 'user.update', l: 'User updates' },
];

export function AuditLog() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState({ action: '', entityType: '', entityId: '' });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    refresh();
  }, [filter.action, filter.entityType, filter.entityId]);

  async function refresh() {
    const params = new URLSearchParams();
    if (filter.action) params.set('action', filter.action);
    if (filter.entityType) params.set('entityType', filter.entityType);
    if (filter.entityId) params.set('entityId', filter.entityId);
    params.set('limit', '200');
    const res = await api.get(apiPaths.audit(params.toString()));
    setEvents(res.events);
    api.get(apiPaths.auditStats).then(setStats).catch(() => {});
  }

  return (
    <PageWrapper
      title="Activity Log"
      subtitle="Nhật ký hoạt động — phục vụ ISO 9001 audit"
      breadcrumb="System / Hệ thống"
      action={
        stats && (
          <div className="text-xs text-gray-500">
            <span className="font-mono font-semibold text-gray-900">{stats.today}</span> today · <span className="font-mono">{stats.all}</span> total
          </div>
        )
      }
    >
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Action</label>
            <select className="input mt-1" value={filter.action} onChange={(e) => setFilter({ ...filter, action: e.target.value })}>
              {ACTION_FILTERS.map((f) => (
                <option key={f.v} value={f.v}>
                  {f.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entity type</label>
            <select className="input mt-1" value={filter.entityType} onChange={(e) => setFilter({ ...filter, entityType: e.target.value })}>
              <option value="">All</option>
              <option value="user">user</option>
              <option value="document">document</option>
              <option value="ecr">ecr</option>
              <option value="bom">bom</option>
            </select>
          </div>
          <div>
            <label className="label">Entity ID</label>
            <input
              className="input mt-1 font-mono"
              type="number"
              value={filter.entityId}
              onChange={(e) => setFilter({ ...filter, entityId: e.target.value })}
              placeholder="optional"
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Who</TH>
              <TH>Action</TH>
              <TH>Summary</TH>
            </TR>
          </THead>
          <tbody>
            {events.map((e) => {
              const Icon = ENTITY_ICON[e.entityType] || IconHistory;
              return (
                <TR key={e.id}>
                  <TD className="text-xs text-gray-500 font-mono whitespace-nowrap">
                    {e.createdAt ? new Date(e.createdAt + 'Z').toLocaleString() : '—'}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <IconUser size={12} className="text-gray-400" />
                      <span className="mono">{e.username || 'system'}</span>
                      {e.role && <span className="text-[10px] text-gray-600">({e.role})</span>}
                    </div>
                  </TD>
                  <TD>
                    <span className={cx('badge inline-flex items-center gap-1', ACTION_TONE[e.action] || 'bg-gray-100 text-gray-700')}>
                      <Icon size={10} />
                      {e.action}
                    </span>
                  </TD>
                  <TD className="text-[12px]">{e.summary}</TD>
                </TR>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-gray-400">
                  No events
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </PageWrapper>
  );
}
