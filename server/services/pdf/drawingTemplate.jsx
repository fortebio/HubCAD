import React from 'react';
import path from 'node:path';
import fs from 'node:fs';
import { Document, Page, Text, View, Image, Svg, Circle, Line, Polygon, G, Rect } from '@react-pdf/renderer';
import { styles, PALETTE, FONT } from './styles.js';
import { PageHeader, PageFooter, Watermark } from './common.jsx';
import { getTemplate, DEFAULT_TEMPLATE_ID } from './drawingTemplates/index.js';

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

function resolveImage(p) {
  if (!p) return null;
  const stripped = p.startsWith('/uploads/') ? p.slice('/uploads/'.length) : p;
  const abs = path.join(UPLOAD_DIR, stripped);
  return fs.existsSync(abs) ? abs : null;
}

const VIEW_LABELS = {
  viewFront: { en: 'FRONT', vn: 'Hình chiếu đứng' },
  viewTop: { en: 'TOP', vn: 'Hình chiếu bằng' },
  viewSide: { en: 'SIDE', vn: 'Hình chiếu cạnh' },
  viewIso: { en: 'ISO', vn: 'Hình chiếu trục đo' },
};

// Sheet inner area heights (after subtracting outer page padding + title block).
// Used to position views absolutely within the drawing region.
const SHEET_DIMENSIONS_PT = {
  A4: { w: 595, h: 842 },
  A3: { w: 842, h: 1191 },
  A2: { w: 1191, h: 1684 },
  A1: { w: 1684, h: 2384 },
  A0: { w: 2384, h: 3370 },
};

function sheetSizePoints(size, orientation) {
  const d = SHEET_DIMENSIONS_PT[size] || SHEET_DIMENSIONS_PT.A4;
  if (orientation === 'landscape') return { w: d.h, h: d.w };
  return d;
}

// ─── ISO projection symbol (truncated cone + circle) ────────────────────────

function ProjectionSymbol({ projection, size = 24 }) {
  const isFirst = projection === 'first_angle';
  const w = size * 2.5;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={w} height={size} viewBox={`0 0 ${w} ${size}`}>
        {isFirst ? (
          <G>
            <Polygon
              points={`2,${size * 0.2} ${w * 0.25},${size * 0.5} 2,${size * 0.8}`}
              fill="none"
              stroke="#1f2937"
              strokeWidth={0.8}
            />
            <Line x1={2} y1={size / 2} x2={w * 0.25} y2={size / 2} stroke="#1f2937" strokeWidth={0.4} strokeDasharray="1.5,1" />
            <Circle cx={w * 0.8} cy={size / 2} r={size * 0.3} fill="none" stroke="#1f2937" strokeWidth={0.8} />
            <Line x1={w * 0.5} y1={size / 2} x2={w * 0.95} y2={size / 2} stroke="#1f2937" strokeWidth={0.4} strokeDasharray="1.5,1" />
            <Line x1={w * 0.8} y1={size * 0.1} x2={w * 0.8} y2={size * 0.9} stroke="#1f2937" strokeWidth={0.4} strokeDasharray="1.5,1" />
          </G>
        ) : (
          <G>
            <Circle cx={w * 0.2} cy={size / 2} r={size * 0.3} fill="none" stroke="#1f2937" strokeWidth={0.8} />
            <Line x1={w * 0.05} y1={size / 2} x2={w * 0.5} y2={size / 2} stroke="#1f2937" strokeWidth={0.4} strokeDasharray="1.5,1" />
            <Line x1={w * 0.2} y1={size * 0.1} x2={w * 0.2} y2={size * 0.9} stroke="#1f2937" strokeWidth={0.4} strokeDasharray="1.5,1" />
            <Polygon
              points={`${w - 2},${size * 0.2} ${w * 0.75},${size * 0.5} ${w - 2},${size * 0.8}`}
              fill="none"
              stroke="#1f2937"
              strokeWidth={0.8}
            />
            <Line x1={w * 0.75} y1={size / 2} x2={w - 2} y2={size / 2} stroke="#1f2937" strokeWidth={0.4} strokeDasharray="1.5,1" />
          </G>
        )}
      </Svg>
      <Text style={{ fontSize: 6, fontFamily: FONT.sans, color: PALETTE.textMuted, marginTop: 1 }}>
        {isFirst ? '1st angle / Góc 1' : '3rd angle / Góc 3'}
      </Text>
    </View>
  );
}

