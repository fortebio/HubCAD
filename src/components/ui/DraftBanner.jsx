import { IconHistory } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';

function when(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

/**
 * Offers work that was typed but never saved to the server, found on this
 * computer. Restoring is always the user's choice — nothing is applied silently.
 */
export function DraftBanner({ draft, onRestore, onDiscard, label }) {
  if (!draft) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-card px-4 py-3"
    >
      <IconHistory size={18} className="text-amber-600 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-gray-900">
          {label || 'Unsaved draft found on this computer'}
        </div>
        <div className="text-[11px] text-gray-600 mt-0.5">
          Có bản nháp chưa lưu trên máy này — {when(draft.savedAt)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={onRestore}>
          Restore / Khôi phục
        </Button>
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          Discard / Bỏ
        </Button>
      </div>
    </div>
  );
}
