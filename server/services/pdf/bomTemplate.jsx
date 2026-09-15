import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles, PALETTE, FONT } from './styles.js';
import { PageHeader, PageFooter, Watermark, MetaGrid } from './common.jsx';

const COL = {
  no: '4%',
  level: '5%',
  part: '15%',
  desc: '30%',
  qty: '6%',
  unit: '6%',
  mat: '12%',
  vendor: '12%',
  unitCost: '5%',
  subtotal: '5%',
};

const SANS = { fontFamily: FONT.sans };
const SANS_BOLD = { fontFamily: FONT.sans, fontWeight: 700 };
const MONO = { fontFamily: FONT.mono };
const MONO_BOLD = { fontFamily: FONT.mono, fontWeight: 700 };

export function BOMDocument({ document, header, items, watermark = 'none' }) {
  const totalCost = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);
  const title = `BOM — ${header?.assemblyNo || document.docNumber}`;
  return (
    <Document title={title} author="Drawing Tool">
      <Page size="A4" style={styles.page}>
        <PageHeader title={title} docNumber={document.docNumber} revision={header?.revision || document.revision} />
        <Watermark kind={watermark} />

        <Text style={[styles.h1, SANS_BOLD]}>{document.nameEn || title}</Text>
        {document.nameVn && <Text style={[styles.h1Sub, SANS]}>{document.nameVn}</Text>}

        <MetaGrid
          items={[
            { label: 'Doc number', value: document.docNumber, mono: true },
            { label: 'Assembly No.', value: header?.assemblyNo, mono: true },
            { label: 'Revision', value: header?.revision || document.revision, mono: true },
            { label: 'Status', value: document.status?.replace('_', ' ').toUpperCase() },
            { label: 'Total items', value: String(items.length) },
            { label: 'Total cost', value: `$${totalCost.toFixed(2)}` },
            { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
            { label: 'Watermark', value: watermark === 'none' ? '—' : watermark.toUpperCase() },
          ]}
        />

        <Text style={[styles.h2, SANS_BOLD]}>Items / Danh mục vật liệu</Text>

        <View style={styles.table}>
          <View style={styles.trHeader} fixed>
            <Text style={[styles.th, SANS_BOLD, { width: COL.no }]}>#</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.level }]}>Lv</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.part }]}>Part No.</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.desc }]}>Description</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.qty, textAlign: 'right' }]}>Qty</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.unit }]}>Unit</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.mat }]}>Material</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.vendor }]}>Vendor</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.unitCost, textAlign: 'right' }]}>$/u</Text>
            <Text style={[styles.th, SANS_BOLD, { width: COL.subtotal, textAlign: 'right' }]}>Sub</Text>
          </View>
          {items.map((it, idx) => {
            const sub = (Number(it.unitCost) || 0) * (Number(it.qty) || 0);
            return (
              <View
                key={it.id || idx}
                style={[styles.tr, idx % 2 === 1 && { backgroundColor: PALETTE.rowZebra }]}
                wrap={false}
              >
                <Text style={[styles.td, SANS, { width: COL.no, textAlign: 'right' }]}>{idx + 1}</Text>
                <Text style={[styles.td, SANS, { width: COL.level }]}>{it.level}</Text>
                <Text style={[styles.tdMono, MONO_BOLD, { width: COL.part, paddingLeft: 6 + (it.level || 0) * 8 }]}>{it.partNumber}</Text>
                <View style={{ width: COL.desc, paddingVertical: 5, paddingHorizontal: 6 }}>
                  <Text style={[SANS, { fontSize: 9 }]}>{it.descEn}</Text>
                  {it.descVn && (
                    <Text style={[SANS, { fontSize: 8, color: PALETTE.textMuted }]}>{it.descVn}</Text>
                  )}
                </View>
                <Text style={[styles.td, MONO, { width: COL.qty, textAlign: 'right' }]}>{it.qty}</Text>
                <Text style={[styles.td, SANS, { width: COL.unit }]}>{it.unit || ''}</Text>
                <Text style={[styles.td, SANS, { width: COL.mat }]}>{it.material || '—'}</Text>
                <Text style={[styles.td, SANS, { width: COL.vendor }]}>{it.vendor || '—'}</Text>
                <Text style={[styles.td, MONO, { width: COL.unitCost, textAlign: 'right' }]}>
                  {it.unitCost != null ? Number(it.unitCost).toFixed(2) : '—'}
                </Text>
                <Text style={[styles.td, MONO_BOLD, { width: COL.subtotal, textAlign: 'right' }]}>
                  {sub.toFixed(2)}
                </Text>
              </View>
            );
          })}
          <View style={[styles.tr, { backgroundColor: '#eff6ff' }]} wrap={false}>
            <Text style={[styles.td, SANS_BOLD, { width: '90%', textAlign: 'right' }]}>Total</Text>
            <Text style={[styles.td, MONO_BOLD, { width: '10%', textAlign: 'right' }]}>{totalCost.toFixed(2)}</Text>
          </View>
        </View>

        <PageFooter docNumber={document.docNumber} />
      </Page>
    </Document>
  );
}
