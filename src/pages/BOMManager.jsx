import { useEffect, useMemo, useRef, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { DocumentPicker } from '@/components/forms/DocumentPicker';
import { useBOMStore } from '@/stores/useBOMStore';
import { useDocStore } from '@/stores/useDocStore';
import { Empty } from '@/components/ui/Empty';
import { BOMCompareModal } from '@/components/bom/BOMCompareModal';
import { downloadBomExcel, uploadBomExcel } from '@/lib/pdfDownload';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { api, apiPaths } from '@/lib/api';
import {
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconListDetails,
  IconDownload,
  IconUpload,
  IconCamera,
  IconGitCompare,
} from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/useToastStore';
import { promptDialog } from '@/components/ui/PromptDialog';
import { usePref } from '@/lib/useLocalMemory';
import { useDraft } from '@/lib/useLocalMemory';
import { DraftBanner } from '@/components/ui/DraftBanner';
import { readPref, removePref } from '@/lib/localMemory';
import { BOM_HANDOFF_KEY } from '@/components/viewer/AssemblyBOMModal';
import { IconCube3dSphere } from '@tabler/icons-react';

const LEVEL_BG = ['bg-blue-50/60', 'bg-white', 'bg-gray-50'];

const EMPTY_ROW = {
  level: 1,
  partNumber: '',
  descEn: '',
  descVn: '',
  qty: 1,
  unit: 'pcs',
  material: '',
  vendor: '',
  unitCost: 0,
  leadTime: '',
  remarks: '',
};

export function BOMManager() {
  // Remembered on this computer so a reload keeps you on the same document.
  const [docId, setDocId] = usePref('doc:bom', null);
  const { header, items, cost, fetchByDocument, saveItems, create } = useBOMStore();
  const fetchDocs = useDocStore((s) => s.fetchAll);
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  // Only autosaves once the table diverges from what the server has.
  const bomDraft = useDraft(docId ? `bom:${docId}` : null, draft, { enabled: dirty });
  const importInputRef = useRef(null);
  // Rows the 3D viewer generated from a CAD assembly and handed over here.
  const [handoff, setHandoff] = useState(() => readPref(BOM_HANDOFF_KEY, null));

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    if (docId) fetchByDocument(docId);
  }, [docId, fetchByDocument]);

  useEffect(() => {
    setDraft(items.map((it) => ({ ...it })));
    setDirty(false);
  }, [items]);

  const total = useMemo(
    () => draft.reduce((sum, it) => sum + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0),
    [draft]
  );

  function update(idx, field, value) {
    setDraft((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setDirty(true);
  }

  function addRow() {
    setDraft((prev) => [...prev, { ...EMPTY_ROW, itemNo: prev.length + 1 }]);
    setDirty(true);
  }

  function removeRow(idx) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function appendHandoff() {
    if (!handoff?.rows?.length) return;
    setDraft((prev) => [
      ...prev,
      ...handoff.rows.map((r, i) => ({ ...r, itemNo: prev.length + i + 1 })),
    ]);
    setDirty(true);
    removePref(BOM_HANDOFF_KEY);
    setHandoff(null);
    toast.success(
      `${handoff.rows.length} rows added from the 3D assembly`,
      'Đã thêm các dòng BOM từ cụm lắp ráp 3D — nhớ lưu lại'
    );
  }

  function discardHandoff() {
    removePref(BOM_HANDOFF_KEY);
    setHandoff(null);
  }

  async function onSave() {
    if (!header) {
      const values = await promptDialog({
        title: 'New BOM / Tạo BOM mới',
        message: 'Give this assembly a number before the first save.',
        fields: [
          {
            name: 'assemblyNo',
            label: 'Assembly number / Mã cụm',
            required: true,
            hint: 'e.g. ASM-001',
          },
        ],
      });
      if (!values) return;
      const assemblyNo = values.assemblyNo.trim();
      await create({
        documentId: docId,
        assemblyNo,
        revision: '-',
        items: draft.map((d, i) => ({ ...d, itemNo: d.itemNo || i + 1 })),
      });
      await fetchByDocument(docId);
      return;
    }
    await saveItems(
      header.id,
      draft.map((d, i) => ({ ...d, itemNo: d.itemNo || i + 1 }))
    );
    setDirty(false);
    bomDraft.clear();
  }

  async function onSnapshot() {
    if (!header) {
      toast.warning('Save the BOM first', 'Lưu BOM trước khi tạo bản chụp');
      return;
    }
    // One dialog for both values instead of two chained browser prompts.
    const values = await promptDialog({
      title: 'Snapshot BOM / Tạo bản chụp BOM',
      message: 'Freeze the current items under a revision label.',
      fields: [
        {
          name: 'revision',
          label: 'Revision / Phiên bản',
          required: true,
          defaultValue: header.revision || '-',
          hint: 'e.g. A, B, 02',
        },
        { name: 'note', label: 'Note / Ghi chú', multiline: true },
      ],
    });
    if (!values) return;
    const revision = values.revision.trim();
    const note = (values.note || '').trim();
    try {
      await api.post(apiPaths.bomSnapshot(header.id), { revision, note });
      await fetchByDocument(docId);
      toast.success(`Snapshot saved as Rev ${revision}`, 'Đã lưu bản chụp BOM');
    } catch (e) {
      toast.error('Snapshot failed / Tạo bản chụp thất bại', e.message);
    }
  }

  async function onImportExcel(file) {
    if (!header) {
      toast.warning('Save the BOM first', 'Lưu BOM trước khi nhập Excel');
      return;
    }
    try {
      const res = await uploadBomExcel(header.id, file);
      await fetchByDocument(docId);
      toast.success(`Imported ${res.imported} items from Excel`, 'Đã nhập dữ liệu từ Excel');
    } catch (e) {
      toast.error('Import failed / Nhập dữ liệu thất bại', e.message);
    }
  }

  return (
    <PageWrapper
      title="BOM Manager"
      subtitle="Quản lý danh mục vật liệu — Bill of Materials"
      breadcrumb="Design / Thiết kế"
      action={
        <>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportExcel(f);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()} disabled={!header}>
            <IconUpload size={14} /> Import xlsx
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadBomExcel(header?.id, `${header?.assemblyNo}_BOM_Rev${header?.revision}.xlsx`)} disabled={!header}>
            <IconDownload size={14} /> Excel
          </Button>
          <ExportMenu kind="bom" documentId={docId} disabled={!docId} buttonLabel="Export" />
          <Button variant="secondary" size="sm" onClick={onSnapshot} disabled={!header}>
            <IconCamera size={14} /> Snapshot
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCompareOpen(true)} disabled={!header}>
            <IconGitCompare size={14} /> Compare
          </Button>
          <Button variant="secondary" size="sm" onClick={addRow} disabled={!docId}>
            <IconPlus size={14} /> Add row
          </Button>
          <Button size="sm" onClick={onSave} disabled={!docId || !dirty}>
            <IconDeviceFloppy size={14} /> Save
          </Button>
        </>
      }
    >
      <Card className="mb-4">
        <label className="label">Target document / Tài liệu BOM</label>
        <DocumentPicker value={docId} onChange={setDocId} className="mt-1" />
      </Card>

      {handoff?.rows?.length > 0 && (
        <div
          role="status"
          className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-primary-50 border border-primary-200 rounded-card px-4 py-3"
        >
          <IconCube3dSphere size={18} className="text-primary-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-gray-900">
              {handoff.rows.length} BOM lines from the 3D viewer
              {handoff.source ? ` · ${handoff.source}` : ''}
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              {docId
                ? 'Dòng BOM tạo từ cụm lắp ráp 3D — thêm vào bảng bên dưới rồi lưu.'
                : 'Chọn tài liệu BOM trước, rồi thêm các dòng này vào.'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={appendHandoff} disabled={!docId}>
              Append / Thêm vào
            </Button>
            <Button size="sm" variant="secondary" onClick={discardHandoff}>
              Discard / Bỏ
            </Button>
          </div>
        </div>
      )}

      <DraftBanner
        draft={bomDraft.pending}
        label="Unsaved BOM rows found on this computer"
        onRestore={() => {
          setDraft(bomDraft.pending.value);
          setDirty(true);
          bomDraft.discard();
          toast.info('Draft restored', 'Đã khôi phục bản nháp BOM');
        }}
        onDiscard={bomDraft.discard}
      />

      {!docId ? (
        <Card>
          <Empty
            icon={<IconListDetails size={40} />}
            title="Pick a BOM document"
            hint="Chọn một tài liệu BOM để xem hoặc chỉnh sửa danh mục vật liệu."
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <CardHeader
            className="px-5 pt-5 mb-0"
            title={header ? `BOM — ${header.assemblyNo} (Rev ${header.revision})` : 'New BOM'}
            subtitle={`${draft.length} items · Total ${total.toFixed(2)} USD`}
            action={
              cost && (
                <div className="text-xs text-gray-500 mono">
                  Saved total: <span className="text-gray-900">${cost.totalCost?.toFixed(2)}</span>
                </div>
              )
            }
          />
          <div className="overflow-auto max-h-[640px] mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Lv</TH>
                  <TH>Part No.</TH>
                  <TH>Description</TH>
                  <TH>Qty</TH>
                  <TH>Unit</TH>
                  <TH>Material</TH>
                  <TH>Vendor</TH>
                  <TH>Unit cost</TH>
                  <TH>Subtotal</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {draft.map((it, idx) => (
                  <tr key={idx} className={cx('border-b border-gray-100', LEVEL_BG[Math.min(it.level || 0, 2)])}>
                    <TD mono>{idx + 1}</TD>
                    <TD>
                      <select
                        value={it.level}
                        onChange={(e) => update(idx, 'level', Number(e.target.value))}
                        className="text-xs border-0 bg-transparent focus:ring-0"
                      >
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </TD>
                    <TD>
                      <input
                        value={it.partNumber || ''}
                        onChange={(e) => update(idx, 'partNumber', e.target.value)}
                        className="bg-transparent border-0 font-mono text-primary-500 w-32 focus:outline-none"
                        style={{ paddingLeft: `${(it.level || 0) * 12}px` }}
                      />
                    </TD>
                    <TD>
                      <input
                        value={it.descEn || ''}
                        onChange={(e) => update(idx, 'descEn', e.target.value)}
                        placeholder="English"
                        className="bg-transparent border-0 w-full focus:outline-none"
                      />
                      <input
                        value={it.descVn || ''}
                        onChange={(e) => update(idx, 'descVn', e.target.value)}
                        placeholder="Tiếng Việt"
                        className="bg-transparent border-0 w-full text-xs text-gray-500 focus:outline-none"
                      />
                    </TD>
                    <TD>
                      <input
                        type="number"
                        step="0.01"
                        value={it.qty}
                        onChange={(e) => update(idx, 'qty', Number(e.target.value))}
                        className="bg-transparent border-0 w-16 text-right font-mono focus:outline-none"
                      />
                    </TD>
                    <TD>
                      <input
                        value={it.unit || ''}
                        onChange={(e) => update(idx, 'unit', e.target.value)}
                        className="bg-transparent border-0 w-14 focus:outline-none"
                      />
                    </TD>
                    <TD>
                      <input
                        value={it.material || ''}
                        onChange={(e) => update(idx, 'material', e.target.value)}
                        className="bg-transparent border-0 w-24 focus:outline-none"
                      />
                    </TD>
                    <TD>
                      <input
                        value={it.vendor || ''}
                        onChange={(e) => update(idx, 'vendor', e.target.value)}
                        className="bg-transparent border-0 w-24 focus:outline-none"
                      />
                    </TD>
                    <TD>
                      <input
                        type="number"
                        step="0.01"
                        value={it.unitCost ?? ''}
                        onChange={(e) => update(idx, 'unitCost', Number(e.target.value))}
                        className="bg-transparent border-0 w-20 text-right font-mono focus:outline-none"
                      />
                    </TD>
                    <TD mono className="text-right">
                      {((Number(it.unitCost) || 0) * (Number(it.qty) || 0)).toFixed(2)}
                    </TD>
                    <TD>
                      <button
                        onClick={() => removeRow(idx)}
                        className="icon-btn text-red-500 hover:text-red-700"
                        aria-label={`Remove item ${idx + 1} / Xóa dòng ${idx + 1}`}
                      >
                        <IconTrash size={14} aria-hidden="true" />
                      </button>
                    </TD>
                  </tr>
                ))}
                {draft.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs text-gray-400">
                      No items — click "Add row" to start
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={9} className="px-2.5 py-2 text-right text-gray-700">
                    Total
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono text-gray-900">{total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </Table>
          </div>
        </Card>
      )}

      <BOMCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        bomId={header?.id}
        currentRevision={header?.revision}
      />
    </PageWrapper>
  );
}
