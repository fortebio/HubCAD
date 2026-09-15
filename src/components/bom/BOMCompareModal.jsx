import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { Empty } from '@/components/ui/Empty';
import { api, apiPaths } from '@/lib/api';
import { cx } from '@/lib/cx';
import { IconArrowRight, IconPlus, IconMinus, IconRefresh } from '@tabler/icons-react';

export function BOMCompareModal({ open, onClose, bomId, currentRevision }) {
  const [snapshots, setSnapshots] = useState([]);
  const [base, setBase] = useState('');
  const [target, setTarget] = useState('current');
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !bomId) return;
    setError(null);
    setDiff(null);
    api
      .get(apiPaths.bomSnapshots(bomId))
      .then((res) => {
        setSnapshots(res.snapshots || []);
        if (res.snapshots?.length) setBase(String(res.snapshots[0].id));
      })
      .catch((e) => setError(e.message));
  }, [open, bomId]);

  async function runCompare() {
    if (!base) {
      setError('Pick a base revision to compare from');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(apiPaths.bomCompare(bomId, base, target));
      setDiff(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    if (!diff) return null;
    return {
      added: diff.diff.added.length,
      removed: diff.diff.removed.length,
      changed: diff.diff.changed.length,
      unchanged: diff.diff.unchanged.length,
      costDelta: diff.costDelta,
    };
  }, [diff]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare BOM revisions"
      subtitle="So sánh hai phiên bản BOM"
      maxWidth="900px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={runCompare} disabled={loading || !base}>
            <IconRefresh size={14} /> Compare
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <label className="label">Base / Phiên bản gốc</label>
            <select className="input mt-1" value={base} onChange={(e) => setBase(e.target.value)}>
              <option value="">— Select snapshot —</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  Rev {s.revision} · {new Date(s.snapshottedAt).toLocaleDateString()} · {s.itemCount} items
                </option>
              ))}
            </select>
          </div>
          <IconArrowRight size={20} className="text-gray-400 mb-2.5" />
          <div>
            <label className="label">Target / Phiên bản đích</label>
            <select className="input mt-1" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="current">Current (Rev {currentRevision || '-'})</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  Rev {s.revision} · {new Date(s.snapshottedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        {!snapshots.length && (
          <Empty
            title="No snapshots yet"
            hint="Create a snapshot first (Save snapshot button on BOM page) before comparing."
          />
        )}

        {counts && (
          <>
            <div className="grid grid-cols-4 gap-2 my-3">
              <Stat tone="success" label="Added" value={counts.added} />
              <Stat tone="danger" label="Removed" value={counts.removed} />
              <Stat tone="warning" label="Changed" value={counts.changed} />
              <Stat tone="primary" label="Cost Δ" value={`${counts.costDelta >= 0 ? '+' : ''}${counts.costDelta.toFixed(2)}`} />
            </div>

            {counts.added + counts.removed + counts.changed === 0 ? (
              <div className="text-center text-xs text-gray-400 py-8">
                Identical — no changes between these revisions.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto border border-gray-200 rounded-lg">
                <Table>
                  <THead>
                    <TR>
                      <TH>Change</TH>
                      <TH>Part No.</TH>
                      <TH>Description</TH>
                      <TH>Details</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {diff.diff.added.map((it, i) => (
                      <TR key={`a${i}`}>
                        <TD>
                          <span className="badge bg-emerald-100 text-emerald-800">
                            <IconPlus size={10} /> Added
                          </span>
                        </TD>
                        <TD mono>{it.partNumber}</TD>
                        <TD>
                          <div>{it.descEn}</div>
                          {it.descVn && <div className="text-[11px] text-gray-500">{it.descVn}</div>}
                        </TD>
                        <TD className="text-xs text-gray-600">
                          Qty {it.qty} {it.unit} · ${(Number(it.unitCost) || 0).toFixed(2)}
                        </TD>
                      </TR>
                    ))}
                    {diff.diff.removed.map((it, i) => (
                      <TR key={`r${i}`}>
                        <TD>
                          <span className="badge bg-red-100 text-red-800">
                            <IconMinus size={10} /> Removed
                          </span>
                        </TD>
                        <TD mono>{it.partNumber}</TD>
                        <TD>
                          <div>{it.descEn}</div>
                          {it.descVn && <div className="text-[11px] text-gray-500">{it.descVn}</div>}
                        </TD>
                        <TD className="text-xs text-gray-600">
                          Was qty {it.qty} {it.unit}
                        </TD>
                      </TR>
                    ))}
                    {diff.diff.changed.map((c, i) => (
                      <TR key={`c${i}`}>
                        <TD>
                          <span className="badge bg-amber-100 text-amber-800">Changed</span>
                        </TD>
                        <TD mono>{c.partNumber}</TD>
                        <TD>
                          <div>{c.after.descEn || c.before.descEn}</div>
                        </TD>
                        <TD>
                          <div className="text-xs space-y-1">
                            {Object.entries(c.fields).map(([k, v]) => (
                              <div key={k} className="font-mono">
                                <span className="text-gray-500">{k}:</span>{' '}
                                <span className="text-red-600 line-through">{String(v.before)}</span>{' '}
                                <span className="text-gray-400">→</span>{' '}
                                <span className="text-emerald-700">{String(v.after)}</span>
                              </div>
                            ))}
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ tone, label, value }) {
  const cls = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
  }[tone];
  return (
    <div className={cx('rounded-lg border px-3 py-2', cls)}>
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
      <div className="text-[18px] font-bold mono">{value}</div>
    </div>
  );
}
