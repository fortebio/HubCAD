import { useRef, useState } from 'react';
import { IconCloudUpload } from '@tabler/icons-react';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/useToastStore';

/**
 * Does `file` satisfy an `accept` string such as ".stl,.obj" or "image/*"?
 * The native picker enforces this, but drag & drop does not — so we re-check.
 */
function matchesAccept(file, accept) {
  const rules = (accept || '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export function FileUpload({
  onFiles,
  accept,
  multiple = false,
  hint,
  className = '',
  compact = false,
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  function handleFiles(fileList) {
    const all = Array.from(fileList || []);
    if (!all.length) return;

    const accepted = [];
    const rejected = [];
    for (const f of all) (matchesAccept(f, accept) ? accepted : rejected).push(f);

    // Tell the user what was dropped and ignored instead of discarding silently.
    if (rejected.length) {
      toast.warning(
        `${rejected.length} file(s) skipped — unsupported type`,
        `Bỏ qua: ${rejected.map((f) => f.name).join(', ')}`
      );
    }
    if (!accepted.length) return;

    if (multiple) {
      onFiles?.(accepted);
      return;
    }
    if (accepted.length > 1) {
      toast.info(
        `Only the first file was used: ${accepted[0].name}`,
        'Ô này chỉ nhận 1 file — các file còn lại đã bỏ qua'
      );
    }
    onFiles?.(accepted[0]);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cx(
        'border-2 border-dashed rounded-2xl transition-colors cursor-pointer flex flex-col items-center justify-center text-center',
        compact ? 'p-4' : 'p-10',
        drag ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-transparent hover:bg-gray-50',
        className
      )}
    >
      <IconCloudUpload size={compact ? 28 : 44} className="text-gray-400 mb-2" aria-hidden="true" />
      <div className="text-[13px] font-medium text-gray-700">
        {multiple ? 'Drop files here to upload' : 'Drop file here to upload'}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        {multiple ? 'Kéo thả nhiều file vào đây' : 'Kéo thả file vào đây'}
      </div>
      {hint && <div className="text-xs text-gray-600 mt-2">{hint}</div>}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="btn-secondary btn-sm mt-3"
      >
        {multiple ? 'Browse / Chọn file' : 'Browse / Chọn file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset so picking the same file again still fires onChange.
          e.target.value = '';
        }}
      />
    </div>
  );
}
