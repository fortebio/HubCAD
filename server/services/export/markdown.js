// Plain-text Markdown generator for each doc kind.
// Output is UTF-8 with Vietnamese diacritics intact. Editable in any text
// editor; renders cleanly on GitHub / Google Docs (paste-as-markdown).

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|');
}

function table(headers, rows, alignments = []) {
  const head = '| ' + headers.join(' | ') + ' |';
  const sep = '| ' + headers.map((_, i) => {
    const a = alignments[i];
    if (a === 'right') return '---:';
    if (a === 'center') return ':---:';
    return '---';
  }).join(' | ') + ' |';
  const body = rows.map((r) => '| ' + r.map(esc).join(' | ') + ' |').join('\n');
  return [head, sep, body].join('\n');
}

function metaList(items) {
  return items
    .filter((it) => it.value != null && it.value !== '')
    .map((it) => `- **${it.label}:** ${it.value}`)
    .join('\n');
}

export function bomMarkdown({ doc, header, items }) {
  const totalCost = items.reduce((s, it) => s + (Number(it.unitCost) || 0) * (Number(it.qty) || 0), 0);
  return [
    `# BOM — ${header?.assemblyNo || doc.docNumber}`,
    '',
    doc.nameEn ? `**${doc.nameEn}**${doc.nameVn ? `  \n_${doc.nameVn}_` : ''}` : '',
    '',
    metaList([
      { label: 'Doc number', value: doc.docNumber },
      { label: 'Assembly No.', value: header?.assemblyNo },
      { label: 'Revision', value: header?.revision || doc.revision },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
      { label: 'Total items', value: items.length },
      { label: 'Total cost', value: `$${totalCost.toFixed(2)}` },
      { label: 'Generated', value: new Date().toLocaleDateString('en-GB') },
    ]),
    '',
    '## Items / Danh mục vật liệu',
    '',
    table(
      ['#', 'Lv', 'Part No.', 'Description', 'Qty', 'Unit', 'Material', 'Vendor', 'Unit cost', 'Subtotal'],
      items.map((it, i) => {
        const sub = (Number(it.unitCost) || 0) * (Number(it.qty) || 0);
        const desc = it.descVn ? `${it.descEn}<br/>_${it.descVn}_` : it.descEn || '';
        return [
          i + 1,
          it.level ?? 1,
          it.partNumber || '',
          desc,
          it.qty ?? '',
          it.unit || '',
          it.material || '—',
          it.vendor || '—',
          it.unitCost != null ? Number(it.unitCost).toFixed(2) : '—',
          sub.toFixed(2),
        ];
      }),
      ['right', 'center', '', '', 'right', '', '', '', 'right', 'right']
    ),
    '',
    `**Total: $${totalCost.toFixed(2)}**`,
    '',
  ].join('\n');
}

