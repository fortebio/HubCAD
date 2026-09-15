import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles, PALETTE, FONT } from './styles.js';
import { PageHeader, PageFooter, Watermark, MetaGrid } from './common.jsx';
import { formatMoney } from '../../../src/lib/costing/format.js';

// Every Text must name a font family: the built-in Helvetica cannot render
// Vietnamese tone marks.
const SANS = { fontFamily: FONT.sans };
const SANS_BOLD = { fontFamily: FONT.sans, fontWeight: 700 };
const MONO = { fontFamily: FONT.mono };
const MONO_BOLD = { fontFamily: FONT.mono, fontWeight: 700 };

const COL = {
  no: '4%',
  part: '20%',
  process: '17%',
  material: '15%',
  mass: '9%',
  qty: '7%',
  unit: '13%',
  total: '15%',
};

export function QuotePdf({ quote, watermark = 'none' }) {
  const { meta, rows, totals } = quote;
  const commercial = { currency: meta.currency, usdRate: meta.usdRate };
  const money = (v) => formatMoney(v, commercial);
  const title = `Quotation ${meta.quoteNumber}`;

  return (
    <Document title={title} author="Drawing Tool">
      <Page size="A4" style={styles.page}>
        <PageHeader title="Quotation / Báo giá" docNumber={meta.quoteNumber} />
        <Watermark kind={watermark} />

        <Text style={[styles.h1, SANS_BOLD]}>{meta.title}</Text>
        <Text style={[styles.h1Sub, SANS]}>
          Báo giá gia công — ước tính từ mô hình 3D
        </Text>

        <MetaGrid
          items={[
            { label: 'Quote No. / Số báo giá', value: meta.quoteNumber, mono: true },
            { label: 'Customer / Khách hàng', value: meta.customer || '—' },
            { label: 'Project / Dự án', value: meta.project || '—' },
            { label: 'Date / Ngày', value: new Date(meta.createdAt).toLocaleDateString('en-GB') },
            { label: 'Sets / Số bộ', value: String(meta.sets), mono: true },
            { label: 'Parts / Số chi tiết', value: String(totals.partCount), mono: true },
            { label: 'Lead time / Giao hàng', value: `${totals.leadDays || 0} days` },
            { label: 'Valid / Hiệu lực', value: `${meta.validDays} days` },
          ]}
        />

        <Text style={[styles.h2, SANS_BOLD]}>Parts / Danh mục chi tiết</Text>

        <View style={styles.table}>
          <View style={styles.trHeader} fixed>
            <Text style={[styles.th, SANS_BOLD, { width: COL.no }]}>#</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.part }]}>Part / Chi tiết</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.process }]}>Process / Gia công</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.material }]}>Material / Vật liệu</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.mass, textAlign: 'right' }]}>Mass</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.qty, textAlign: 'right' }]}>Qty</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.unit, textAlign: 'right' }]}>Unit</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.total, textAlign: 'right' }]}>Total</Text>
          </View>

          {rows.map((r, idx) => (
            <View
              key={r.index}
              style={[styles.tr, idx % 2 === 1 && { backgroundColor: PALETTE.rowZebra }]}
              wrap={false}
            >
              <Text style={[styles.td, SANS, { width: COL.no, textAlign: 'right' }]}>{r.index}</Text>
              <View style={{ width: COL.part, paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={[SANS, { fontSize: 9 }]}>{r.name}</Text>
                {r.dimsMm.length === 3 && (
                  <Text style={[MONO, { fontSize: 7, color: PALETTE.textMuted }]}>
                    {r.dimsMm.map((d) => d.toFixed(1)).join(' × ')} mm
                  </Text>
                )}
              </View>
              <View style={{ width: COL.process, paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={[SANS, { fontSize: 9 }]}>{r.processEn}</Text>
                {!!r.processVn && (
                  <Text style={[SANS, { fontSize: 7, color: PALETTE.textMuted }]}>{r.processVn}</Text>
                )}
              </View>
              <View style={{ width: COL.material, paddingVertical: 5, paddingHorizontal: 6 }}>
                <Text style={[SANS, { fontSize: 9 }]}>{r.materialEn}</Text>
                {!!r.finishEn && (
                  <Text style={[SANS, { fontSize: 7, color: PALETTE.textMuted }]}>{r.finishEn}</Text>
                )}
              </View>
              <Text style={[styles.td, MONO, { width: COL.mass, textAlign: 'right' }]}>
                {r.massG >= 1000 ? `${(r.massG / 1000).toFixed(2)} kg` : `${r.massG.toFixed(1)} g`}
              </Text>
              <Text style={[styles.td, MONO, { width: COL.qty, textAlign: 'right' }]}>{r.qty}</Text>
              <Text style={[styles.td, MONO, { width: COL.unit, textAlign: 'right' }]}>
                {money(r.unitPrice)}
              </Text>
              <Text style={[styles.td, MONO_BOLD, { width: COL.total, textAlign: 'right' }]}>
                {money(r.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }} wrap={false}>
          <View style={{ width: '52%' }}>
            <TotalRow label="Subtotal / Tạm tính" value={money(totals.subtotal)} />
            {meta.applyVat && (
              <TotalRow label={`VAT ${meta.vatPct}%`} value={money(totals.vat)} />
            )}
            <TotalRow
              label={`TOTAL / TỔNG CỘNG (${meta.currency})`}
              value={money(totals.grandTotal)}
              strong
            />
            <TotalRow label={`Per set / Mỗi bộ (× ${meta.sets})`} value={money(totals.pricePerSet)} />
            <TotalRow
              label="Mass per set / Khối lượng mỗi bộ"
              value={
                totals.massPerSetG >= 1000
                  ? `${(totals.massPerSetG / 1000).toFixed(2)} kg`
                  : `${totals.massPerSetG.toFixed(1)} g`
              }
            />
          </View>
        </View>

        <Text style={[styles.h2, SANS_BOLD]}>Notes / Ghi chú</Text>
        {!!meta.notesEn && <Text style={[styles.body, SANS]}>{meta.notesEn}</Text>}
        {!!meta.notesVn && <Text style={[styles.bodyMuted, SANS]}>{meta.notesVn}</Text>}
        <Text style={[styles.bodyMuted, SANS, { marginTop: 4 }]}>
          Prices are estimated from 3D geometry (volume, surface area, bounding stock) using the
          current shop rate card. Tolerances, threads, inserts, assembly and shipping are quoted
          separately unless stated.
        </Text>
        <Text style={[styles.bodyMuted, SANS]}>
          Giá được ước tính từ hình học 3D (thể tích, diện tích bề mặt, phôi bao) theo bảng đơn giá
          hiện hành. Dung sai, ren, bạc cấy, lắp ráp và vận chuyển được báo riêng nếu không ghi rõ.
        </Text>

        {rows.some((r) => r.warnings.length) && (
          <>
            <Text style={[styles.h2, SANS_BOLD]}>Manufacturing notes / Lưu ý gia công</Text>
            {rows
              .filter((r) => r.warnings.length)
              .map((r) => (
                <View key={`w-${r.index}`} style={{ marginBottom: 4 }} wrap={false}>
                  <Text style={[SANS_BOLD, { fontSize: 9 }]}>{r.name}</Text>
                  {r.warnings.map((w, i) => (
                    <Text key={i} style={[styles.bodyMuted, SANS]}>
                      • {w.en}
                      {w.vn ? ` — ${w.vn}` : ''}
                    </Text>
                  ))}
                </View>
              ))}
          </>
        )}

        <View style={{ flexDirection: 'row', marginTop: 18 }} wrap={false}>
          <SignBlock label="Prepared by / Người lập" name={meta.preparedBy} />
          <SignBlock label="Approved by / Người duyệt" name="" />
          <SignBlock label="Customer / Khách hàng" name={meta.customer} />
        </View>

        <PageFooter docNumber={meta.quoteNumber} />
      </Page>
    </Document>
  );
}

function TotalRow({ label, value, strong = false }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderBottomWidth: 0.5,
        borderBottomColor: PALETTE.border,
        backgroundColor: strong ? '#eff6ff' : undefined,
      }}
    >
      <Text style={[SANS, { fontSize: strong ? 10 : 9, fontWeight: strong ? 700 : 400 }]}>
        {label}
      </Text>
      <Text style={[MONO_BOLD, { fontSize: strong ? 11 : 9, color: strong ? PALETTE.primary : PALETTE.text }]}>
        {value}
      </Text>
    </View>
  );
}

function SignBlock({ label, name }) {
  return (
    <View style={{ width: '33%', paddingRight: 10 }}>
      <Text style={[styles.caption, SANS]}>{label}</Text>
      <View style={{ height: 40 }} />
      <View style={{ borderTopWidth: 0.5, borderTopColor: PALETTE.borderStrong, paddingTop: 3 }}>
        <Text style={[SANS, { fontSize: 8, color: PALETTE.textMuted }]}>{name || ' '}</Text>
      </View>
    </View>
  );
}
