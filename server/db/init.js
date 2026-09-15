import { sqlite } from './client.js';

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'designer',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  username    TEXT,
  role        TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  summary     TEXT NOT NULL,
  meta        TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number  TEXT UNIQUE NOT NULL,
  name_en     TEXT NOT NULL,
  name_vn     TEXT,
  doc_type    TEXT NOT NULL,
  revision    TEXT NOT NULL DEFAULT '-',
  status      TEXT NOT NULL DEFAULT 'draft',
  project_id  INTEGER REFERENCES projects(id),
  created_by  INTEGER REFERENCES users(id),
  file_path   TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_revisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  revision    TEXT NOT NULL,
  change_desc TEXT,
  ecr_id      INTEGER,
  file_path   TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bom_headers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  assembly_no TEXT NOT NULL,
  revision    TEXT NOT NULL DEFAULT '-',
  total_items INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bom_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bom_id      INTEGER REFERENCES bom_headers(id) ON DELETE CASCADE,
  item_no     INTEGER NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1,
  part_number TEXT NOT NULL,
  desc_en     TEXT NOT NULL,
  desc_vn     TEXT,
  qty         REAL NOT NULL DEFAULT 1,
  unit        TEXT DEFAULT 'pcs',
  material    TEXT,
  vendor      TEXT,
  unit_cost   REAL,
  lead_time   TEXT,
  remarks     TEXT
);

CREATE TABLE IF NOT EXISTS ecr (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_number  TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  change_type TEXT NOT NULL,
  priority    TEXT DEFAULT 'normal',
  status      TEXT DEFAULT 'open',
  originated_by INTEGER REFERENCES users(id),
  project_id  INTEGER REFERENCES projects(id),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at   TEXT
);

CREATE TABLE IF NOT EXISTS ecr_affected_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_id      INTEGER REFERENCES ecr(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  rev_before  TEXT,
  rev_after   TEXT,
  action      TEXT
);

CREATE TABLE IF NOT EXISTS ecr_approvals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_id      INTEGER REFERENCES ecr(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  role        TEXT NOT NULL,
  decision    TEXT DEFAULT 'pending',
  comment     TEXT,
  decided_at  TEXT
);

CREATE TABLE IF NOT EXISTS ecn_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_id      INTEGER REFERENCES ecr(id) ON DELETE CASCADE,
  recipient   TEXT NOT NULL,
  sent_at     TEXT,
  acknowledged_at TEXT
);

CREATE TABLE IF NOT EXISTS checklist_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  checklist_type TEXT NOT NULL,
  revision    TEXT NOT NULL,
  results     TEXT NOT NULL,
  overall     TEXT,
  checked_by  INTEGER REFERENCES users(id),
  checked_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  remarks     TEXT
);

CREATE TABLE IF NOT EXISTS drawing_sheets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  view_front  TEXT,
  view_top    TEXT,
  view_side   TEXT,
  view_iso    TEXT,
  dim_x       REAL,
  dim_y       REAL,
  dim_z       REAL,
  triangles   INTEGER,
  source_file TEXT,
  notes       TEXT,
  scale       TEXT DEFAULT '1:1',
  projection  TEXT DEFAULT 'third_angle',
  tolerance   TEXT DEFAULT 'ISO 2768-mK',
  material    TEXT,
  surface_finish TEXT,
  weight      REAL,
  sheet_size  TEXT DEFAULT 'A4',
  designer    TEXT,
  checker     TEXT,
  approver    TEXT,
  approver_date TEXT,
  general_notes TEXT,
  treatment   TEXT,
  standard_ref TEXT DEFAULT 'ISO 128 / ISO 7200',
  customer    TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models_3d (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_size   INTEGER,
  format      TEXT,
  dim_x       REAL,
  dim_y       REAL,
  dim_z       REAL,
  triangles   INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wi_content (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  meta        TEXT NOT NULL DEFAULT '{}',
  steps       TEXT NOT NULL DEFAULT '[]',
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalog_content (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  data        TEXT NOT NULL DEFAULT '{}',
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bom_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bom_id      INTEGER REFERENCES bom_headers(id) ON DELETE CASCADE,
  revision    TEXT NOT NULL,
  items       TEXT NOT NULL,
  total_cost  REAL,
  note        TEXT,
  snapshotted_by INTEGER REFERENCES users(id),
  snapshotted_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cost_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  data        TEXT NOT NULL DEFAULT '{}',
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_number TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  customer    TEXT,
  document_id INTEGER REFERENCES documents(id),
  currency    TEXT NOT NULL DEFAULT 'VND',
  sets        INTEGER NOT NULL DEFAULT 1,
  part_count  INTEGER NOT NULL DEFAULT 0,
  total_cost  REAL,
  total_price REAL,
  status      TEXT NOT NULL DEFAULT 'draft',
  data        TEXT NOT NULL DEFAULT '{}',
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_ecr_status ON ecr(status);
CREATE INDEX IF NOT EXISTS idx_checklist_doc ON checklist_results(document_id);
CREATE INDEX IF NOT EXISTS idx_bom_snapshots_bom ON bom_snapshots(bom_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_drawing_sheets_doc ON drawing_sheets(document_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_doc ON quotes(document_id);

-- Backfill: add active column if migrating from old schema
-- (SQLite ignores the ALTER if the column already exists, but only via a separate path; we rely on CREATE IF NOT EXISTS for new installs)

`;

export function initSchema() {
  sqlite.exec(DDL);
  // Idempotent additive migrations for existing DBs
  ensureColumn('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
  // Drawing-sheet ISO 7200 extras (idempotent migration)
  ensureColumn('drawing_sheets', 'weight', 'REAL');
  ensureColumn('drawing_sheets', 'sheet_size', "TEXT DEFAULT 'A4'");
  ensureColumn('drawing_sheets', 'designer', 'TEXT');
  ensureColumn('drawing_sheets', 'checker', 'TEXT');
  ensureColumn('drawing_sheets', 'approver', 'TEXT');
  ensureColumn('drawing_sheets', 'approver_date', 'TEXT');
  ensureColumn('drawing_sheets', 'general_notes', 'TEXT');
  ensureColumn('drawing_sheets', 'treatment', 'TEXT');
  ensureColumn('drawing_sheets', 'standard_ref', "TEXT DEFAULT 'ISO 128 / ISO 7200'");
  ensureColumn('drawing_sheets', 'customer', 'TEXT');
  ensureColumn('drawing_sheets', 'template_id', "TEXT DEFAULT 'iso-a4-landscape'");
}

function ensureColumn(table, column, definition) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
