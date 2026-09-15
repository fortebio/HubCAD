import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { styles, WATERMARKS } from './styles.js';

export function PageHeader({ title, docNumber, revision }) {
  return (
    <View style={styles.headerBar} fixed>
      <View style={styles.headerBrand}>
        <Text style={styles.brandBadge}>DT</Text>
        <Text style={styles.brandTitle}>Drawing Tool</Text>
        <Text style={styles.brandSub}>Forte Biotech</Text>
      </View>
      <View>
        <Text style={styles.headerMeta}>{title || ''}</Text>
        {(docNumber || revision) && (
          <Text style={styles.headerMeta}>
            {docNumber} {revision ? `· Rev ${revision}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

export function PageFooter({ docNumber, generatedAt }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerCell}>{docNumber || ''}</Text>
      <Text
        style={styles.footerCell}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
      <Text style={styles.footerCell}>
        Generated {generatedAt || new Date().toLocaleString('en-GB', { hour12: false })}
      </Text>
    </View>
  );
}

export function Watermark({ kind = 'none' }) {
  const wm = WATERMARKS[kind];
  if (!wm) return null;
  return (
    <Text style={[styles.watermark, { color: wm.color }]} fixed>
      {wm.label}
    </Text>
  );
}

export function MetaGrid({ items }) {
  return (
    <View style={styles.metaGrid}>
      {items.map((it, i) => (
        <View
          style={[
            styles.metaCell,
            i % 4 === 0 && { borderLeftWidth: 1, borderLeftColor: '#e5e7eb' },
          ]}
          key={i}
        >
          <Text style={styles.metaLabel}>{it.label}</Text>
          <Text style={it.mono ? styles.metaValueMono : styles.metaValue}>{it.value || '—'}</Text>
        </View>
      ))}
    </View>
  );
}
