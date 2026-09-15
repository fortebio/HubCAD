import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useECRStore } from '@/stores/useECRStore';
import { IconPlus, IconAlertTriangle, IconFlag, IconSend } from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { api, apiPaths } from '@/lib/api';
import { toast } from '@/stores/useToastStore';
import { useDraft } from '@/lib/useLocalMemory';
import { DraftBanner } from '@/components/ui/DraftBanner';

const COLUMNS = [
  { status: 'open', title: 'Open', vn: 'Mở', tone: 'border-amber-300 bg-amber-50/50' },
  { status: 'in_review', title: 'In review', vn: 'Đang duyệt', tone: 'border-blue-300 bg-blue-50/50' },
  { status: 'approved', title: 'Approved', vn: 'Đã duyệt', tone: 'border-emerald-300 bg-emerald-50/50' },
  { status: 'rejected', title: 'Rejected', vn: 'Từ chối', tone: 'border-red-300 bg-red-50/50' },
  { status: 'implemented', title: 'Implemented', vn: 'Đã thực hiện', tone: 'border-indigo-300 bg-indigo-50/50' },
];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TYPES = ['design', 'material', 'process', 'document'];

const PRIORITY_TONE = {
  urgent: 'text-red-600',
  high: 'text-orange-700',
  normal: 'text-gray-500',
  low: 'text-gray-500',
};

export function ECRManager() {
  const { ecrs, fetchAll, create, approve } = useECRStore();
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    ecrNumber: '',
    title: '',
    reason: '',
    description: '',
    changeType: 'design',
    priority: 'normal',
  });
  const [approval, setApproval] = useState({ role: 'design', decision: 'approved', comment: '' });
  const [notifyTargets, setNotifyTargets] = useState({ vendor: false, oem: false, quality: false, sales: false });
  const [notifying, setNotifying] = useState(false);
  // Kept while the dialog is open so a mis-click does not lose the request.
  const ecrDraft = useDraft('ecr:new', form, { enabled: createOpen });

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function onNotify() {
    const recipients = Object.entries(notifyTargets).filter(([_, v]) => v).map(([k]) => k);
    if (!detail || !recipients.length) {
      toast.warning('Tick at least one recipient', 'Chọn ít nhất một bên nhận');
      return;
    }
    setNotifying(true);
    try {
      const res = await api.post(apiPaths.ecrNotify(detail.id), { recipients });
      if (res.notifier?.mode === 'smtp') {
        toast.success(`Sent ${res.sent} email(s) via SMTP`, 'Đã gửi thông báo ECN');
      } else {
        toast.info(
          `${res.sent} notification(s) logged to the server console`,
          'No SMTP configured — check the server terminal for the message bodies.'
        );
      }
    } catch (e) {
      toast.error('Notify failed / Gửi thông báo thất bại', e.message);
    } finally {
      setNotifying(false);
    }
  }

  async function onCreate() {
    try {
      const next = `ECR-${String(ecrs.length + 1).padStart(3, '0')}`;
      await create({ ...form, ecrNumber: form.ecrNumber || next });
      setCreateOpen(false);
      setForm({ ecrNumber: '', title: '', reason: '', description: '', changeType: 'design', priority: 'normal' });
      ecrDraft.clear();
    } catch (e) {
      toast.error('Could not create ECR / Không tạo được ECR', e.message);
    }
  }

  async function onApprove() {
    await approve(detail.id, approval);
    setApproval({ role: 'design', decision: 'approved', comment: '' });
    setDetail(null);
  }

  return (
    <PageWrapper
      title="ECR / ECO / ECN"
      subtitle="Quản lý yêu cầu thay đổi kỹ thuật — Engineering Change Request / Order / Notice"
      breadcrumb="Change / Thay đổi"
      action={
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus size={14} /> New ECR
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const items = ecrs.filter((e) => e.status === col.status);
          return (
            <Card key={col.status} className={cx('border', col.tone)}>
              <CardHeader title={col.title} subtitle={`${col.vn} · ${items.length}`} />
              <div className="space-y-2">
                {items.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setDetail(e)}
                    className="block w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-card transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-mono font-medium text-primary-500">{e.ecrNumber}</span>
                      <IconFlag size={12} className={cx(PRIORITY_TONE[e.priority])} />
                    </div>
                    <div className="text-[13px] text-gray-800 leading-tight mb-1.5 line-clamp-2">{e.title}</div>
                    <div className="text-[11px] text-gray-500 line-clamp-1">{e.reason}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] text-gray-600 capitalize">{e.changeType}</span>
                      <span className={cx('text-[10px] capitalize font-semibold', PRIORITY_TONE[e.priority])}>
                        {e.priority}
                      </span>
                    </div>
                  </button>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-4">No items</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New ECR"
        subtitle="Tạo yêu cầu thay đổi"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onCreate}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <DraftBanner
            draft={ecrDraft.pending}
            label="Unsaved ECR found on this computer"
            onRestore={() => {
              setForm({ ...form, ...ecrDraft.pending.value });
              ecrDraft.discard();
            }}
            onDiscard={ecrDraft.discard}
          />
          <div>
            <label className="label">ECR number (auto if blank)</label>
            <input
              className="input mt-1 font-mono"
              value={form.ecrNumber}
              onChange={(e) => setForm({ ...form, ecrNumber: e.target.value })}
              placeholder={`ECR-${String(ecrs.length + 1).padStart(3, '0')}`}
            />
          </div>
          <div>
            <label className="label">Title *</label>
            <input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea
              className="input mt-1"
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input mt-1"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Change type</label>
              <select className="input mt-1" value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.ecrNumber}
        subtitle={detail?.title}
        maxWidth="640px"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDetail(null)}>
              Close
            </Button>
            <Button size="sm" onClick={onApprove}>
              Submit decision
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center gap-2">
              <Badge status={detail.status} />
              <span className="text-xs text-gray-500 capitalize">{detail.changeType}</span>
              <span className={cx('text-xs font-semibold capitalize', PRIORITY_TONE[detail.priority])}>
                {detail.priority}
              </span>
            </div>
            <div>
              <div className="label">Reason</div>
              <div className="text-gray-800 mt-1">{detail.reason}</div>
            </div>
            {detail.description && (
              <div>
                <div className="label">Description</div>
                <div className="text-gray-800 mt-1 whitespace-pre-wrap">{detail.description}</div>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3">
              <div className="label mb-2">Send ECN / Gửi thông báo</div>
              <div className="grid grid-cols-4 gap-2 text-[12px]">
                {['vendor', 'oem', 'quality', 'sales'].map((r) => (
                  <label key={r} className="flex items-center gap-1.5 capitalize cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyTargets[r]}
                      onChange={(e) => setNotifyTargets({ ...notifyTargets, [r]: e.target.checked })}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <Button size="sm" variant="secondary" className="mt-2" onClick={onNotify} disabled={notifying}>
                <IconSend size={14} /> {notifying ? 'Sending...' : 'Send ECN'}
              </Button>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="label mb-2">Add approval</div>
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={approval.role} onChange={(e) => setApproval({ ...approval, role: e.target.value })}>
                  {['design', 'quality', 'production', 'manager'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select className="input" value={approval.decision} onChange={(e) => setApproval({ ...approval, decision: e.target.value })}>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              <textarea
                className="input mt-2"
                rows={2}
                placeholder="Comment / Ghi chú"
                value={approval.comment}
                onChange={(e) => setApproval({ ...approval, comment: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </PageWrapper>
  );
}
