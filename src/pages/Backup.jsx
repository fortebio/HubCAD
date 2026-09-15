import { useEffect, useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useHasRole } from '@/lib/roles';
import {
  IconDownload,
  IconDatabase,
  IconFolderFilled,
  IconLock,
  IconDeviceDesktop,
  IconEraser,
} from '@tabler/icons-react';
import { clearLocalMemory, localMemoryStats } from '@/lib/localMemory';
import { clearViewerSession, loadViewerSession, sessionBytes } from '@/lib/viewerSession';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/useToastStore';

function bytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function Backup() {
  const [mem, setMem] = useState(() => localMemoryStats());
  const [viewerBytes, setViewerBytes] = useState(null);

  // The 3D session lives in IndexedDB, so its size has to be read async.
  useEffect(() => {
    let cancelled = false;
    loadViewerSession().then((session) => {
      if (!cancelled) setViewerBytes(session ? sessionBytes(session.models) : 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function forgetLocal() {
    const ok = await confirmDialog({
      title: 'Forget local memory / Xóa bộ nhớ trên máy',
      message: 'Filters, selected documents, unsaved drafts and the saved 3D session will be removed from this computer.',
      detail: 'Dữ liệu trên server không bị ảnh hưởng.',
      confirmLabel: 'Forget / Xóa',
      tone: 'danger',
    });
    if (!ok) return;
    const removed = clearLocalMemory();
    await clearViewerSession();
    setMem(localMemoryStats());
    setViewerBytes(0);
    toast.success(`Cleared ${removed} stored item(s)`, 'Đã xóa bộ nhớ trên máy này');
  }

  const canBackup = useHasRole('manager');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/backup/status').then(setStatus).catch(() => {});
  }, []);

  async function onExport() {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/backup/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ymd = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      a.download = `drawing-tool-backup-${ymd}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error('Backup failed / Sao lưu thất bại', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageWrapper
      title="Backup & Restore"
      subtitle="Sao lưu và phục hồi dữ liệu"
      breadcrumb="System / Hệ thống"
      action={
        <Button
          onClick={onExport}
          disabled={!canBackup || loading}
          title={!canBackup ? 'Manager only / Chỉ quản lý' : undefined}
        >
          {canBackup ? <IconDownload size={14} /> : <IconLock size={14} />}{' '}
          {loading ? 'Building...' : 'Download backup'}
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Database" subtitle="Cơ sở dữ liệu SQLite" icon={<IconDatabase size={18} />} />
          {status?.db ? (
            <div className="space-y-1 text-[13px]">
              <Row label="Path" value={status.db.path} mono />
              <Row label="Size" value={bytes(status.db.sizeBytes)} mono />
              <Row label="Exists" value={status.db.exists ? 'yes' : 'no'} />
            </div>
          ) : (
            <div className="text-xs text-gray-400">Loading...</div>
          )}
        </Card>
        <Card>
          <CardHeader title="Uploaded files" subtitle="File 3D + ảnh đã tải lên" icon={<IconFolderFilled size={18} />} />
          {status?.uploads ? (
            <div className="space-y-1 text-[13px]">
              <Row label="Path" value={status.uploads.path} mono />
              <Row label="Files" value={status.uploads.fileCount} mono />
              <Row label="Size" value={bytes(status.uploads.sizeBytes)} mono />
            </div>
          ) : (
            <div className="text-xs text-gray-400">Loading...</div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Row counts" subtitle="Số bản ghi trong từng bảng" />
        {status?.counts ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
            {Object.entries(status.counts).map(([table, n]) => (
              <div key={table} className="border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-gray-500">{table}</span>
                <span className="mono font-semibold">{n == null ? '—' : n}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400">Loading...</div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Local memory / Bộ nhớ trên máy này"
          subtitle="Chỉ nằm trên máy tính này, không đồng bộ lên server"
          icon={<IconDeviceDesktop size={18} aria-hidden="true" />}
        />
        <div className="text-[12px] space-y-1.5">
          <Row label="Preferences / Tùy chọn" value={`${mem.prefs} mục`} />
          <Row label="Unsaved drafts / Bản nháp" value={`${mem.drafts} mục`} />
          <Row label="Size / Dung lượng" value={formatBytes(mem.bytes)} />
          <Row
            label="3D session / Phiên 3D"
            value={viewerBytes === null ? '—' : formatBytes(viewerBytes)}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="danger" size="sm" onClick={forgetLocal}>
            <IconEraser size={14} aria-hidden="true" /> Forget everything / Xóa bộ nhớ máy
          </Button>
          <span className="text-[11px] text-gray-600">
            Bộ lọc, tài liệu đang chọn, bản nháp và phiên 3D sẽ bị xóa khỏi máy này.
          </span>
        </div>
      </Card>

      <Card className="mt-4 bg-amber-50 border-amber-200">
        <div className="text-[12px] text-amber-900">
          <strong>Restore:</strong> Stop the API server and replace <code>data/drawing-tool.db</code> and the{' '}
          <code>uploads/</code> folder with the contents of a backup ZIP. Then restart the server with{' '}
          <code>npm run server</code>. (UI-based restore is not implemented — DB swap is safer when offline.)
        </div>
      </Card>
    </PageWrapper>
  );
}

/** KB below a megabyte, so a small session does not read as "0.0 MB". */
function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right ${mono ? 'mono text-gray-900' : 'text-gray-900'} break-all`}>{value}</span>
    </div>
  );
}
