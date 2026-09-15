import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { Empty } from '@/components/ui/Empty';
import { api, apiPaths } from '@/lib/api';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { IconPresentation, IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { toast } from '@/stores/useToastStore';
import { usePref } from '@/lib/useLocalMemory';
import { useDraft } from '@/lib/useLocalMemory';
import { DraftBanner } from '@/components/ui/DraftBanner';

const EMPTY = {
  productNameEn: '',
  productNameVn: '',
  tagline: '',
  description: '',
  specs: [{ key: '', valueEn: '', valueVn: '' }],
  features: [{ en: '', vn: '' }],
  certifications: '',
  warranty: '',
  heroImage: null,
};

export function CatalogDatasheet() {
  // Remembered on this computer so a reload keeps you on the same document.
  const [docId, setDocId] = usePref('doc:catalog', null);
  const [data, setData] = useState(EMPTY);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const catalogDraft = useDraft(docId ? `catalog:${docId}` : null, data);

  useEffect(() => {
    if (!docId) {
      setData(EMPTY);
      setSavedAt(null);
      return;
    }
    api
      .get(apiPaths.catalogByDoc(docId))
      .then((res) => {
        const d = res.data || {};
        setData({
          ...EMPTY,
          ...d,
          specs: d.specs?.length ? d.specs : EMPTY.specs,
          features: d.features?.length ? d.features : EMPTY.features,
        });
        setSavedAt(res.updatedAt);
      })
      .catch(() => {});
  }, [docId]);

  async function save() {
    if (!docId) return;
    setSaving(true);
    try {
      await api.put(apiPaths.catalogByDoc(docId), { data });
      const refreshed = await api.get(apiPaths.catalogByDoc(docId));
      setSavedAt(refreshed.updatedAt);
      catalogDraft.clear();
    } catch (e) {
      toast.error('Save failed / Lưu thất bại', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadHero(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload(apiPaths.upload('image'), fd);
    setData((prev) => ({ ...prev, heroImage: res.path }));
  }

  function addSpec() {
    setData((prev) => ({ ...prev, specs: [...prev.specs, { key: '', valueEn: '', valueVn: '' }] }));
  }

  function updateSpec(idx, patch) {
    setData((prev) => ({
      ...prev,
      specs: prev.specs.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function removeSpec(idx) {
    setData((prev) => ({ ...prev, specs: prev.specs.filter((_, i) => i !== idx) }));
  }

  function addFeature() {
    setData((prev) => ({ ...prev, features: [...prev.features, { en: '', vn: '' }] }));
  }

  function updateFeature(idx, patch) {
    setData((prev) => ({
      ...prev,
      features: prev.features.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  }

  function removeFeature(idx) {
    setData((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  }

  return (
    <PageWrapper
      title="Catalog / Datasheet"
      subtitle="Tạo tờ thông số sản phẩm — song ngữ EN/VN"
      breadcrumb="Publish / Phát hành"
      action={
        <>
          <ExportMenu kind="catalog" documentId={docId} disabled={!docId} />
          <Button size="sm" onClick={save} disabled={!docId || saving}>
            <IconDeviceFloppy size={14} /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <Card className="mb-4">
        <label className="label">Target catalog document / Tài liệu catalog</label>
        <DocumentPicker value={docId} onChange={setDocId} filterType="catalog" className="mt-1" />
        {savedAt && <div className="text-[11px] text-gray-600 mt-2">Last saved: {new Date(savedAt).toLocaleString()}</div>}
      </Card>

      <DraftBanner
        draft={catalogDraft.pending}
        label="Unsaved datasheet found on this computer"
        onRestore={() => {
          setData({ ...EMPTY, ...catalogDraft.pending.value });
          catalogDraft.discard();
          toast.info('Draft restored', 'Đã khôi phục bản nháp catalog');
        }}
        onDiscard={catalogDraft.discard}
      />

      {!docId ? (
        <Card>
          <Empty
            icon={<IconPresentation size={40} />}
            title="Pick a catalog document"
            hint="Chọn tài liệu catalog để xây dựng tờ thông số."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Product info" subtitle="Thông tin sản phẩm" />
              <div className="space-y-3">
                <div>
                  <label className="label">Product name (EN)</label>
                  <input className="input mt-1" value={data.productNameEn} onChange={(e) => setData({ ...data, productNameEn: e.target.value })} />
                </div>
                <div>
                  <label className="label">Tên sản phẩm (VN)</label>
                  <input className="input mt-1" value={data.productNameVn} onChange={(e) => setData({ ...data, productNameVn: e.target.value })} />
                </div>
                <div>
                  <label className="label">Tagline</label>
                  <input className="input mt-1" value={data.tagline} onChange={(e) => setData({ ...data, tagline: e.target.value })} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input mt-1" rows={3} value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Specifications"
                subtitle="Thông số kỹ thuật"
                action={
                  <Button variant="ghost" size="sm" onClick={addSpec}>
                    <IconPlus size={14} /> Add
                  </Button>
                }
              />
              <div className="space-y-2">
                {data.specs.map((spec, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <input className="input" placeholder="Key" value={spec.key} onChange={(e) => updateSpec(idx, { key: e.target.value })} />
                    <input className="input" placeholder="Value (EN)" value={spec.valueEn} onChange={(e) => updateSpec(idx, { valueEn: e.target.value })} />
                    <input className="input" placeholder="Giá trị (VN)" value={spec.valueVn} onChange={(e) => updateSpec(idx, { valueVn: e.target.value })} />
                    <button
                      onClick={() => removeSpec(idx)}
                      className="icon-btn text-red-500 hover:text-red-700"
                      aria-label={`Remove spec ${idx + 1} / Xóa thông số ${idx + 1}`}
                    >
                      <IconTrash size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Key features"
                subtitle="Tính năng nổi bật"
                action={
                  <Button variant="ghost" size="sm" onClick={addFeature}>
                    <IconPlus size={14} /> Add
                  </Button>
                }
              />
              <div className="space-y-2">
                {data.features.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input className="input" placeholder="Feature (EN)" value={f.en} onChange={(e) => updateFeature(idx, { en: e.target.value })} />
                    <input className="input" placeholder="Tính năng (VN)" value={f.vn} onChange={(e) => updateFeature(idx, { vn: e.target.value })} />
                    <button
                      onClick={() => removeFeature(idx)}
                      className="icon-btn text-red-500 hover:text-red-700"
                      aria-label={`Remove feature ${idx + 1} / Xóa tính năng ${idx + 1}`}
                    >
                      <IconTrash size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Certifications & Warranty" subtitle="Chứng nhận & bảo hành" />
              <div className="space-y-3">
                <div>
                  <label className="label">Certifications (comma-separated)</label>
                  <input className="input mt-1" placeholder="CE, FCC, RoHS, ..." value={data.certifications} onChange={(e) => setData({ ...data, certifications: e.target.value })} />
                </div>
                <div>
                  <label className="label">Warranty / Bảo hành</label>
                  <input className="input mt-1" value={data.warranty} onChange={(e) => setData({ ...data, warranty: e.target.value })} />
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Hero image" subtitle="Ảnh sản phẩm chính" />
              {data.heroImage ? (
                <div className="relative">
                  <img
                    src={data.heroImage}
                    alt="Product hero image / Ảnh sản phẩm chính"
                    className="w-full rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={() => setData({ ...data, heroImage: null })}
                    className="icon-btn absolute top-2 right-2 bg-white/90 rounded-full text-red-500 hover:text-red-700"
                    aria-label="Remove hero image / Xóa ảnh sản phẩm"
                  >
                    <IconTrash size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <FileUpload accept="image/*" onFiles={uploadHero} />
              )}
            </Card>

            <Card>
              <CardHeader title="Preview" subtitle="Xem trước" />
              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                {data.heroImage && <img src={data.heroImage} alt="" className="w-full h-40 object-contain rounded mb-3 bg-gray-50" />}
                <h2 className="text-[18px] font-bold text-gray-900">{data.productNameEn || 'Product name'}</h2>
                <div className="text-[13px] text-gray-500 mb-2">{data.productNameVn}</div>
                {data.tagline && <div className="text-[13px] text-primary-500 italic mb-3">{data.tagline}</div>}
                {data.description && <p className="text-[12px] text-gray-700 mb-4">{data.description}</p>}

                {data.features.filter((f) => f.en).length > 0 && (
                  <div className="mb-4">
                    <div className="label mb-2">Features</div>
                    <ul className="text-[12px] space-y-1 list-disc pl-5 text-gray-700">
                      {data.features.filter((f) => f.en).map((f, i) => (
                        <li key={i}>
                          {f.en}
                          {f.vn && <span className="text-gray-500"> · {f.vn}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.specs.filter((s) => s.key).length > 0 && (
                  <div>
                    <div className="label mb-2">Specifications</div>
                    <table className="w-full text-[12px]">
                      <tbody>
                        {data.specs.filter((s) => s.key).map((s, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-1.5 text-gray-500 w-1/3">{s.key}</td>
                            <td className="py-1.5 text-gray-800 font-medium">{s.valueEn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {data.certifications && (
                  <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500">
                    Certifications: <span className="text-gray-800">{data.certifications}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
