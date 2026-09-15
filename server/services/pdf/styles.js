import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StyleSheet, Font } from '@react-pdf/renderer';

// Resolve font files relative to this module so it works regardless of cwd.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, '..', '..', 'fonts');

// Register Be Vietnam Pro (covers full Vietnamese diacritics) as the body font
// and JetBrains Mono (also covers Vietnamese) for monospace cells.
// Built-in Helvetica / Courier in PDF cannot render combined Vietnamese tones
// (ấ, ề, ố, ự, ặ, ệ, ...), which is why text was rendering with the wrong
// or missing characters before this registration.
Font.register({
  family: 'BeVietnamPro',
  fonts: [
    { src: path.join(FONT_DIR, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-Medium.ttf'), fontWeight: 500 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-Italic.ttf'), fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'JetBrainsMono',
  fonts: [
    { src: path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'JetBrainsMono-Bold.ttf'), fontWeight: 700 },
  ],
});

// Alias the PDF built-in standard fonts to Vietnamese-capable fonts so that
// any internal react-pdf glyph fallback path also lands on Vietnamese.
// (react-pdf substitutes individual glyphs through Helvetica/Courier when a
//  glyph is missing from the subset; without this alias those glyphs would
//  render via the built-in PDF Type 1 fonts which have no Vietnamese coverage.)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: path.join(FONT_DIR, 'BeVietnamPro-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-Medium.ttf'), fontWeight: 500 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-Bold.ttf'), fontWeight: 700 },
    { src: path.join(FONT_DIR, 'BeVietnamPro-Italic.ttf'), fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Courier',
  fonts: [
    { src: path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'JetBrainsMono-Bold.ttf'), fontWeight: 700 },
  ],
});

// Disable hyphenation — the default callback can mangle Vietnamese words.
Font.registerHyphenationCallback((word) => [word]);

export const FONT = {
  sans: 'BeVietnamPro',
  mono: 'JetBrainsMono',
};

export const PALETTE = {
  primary: '#1a6ff5',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  borderStrong: '#9ca3af',
  watermarkRed: '#ef4444',
  watermarkAmber: '#f59e0b',
  watermarkGreen: '#10b981',
  watermarkGray: '#9ca3af',
  rowZebra: '#f9fafb',
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontFamily: FONT.sans,
    fontSize: 10,
    color: PALETTE.text,
    lineHeight: 1.4,
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    backgroundColor: '#ffffff',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBadge: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: PALETTE.primary,
    color: '#ffffff',
    fontSize: 9,
    fontFamily: FONT.sans,
    fontWeight: 700,
    textAlign: 'center',
    paddingTop: 5,
    marginRight: 6,
  },
  brandTitle: { fontSize: 10, fontFamily: FONT.sans, fontWeight: 700 },
  brandSub: { fontSize: 8, color: PALETTE.textMuted, marginLeft: 6, fontFamily: FONT.sans },
  headerMeta: { fontSize: 8, color: PALETTE.textMuted, textAlign: 'right', fontFamily: FONT.sans },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    fontFamily: FONT.sans,
    color: PALETTE.textMuted,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },
  footerCell: { fontSize: 8, fontFamily: FONT.sans, color: PALETTE.textMuted },

  watermark: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 84,
    fontFamily: FONT.sans,
    fontWeight: 700,
    opacity: 0.12,
    transform: 'rotate(-22deg)',
    letterSpacing: 4,
  },

  h1: { fontSize: 18, fontFamily: FONT.sans, fontWeight: 700, color: PALETTE.text, marginBottom: 2 },
  h1Sub: { fontSize: 10, color: PALETTE.textMuted, marginBottom: 12, fontFamily: FONT.sans },
  h2: {
    fontSize: 12,
    fontFamily: FONT.sans,
    fontWeight: 700,
    color: PALETTE.text,
    marginTop: 12,
    marginBottom: 6,
  },
  caption: { fontSize: 8, color: PALETTE.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: FONT.sans },

  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderColor: PALETTE.border,
    marginBottom: 14,
  },
  metaCell: {
    width: '25%',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: PALETTE.border,
  },
  metaLabel: { fontSize: 7, color: PALETTE.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2, fontFamily: FONT.sans },
  metaValue: { fontSize: 10, color: PALETTE.text, fontFamily: FONT.sans, fontWeight: 600 },
  metaValueMono: { fontSize: 10, color: PALETTE.primary, fontFamily: FONT.mono, fontWeight: 700 },

  table: { display: 'flex', flexDirection: 'column', width: '100%', marginBottom: 8 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: PALETTE.border },
  trHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderStrong,
    backgroundColor: PALETTE.rowZebra,
  },
  th: {
    fontSize: 8,
    fontFamily: FONT.sans,
    fontWeight: 700,
    color: PALETTE.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  td: { fontSize: 9, color: PALETTE.text, paddingVertical: 5, paddingHorizontal: 6, fontFamily: FONT.sans },
  tdMono: { fontSize: 9, color: PALETTE.primary, fontFamily: FONT.mono, fontWeight: 700, paddingVertical: 5, paddingHorizontal: 6 },

  pill: {
    fontSize: 8,
    fontFamily: FONT.sans,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  body: { fontSize: 10, color: PALETTE.text, lineHeight: 1.5, fontFamily: FONT.sans },
  bodyMuted: { fontSize: 9, color: PALETTE.textMuted, lineHeight: 1.5, fontFamily: FONT.sans },
});

export const WATERMARKS = {
  preliminary: { label: 'PRELIMINARY', color: PALETTE.watermarkAmber },
  for_production: { label: 'FOR PRODUCTION', color: PALETTE.watermarkRed },
  approved: { label: 'APPROVED', color: PALETTE.watermarkGreen },
  obsolete: { label: 'OBSOLETE', color: PALETTE.watermarkGray },
  none: null,
};

export function statusToWatermark(status) {
  if (status === 'draft' || status === 'in_review') return 'preliminary';
  if (status === 'approved') return 'approved';
  if (status === 'released') return 'for_production';
  if (status === 'obsolete') return 'obsolete';
  return 'none';
}