// ─── Title block cells ──────────────────────────────────────────────────────

function TBCell({ label, value, mono, width, height, valueSize = 9, bold = true, align = 'left', children }) {
  return (
    <View
      style={{
        width,
        height,
        borderWidth: 0.5,
        borderColor: PALETTE.borderStrong,
        paddingHorizontal: 4,
        paddingVertical: 2,
        justifyContent: 'space-between',
      }}
    >
      {label && (
        <Text
          style={{
            fontSize: 6,
            fontFamily: FONT.sans,
            color: PALETTE.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
      )}
      {children ? children : (
        <Text
          style={{
            fontSize: valueSize,
            fontFamily: mono ? FONT.mono : FONT.sans,
            fontWeight: bold ? 700 : 400,
            color: mono ? PALETTE.primary : PALETTE.text,
            textAlign: align,
          }}
        >
          {value ?? '—'}
        </Text>
      )}
    </View>
  );
}

function TitleBlockFull({ document, sheet, project, sheetIndex = 1, sheetTotal = 1, template }) {
  const projection = sheet?.projection || 'third_angle';
  const dim =
    sheet && sheet.dimX != null
      ? `${sheet.dimX.toFixed(2)} × ${sheet.dimY.toFixed(2)} × ${sheet.dimZ.toFixed(2)} mm`
      : '—';

  return (
    <View style={{ marginTop: 8, flexDirection: 'column', borderWidth: 1, borderColor: PALETTE.borderStrong }}>
      <View style={{ flexDirection: 'row' }}>
        <View
          style={{
            width: '50%',
            height: 40,
            borderRightWidth: 0.5,
            borderColor: PALETTE.borderStrong,
            paddingHorizontal: 6,
            paddingVertical: 3,
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
          }}
        >
          <Text style={{ fontSize: 7, fontFamily: FONT.sans, color: PALETTE.textMuted }}>COMPANY / CÔNG TY</Text>
          <Text style={{ fontSize: 11, fontFamily: FONT.sans, fontWeight: 700 }}>Forte Biotech</Text>
          <Text style={{ fontSize: 7, fontFamily: FONT.sans, color: PALETTE.textMuted }}>
            Template: {template?.name || DEFAULT_TEMPLATE_ID}
          </Text>
        </View>
        {template?.showProjectionSymbol !== false && (
          <TBCell label="Projection" width="14%" height={40}>
            <ProjectionSymbol projection={projection} />
          </TBCell>
        )}
        <TBCell label="Scale" value={sheet?.scale || '1:1'} mono width="12%" height={40} valueSize={11} />
        <TBCell label="Unit" value="mm" width="8%" height={40} />
        <TBCell
          label="Sheet"
          value={`${sheetIndex} / ${sheetTotal} · ${sheet?.sheetSize || template?.sheet?.size || 'A4'}`}
          width="16%"
          height={40}
        />
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderColor: PALETTE.borderStrong }}>
        <View
          style={{
            width: '50%',
            height: 36,
            borderRightWidth: 0.5,
            borderColor: PALETTE.borderStrong,
            paddingHorizontal: 6,
            paddingVertical: 3,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 6, fontFamily: FONT.sans, color: PALETTE.textMuted }}>TITLE / TIÊU ĐỀ</Text>
          <Text style={{ fontSize: 11, fontFamily: FONT.sans, fontWeight: 700 }}>
            {document.nameEn || document.docNumber}
          </Text>
          {document.nameVn && (
            <Text style={{ fontSize: 8, fontFamily: FONT.sans, color: PALETTE.textMuted, fontStyle: 'italic' }}>
              {document.nameVn}
            </Text>
          )}
        </View>
        <TBCell label="Doc number" value={document.docNumber} mono width="20%" height={36} valueSize={10} />
        <TBCell label="Revision" value={document.revision} mono width="10%" height={36} valueSize={11} />
        <TBCell
          label="Status"
          value={(document.status || 'draft').replace('_', ' ').toUpperCase()}
          width="20%"
          height={36}
          valueSize={9}
        />
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderColor: PALETTE.borderStrong }}>
        <TBCell label="Material / Vật liệu" value={sheet?.material} width="20%" height={32} />
        <TBCell label="Treatment / Xử lý nhiệt" value={sheet?.treatment} width="20%" height={32} />
        <TBCell label="Surface finish / Bề mặt" value={sheet?.surfaceFinish} width="20%" height={32} />
        <TBCell label="General tolerance" value={sheet?.tolerance || 'ISO 2768-mK'} width="20%" height={32} />
        <TBCell
          label="Mass / Khối lượng"
          value={sheet?.weight != null ? `${Number(sheet.weight).toFixed(2)} g` : '—'}
          width="20%"
          height={32}
        />
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderColor: PALETTE.borderStrong }}>
        <TBCell label="Bounding box / Kích thước bao" value={dim} mono width="25%" height={28} />
        <TBCell label="Source file" value={sheet?.sourceFile || '—'} mono width="25%" height={28} valueSize={8} />
        <TBCell
          label="Standard / Tiêu chuẩn"
          value={sheet?.standardRef || 'ISO 128 / ISO 7200'}
          width="20%"
          height={28}
          valueSize={8}
        />
        <TBCell label="Customer / Khách hàng" value={sheet?.customer} width="15%" height={28} valueSize={8} />
        <TBCell label="Project" value={project?.name} width="15%" height={28} valueSize={8} />
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderColor: PALETTE.borderStrong }}>
        <TBCell label="Designer / Thiết kế" value={sheet?.designer} width="25%" height={32} valueSize={9} />
        <TBCell label="Checker / Kiểm tra" value={sheet?.checker} width="25%" height={32} valueSize={9} />
        <TBCell label="Approver / Phê duyệt" value={sheet?.approver} width="25%" height={32} valueSize={9} />
        <TBCell
          label="Approval date"
          value={sheet?.approverDate ? new Date(sheet.approverDate).toLocaleDateString('en-GB') : '—'}
          mono
          width="25%"
          height={32}
          valueSize={9}
        />
      </View>
    </View>
  );
}

