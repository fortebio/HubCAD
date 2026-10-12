import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initSchema } from './db/init.js';
import authRouter from './routes/auth.js';
import documentsRouter from './routes/documents.js';
import bomRouter from './routes/bom.js';
import ecrRouter from './routes/ecr.js';
import filesRouter from './routes/files.js';
import checklistsRouter from './routes/checklists.js';
import pdfRouter from './routes/pdf.js';
import wiRouter from './routes/wi.js';
import catalogRouter from './routes/catalog.js';
import backupRouter from './routes/backup.js';
import usersRouter from './routes/users.js';
import auditRouter from './routes/audit.js';
import exportRouter from './routes/export.js';
import drawingsRouter from './routes/drawings.js';
import drawingTemplatesRouter from './routes/drawingTemplates.js';
import costSettingsRouter from './routes/costSettings.js';
import quotesRouter from './routes/quotes.js';
import cadSourceRouter from './routes/cadSource.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.API_PORT || 3002;
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

for (const sub of ['models', 'images', 'documents']) {
  fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
}

initSchema();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/bom', bomRouter);
app.use('/api/ecr', ecrRouter);
app.use('/api/files', filesRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/wi', wiRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/backup', backupRouter);
app.use('/api/users', usersRouter);
app.use('/api/audit', auditRouter);
app.use('/api/export', exportRouter);
app.use('/api/drawings', drawingsRouter);
app.use('/api/drawing-templates', drawingTemplatesRouter);
app.use('/api/cost-settings', costSettingsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/cad-source', cadSourceRouter);

// Production: serve the Vite build from dist/ with an SPA fallback so deep
// links (/quote, /viewer/…) resolve to index.html. In dev, Vite serves the
// frontend itself and proxies /api + /uploads here, so dist/ does not exist.
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR, { index: false }));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  console.log(`[web] serving ${DIST_DIR}`);
}

app.use((err, req, res, _next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[api] listening on http://${HOST}:${PORT}`);
});
