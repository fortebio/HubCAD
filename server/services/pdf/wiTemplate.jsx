import React from 'react';
import path from 'node:path';
import fs from 'node:fs';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles, PALETTE, FONT } from './styles.js';
import { PageHeader, PageFooter, Watermark, MetaGrid } from './common.jsx';

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

function resolveImage(p) {
  if (!p) return null;
  const stripped = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p;
  const abs = path.join(UPLOAD_DIR, stripped);
  return fs.existsSync(abs) ? abs : null;
}

export function WIDocumentPdf({ document, meta = {}, steps = [], watermark = 'none' }) {
  const title = meta.titleEn || `WI — ${document.docNumber}`;
  return (
    <Document title={title} author="Drawing Tool">
      <Page size="A4" style={styles.page}>
        <PageHeader title={title} docNumber={document.docNumber} revision={document.revision} />
        <Watermark kind={watermark} />

        <Text style={styles.h1}>{meta.titleEn || document.nameEn}</Text>
        {(meta.titleVn || document.nameVn) && (
          <Text style={styles.h1Sub}>{meta.titleVn || document.nameVn}</Text>
        )}

        <MetaGrid
          items={[
            { label: 'Doc number', value: document.docNumber, mono: true },
            { label: 'Revision', value: document.revision, mono: true },
            { label: 'Station', value: meta.station },
            { label: 'Cycle time', value: meta.cycleTime },
            { label: 'Steps', value: String(steps.length) },
            { label: 'Status', value: document.status?.replace('_', ' ').toUpperCase() },
            { label: 'Watermark', value: watermark === 'none' ? '—' : watermark.toUpperCase() },
            { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
          ]}
        />

        <Text style={styles.h2}>Procedure / Trình tự</Text>

        {steps.length === 0 ? (
          <Text style={styles.bodyMuted}>No steps defined yet.</Text>
        ) : (
          steps.map((step, idx) => {
            const imgAbs = resolveImage(step.imagePath);
            return (
              <View
                key={step.id || idx}
                wrap={false}
                style={{
                  flexDirection: 'row',
                  marginBottom: 10,
                  borderBottomWidth: 0.5,
                  borderBottomColor: PALETTE.border,
                  paddingBottom: 8,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: PALETTE.primary,
                    marginRight: 10,
                    paddingTop: 4,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontFamily: FONT.sans, fontWeight: 700, textAlign: 'center' }}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  {(step.titleEn || step.titleVn) && (
                    <View style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: FONT.sans, fontWeight: 700 }}>{step.titleEn || ''}</Text>
                      {step.titleVn && (
                        <Text style={{ fontSize: 9, color: PALETTE.textMuted }}>{step.titleVn}</Text>
                      )}
                    </View>
                  )}
                  {step.bodyEn && <Text style={{ fontSize: 10, marginBottom: 2 }}>{step.bodyEn}</Text>}
                  {step.bodyVn && <Text style={{ fontSize: 9, color: PALETTE.textMuted, marginBottom: 4 }}>{step.bodyVn}</Text>}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {step.tools && (
                      <Text style={{ fontSize: 8, marginRight: 12, color: PALETTE.textMuted }}>
                        Tools / Dụng cụ: <Text style={{ color: PALETTE.text }}>{step.tools}</Text>
                      </Text>
                    )}
                    {step.caution && (
                      <Text style={{ fontSize: 8, color: '#b91c1c' }}>
                        ⚠ Caution / Lưu ý: <Text style={{ fontFamily: FONT.sans, fontWeight: 700 }}>{step.caution}</Text>
                      </Text>
                    )}
                  </View>
                </View>
                {imgAbs && (
                  <View style={{ width: 130, marginLeft: 10 }}>
                    <Image src={imgAbs} style={{ width: 130, height: 90, objectFit: 'contain' }} />
                  </View>
                )}
              </View>
            );
          })
        )}

        <PageFooter docNumber={document.docNumber} />
      </Page>
    </Document>
  );
}