function TitleBlockCompact({ document, sheet, template }) {
  const projection = sheet?.projection || 'third_angle';
  return (
    <View style={{ marginTop: 8, flexDirection: 'row', borderWidth: 1, borderColor: PALETTE.borderStrong }}>
      <View
        style={{
          width: '40%',
          height: 50,
          borderRightWidth: 0.5,
          borderColor: PALETTE.borderStrong,
          paddingHorizontal: 6,
          paddingVertical: 4,
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <Text style={{ fontSize: 7, fontFamily: FONT.sans, color: PALETTE.textMuted }}>FORTE BIOTECH</Text>
        <Text style={{ fontSize: 12, fontFamily: FONT.sans, fontWeight: 700 }}>
          {document.nameEn || document.docNumber}
        </Text>
        {document.nameVn && (
          <Text style={{ fontSize: 8, fontFamily: FONT.sans, color: PALETTE.textMuted, fontStyle: 'italic' }}>
            {document.nameVn}
          </Text>
        )}
      </View>
      <TBCell label="Doc no." value={document.docNumber} mono width="20%" height={50} valueSize={10} />
      <TBCell label="Rev" value={document.revision} mono width="8%" height={50} valueSize={11} />
      <TBCell label="Scale" value={sheet?.scale || '1:1'} mono width="10%" height={50} valueSize={11} />
      {template?.showProjectionSymbol !== false && (
        <TBCell label="Proj" width="12%" height={50}>
          <ProjectionSymbol projection={projection} size={20} />
        </TBCell>
      )}
      <TBCell label="Material" value={sheet?.material} width="10%" height={50} valueSize={8} />
    </View>
  );
}

// ─── View cell ──────────────────────────────────────────────────────────────

function ViewCell({ label, vn, imgPath, framed, labeled }) {
  return (
    <View style={{ width: '100%', height: '100%', padding: 2 }}>
      <View
        style={{
          flex: 1,
          borderWidth: framed ? 1 : 0,
          borderColor: PALETTE.borderStrong,
          padding: 3,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
        }}
      >
        {imgPath ? (
          <Image src={imgPath} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Text style={{ fontSize: 8, color: PALETTE.textMuted, fontFamily: FONT.sans }}>no view</Text>
        )}
      </View>
      {labeled && (
        <Text
          style={{
            fontSize: 8,
            fontFamily: FONT.sans,
            fontWeight: 700,
            textAlign: 'center',
            marginTop: 1,
          }}
        >
          {label} <Text style={{ color: PALETTE.textMuted, fontWeight: 400 }}>· {vn}</Text>
        </Text>
      )}
    </View>
  );
}

// Place views absolutely inside a drawing region using the template layout.
function ViewGrid({ template, sheet, projection, regionW, regionH }) {
  const layouts = template?.layouts || {};
  const layout = layouts[projection] || layouts.third_angle || [];
  const framed = template?.viewGrid?.framed !== false;
  const labeled = template?.viewGrid?.labeled !== false;

  return (
    <View style={{ position: 'relative', width: regionW, height: regionH }}>
      {layout.map((cell) => {
        const meta = VIEW_LABELS[cell.viewKey] || { en: cell.viewKey, vn: '' };
        const img = resolveImage(sheet?.[cell.viewKey]);
        return (
          <View
            key={cell.viewKey}
            style={{
              position: 'absolute',
              left: cell.x * regionW,
              top: cell.y * regionH,
              width: cell.w * regionW,
              height: cell.h * regionH,
            }}
          >
            <ViewCell label={meta.en} vn={meta.vn} imgPath={img} framed={framed} labeled={labeled} />
          </View>
        );
      })}
    </View>
  );
}

// ─── Revision table / Notes blocks ──────────────────────────────────────────

function RevisionTable({ revisions, maxRows = 6 }) {
  return (
    <View style={{ borderWidth: 0.5, borderColor: PALETTE.borderStrong }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#f3f4f6',
          borderBottomWidth: 0.5,
          borderBottomColor: PALETTE.borderStrong,
        }}
      >
        <Text style={[styles.th, { width: '15%', fontSize: 7 }]}>Rev</Text>
        <Text style={[styles.th, { width: '60%', fontSize: 7 }]}>Change / Sửa đổi</Text>
        <Text style={[styles.th, { width: '25%', fontSize: 7 }]}>Date</Text>
      </View>
      {revisions.length === 0 ? (
        <Text style={{ fontSize: 7, color: PALETTE.textMuted, fontFamily: FONT.sans, fontStyle: 'italic', padding: 3 }}>
          No revisions yet
        </Text>
      ) : (
        revisions.slice(0, maxRows).map((r, i) => (
          <View
            key={r.id || i}
            style={{
              flexDirection: 'row',
              borderBottomWidth: 0.3,
              borderBottomColor: PALETTE.border,
              backgroundColor: i % 2 === 1 ? PALETTE.rowZebra : undefined,
            }}
          >
            <Text style={[styles.tdMono, { width: '15%', fontSize: 7, padding: 2 }]}>{r.revision}</Text>
            <Text style={[styles.td, { width: '60%', fontSize: 7, padding: 2 }]}>{r.changeDesc || '—'}</Text>
            <Text style={[styles.td, { width: '25%', fontSize: 7, padding: 2 }]}>
              {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : ''}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function GeneralNotes({ notes }) {
  if (!notes) return null;
  const lines = String(notes).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: 6, borderWidth: 0.5, borderColor: PALETTE.borderStrong, padding: 5 }}>
      <Text
        style={{
          fontSize: 7,
          fontFamily: FONT.sans,
          color: PALETTE.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 3,
        }}
      >
        General notes / Ghi chú chung
      </Text>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 1 }}>
          <Text style={{ fontSize: 8, fontFamily: FONT.mono, color: PALETTE.primary, width: 18 }}>
            {String(i + 1).padStart(2, '0')}.
          </Text>
          <Text style={{ fontSize: 8, fontFamily: FONT.sans, flex: 1 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main exported component ────────────────────────────────────────────────

export function DrawingCoverPdf({ document, revisions = [], project, sheet, watermark = 'none', templateId }) {
  const template = getTemplate(templateId || sheet?.templateId || DEFAULT_TEMPLATE_ID);
  const sheetSize = template?.sheet?.size || sheet?.sheetSize || 'A4';
  const orientation = template?.sheet?.orientation || 'landscape';
  const projection = sheet?.projection || 'third_angle';

  const title = document.nameEn || document.docNumber;
  const hasViews = sheet && (sheet.viewFront || sheet.viewTop || sheet.viewSide || sheet.viewIso);

  // Right column (revisions) takes 30% when enabled
  const revisionEnabled = template?.revisionTable?.enabled !== false;
  const leftW = revisionEnabled ? '70%' : '100%';
  const rightW = revisionEnabled ? '30%' : '0%';

  const TitleBlock = template?.titleBlock?.variant === 'iso7200-compact' ? TitleBlockCompact : TitleBlockFull;

  // Compute drawing region height. We aim for views to fill ~60% of page when
  // title block is full, or ~75% when compact.
  const isCompact = template?.titleBlock?.variant === 'iso7200-compact';
  const dims = sheetSizePoints(sheetSize, orientation);
  const drawingRegionHeight = Math.max(220, Math.floor(dims.h * (isCompact ? 0.78 : 0.62)));

  return (
    <Document title={title} author="Forte Biotech — Drawing Tool">
      <Page size={sheetSize} orientation={orientation} style={styles.page}>
        <PageHeader title={title} docNumber={document.docNumber} revision={document.revision} />
        {template?.showWatermark !== false && <Watermark kind={watermark} />}

        {hasViews ? (
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            <View style={{ width: leftW }}>
              <ViewGrid
                template={template}
                sheet={sheet}
                projection={projection}
                regionW={(dims.w - 80) * (revisionEnabled ? 0.7 : 1)}
                regionH={drawingRegionHeight}
              />
              {template?.notesBlock?.enabled !== false && <GeneralNotes notes={sheet.generalNotes} />}
              {sheet.notes && (
                <View style={{ marginTop: 4, borderWidth: 0.5, borderColor: PALETTE.border, padding: 4 }}>
                  <Text style={[styles.caption, { marginBottom: 2 }]}>Notes / Ghi chú</Text>
                  <Text style={{ fontSize: 8, fontFamily: FONT.sans }}>{sheet.notes}</Text>
                </View>
              )}
            </View>

            {revisionEnabled && (
              <View style={{ width: rightW, paddingLeft: 6 }}>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: PALETTE.borderStrong,
                    padding: 5,
                    marginBottom: 4,
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Text style={{ fontSize: 7, color: PALETTE.textMuted, fontFamily: FONT.sans, textTransform: 'uppercase' }}>
                    Model bounds
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: FONT.mono,
                      fontWeight: 700,
                      color: PALETTE.primary,
                      marginTop: 1,
                    }}
                  >
                    {sheet.dimX != null
                      ? `${sheet.dimX.toFixed(2)} × ${sheet.dimY.toFixed(2)} × ${sheet.dimZ.toFixed(2)} mm`
                      : '—'}
                  </Text>
                  {sheet.triangles != null && (
                    <Text style={{ fontSize: 7, color: PALETTE.textMuted, fontFamily: FONT.sans, marginTop: 2 }}>
                      Triangles: {sheet.triangles.toLocaleString()}
                    </Text>
                  )}
                </View>
                <Text style={[styles.caption, { marginBottom: 2 }]}>Revision history / Lịch sử sửa đổi</Text>
                <RevisionTable revisions={revisions} maxRows={template?.revisionTable?.maxRows || 6} />
              </View>
            )}
          </View>
        ) : (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.h1}>{document.nameEn}</Text>
            {document.nameVn && <Text style={styles.h1Sub}>{document.nameVn}</Text>}
          </View>
        )}

        <TitleBlock document={document} sheet={sheet || {}} project={project} template={template} />

        <PageFooter docNumber={document.docNumber} />
      </Page>
    </Document>
  );
}
