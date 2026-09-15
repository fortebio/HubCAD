import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { ChecklistRunner } from '@/components/forms/ChecklistRunner';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { Button } from '@/components/ui/Button';
import { DRAWING_CHECKLIST, TOTAL_DRAWING_ITEMS } from '@/data/checklistItems';
import { api, apiPaths } from '@/lib/api';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';

export function DrawingChecklist() {
  // Remembered on this computer so a reload keeps you on the same document.
  const [docId, setDocId] = usePref('doc:checklist', null);
  const [latest, setLatest] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!docId) {
      setLatest(null);
      return;
    }
    api
      .get(`${apiPaths.checklistsByDoc(docId)}?type=drawing`)
      .then((res) => setLatest(res.results?.[0] || null))
      .catch(() => setLatest(null));
  }, [docId, saved]);

  async function onSave({ results, remarks, overall }) {
    if (!docId) {
      toast.warning('Pick a document first', 'Chọn tài liệu trước khi lưu');
      return;
    }
    const res = await api.post(apiPaths.checklists, {
      documentId: docId,
      checklistType: 'drawing',
      results,
      remarks,
    });
    setSaved(res.result.id);
  }

  return (
    <PageWrapper
      title="Drawing Checklist"
      subtitle="Kiểm tra bản vẽ kỹ thuật theo ISO 128 / ISO 7200 / ISO 2768"
      breadcrumb="Review / Kiểm tra"
      action={
        <ExportMenu kind="checklist" checklistType="drawing" documentId={docId} disabled={!docId} />
      }
    >
      <Card className="mb-4">
        <label className="label">Target document / Tài liệu cần kiểm tra</label>
        <DocumentPicker value={docId} onChange={setDocId} filterType="machining" className="mt-1" />
      </Card>

      <ChecklistRunner
        title="Drawing checklist — ISO 128 / 7200 / 2768"
        sections={DRAWING_CHECKLIST}
        totalItems={TOTAL_DRAWING_ITEMS}
        initialResults={latest?.results || {}}
        savedAt={latest?.checkedAt}
        onSave={onSave}
      />
    </PageWrapper>
  );
}
