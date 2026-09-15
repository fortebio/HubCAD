import { useEffect, useMemo, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { Empty } from '@/components/ui/Empty';
import { api, apiPaths } from '@/lib/api';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { IconPlus, IconTrash, IconFileDescription, IconArrowUp, IconArrowDown, IconDeviceFloppy } from '@tabler/icons-react';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';
import { useDraft } from '@/lib/useLocalMemory';
import { DraftBanner } from '@/components/ui/DraftBanner';

const EMPTY_STEP = () => ({
  id: Math.random().toString(36).slice(2, 9),
  titleEn: '',
  titleVn: '',
  bodyEn: '',
  bodyVn: '',
  imagePath: null,
  tools: '',
  caution: '',
});

export function WIDocument() {
  // Remembered on this computer so a reload keeps you on the same document.
  const [docId, setDocId] = usePref('doc:wi', null);
  const [steps, setSteps] = useState([]);
  const [meta, setMeta] = useState({ titleEn: '', titleVn: '', station: '', cycleTime: '' });
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  // Memoised so the autosave timer keys off real edits, not re-renders.
  const wiValue = useMemo(() => ({ meta, steps }), [meta, steps]);
  const wiDraft = useDraft(docId ? `wi:${docId}` : null, wiValue);

  useEffect(() => {
    if (!docId) {
      setSteps([]);
      setMeta({ titleEn: '', titleVn: '', station: '', cycleTime: '' });
      setSavedAt(null);
      return;
    }
    api
      .get(apiPaths.wiByDoc(docId))
      .then((res) => {
        setSteps(res.steps || []);
        setMeta(res.meta || { titleEn: '', titleVn: '', station: '', cycleTime: '' });
        setSavedAt(res.updatedAt);
      })
      .catch(() => {});
  }, [docId]);

  async function save() {
    if (!docId) return;
    setSaving(true);
    try {
      await api.put(apiPaths.wiByDoc(docId), { meta, steps });
      const refreshed = await api.get(apiPaths.wiByDoc(docId));
      setSavedAt(refreshed.updatedAt);
      wiDraft.clear();
    } catch (e) {
      toast.error('Save failed / Lưu thất bại', e.message);
    } finally {
      setSaving(false);
    }
  }

  function addStep() {
    setSteps((prev) => [...prev, EMPTY_STEP()]);
  }

  function updateStep(id, patch) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function move(id, dir) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  async function uploadImage(file, stepId) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload(apiPaths.upload('image'), fd);
    updateStep(stepId, { imagePath: res.path });
  }

  return (
    <PageWrapper
      title="WI Document"
      subtitle="Tạo Work Instruction — Hướng dẫn lắp ráp / sản xuất"
      breadcrumb="Publish / Phát hành"
      action={
        <>
          <ExportMenu kind="wi" documentId={docId} disabled={!docId} />
          <Button variant="secondary" size="sm" onClick={addStep} disabled={!docId}>
            <IconPlus size={14} /> Add step
          </Button>
          <Button size="sm" onClick={save} disabled={!docId || saving}>
            <IconDeviceFloppy size={14} /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <Card className="mb-4">
        <label className="label">Target WI document / Tài liệu WI</label>
        <DocumentPicker value={docId} onChange={setDocId} filterType="wi" className="mt-1" />
        {savedAt && <div className="text-[11px] text-gray-600 mt-2">Last saved: {new Date(savedAt).toLocaleString()}</div>}
      </Card>

      <DraftBanner
        draft={wiDraft.pending}
        label="Unsaved work instruction found on this computer"
        onRestore={() => {
          const v = wiDraft.pending.value;
          if (v?.meta) setMeta(v.meta);
          if (Array.isArray(v?.steps)) setSteps(v.steps);
          wiDraft.discard();
          toast.info('Draft restored', 'Đã khôi phục bản nháp WI');
        }}
        onDiscard={wiDraft.discard}
      />

      {!docId ? (
        <Card>
          <Empty
            icon={<IconFileDescription size={40} />}
            title="Pick a WI document"
            hint="Chọn tài liệu WI để biên soạn các bước lắp ráp / sản xuất."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader title="WI metadata" subtitle="Thông tin tài liệu WI" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Title (English)</label>
                <input className="input mt-1" value={meta.titleEn} onChange={(e) => setMeta({ ...meta, titleEn: e.target.value })} />
              </div>
              <div>
                <label className="label">Tiêu đề (VN)</label>
                <input className="input mt-1" value={meta.titleVn} onChange={(e) => setMeta({ ...meta, titleVn: e.target.value })} />
              </div>
              <div>
                <label className="label">Station / Trạm</label>
                <input className="input mt-1" value={meta.station} onChange={(e) => setMeta({ ...meta, station: e.target.value })} />
              </div>
              <div>
                <label className="label">Cycle time</label>
                <input className="input mt-1" value={meta.cycleTime} onChange={(e) => setMeta({ ...meta, cycleTime: e.target.value })} />
              </div>
            </div>
          </Card>

          {steps.map((step, idx) => (
            <Card key={step.id}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-2">
                  <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <button
                    onClick={() => move(step.id, -1)}
                    disabled={idx === 0}
                    className="icon-btn disabled:opacity-30"
                    aria-label={`Move step ${idx + 1} up / Chuyển bước lên`}
                  >
                    <IconArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => move(step.id, 1)}
                    disabled={idx === steps.length - 1}
                    className="icon-btn disabled:opacity-30"
                    aria-label={`Move step ${idx + 1} down / Chuyển bước xuống`}
                  >
                    <IconArrowDown size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input"
                        placeholder="Step title (English)"
                        value={step.titleEn}
                        onChange={(e) => updateStep(step.id, { titleEn: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Tiêu đề bước (VN)"
                        value={step.titleVn}
                        onChange={(e) => updateStep(step.id, { titleVn: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Instruction (English)"
                      value={step.bodyEn}
                      onChange={(e) => updateStep(step.id, { bodyEn: e.target.value })}
                    />
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Hướng dẫn (Tiếng Việt)"
                      value={step.bodyVn}
                      onChange={(e) => updateStep(step.id, { bodyVn: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input"
                        placeholder="Tools / Dụng cụ"
                        value={step.tools}
                        onChange={(e) => updateStep(step.id, { tools: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Caution / Lưu ý"
                        value={step.caution}
                        onChange={(e) => updateStep(step.id, { caution: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {step.imagePath ? (
                      <div className="relative">
                        <img
                          src={step.imagePath}
                          alt={`Photo for step ${idx + 1} / Ảnh bước ${idx + 1}`}
                          className="w-full rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={() => updateStep(step.id, { imagePath: null })}
                          className="icon-btn absolute top-2 right-2 bg-white/90 rounded-full text-red-500 hover:text-red-700"
                          aria-label={`Remove photo for step ${idx + 1} / Xóa ảnh bước ${idx + 1}`}
                        >
                          <IconTrash size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <FileUpload
                        compact
                        accept="image/*"
                        onFiles={(f) => uploadImage(f, step.id)}
                        className="!p-3"
                      />
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeStep(step.id)}
                  className="icon-btn text-red-500 hover:text-red-700"
                  aria-label={`Remove step ${idx + 1} / Xóa bước ${idx + 1}`}
                >
                  <IconTrash size={16} aria-hidden="true" />
                </button>
              </div>
            </Card>
          ))}

          {steps.length === 0 && (
            <Card>
              <Empty
                title="No steps yet"
                hint="Click 'Add step' to begin building the assembly instructions."
                action={
                  <Button onClick={addStep}>
                    <IconPlus size={14} /> Add first step
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
