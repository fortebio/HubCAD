import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { CheckItem } from '@/components/ui/CheckItem';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconDownload, IconDeviceFloppy } from '@tabler/icons-react';

function flatKey(secIdx, itemIdx) {
  return `${secIdx}-${itemIdx}`;
}

export function ChecklistRunner({ title, sections, totalItems, initialResults = {}, onSave, savedAt }) {
  const [results, setResults] = useState(initialResults);
  const [remarks, setRemarks] = useState('');

  const stats = useMemo(() => {
    const entries = Object.values(results);
    const ok = entries.filter((v) => v === 'ok').length;
    const ng = entries.filter((v) => v === 'ng').length;
    return { ok, ng, done: ok + ng, total: totalItems };
  }, [results, totalItems]);

  const overall = stats.ng > 0 ? 'fail' : stats.ok === stats.total ? 'pass' : 'conditional';

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[15px] font-semibold text-gray-800">{title}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {stats.ok} OK · {stats.ng} NG · {stats.done} / {stats.total} done
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge status={overall} />
            <Button variant="secondary" size="sm">
              <IconDownload size={14} /> Export PDF
            </Button>
            <Button
              size="sm"
              onClick={() => onSave?.({ results, remarks, overall })}
            >
              <IconDeviceFloppy size={14} /> Save / Lưu
            </Button>
          </div>
        </div>
        <ProgressBar value={stats.done} max={stats.total} color={overall === 'fail' ? 'danger' : 'success'} />
        {savedAt && (
          <div className="text-[11px] text-gray-400 mt-2">
            Last saved: {new Date(savedAt).toLocaleString()}
          </div>
        )}
      </Card>

      {sections.map((sec, sIdx) => (
        <Card key={sIdx}>
          <CardHeader title={sec.title.en} subtitle={sec.title.vn} />
          <div>
            {sec.items.map((it, iIdx) => {
              const key = flatKey(sIdx, iIdx);
              return (
                <CheckItem
                  key={key}
                  index={iIdx + 1}
                  en={it.en}
                  vn={it.vn}
                  value={results[key] || null}
                  onChange={(v) => setResults((prev) => ({ ...prev, [key]: v }))}
                />
              );
            })}
          </div>
        </Card>
      ))}

      <Card>
        <label className="label">Remarks / Ghi chú</label>
        <textarea
          className="input mt-2 min-h-[72px]"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional notes about NG items or required follow-up"
        />
      </Card>
    </div>
  );
}
