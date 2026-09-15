import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { ChecklistRunner } from '@/components/forms/ChecklistRunner';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { Button } from '@/components/ui/Button';
import { DFM_CHECKLIST, TOTAL_DFM_ITEMS } from '@/data/dfmItems';
import { api, apiPaths } from '@/lib/api';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';

export function DFMReview() {
  // Remembered on this computer so a reload keeps you on the same document.
  const [docId, setDocId] = usePref('doc:dfm', null);
  const [latest, setLatest] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!docId) {
      setLatest(null);
      return;
    }
    api
      .get(`${apiPaths.checklistsByDoc(docId)}?type=dfm`)
      .then((res) => setLatest(res.results?.[0] || null))
      .catch(() => setLatest(null));
  }, [docId, saved]);

  async function onSave({ results, remarks }) {
    if (!docId) {
      toast.warning('Pick a document first', 'Chọn tài liệu trước khi lưu');
      return;
    }
    const res = await api.post(apiPaths.checklists, {
      documentId: docId,
      checklistType: 'dfm',
      results,
      remarks,
    });
    setSaved(res.result.id);
  }

  return (
    <PageWrapper
      title="DFM / DFA Review"
      subtitle="Đánh giá khả năng chế tạo & lắp ráp — Design for Manufacturing / Assembly"
      breadcrumb="Review / Kiểm tra"
      action={
        <ExportMenu kind="checklist" checklistType="dfm" documentId={docId} disabled={!docId} />
      }
    >
      <Card className="mb-4">
        <label className="label">Target document / Tài liệu cần đánh giá</label>
        <DocumentPicker value={docId} onChange={setDocId} className="mt-1" />
      </Card>

      <ChecklistRunner
        title="DFM / DFA checklist"
        sections={DFM_CHECKLIST}
        totalItems={TOTAL_DFM_ITEMS}
        initialResults={latest?.results || {}}
        savedAt={latest?.checkedAt}
        onSave={onSave}
      />
    </PageWrapper>
  );
}
