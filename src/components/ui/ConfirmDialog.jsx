import { create } from 'zustand';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const useConfirmStore = create(() => ({ request: null }));

/**
 * Promise-based replacement for window.confirm().
 * Keeps the app inside its own UI (and its own language) instead of a
 * browser dialog that cannot be styled or translated.
 *
 *   if (!(await confirmDialog({ title: 'Deactivate user?', message: '...' }))) return;
 */
export function confirmDialog({
  title,
  message,
  detail,
  confirmLabel = 'Confirm / Xác nhận',
  cancelLabel = 'Cancel / Hủy',
  tone = 'primary',
} = {}) {
  return new Promise((resolve) => {
    useConfirmStore.setState({
      request: { title, message, detail, confirmLabel, cancelLabel, tone, resolve },
    });
  });
}

/** Rendered once in the app shell. */
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);

  const settle = (value) => {
    request?.resolve(value);
    useConfirmStore.setState({ request: null });
  };

  if (!request) return null;

  return (
    <Modal
      open
      onClose={() => settle(false)}
      title={request.title}
      subtitle={request.detail}
      maxWidth="440px"
      footer={
        <>
          <Button variant="secondary" onClick={() => settle(false)}>
            {request.cancelLabel}
          </Button>
          <Button
            variant={request.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            autoFocus
          >
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      {request.message && (
        <p className="text-[13px] text-gray-700 leading-relaxed">{request.message}</p>
      )}
    </Modal>
  );
}
