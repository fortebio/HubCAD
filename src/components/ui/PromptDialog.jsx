import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const usePromptStore = create(() => ({ request: null }));

/**
 * Promise-based replacement for window.prompt(), with support for several
 * fields in one dialog instead of a chain of browser popups.
 *
 *   const values = await promptDialog({
 *     title: 'Snapshot BOM',
 *     fields: [{ name: 'revision', label: 'Revision', required: true }],
 *   });
 *   if (!values) return; // cancelled
 */
export function promptDialog({
  title,
  message,
  fields = [],
  confirmLabel = 'Save / Lưu',
  cancelLabel = 'Cancel / Hủy',
} = {}) {
  return new Promise((resolve) => {
    usePromptStore.setState({
      request: { title, message, fields, confirmLabel, cancelLabel, resolve },
    });
  });
}

/** Rendered once in the app shell. */
export function PromptHost() {
  const request = usePromptStore((s) => s.request);
  const [values, setValues] = useState({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!request) return;
    const initial = {};
    for (const f of request.fields) initial[f.name] = f.defaultValue ?? '';
    setValues(initial);
    setTouched(false);
  }, [request]);

  if (!request) return null;

  const missing = request.fields.filter((f) => f.required && !String(values[f.name] ?? '').trim());

  const settle = (result) => {
    request.resolve(result);
    usePromptStore.setState({ request: null });
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (missing.length) return;
    settle(values);
  };

  return (
    <Modal
      open
      onClose={() => settle(null)}
      title={request.title}
      subtitle={request.message}
      maxWidth="460px"
    >
      <form onSubmit={submit} className="space-y-4">
        {request.fields.map((f) => {
          const invalid = touched && f.required && !String(values[f.name] ?? '').trim();
          return (
            <div key={f.name}>
              <label htmlFor={`prompt-${f.name}`} className="label block mb-1.5">
                {f.label}
                {f.required && (
                  <span className="text-red-500 ml-0.5" aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              {f.multiline ? (
                <textarea
                  id={`prompt-${f.name}`}
                  className="input min-h-[72px]"
                  value={values[f.name] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              ) : (
                <input
                  id={`prompt-${f.name}`}
                  className={invalid ? 'input input-error' : 'input'}
                  value={values[f.name] ?? ''}
                  placeholder={f.placeholder}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? `prompt-${f.name}-error` : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                />
              )}
              {/* Error sits next to the field it belongs to, not in a summary. */}
              {invalid && (
                <div id={`prompt-${f.name}-error`} className="error-text">
                  Required / Bắt buộc
                </div>
              )}
              {f.hint && !invalid && <div className="hint">{f.hint}</div>}
            </div>
          );
        })}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => settle(null)}>
            {request.cancelLabel}
          </Button>
          <Button type="submit">{request.confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
