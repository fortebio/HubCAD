import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  documents,
  documentRevisions,
  projects,
  bomHeaders,
  bomItems,
  wiContent,
  catalogContent,
  checklistResults,
  drawingSheets,
} from '../../db/schema.js';
import { statusToWatermark } from './styles.js';
import { BOMDocument } from './bomTemplate.jsx';
import { WIDocumentPdf } from './wiTemplate.jsx';
import { CatalogPdf } from './catalogTemplate.jsx';
import { ChecklistPdf } from './checklistTemplate.jsx';
import { DrawingCoverPdf } from './drawingTemplate.jsx';
import { DRAWING_CHECKLIST } from './checklistSections.js';

function safeParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function resolveWatermark(req, doc) {
  if (req === 'auto' || req == null) return statusToWatermark(doc.status);
  return req;
}

export async function generatePdf({ documentId, kind, watermark = 'auto', checklistType }) {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 });

  const wm = resolveWatermark(watermark, doc);

  let element;
  let fileLabel;

  if (kind === 'bom') {
    const header = db.select().from(bomHeaders).where(eq(bomHeaders.documentId, documentId)).get();
    const items = header
      ? db.select().from(bomItems).where(eq(bomItems.bomId, header.id)).all()
      : [];
    element = React.createElement(BOMDocument, { document: doc, header, items, watermark: wm });
    fileLabel = 'BOM';
  } else if (kind === 'wi') {
    const wi = db.select().from(wiContent).where(eq(wiContent.documentId, documentId)).get();
    element = React.createElement(WIDocumentPdf, {
      document: doc,
      meta: safeParse(wi?.meta || '{}', {}),
      steps: safeParse(wi?.steps || '[]', []),
      watermark: wm,
    });
    fileLabel = 'WI';
  } else if (kind === 'catalog') {
    const cat = db.select().from(catalogContent).where(eq(catalogContent.documentId, documentId)).get();
    element = React.createElement(CatalogPdf, {
      document: doc,
      data: safeParse(cat?.data || '{}', {}),
      watermark: wm,
    });
    fileLabel = 'CAT';
  } else if (kind === 'drawing') {
    const revs = db
      .select()
      .from(documentRevisions)
      .where(eq(documentRevisions.documentId, documentId))
      .all();
    const project = doc.projectId
      ? db.select().from(projects).where(eq(projects.id, doc.projectId)).get()
      : null;
    const sheet = db.select().from(drawingSheets).where(eq(drawingSheets.documentId, documentId)).get();
    element = React.createElement(DrawingCoverPdf, {
      document: doc,
      revisions: revs,
      project,
      sheet: sheet || null,
      watermark: wm,
      templateId: sheet?.templateId || null,
    });
    fileLabel = 'DWG';
  } else if (kind === 'checklist') {
    if (!checklistType) {
      throw Object.assign(new Error('checklistType is required (drawing | dfm | release)'), { status: 400 });
    }
    const sections = DRAWING_CHECKLIST[checklistType];
    if (!sections) {
      throw Object.assign(new Error(`Unknown checklist type: ${checklistType}`), { status: 400 });
    }
    const result = db
      .select()
      .from(checklistResults)
      .where(eq(checklistResults.documentId, documentId))
      .all()
      .filter((r) => r.checklistType === checklistType)
      .sort((a, b) => (b.checkedAt > a.checkedAt ? 1 : -1))[0];

    const parsed = result ? { ...result, results: safeParse(result.results, {}) } : null;
    element = React.createElement(ChecklistPdf, {
      document: doc,
      checklistType,
      sections,
      result: parsed,
      watermark: wm,
    });
    fileLabel = `CHK_${checklistType.toUpperCase()}`;
  } else {
    throw Object.assign(new Error(`Unknown PDF kind: ${kind}`), { status: 400 });
  }

  const buffer = await renderToBuffer(element);
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `${doc.docNumber}_${fileLabel}_Rev${doc.revision}_${ymd}.pdf`;
  return { buffer, fileName };
}
