import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { models3d } from '../db/schema.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

const KIND_TO_SUB = {
  model: 'models',
  image: 'images',
  document: 'documents',
};

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const kind = req.params.kind || 'document';
    const sub = KIND_TO_SUB[kind] || 'documents';
    const dest = path.join(UPLOAD_DIR, sub);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(_req, file, cb) {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

router.post('/upload/:kind', optionalAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const kind = req.params.kind;
  const sub = KIND_TO_SUB[kind] || 'documents';
  const publicPath = `/uploads/${sub}/${req.file.filename}`;
  const out = {
    kind,
    originalName: req.file.originalname,
    fileName: req.file.filename,
    size: req.file.size,
    path: publicPath,
    absPath: req.file.path,
  };

  if (kind === 'model') {
    const documentId = req.body.documentId ? Number(req.body.documentId) : null;
    const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
    const meta = req.body.meta ? JSON.parse(req.body.meta) : {};
    const [row] = db
      .insert(models3d)
      .values({
        documentId,
        fileName: req.file.originalname,
        filePath: publicPath,
        fileSize: req.file.size,
        format: ext,
        dimX: meta.dimX,
        dimY: meta.dimY,
        dimZ: meta.dimZ,
        triangles: meta.triangles,
        uploadedBy: req.user?.id || null,
      })
      .returning()
      .all();
    out.model = row;
  }
  res.status(201).json(out);
});

router.get('/models/by-document/:documentId', (req, res) => {
  const documentId = Number(req.params.documentId);
  const rows = db.select().from(models3d).where(eq(models3d.documentId, documentId)).all();
  res.json({ models: rows });
});

export default router;
