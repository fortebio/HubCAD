import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDocStore } from '@/stores/useDocStore';
import { useECRStore } from '@/stores/useECRStore';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import {
  IconFileStack,
  IconCircleCheck,
  IconRocket,
  IconReplace,
  Icon3dCubeSphere,
  IconChecklist,
  IconListDetails,
  IconPlus,
  IconArrowRight,
} from '@tabler/icons-react';
import { DocStatusChart } from '@/components/charts/DocStatusChart';
import { DocTypeChart } from '@/components/charts/DocTypeChart';
import { ECRStatusChart } from '@/components/charts/ECRStatusChart';
import { api, apiPaths } from '@/lib/api';
import { useState } from 'react';
import { SkeletonStatCard, SkeletonTable } from '@/components/ui/Skeleton';

const QUICK_ACTIONS = [
  { to: '/viewer', icon: Icon3dCubeSphere, en: 'Open 3D Viewer', vn: 'Xem mô hình 3D', tone: 'purple' },
  { to: '/checklist', icon: IconChecklist, en: 'Run drawing checklist', vn: 'Chạy checklist bản vẽ', tone: 'info' },
  { to: '/bom', icon: IconListDetails, en: 'Edit BOM', vn: 'Chỉnh sửa BOM', tone: 'success' },
  { to: '/ecr', icon: IconReplace, en: 'Create ECR', vn: 'Tạo yêu cầu thay đổi', tone: 'warning' },
];

export function Dashboard() {
  const { recent: recentDocs, stats, fetchRecent, fetchStats, loading } = useDocStore();
  const ecrs = useECRStore((s) => s.ecrs);
  const fetchEcrs = useECRStore((s) => s.fetchAll);
  const [ecrStats, setEcrStats] = useState(null);

  useEffect(() => {
    fetchRecent();
    fetchStats();
    fetchEcrs();
    api.get(apiPaths.ecrStats).then(setEcrStats).catch(() => {});
  }, [fetchRecent, fetchStats, fetchEcrs]);

  const recent = recentDocs;
  const openEcrs = ecrs.filter((e) => e.status === 'open' || e.status === 'in_review').length;
  const released = stats?.byStatus?.released || 0;
  const inReview = (stats?.byStatus?.in_review || 0) + (stats?.byStatus?.draft || 0);

  return (
    <PageWrapper
      title="Dashboard"
      subtitle="Bảng điều khiển — tổng quan tài liệu kỹ thuật"
      breadcrumb="Overview / Tổng quan"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {!stats ? (
          // Placeholders hold the exact card footprint, so the row does not
          // jump when the numbers land.
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
        <StatCard
          icon={<IconFileStack size={22} />}
          value={stats?.total || 0}
          label="Total documents"
          sublabel="Tổng số tài liệu"
          tone="primary"
        />
        <StatCard
          icon={<IconCircleCheck size={22} />}
          value={released}
          label="Released"
          sublabel="Đã phát hành"
          tone="success"
        />
        <StatCard
          icon={<IconRocket size={22} />}
          value={inReview}
          label="Draft + In review"
          sublabel="Nháp + đang duyệt"
          tone="warning"
        />
        <StatCard
          icon={<IconReplace size={22} />}
          value={openEcrs}
          label="Open ECRs"
          sublabel="Yêu cầu thay đổi đang mở"
          tone="danger"
        />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader title="Documents by status" subtitle="Tài liệu theo trạng thái" />
          <DocStatusChart byStatus={stats?.byStatus} />
        </Card>
        <Card>
          <CardHeader title="Documents by type" subtitle="Tài liệu theo loại" />
          <DocTypeChart byType={stats?.byType} />
        </Card>
        <Card>
          <CardHeader title="ECR status" subtitle="Yêu cầu thay đổi" />
          <ECRStatusChart data={ecrStats?.byStatus} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent documents"
            subtitle="Tài liệu gần đây"
            action={
              <Link to="/tracker">
                <Button variant="ghost" size="sm">
                  View all <IconArrowRight size={14} />
                </Button>
              </Link>
            }
          />
          {loading && recent.length === 0 ? (
            <SkeletonTable rows={5} cols={5} />
          ) : (
          <Table label="Recent documents / Tài liệu gần đây">
            <THead>
              <TR>
                <TH>Doc number</TH>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Rev</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {recent.map((d) => (
                <TR key={d.id}>
                  <TD mono>{d.docNumber}</TD>
                  <TD>
                    <div className="leading-tight">
                      <div>{d.nameEn}</div>
                      {d.nameVn && <div className="text-[11px] text-gray-500">{d.nameVn}</div>}
                    </div>
                  </TD>
                  <TD>
                    <span className="capitalize text-xs text-gray-600">{d.docType}</span>
                  </TD>
                  <TD mono>{d.revision}</TD>
                  <TD>
                    <Badge status={d.status} />
                  </TD>
                </TR>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-gray-400">
                    No documents yet — run <code>npm run db:seed</code>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Quick actions" subtitle="Hành động nhanh" />
            <div className="space-y-2">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.to}
                    to={a.to}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-500 flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </div>
                    <div className="leading-tight flex-1">
                      <div className="text-[13px] font-medium text-gray-800">{a.en}</div>
                      <div className="text-[11px] text-gray-500">{a.vn}</div>
                    </div>
                    <IconArrowRight size={14} className="text-gray-400" />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="bg-primary-50/50 border-primary-200">
            <div className="text-[13px] font-semibold text-primary-700 mb-1">Workflow / Quy trình</div>
            <div className="text-[12px] text-primary-700/80 leading-relaxed">
              Draft → In Review → Approved → Released. Every released doc must pass drawing checklist, DFM review, and release checklist for vendor / OEM / sales.
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