export function wiMarkdown({ doc, meta, steps }) {
  return [
    `# ${meta.titleEn || doc.nameEn || `WI — ${doc.docNumber}`}`,
    meta.titleVn || doc.nameVn ? `_${meta.titleVn || doc.nameVn}_` : '',
    '',
    metaList([
      { label: 'Doc number', value: doc.docNumber },
      { label: 'Revision', value: doc.revision },
      { label: 'Station', value: meta.station },
      { label: 'Cycle time', value: meta.cycleTime },
      { label: 'Steps', value: steps.length },
      { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
    ]),
    '',
    '## Procedure / Trình tự',
    '',
    steps.length === 0
      ? '_No steps defined yet._'
      : steps
          .map((s, i) => {
            const lines = [
              `### Step ${i + 1}${s.titleEn ? ` — ${s.titleEn}` : ''}`,
              s.titleVn ? `_${s.titleVn}_` : '',
              '',
              s.bodyEn || '',
              s.bodyVn ? `\n_${s.bodyVn}_` : '',
            ];
            if (s.tools) lines.push(`\n- **Tools / Dụng cụ:** ${s.tools}`);
            if (s.caution) lines.push(`- **⚠ Caution / Lưu ý:** ${s.caution}`);
            if (s.imagePath) lines.push(`\n![Step ${i + 1}](${s.imagePath})`);
            return lines.filter(Boolean).join('\n');
          })
          .join('\n\n'),
    '',
  ].join('\n');
}

export function catalogMarkdown({ doc, data }) {
  const features = (data.features || []).filter((f) => f.en);
  const specs = (data.specs || []).filter((s) => s.key);
  return [
    `# ${data.productNameEn || doc.nameEn || `Catalog — ${doc.docNumber}`}`,
    data.productNameVn || doc.nameVn ? `_${data.productNameVn || doc.nameVn}_` : '',
    '',
    data.tagline ? `> ${data.tagline}` : '',
    '',
    data.description || '',
    '',
    data.heroImage ? `![Product](${data.heroImage})` : '',
    '',
    features.length > 0 ? '## Key features / Tính năng nổi bật\n' : '',
    features.map((f) => `- **${f.en}**${f.vn ? ` — _${f.vn}_` : ''}`).join('\n'),
    '',
    specs.length > 0 ? '## Specifications / Thông số kỹ thuật\n' : '',
    specs.length > 0
      ? table(
          ['Spec', 'Value (EN)', 'Value (VN)'],
          specs.map((s) => [s.key, s.valueEn || '—', s.valueVn || ''])
        )
      : '',
    '',
    data.certifications ? `**Certifications:** ${data.certifications}` : '',
    data.warranty ? `**Warranty / Bảo hành:** ${data.warranty}` : '',
    '',
  ].filter((line) => line !== '').join('\n');
}

export function drawingMarkdown({ doc, revisions, project, sheet }) {
  const hasViews = sheet && (sheet.viewFront || sheet.viewTop || sheet.viewSide || sheet.viewIso);
  const viewLines = hasViews
    ? [
        '## Views / Hình chiếu',
        '',
        sheet.viewFront ? `![FRONT · Hình chiếu đứng](${sheet.viewFront})` : '',
        sheet.viewTop ? `![TOP · Hình chiếu bằng](${sheet.viewTop})` : '',
        sheet.viewSide ? `![SIDE · Hình chiếu cạnh](${sheet.viewSide})` : '',
        sheet.viewIso ? `![ISO · Hình chiếu trục đo](${sheet.viewIso})` : '',
        '',
        '## Title block / Khung tên (ISO 7200)',
        '',
        metaList([
          { label: 'Company / Công ty', value: 'Forte Biotech' },
          { label: 'Doc number', value: doc.docNumber },
          { label: 'Title (EN)', value: doc.nameEn },
          { label: 'Title (VN)', value: doc.nameVn },
          { label: 'Revision', value: doc.revision },
          { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
          { label: 'Scale', value: sheet.scale || '1:1' },
          { label: 'Projection', value: sheet.projection === 'first_angle' ? '1st angle (ISO)' : '3rd angle (ISO)' },
          { label: 'Sheet size', value: sheet.sheetSize || 'A4' },
          { label: 'Unit', value: 'mm' },
          { label: 'Standard', value: sheet.standardRef || 'ISO 128 / ISO 7200' },
          { label: 'Customer / Khách hàng', value: sheet.customer },
          { label: 'Project', value: project?.name },
          {
            label: 'Bounding box',
            value: sheet.dimX != null ? `${sheet.dimX.toFixed(2)} × ${sheet.dimY.toFixed(2)} × ${sheet.dimZ.toFixed(2)} mm` : '—',
          },
          { label: 'Mass / Khối lượng', value: sheet.weight != null ? `${Number(sheet.weight).toFixed(2)} g` : null },
          { label: 'Material / Vật liệu', value: sheet.material },
          { label: 'Treatment / Xử lý nhiệt', value: sheet.treatment },
          { label: 'Surface finish / Bề mặt', value: sheet.surfaceFinish },
          { label: 'General tolerance', value: sheet.tolerance || 'ISO 2768-mK' },
          { label: 'Triangles', value: sheet.triangles?.toLocaleString() },
          { label: 'Source file', value: sheet.sourceFile },
          { label: 'Designer / Thiết kế', value: sheet.designer },
          { label: 'Checker / Kiểm tra', value: sheet.checker },
          { label: 'Approver / Phê duyệt', value: sheet.approver },
          {
            label: 'Approval date',
            value: sheet.approverDate ? new Date(sheet.approverDate).toLocaleDateString('en-GB') : null,
          },
        ]),
        sheet.generalNotes
          ? `\n## General notes / Ghi chú chung\n\n${String(sheet.generalNotes).split(/\r?\n/).filter((l) => l.trim()).map((l, i) => `${String(i + 1).padStart(2, '0')}. ${l.trim()}`).join('\n')}`
          : '',
        sheet.notes ? `\n## Notes / Ghi chú\n\n${sheet.notes}` : '',
      ]
    : [
        metaList([
          { label: 'Doc number', value: doc.docNumber },
          { label: 'Revision', value: doc.revision },
          { label: 'Type', value: doc.docType?.toUpperCase() },
          { label: 'Status', value: doc.status?.replace('_', ' ').toUpperCase() },
          { label: 'Project', value: project?.name },
          { label: 'Project code', value: project?.code },
        ]),
      ];

  return [
    `# ${doc.nameEn || doc.docNumber}`,
    doc.nameVn ? `_${doc.nameVn}_` : '',
    '',
    ...viewLines,
    '',
    '## Revision history / Lịch sử sửa đổi',
    '',
    revisions.length === 0
      ? '_No revision history yet._'
      : table(
          ['Rev', 'Change description', 'Date'],
          revisions.map((r) => [
            r.revision,
            r.changeDesc || '—',
            r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : '',
          ])
        ),
    '',
    '## Signoff / Phê duyệt',
    '',
    '| Role | Name | Date |',
    '| --- | --- | --- |',
    '| Designer / Thiết kế |  |  |',
    '| Reviewer / Kiểm tra |  |  |',
    '| Approver / Phê duyệt |  |  |',
    '',
  ].join('\n');
}

const TITLE_BY_TYPE = {
  drawing: 'Drawing checklist',
  dfm: 'DFM / DFA review',
  release: 'Release checklist',
};

export function checklistMarkdown({ doc, checklistType, sections, result }) {
  const results = result?.results || {};
  let ok = 0, ng = 0, total = 0;
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    for (let i = 0; i < sec.items.length; i++) {
      const k = `${sec.audience ?? s}-${i}`;
      if (results[k] === 'ok') ok++;
      else if (results[k] === 'ng') ng++;
      total++;
    }
  }

  return [
    `# ${TITLE_BY_TYPE[checklistType] || 'Checklist'} — ${doc.docNumber}`,
    `${doc.nameEn || ''}${doc.nameVn ? ` · _${doc.nameVn}_` : ''}`,
    '',
    metaList([
      { label: 'Doc number', value: doc.docNumber },
      { label: 'Revision', value: doc.revision },
      { label: 'Checklist type', value: checklistType?.toUpperCase() },
      { label: 'Overall', value: (result?.overall || '—').toUpperCase() },
      { label: 'OK', value: ok },
      { label: 'NG', value: ng },
      { label: 'Total', value: total },
      { label: 'Checked at', value: result?.checkedAt ? new Date(result.checkedAt).toLocaleString('en-GB') : '—' },
    ]),
    '',
    ...sections.map((sec, sIdx) => {
      const lines = [
        `## ${sec.title?.en || ''}${sec.title?.vn ? ` · ${sec.title.vn}` : ''}`,
        '',
        table(
          ['#', 'English', 'Tiếng Việt', 'Result'],
          (sec.items || []).map((it, iIdx) => {
            const k = `${sec.audience ?? sIdx}-${iIdx}`;
            const v = results[k];
            return [iIdx + 1, it.en, it.vn, v ? v.toUpperCase() : '—'];
          }),
          ['right', '', '', 'center']
        ),
        '',
      ];
      return lines.join('\n');
    }),
    result?.remarks ? `\n## Remarks / Ghi chú\n\n${result.remarks}\n` : '',
  ].join('\n');
}

export function renderMarkdown(payload) {
  switch (payload.kind) {
    case 'bom': return bomMarkdown(payload);
    case 'wi': return wiMarkdown(payload);
    case 'catalog': return catalogMarkdown(payload);
    case 'drawing': return drawingMarkdown(payload);
    case 'checklist': return checklistMarkdown(payload);
    default: throw new Error(`Unknown kind: ${payload.kind}`);
  }
}
