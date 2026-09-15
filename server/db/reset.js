import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL || './data/drawing-tool.db');
const journal = dbPath + '-journal';
const wal = dbPath + '-wal';
const shm = dbPath + '-shm';

for (const f of [dbPath, journal, wal, shm]) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`[reset] removed ${f}`);
  }
}
console.log('[reset] done. Run `npm run db:seed` to recreate.');
