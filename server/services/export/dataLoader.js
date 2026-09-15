// Shared data-loader used by every export format (PDF, DOCX, HTML, MD).
// Pulls the right rows out of SQLite for a given (kind, documentId) pair so
// each format generator only has to render data.

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
import { DRAWING_CHECKLIST } from '../pdf/checklistSections.js';

function safeParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function loadDoc(documentId) {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }
  return doc;
}

export function loadExportData({ kind, documentId, checklistType }) {
  const doc = loadDoc(documentId);
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (kind === 'bom') {
    const header = db.select().from(bomHeaders).where(eq(bomHeaders.documentId, documentId)).get();
    const items = header
      ? db.select().from(bomItems).where(eq(bomItems.bomId, header.id)).all()
      : [];
    return { kind, doc, header, items, fileLabel: 'BOM', ymd };
  }

  if (kind === 'wi') {
    const wi = db.select().from(wiContent).where(eq(wiContent.documentId, documentId)).get();
    return {
      kind,
      doc,
      meta: safeParse(wi?.meta || '{}', {}),
      steps: safeParse(wi?.steps || '[]', []),
      fileLabel: 'WI',
      ymd,
    };
  }

  if (kind === 'catalog') {
    const cat = db.select().from(catalogContent).where(eq(catalogContent.documentId, documentId)).get();
    return {
      kind,
      doc,
      data: safeParse(cat?.data || '{}', {}),
      fileLabel: 'CAT',
      ymd,
    };
  }

  if (kind === 'drawing') {
    const revs = db
      .select()
      .from(documentRevisions)
      .where(eq(documentRevisions.documentId, documentId))
      .all();
    const project = doc.projectId
      ? db.select().from(projects).where(eq(projects.id, doc.projectId)).get()
      : null;
    const sheet = db.select().from(drawingSheets).where(eq(drawingSheets.documentId, documentId)).get();
    return { kind, doc, revisions: revs, project, sheet: sheet || null, fileLabel: 'DWG', ymd };
  }

  if (kind === 'checklist') {
    if (!checklistType) {
      const err = new Error('checklistType is required (drawing | dfm | release)');
      err.status = 400;
      throw err;
    }
    const sections = DRAWING_CHECKLIST[checklistType];
    if (!sections) {
      const err = new Error(`Unknown checklist type: ${checklistType}`);
      err.status = 400;
      throw err;
    }
    const result = db
      .select()
      .from(checklistResults)
      .where(eq(checklistResults.documentId, documentId))
      .all()
      .filter((r) => r.checklistType === checklistType)
      .sort((a, b) => (b.checkedAt > a.checkedAt ? 1 : -1))[0];
    const parsed = result ? { ...result, results: safeParse(result.results, {}) } : null;
    return {
      kind,
      doc,
      checklistType,
      sections,
      result: parsed,
      fileLabel: `CHK_${checklistType.toUpperCase()}`,
      ymd,
    };
  }

  const err = new Error(`Unknown export kind: ${kind}`);
  err.status = 400;
  throw err;
}

export function buildFileName({ doc, fileLabel, ymd, ext }) {
  return `${doc.docNumber}_${fileLabel}_Rev${doc.revision}_${ymd}.${ext}`;
}
