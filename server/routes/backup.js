import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import archiver from 'archiver';
import { fileURLToPath } from 'node:url';
import { sqlite } from '../db/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = path.resolve(PROJECT_ROOT, process.env.DATABASE_URL || './data/drawing-tool.db');
const UPLOAD_DIR = path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR || './uploads');

const router = Router();

router.get('/export', (_req, res, next) => {
  try {
    const ymd = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `drawing-tool-backup-${ymd}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    // 1. Database — checkpoint WAL first so the .db file is fully consistent
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)');
    } catch (_) {
      // best effort
    }
    if (fs.existsSync(DB_PATH)) {
      archive.file(DB_PATH, { name: 'data/drawing-tool.db' });
    }

    // 2. Uploads
    if (fs.existsSync(UPLOAD_DIR)) {
      archive.directory(UPLOAD_DIR, 'uploads');
    }

    // 3. Manifest
    const manifest = {
      tool: 'Drawing Tool',
      schema: 'v2',
      createdAt: new Date().toISOString(),
      hostname: os.hostname(),
      counts: countTables(),
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    archive.finalize();
  } catch (e) {
    next(e);
  }
});

router.get('/status', (_req, res) => {
  res.json({
    db: {
      path: DB_PATH,
      exists: fs.existsSync(DB_PATH),
      sizeBytes: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
    },
    uploads: {
      path: UPLOAD_DIR,
      exists: fs.existsSync(UPLOAD_DIR),
      sizeBytes: fs.existsSync(UPLOAD_DIR) ? dirSize(UPLOAD_DIR) : 0,
      fileCount: fs.existsSync(UPLOAD_DIR) ? countFilesRecursive(UPLOAD_DIR) : 0,
    },
    counts: countTables(),
  });
});

function countTables() {
  const tables = [
    'users',
    'projects',
    'documents',
    'document_revisions',
    'bom_headers',
    'bom_items',
    'ecr',
    'checklist_results',
    'models_3d',
    'wi_content',
    'catalog_content',
    'bom_snapshots',
  ];
  const counts = {};
  for (const t of tables) {
    try {
      counts[t] = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
    } catch (_) {
      counts[t] = null;
    }
  }
  return counts;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else if (entry.isFile()) total += fs.statSync(p).size;
  }
  return total;
}

function countFilesRecursive(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFilesRecursive(p);
    else if (entry.isFile()) n++;
  }
  return n;
}

export default router;
