import { useEffect, useId, useRef } from 'react';
import { IconX } from '@tabler/icons-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: labelled, modal to assistive tech, focus is trapped
 * while open and returned to the trigger on close, and the page behind
 * cannot scroll away under it.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, maxWidth = '560px' }) {
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  // Remember the trigger, move focus in, lock the background, then undo it all.
  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus synchronously: React has already committed the DOM (and applied
    // any child autoFocus) by the time this effect runs. A rAF callback would
    // never fire while the tab is hidden, leaving focus stranded on <body>.
    const node = dialogRef.current;
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus();
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      const target = restoreRef.current;
      if (target && typeof target.focus === 'function') target.focus();
    };
  }, [open]);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const node = dialogRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px] animate-overlay-in"
      // Close only when the press starts and ends on the backdrop, so a
      // text selection that drags outside the dialog does not dismiss it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? descId : undefined}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-modal w-full max-h-[90vh] flex flex-col outline-none animate-dialog-in"
        style={{ maxWidth }}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-[15px] font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <div id={descId} className="text-xs text-gray-500 mt-1">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn shrink-0 -mt-1 -mr-1"
            aria-label="Close dialog / Đóng"
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
