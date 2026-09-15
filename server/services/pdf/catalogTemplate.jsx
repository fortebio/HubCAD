import React from 'react';
import path from 'node:path';
import fs from 'node:fs';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles, PALETTE, FONT } from './styles.js';
import { PageHeader, PageFooter, Watermark } from './common.jsx';

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

function resolveImage(p) {
  if (!p) return null;
  const stripped = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p;
  const abs = path.join(UPLOAD_DIR, stripped);
  return fs.existsSync(abs) ? abs : null;
}

export function CatalogPdf({ document, data = {}, watermark = 'none' }) {
  const title = data.productNameEn || `Catalog — ${document.docNumber}`;
  const heroAbs = resolveImage(data.heroImage);

  return (
    <Document title={title} author="Drawing Tool">
      <Page size="A4" style={styles.page}>
        <PageHeader title={title} docNumber={document.docNumber} revision={document.revision} />
        <Watermark kind={watermark} />

        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.h1, { fontSize: 22 }]}>{data.productNameEn || document.nameEn}</Text>
            {(data.productNameVn || document.nameVn) && (
              <Text style={styles.h1Sub}>{data.productNameVn || document.nameVn}</Text>
            )}
            {data.tagline && (
              <Text style={{ fontSize: 11, fontStyle: 'italic', color: PALETTE.primary, marginTop: 4, marginBottom: 6 }}>
                {data.tagline}
              </Text>
            )}
            {data.description && <Text style={styles.body}>{data.description}</Text>}
          </View>
          {heroAbs && (
            <View style={{ width: 200 }}>
              <Image src={heroAbs} style={{ width: 200, height: 130, objectFit: 'contain' }} />
            </View>
          )}
        </View>

        {Array.isArray(data.features) && data.features.filter((f) => f.en).length > 0 && (
          <>
            <Text style={styles.h2}>Key features / Tính năng nổi bật</Text>
            <View style={{ marginBottom: 8 }}>
              {data.features.filter((f) => f.en).map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  <Text style={{ width: 12, color: PALETTE.primary, fontFamily: FONT.sans, fontWeight: 700 }}>•</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10 }}>{f.en}</Text>
                    {f.vn && <Text style={{ fontSize: 9, color: PALETTE.textMuted }}>{f.vn}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {Array.isArray(data.specs) && data.specs.filter((s) => s.key).length > 0 && (
          <>
            <Text style={styles.h2}>Specifications / Thông số kỹ thuật</Text>
            <View style={styles.table}>
              {data.specs.filter((s) => s.key).map((s, i) => (
                <View key={i} style={[styles.tr, i % 2 === 1 && { backgroundColor: PALETTE.rowZebra }]} wrap={false}>
                  <Text style={[styles.td, { width: '32%', color: PALETTE.textMuted }]}>{s.key}</Text>
                  <Text style={[styles.td, { width: '36%', fontFamily: FONT.sans, fontWeight: 700 }]}>{s.valueEn || '—'}</Text>
                  <Text style={[styles.td, { width: '32%', color: PALETTE.textMuted }]}>{s.valueVn || ''}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {(data.certifications || data.warranty) && (
          <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: PALETTE.border }}>
            {data.certifications && (
              <Text style={styles.bodyMuted}>
                Certifications: <Text style={{ color: PALETTE.text }}>{data.certifications}</Text>
              </Text>
            )}
            {data.warranty && (
              <Text style={styles.bodyMuted}>
                Warranty / Bảo hành: <Text style={{ color: PALETTE.text }}>{data.warranty}</Text>
              </Text>
            )}
          </View>
        )}

        <PageFooter docNumber={document.docNumber} />
      </Page>
    </Document>
  );
}
