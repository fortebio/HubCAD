import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Table, THead, TR, TH, TD } from '@/components/ui/Table';
import { LAYERS, layerById } from '@/lib/assemblyLayers';
import { parsePartNumber } from '@/lib/partNumber';
import { writePref } from '@/lib/localMemory';
import { formatMass } from '@/lib/costing/format';
import { toast } from '@/stores/useToastStore';
import { IconClipboardCopy, IconListDetails } from '@tabler/icons-react';

/** Where the BOM Manager looks for rows handed over from the viewer. */
export const BOM_HANDOFF_KEY = 'bom:handoff';

// Layers whose parts are bought, not made: no material is assumed for them.
const BOUGHT = new Set(['fastener', 'purchased', 'pcb', 'cable', 'label']);

/**
 * Collapse placed bodies into BOM lines: the same body name placed six times
 * is one line with qty 6 — exactly how the STEP tree instances it.
 */
export function aggregateAssembly(models, statsById, material) {
  const groups = new Map();
  for (const m of models) {
    const key = m.name.trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { name: m.name.trim(), layer: m.layer || 'other', qty: 0, sample: m, ids: [] });
    }
    const g = groups.get(key);
    g.qty += 1;
    g.ids.push(m.id);
  }
  const order = LAYERS.map((l) => l.id);
  return [...groups.values()]
    .map((g) => {
      const stats = statsById[g.sample.id];
      const massG = stats && material ? (stats.volumeMm3 / 1000) * material.density : null;
      const parsed = parsePartNumber(g.name.split(/[\s_]/)[0]);
      return {
        ...g,
        partNumber: parsed ? g.name.split(/[\s_]/)[0] : '',
        massG,
        size: g.sample.bbox.size,
        materialLabel: material && !BOUGHT.has(g.layer) ? `${material.en} / ${material.vn}` : '',
      };
    })
    .sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer) || b.qty - a.qty);
}

function toBomRows(rows, sourceFile) {
  return rows.map((r, i) => ({
    itemNo: i + 1,
    level: 1,
    partNumber: r.partNumber,
    descEn: r.name,
    descVn: '',
    qty: r.qty,
    unit: 'pcs',
    material: r.materialLabel,
    vendor: '',
    unitCost: 0,
    leadTime: '',
    remarks: [
      layerById(r.layer).en,
      r.massG != null ? `${r.massG.toFixed(1)} g ea` : null,
      `${r.size.x.toFixed(1)}×${r.size.y.toFixed(1)}×${r.size.z.toFixed(1)} mm`,
      sourceFile ? `from ${sourceFile}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

export function AssemblyBOMModal({ open, onClose, models, statsById, material, sourceFile }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const rows = useMemo(
    () => (open ? aggregateAssembly(models, statsById, material) : []),
    [open, models, statsById, material]
  );

  const totals = useMemo(() => {
    const pieces = rows.reduce((n, r) => n + r.qty, 0);
    const massG = rows.reduce((n, r) => n + (r.massG != null ? r.massG * r.qty : 0), 0);
    const hasMass = rows.some((r) => r.massG != null);
    return { lines: rows.length, pieces, massG, hasMass };
  }, [rows]);

  async function copyCsv() {
    const header = ['Item', 'Part number', 'Description', 'System', 'Qty', 'Unit mass (g)', 'Size (mm)'];
    const lines = rows.map((r, i) =>
      [
        i + 1,
        r.partNumber,
        r.name,
        layerById(r.layer).en,
        r.qty,
        r.massG != null ? r.massG.toFixed(2) : '',
        `${r.size.x.toFixed(1)}x${r.size.y.toFixed(1)}x${r.size.z.toFixed(1)}`,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    try {
      await navigator.clipboard.writeText([header.join(','), ...lines].join('\n'));
      toast.success('BOM copied as CSV', 'Đã sao chép BOM dạng CSV');
    } catch {
      toast.error('Clipboard unavailable', 'Không truy cập được clipboard');
    }
  }

  function sendToBom() {
    setBusy(true);
    const ok = writePref(BOM_HANDOFF_KEY, {
      savedAt: new Date().toISOString(),
      source: sourceFile,
      rows: toBomRows(rows, sourceFile),
    });
    setBusy(false);
    if (!ok) {
      toast.error('Could not hand the rows over', 'Không lưu được dữ liệu tạm trên máy này');
      return;
    }
    onClose();
    navigate('/bom');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="BOM from assembly / BOM từ cụm lắp ráp"
      subtitle={`${totals.lines} lines · ${totals.pieces} pieces${
        totals.hasMass ? ` · ${formatMass(totals.massG)}` : ''
      } — ${totals.lines} dòng · ${totals.pieces} chi tiết`}
      maxWidth="860px"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="text-[11px] text-gray-600">
            Quantities come from how many times each body is placed in the CAD tree.
            <span className="block">Số lượng lấy từ số lần chi tiết xuất hiện trong cây lắp ráp.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={copyCsv} disabled={!rows.length}>
              <IconClipboardCopy size={14} aria-hidden="true" /> Copy CSV
            </Button>
            <Button size="sm" onClick={sendToBom} disabled={!rows.length} loading={busy}>
              <IconListDetails size={14} aria-hidden="true" /> Open in BOM Manager / Mở trong BOM
            </Button>
          </div>
        </div>
      }
    >
      <Table stickyHeader maxHeight="60vh" label="Assembly bill of materials">
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Part / Chi tiết</TH>
            <TH>System / Hệ</TH>
            <TH className="text-right">Qty / SL</TH>
            <TH className="text-right">Mass ea / KL</TH>
            <TH className="text-right">Total / Tổng</TH>
            <TH>Size (mm)</TH>
          </TR>
        </THead>
        <tbody>
          {rows.map((r, i) => {
            const layer = layerById(r.layer);
            return (
              <tr key={r.name} className="border-b border-gray-100">
                <TD mono>{i + 1}</TD>
                <TD>
                  <div className="text-[13px] text-gray-900">{r.name}</div>
                  {r.sample.path?.length > 0 && (
                    <div className="text-[10px] text-gray-600 truncate max-w-[280px]" title={r.sample.path.join(' › ')}>
                      {r.sample.path.join(' › ')}
                    </div>
                  )}
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-800">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: layer.color }} aria-hidden="true" />
                    {layer.en}
                    <span className="text-gray-600">/ {layer.vn}</span>
                  </span>
                </TD>
                <TD mono className="text-right">{r.qty}</TD>
                <TD mono className="text-right">{r.massG != null ? formatMass(r.massG) : '—'}</TD>
                <TD mono className="text-right">{r.massG != null ? formatMass(r.massG * r.qty) : '—'}</TD>
                <TD mono className="text-[11px]">
                  {r.size.x.toFixed(1)} × {r.size.y.toFixed(1)} × {r.size.z.toFixed(1)}
                </TD>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Modal>
  );
}
