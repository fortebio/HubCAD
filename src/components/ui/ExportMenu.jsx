import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { downloadExport } from '@/lib/pdfDownload';
import { cx } from '@/lib/cx';
import {
  IconDownload,
  IconChevronDown,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypeHtml,
  IconMarkdown,
  IconBrandGoogle,
  IconLock,
  IconVector,
} from '@tabler/icons-react';

const ALL_FORMATS = [
  { key: 'pdf', label: 'PDF', icon: IconFileTypePdf, hint: 'Print-ready, watermark' },
  { key: 'dxf', label: 'DXF (CAD)', icon: IconVector, hint: 'Mở trong SolidWorks / Fusion 360 / AutoCAD', drawingOnly: true },
  { key: 'docx', label: 'Word / Google Docs', icon: IconFileTypeDocx, hint: 'Upload to Google Drive → open as Google Doc, or edit in Word' },
  { key: 'html', label: 'HTML (web)', icon: IconFileTypeHtml, hint: 'Self-contained, prints from browser' },
  { key: 'md', label: 'Markdown', icon: IconMarkdown, hint: 'Plain text, version-control friendly' },
];

export function ExportMenu({
  kind,
  documentId,
  checklistType,
  watermark,
  formats,
  disabled,
  className = '',
  size = 'sm',
  buttonLabel = 'Export',
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  const visibleFormats = formats
    ? ALL_FORMATS.filter((f) => formats.includes(f.key))
    : ALL_FORMATS.filter((f) => !f.drawingOnly || kind === 'drawing');

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function run(format) {
    setBusy(format);
    setError(null);
    try {
      await downloadExport(format, kind, documentId, { checklistType, watermark });
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className={cx('relative inline-block', className)}>
      <Button
        variant="secondary"
        size={size}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={disabled ? 'Pick a document first' : undefined}
      >
        {disabled ? <IconLock size={14} /> : <IconDownload size={14} />}
        {buttonLabel}
        <IconChevronDown size={12} />
      </Button>

      {open && !disabled && (
        <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-modal z-30 overflow-hidden">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
            Export as / Xuất dạng
          </div>
          {visibleFormats.map((f) => (
            <button
              key={f.key}
              onClick={() => run(f.key)}
              disabled={!!busy}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 text-left disabled:opacity-50"
            >
              <f.icon size={20} className="text-gray-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-gray-800">
                  {f.label}
                  {busy === f.key && <span className="ml-2 text-[10px] text-primary-500">building…</span>}
                </div>
                <div className="text-[11px] text-gray-500 leading-tight">{f.hint}</div>
              </div>
            </button>
          ))}

          {error && <div className="px-3 py-2 text-[11px] text-red-600 border-t border-red-100">{error}</div>}

          <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500 flex items-center gap-1.5">
            <IconBrandGoogle size={11} /> For Google Docs: pick Word, then upload to Drive → "Open with Google Docs"
          </div>
        </div>
      )}
    </div>
  );
}
