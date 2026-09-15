import { useEffect, useState } from 'react';
import { useDocStore } from '@/stores/useDocStore';

export function DocumentPicker({ value, onChange, filterType, className = '' }) {
  const docs = useDocStore((s) => s.documents);
  const fetchAll = useDocStore((s) => s.fetchAll);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (docs.length === 0) {
      fetchAll().finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [docs.length, fetchAll]);

  const filtered = filterType ? docs.filter((d) => d.docType === filterType) : docs;

  return (
    <select
      className={`input ${className}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">— Select document / Chọn tài liệu —</option>
      {filtered.map((d) => (
        <option key={d.id} value={d.id}>
          {d.docNumber} · {d.nameEn} (Rev {d.revision}, {d.status})
        </option>
      ))}
    </select>
  );
}
