import { useEffect, useState } from 'react';
import { useDocStore } from '@/stores/useDocStore';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card } from '@/components/ui/Card';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IconPlus, IconSearch, IconDownload, IconLock } from '@tabler/icons-react';
import { downloadPdf } from '@/lib/pdfDownload';
import { useHasRole, RoleGate } from '@/lib/roles';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { readPref, writePref } from '@/lib/localMemory';
import { WorkflowGate } from '@/components/workflow/WorkflowGate';

const STATUSES = ['draft', 'in_review', 'approved', 'released', 'obsolete'];
const TYPES = ['machining', 'wi', 'catalog', 'bom'];

function pdfKindForDoc(d) {
  if (d.docType === 'wi') return 'wi';
  if (d.docType === 'catalog') return 'catalog';
  if (d.docType === 'bom') return 'bom';
  return 'drawing';
}

export function DocTracker() {
  const canEdit = useHasRole('designer', 'reviewer', 'manager');
  const { documents, filters, setFilters, fetchAll, create, changeStatus, loading } =
    useDocStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(null);
  const [form, setForm] = useState({
    docNumber: '',
    nameEn: '',
    nameVn: '',
    docType: 'machining',
    revision: '-',
  });
  const [error, setError] = useState(null);
  const [transition, setTransition] = useState({ status: '', comment: '' });
  const [workflow, setWorkflow] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Restore the last filter set used on this computer, once, before the
  // first fetch is allowed to persist anything back.
  const [filtersReady, setFiltersReady] = useState(false);
  useEffect(() => {
    const saved = readPref('tracker:filters', null);
    if (saved && typeof saved === 'object') setFilters(saved);
    setFiltersReady(true);
  }, [setFilters]);

  useEffect(() => {
    if (!filtersReady) return;
    writePref('tracker:filters', filters);
  }, [filtersReady, filters]);

  useEffect(() => {
    fetchAll();
  }, [filters.status, filters.type, filters.q, fetchAll]);

  useEffect(() => {
    if (!statusOpen) {
      setWorkflow(null);
      return;
    }
    setWorkflowLoading(true);
    setTransition({ status: '', comment: '' });
    api.get(apiPaths.documentWorkflow(statusOpen.id))
      .then(setWorkflow)
      .catch((e) => setError(e.message))
      .finally(() => setWorkflowLoading(false));
  }, [statusOpen]);

  async function onCreate() {
    try {
      setError(null);
      await create(form);
      setModalOpen(false);
      setForm({ docNumber: '', nameEn: '', nameVn: '', docType: 'machining', revision: '-' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function onTransition() {
    try {
      setError(null);
      await changeStatus(statusOpen.id, transition.status, transition.comment);
      setStatusOpen(null);
      setTransition({ status: '', comment: '' });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <PageWrapper
      title="Document Tracker"
      subtitle="Theo dõi và quản lý toàn bộ tài liệu kỹ thuật"
      breadcrumb="Change / Thay đổi"
      action={
        <Button onClick={() => setModalOpen(true)}>
          <IconPlus size={14} /> New document
        </Button>
      }
    >
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by doc number or name..."
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
            />
          </div>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}>
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        {loading && documents.length === 0 ? (
          <SkeletonTable rows={8} cols={7} />
        ) : (
        <Table stickyHeader label="Documents / Danh sách tài liệu">
          <THead>
            <TR>
              <TH>Doc number</TH>
              <TH>Name (EN / VN)</TH>
              <TH>Type</TH>
              <TH>Rev</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10">
                  <Empty
                    icon={<IconSearch size={28} />}
                    title="No documents match these filters"
                    hint="Không có tài liệu nào khớp bộ lọc. Xóa bớt bộ lọc hoặc tạo tài liệu mới."
                  />
                </td>
              </tr>
            )}
            {documents.map((d) => (
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
                <TD className="text-xs text-gray-500">
                  {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : '—'}
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={() => { setError(null); setStatusOpen(d); }}>
                        Status / Trạng thái
                      </Button>
                    ) : (
                      <span
                        title="Reviewer or manager only / Chỉ reviewer hoặc manager"
                        className="text-gray-400 p-1.5 inline-flex"
                      >
                        <IconLock size={12} aria-hidden="true" />
                        <span className="sr-only">
                          Status change requires reviewer or manager role
                        </span>
                      </span>
                    )}
                    <button
                      onClick={() => downloadPdf(pdfKindForDoc(d), d.id)}
                      title="Download PDF / Tải PDF"
                      className="icon-btn hover:text-primary-500"
                      aria-label={`Download PDF for ${d.docNumber} / Tải PDF`}
                    >
                      <IconDownload size={14} aria-hidden="true" />
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                  No documents match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New document"
        subtitle="Tạo tài liệu mới"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onCreate}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Doc number *</label>
            <input
              className="input mt-1 font-mono"
              value={form.docNumber}
              onChange={(e) => setForm({ ...form, docNumber: e.target.value })}
              placeholder="DWG-HSG-004"
            />
          </div>
          <div>
            <label className="label">Name (English) *</label>
            <input className="input mt-1" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </div>
          <div>
            <label className="label">Tên (Tiếng Việt)</label>
            <input className="input mt-1" value={form.nameVn} onChange={(e) => setForm({ ...form, nameVn: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input mt-1" value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Revision</label>
              <input className="input mt-1 font-mono" value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} />
            </div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </Modal>

      <Modal
        open={!!statusOpen}
        onClose={() => setStatusOpen(null)}
        title={`Change status: ${statusOpen?.docNumber || ''}`}
        subtitle={`Current: ${statusOpen?.status || ''}`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setStatusOpen(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onTransition} disabled={!transition.status || !workflow?.transitions.find((item) => item.to === transition.status)?.ready}>
              Apply / Áp dụng
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">New status</label>
            <select className="input mt-1" value={transition.status} onChange={(e) => setTransition({ ...transition, status: e.target.value })} disabled={workflowLoading}>
              <option value="">{workflowLoading ? 'Checking requirements… / Đang kiểm tra…' : 'Select next step / Chọn bước tiếp theo'}</option>
              {(workflow?.transitions || []).map((item) => (
                <option key={item.to} value={item.to}>
                  {item.to}{item.ready ? '' : ' — blocked / đang chặn'}
                </option>
              ))}
            </select>
          </div>
          {transition.status && <WorkflowGate transition={workflow?.transitions.find((item) => item.to === transition.status)} />}
          <div>
            <label className="label">Comment</label>
            <textarea
              className="input mt-1"
              rows={3}
              value={transition.comment}
              onChange={(e) => setTransition({ ...transition, comment: e.target.value })}
            />
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </Modal>
    </PageWrapper>
  );
}
