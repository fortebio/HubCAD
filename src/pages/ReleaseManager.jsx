import { useEffect, useMemo, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckItem } from '@/components/ui/CheckItem';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { RELEASE_CHECKLIST } from '@/data/releaseItems';
import { api, apiPaths } from '@/lib/api';
import { useDocStore } from '@/stores/useDocStore';
import { cx } from '@/lib/cx';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { useHasRole } from '@/lib/roles';
import { IconTruck, IconBuildingFactory2, IconPresentation, IconRocket, IconLock } from '@tabler/icons-react';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';
import { WorkflowGate } from '@/components/workflow/WorkflowGate';

const ACCENT = {
  deliver: 'border-orange-300 bg-orange-50/50',
  publish: 'border-primary-300 bg-primary-50/50',
  review: 'border-emerald-300 bg-emerald-50/50',
};

const ICONS = {
  vendor: IconTruck,
  oem: IconBuildingFactory2,
  sales: IconPresentation,
};

export function ReleaseManager() {
  const canRelease = useHasRole('manager');
  // Remembered on this computer so a reload keeps you on the same document.
  const [docId, setDocId] = usePref('doc:release', null);
  const [results, setResults] = useState({});
  const [doc, setDoc] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const changeStatus = useDocStore((s) => s.changeStatus);

  useEffect(() => {
    setResults({});
    if (!docId) {
      setDoc(null);
      return;
    }
    api.get(apiPaths.document(docId)).then((r) => setDoc(r.document)).catch(() => setDoc(null));
    api.get(apiPaths.documentWorkflow(docId)).then(setWorkflow).catch(() => setWorkflow(null));
    api
      .get(`${apiPaths.checklistsByDoc(docId)}?type=release`)
      .then((r) => {
        if (r.results?.[0]) setResults(r.results[0].results);
      })
      .catch(() => {});
  }, [docId]);

  const stats = useMemo(() => {
    const totals = RELEASE_CHECKLIST.map((section) => {
      const sectionDone = section.items.filter((_, i) => {
        const key = `${section.audience}-${i}`;
        return results[key] === 'ok';
      }).length;
      return { audience: section.audience, ok: sectionDone, total: section.items.length };
    });
    const allDone = totals.every((t) => t.ok === t.total);
    return { totals, allDone };
  }, [results]);

  function setVal(audience, idx, v) {
    setResults((prev) => ({ ...prev, [`${audience}-${idx}`]: v }));
  }

  async function onSave() {
    if (!docId) return;
    await api.post(apiPaths.checklists, {
      documentId: docId,
      checklistType: 'release',
      results,
    });
    toast.success('Saved', 'Đã lưu checklist phát hành');
  }

  async function onRelease() {
    if (!doc) return;
    if (!stats.allDone) {
      toast.warning('All items must be OK before releasing', 'Tất cả mục phải đạt OK trước khi phát hành');
      return;
    }
    if (doc.status !== 'approved') {
      toast.warning(
        'Document must be approved first',
        `Tài liệu phải ở trạng thái approved (hiện tại: ${doc.status})`
      );
      return;
    }
    await changeStatus(doc.id, 'released', 'All three release packages passed');
    toast.success('Released', 'Đã phát hành tài liệu');
    const refreshed = await api.get(apiPaths.document(doc.id));
    setDoc(refreshed.document);
    const refreshedWorkflow = await api.get(apiPaths.documentWorkflow(doc.id));
    setWorkflow(refreshedWorkflow);
  }

  return (
    <PageWrapper
      title="Release Manager"
      subtitle="Phát hành tài liệu — kiểm tra 3 gói: nhà cung ứng / OEM / kinh doanh"
      breadcrumb="Publish / Phát hành"
      action={
        <>
          <ExportMenu kind="checklist" checklistType="release" documentId={docId} disabled={!docId} />
          <Button
            onClick={onRelease}
            disabled={!canRelease || !workflow?.transitions.find((item) => item.to === 'released')?.ready}
            title={!canRelease ? 'Manager only / Chỉ quản lý' : undefined}
          >
            {canRelease ? <IconRocket size={14} /> : <IconLock size={14} />} Release / Phát hành
          </Button>
        </>
      }
    >
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="label">Target document / Tài liệu phát hành</label>
            <DocumentPicker value={docId} onChange={setDocId} className="mt-1" />
          </div>
          {doc && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Current status:</span>
              <Badge status={doc.status} />
            </div>
          )}
        </div>
      </Card>

      {doc && (
        <div className="mb-4">
          <WorkflowGate transition={workflow?.transitions.find((item) => item.to === 'released')} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {RELEASE_CHECKLIST.map((section) => {
          const Icon = ICONS[section.audience];
          const stat = stats.totals.find((t) => t.audience === section.audience);
          return (
            <Card key={section.audience} className={cx('border', ACCENT[section.accent])}>
              <CardHeader
                title={section.title.en}
                subtitle={section.title.vn}
                icon={<Icon size={18} />}
              />
              <ProgressBar
                value={stat.ok}
                max={stat.total}
                color={stat.ok === stat.total ? 'success' : 'primary'}
                className="mb-3"
              />
              <div className="text-xs text-gray-500 mb-2">
                {stat.ok} / {stat.total} items OK
              </div>
              <div>
                {section.items.map((it, idx) => (
                  <CheckItem
                    key={idx}
                    index={idx + 1}
                    en={it.en}
                    vn={it.vn}
                    value={results[`${section.audience}-${idx}`] || null}
                    onChange={(v) => setVal(section.audience, idx, v)}
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onSave} disabled={!docId}>
          Save progress / Lưu tiến độ
        </Button>
      </div>
    </PageWrapper>
  );
}
