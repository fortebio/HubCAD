// Multi-format export dispatcher.
// Resolves (format, kind, documentId) → { buffer, fileName, mimeType }.
// PDF goes through the existing react-pdf pipeline; DOCX/HTML/MD have their
// own generators in this folder.

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { generatePdf } from '../pdf/generator.js';
import { loadExportData, buildFileName } from './dataLoader.js';
import { renderDocx, drawingDocx } from './docx.js';
import { renderHtml, drawingHtml } from './html.js';
import { renderMarkdown, drawingMarkdown } from './markdown.js';
import { statusToWatermark } from '../pdf/styles.js';
import { DrawingCoverPdf } from '../pdf/drawingTemplate.jsx';
import { renderDrawingDxf } from './dxf.js';

export const SUPPORTED_FORMATS = ['pdf', 'docx', 'html', 'md', 'dxf'];

export const SUPPORTED_KINDS = ['bom', 'wi', 'catalog', 'drawing', 'checklist'];

const FORMAT_META = {
  pdf: { ext: 'pdf', mime: 'application/pdf', inline: true },
  docx: {
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    inline: false,
  },
  html: { ext: 'html', mime: 'text/html; charset=utf-8', inline: true },
  md: { ext: 'md', mime: 'text/markdown; charset=utf-8', inline: false },
  dxf: { ext: 'dxf', mime: 'application/dxf; charset=utf-8', inline: false },
};

function resolveWatermark(req, doc) {
  if (req === 'auto' || req == null) return statusToWatermark(doc.status);
  return req;
}

export async function generateExport({ format, kind, documentId, watermark = 'auto', checklistType }) {
  if (!SUPPORTED_FORMATS.includes(format)) {
    const err = new Error(`Unsupported format: ${format}. Use one of: ${SUPPORTED_FORMATS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (!SUPPORTED_KINDS.includes(kind)) {
    const err = new Error(`Unsupported kind: ${kind}. Use one of: ${SUPPORTED_KINDS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // PDF reuses the existing pipeline so we keep one source of truth there.
  if (format === 'pdf') {
    return { ...(await generatePdf({ documentId, kind, watermark, checklistType })), mimeType: FORMAT_META.pdf.mime, inline: true };
  }

  const payload = loadExportData({ kind, documentId, checklistType });
  payload.watermark = resolveWatermark(watermark, payload.doc);

  let buffer;
  if (format === 'docx') {
    buffer = await renderDocx(payload);
  } else if (format === 'html') {
    buffer = Buffer.from(renderHtml(payload), 'utf8');
  } else if (format === 'md') {
    buffer = Buffer.from(renderMarkdown(payload), 'utf8');
  } else if (format === 'dxf') {
    if (kind !== 'drawing') {
      const err = new Error('DXF export is only available for drawing documents');
      err.status = 400;
      throw err;
    }
    buffer = Buffer.from(renderDrawingDxf(payload), 'utf8');
  }

  const meta = FORMAT_META[format];
  return {
    buffer,
    fileName: buildFileName({ doc: payload.doc, fileLabel: payload.fileLabel, ymd: payload.ymd, ext: meta.ext }),
    mimeType: meta.mime,
    inline: meta.inline,
  };
}

// Ad-hoc drawing export: caller already has the 4 view image paths (from a
// fresh capture in the 3D viewer) and the model metadata, but the drawing
// isn't persisted to a document yet. Synthesise the payload and render
// directly, returning a file the browser can download.
export async function generateDrawingFromViews({ format, payload }) {
  if (!SUPPORTED_FORMATS.includes(format)) {
    const err = new Error(`Unsupported format: ${format}`);
    err.status = 400;
    throw err;
  }

  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const doc = {
    id: 0,
    docNumber: payload.docNumber || 'DRAFT',
    nameEn: payload.nameEn || payload.sourceFile || 'Untitled drawing',
    nameVn: payload.nameVn || null,
    docType: 'machining',
    revision: payload.revision || '-',
    status: 'draft',
    projectId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const sheet = {
    viewFront: payload.viewFront || null,
    viewTop: payload.viewTop || null,
    viewSide: payload.viewSide || null,
    viewIso: payload.viewIso || null,
    dimX: payload.dimX,
    dimY: payload.dimY,
    dimZ: payload.dimZ,
    triangles: payload.triangles,
    sourceFile: payload.sourceFile || null,
    notes: payload.notes || null,
    scale: payload.scale || '1:1',
    projection: payload.projection || 'third_angle',
    sheetSize: payload.sheetSize || null,
    tolerance: payload.tolerance || 'ISO 2768-mK',
    material: payload.material || null,
    treatment: payload.treatment || null,
    surfaceFinish: payload.surfaceFinish || null,
    weight: payload.weight ?? null,
    designer: payload.designer || null,
    checker: payload.checker || null,
    approver: payload.approver || null,
    customer: payload.customer || null,
    standardRef: payload.standardRef || 'ISO 128 / ISO 7200',
    generalNotes: payload.generalNotes || null,
    templateId: payload.templateId || null,
  };
  const rendered = {
    kind: 'drawing',
    doc,
    revisions: [],
    project: null,
    sheet,
    watermark: 'preliminary',
  };

  let buffer;
  if (format === 'pdf') {
    // DrawingCoverPdf takes the prop name `document`, not `doc`.
    buffer = await renderToBuffer(
      React.createElement(DrawingCoverPdf, {
        document: rendered.doc,
        revisions: rendered.revisions,
        project: rendered.project,
        sheet: rendered.sheet,
        watermark: rendered.watermark,
        templateId: rendered.sheet.templateId,
      })
    );
  } else if (format === 'docx') {
    buffer = await drawingDocx(rendered);
  } else if (format === 'html') {
    buffer = Buffer.from(drawingHtml(rendered), 'utf8');
  } else if (format === 'md') {
    buffer = Buffer.from(drawingMarkdown(rendered), 'utf8');
  } else if (format === 'dxf') {
    buffer = Buffer.from(renderDrawingDxf(rendered), 'utf8');
  }

  const meta = FORMAT_META[format];
  return {
    buffer,
    fileName: buildFileName({ doc, fileLabel: 'DWG', ymd, ext: meta.ext }),
    mimeType: meta.mime,
    inline: meta.inline,
  };
}
