import { useMemo } from 'react';
import {
  IconAlertTriangle,
  IconShieldX,
  IconGitBranch,
  IconDeviceFloppy,
  IconArchive,
} from '@tabler/icons-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';

/** One unified-diff line, coloured by its leading marker. */
function DiffLine({ text }) {
  const kind = text.startsWith('@@') ? 'hunk' : text[0] === '+' ? 'add' : text[0] === '-' ? 'del' : null;
  return (
    <div
      className={cx(
        'whitespace-pre px-2',
        kind === 'add' && 'bg-emerald-50 text-emerald-900',
        kind === 'del' && 'bg-red-50 text-red-900',
        kind === 'hunk' && 'bg-gray-100 text-gray-500'
      )}
    >
      {text || ' '}
    </div>
  );
}

/**
 * Last stop before the file on disk changes.
 *
 * Shows the exact lines that will move, which shop rules the edit breaks, and
 * how far the change reaches — a module under common/ is imported by every
 * other concept folder, so "edit one number" is rarely as local as it looks.
 */
export function DiffModal({ open, onClose, preview, busy, onConfirm, edits }) {
  const blockers = useMemo(
    () => (preview?.constraints || []).filter((c) => c.severity === 'error' && c.holds === false),
    [preview]
  );
  const warnings = useMemo(
    () => (preview?.constraints || []).filter((c) => c.severity !== 'error' && c.holds === false),
    [preview]
  );
  const changed = (preview?.diffs || []).filter((d) => d.changed);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review changes / Xem lại thay đổi"
      subtitle={
        changed.length
          ? `${edits?.length || 0} giá trị · ${changed.length} file sẽ được ghi`
          : 'Không có gì thay đổi'
      }
      maxWidth="840px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel / Hủy
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            loading={busy}
            disabled={busy || preview?.blocked || !changed.length}
          >
            <IconDeviceFloppy size={14} />
            Write files / Ghi file
          </Button>
        </>
      }
    >
      {!preview ? (
        <p className="text-[13px] text-gray-500 py-6 text-center">Preparing… / Đang chuẩn bị…</p>
      ) : (
        <div className="space-y-3">
          {blockers.map((c) => (
            <div
              key={c.id}
              className="flex gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50 text-[12px]"
            >
              <IconShieldX size={16} className="text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-red-800">{c.message?.en || `Rule ${c.id} broken`}</p>
                <p className="text-red-700">{c.message?.vn}</p>
                <p className="font-mono text-[11px] text-red-600 mt-1">
                  {c.expr} · {String(c.beforeValue ?? '—')} → {String(c.afterValue ?? '—')}
                </p>
              </div>
            </div>
          ))}

          {warnings.map((c) => (
            <div
              key={c.id}
              className="flex gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-[12px]"
            >
              <IconAlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-amber-800">{c.message?.en || c.id}</p>
                <p className="text-amber-700">{c.message?.vn}</p>
              </div>
            </div>
          ))}

          {(preview.sharedFileWarnings || []).map((s) => (
            <div
              key={s.file}
              className="flex gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-[12px]"
            >
              <IconGitBranch size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-amber-800">
                  {s.file.split('/').pop()} is imported by {s.count} other file
                  {s.count > 1 ? 's' : ''}
                </p>
                <p className="text-amber-700">
                  Sửa file này ảnh hưởng tới các dự án khác, không chỉ dự án đang mở.
                </p>
                <ul className="mt-1 font-mono text-[10px] text-amber-700 space-y-0.5 max-h-20 overflow-y-auto">
                  {s.importedBy.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {changed.length === 0 ? (
            <p className="text-[13px] text-gray-500 py-4 text-center">
              The new values match what is already in the file / Giá trị mới trùng với file hiện tại
            </p>
          ) : (
            changed.map((d) => (
              <div key={d.file} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <span className="font-mono text-[11px] text-gray-700 truncate flex-1">{d.file}</span>
                  <span
                    className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0"
                    title={d.backupWillBe}
                  >
                    <IconArchive size={11} aria-hidden="true" />
                    backup
                  </span>
                </div>
                <div className="font-mono text-[11px] leading-[1.5] max-h-56 overflow-auto py-1">
                  {d.unified
                    .split('\n')
                    .filter((l) => !l.startsWith('--- ') && !l.startsWith('+++ '))
                    .map((l, i) => (
                      <DiffLine key={i} text={l} />
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
