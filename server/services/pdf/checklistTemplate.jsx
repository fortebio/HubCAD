import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles, PALETTE, FONT } from './styles.js';
import { PageHeader, PageFooter, Watermark, MetaGrid } from './common.jsx';

const STATUS_COLOR = {
  ok: { bg: '#d1fae5', fg: '#065f46', label: 'OK' },
  ng: { bg: '#fee2e2', fg: '#991b1b', label: 'NG' },
};

const TITLE_BY_TYPE = {
  drawing: 'Drawing checklist',
  dfm: 'DFM / DFA review',
  release: 'Release checklist',
};

export function ChecklistPdf({ document, checklistType, sections = [], result, watermark = 'none' }) {
  const title = `${TITLE_BY_TYPE[checklistType] || 'Checklist'} — ${document.docNumber}`;
  const results = result?.results || {};

  const counts = sections.reduce(
    (acc, sec, sIdx) => {
      const items = sec.items || [];
      items.forEach((_, iIdx) => {
        const k = `${sec.audience ?? sIdx}-${iIdx}`;
        if (results[k] === 'ok') acc.ok++;
        else if (results[k] === 'ng') acc.ng++;
        acc.total++;
      });
      return acc;
    },
    { ok: 0, ng: 0, total: 0 }
  );

  return (
    <Document title={title} author="Drawing Tool">
      <Page size="A4" style={styles.page}>
        <PageHeader title={title} docNumber={document.docNumber} revision={document.revision} />
        <Watermark kind={watermark} />

        <Text style={styles.h1}>{TITLE_BY_TYPE[checklistType] || 'Checklist'}</Text>
        <Text style={styles.h1Sub}>
          {document.nameEn}
          {document.nameVn ? ` · ${document.nameVn}` : ''}
        </Text>

        <MetaGrid
          items={[
            { label: 'Doc number', value: document.docNumber, mono: true },
            { label: 'Revision', value: document.revision, mono: true },
            { label: 'Checklist type', value: checklistType?.toUpperCase() },
            { label: 'Overall', value: (result?.overall || '—').toUpperCase() },
            { label: 'OK', value: String(counts.ok) },
            { label: 'NG', value: String(counts.ng) },
            { label: 'Total items', value: String(counts.total) },
            { label: 'Checked at', value: result?.checkedAt ? new Date(result.checkedAt).toLocaleString('en-GB') : '—' },
          ]}
        />

        {sections.map((sec, sIdx) => (
          <View key={sIdx} wrap={false} style={{ marginBottom: 8 }}>
            <Text style={styles.h2}>
              {sec.title?.en || sec.title || ''}{' '}
              {sec.title?.vn && <Text style={{ color: PALETTE.textMuted, fontFamily: FONT.sans }}>· {sec.title.vn}</Text>}
            </Text>
            <View style={styles.table}>
              <View style={styles.trHeader}>
                <Text style={[styles.th, { width: '5%' }]}>#</Text>
                <Text style={[styles.th, { width: '47%' }]}>English</Text>
                <Text style={[styles.th, { width: '40%' }]}>Tiếng Việt</Text>
                <Text style={[styles.th, { width: '8%', textAlign: 'center' }]}>Result</Text>
              </View>
              {(sec.items || []).map((it, iIdx) => {
                const k = `${sec.audience ?? sIdx}-${iIdx}`;
                const v = results[k];
                const tone = v && STATUS_COLOR[v];
                return (
                  <View key={iIdx} style={[styles.tr, iIdx % 2 === 1 && { backgroundColor: PALETTE.rowZebra }]}>
                    <Text style={[styles.td, { width: '5%', textAlign: 'center' }]}>{iIdx + 1}</Text>
                    <Text style={[styles.td, { width: '47%' }]}>{it.en}</Text>
                    <Text style={[styles.td, { width: '40%', color: PALETTE.textMuted }]}>{it.vn}</Text>
                    <View style={{ width: '8%', justifyContent: 'center', alignItems: 'center' }}>
                      {tone ? (
                        <Text style={[styles.pill, { backgroundColor: tone.bg, color: tone.fg }]}>{tone.label}</Text>
                      ) : (
                        <Text style={{ fontSize: 8, color: PALETTE.textMuted }}>—</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {result?.remarks && (
          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: PALETTE.border }}>
            <Text style={styles.caption}>Remarks / Ghi chú</Text>
            <Text style={styles.body}>{result.remarks}</Text>
          </View>
        )}

        <PageFooter docNumber={document.docNumber} />
      </Page>
    </Document>
  );
}
