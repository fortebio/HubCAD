# CLAUDE.md — Technical Drawing Publishing Tool

## Project overview

A web-based tool for managing the full lifecycle of technical drawings in an electronics/consumer product company. The tool covers the workflow from 3D CAD design (Inventor/Fusion 360) through 2D drawing creation, review, approval, and distribution to three audiences: machining vendors, OEM factories, and sales/web teams.

**Target user:** Small engineering team (1–3 people) in Vietnam, working with international vendors.
**Language:** Bilingual English + Vietnamese throughout all UI and documents.
**Industry:** Electronics & consumer product manufacturing.
**Standards:** ISO 128, ISO 7200, ISO 2768, ISO 1101, IPC-2221, ISO 9001.

## Tech stack

```
Frontend:  React 18 + Vite
Styling:   Tailwind CSS (migrate from inline styles in prototype)
3D:        Three.js (STL/OBJ/STEP viewer)
State:     Zustand (lightweight, good for small teams)
Backend:   Node.js + Express (or Fastify)
Database:  SQLite (via better-sqlite3) for simplicity — single file, no server needed
           Migrate to PostgreSQL later if team grows
ORM:       Drizzle ORM (type-safe, lightweight)
File storage: Local filesystem with structured folders
PDF export:   @react-pdf/renderer or Puppeteer for server-side PDF generation
Auth:      Simple JWT with bcrypt — 3 roles: designer, reviewer, manager
```

## Project structure

```
drawing-tool/
├── CLAUDE.md                    # This file
├── DESIGN.md                    # Design system & UI specs
├── package.json
├── vite.config.js
├── drizzle.config.ts
├── .env.example
│
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Router + layout
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx      # Navigation sidebar (collapsible)
│   │   │   ├── Header.jsx       # Top bar with breadcrumb + user
│   │   │   └── PageWrapper.jsx  # Consistent page padding/scroll
│   │   │
│   │   ├── ui/                  # Reusable UI primitives
│   │   │   ├── Badge.jsx        # Status badges (Draft/Approved/Released/Obsolete)
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Table.jsx        # Sortable, filterable table
│   │   │   ├── Modal.jsx
│   │   │   ├── FileUpload.jsx   # Drag & drop zone
│   │   │   ├── CheckItem.jsx    # OK/NG toggle row for checklists
│   │   │   ├── ProgressBar.jsx
│   │   │   └── StatCard.jsx     # Dashboard metric card
│   │   │
│   │   ├── viewer/
│   │   │   ├── STLViewer.jsx    # Three.js 3D viewer (DONE in prototype)
│   │   │   ├── ViewControls.jsx # View angle buttons
│   │   │   └── ModelInfo.jsx    # Dimensions + triangle count panel
│   │   │
│   │   ├── quote/
│   │   │   ├── QuotePartRow.jsx     # One part: material/process/finish + breakdown
│   │   │   └── ProcessComparison.jsx # Every route ranked by unit price
│   │   │
│   │   └── forms/
│   │       ├── ECRForm.jsx      # ECR/ECO submission form
│   │       ├── BOMEditor.jsx    # Inline-editable BOM table
│   │       └── WIEditor.jsx     # Step-by-step WI editor with image upload
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Viewer3D.jsx
│   │   ├── BOMManager.jsx
│   │   ├── QuoteEstimator.jsx   # Mass · process choice · quotation
│   │   ├── CostSettings.jsx     # Manager-only rate card
│   │   ├── DrawingChecklist.jsx
│   │   ├── DFMReview.jsx
│   │   ├── WIDocument.jsx
│   │   ├── CatalogDatasheet.jsx
│   │   ├── ReleaseManager.jsx
│   │   ├── ECRManager.jsx
│   │   └── DocTracker.jsx
│   │
│   ├── stores/
│   │   ├── useDocStore.js       # Document state (CRUD, status transitions)
│   │   ├── useBOMStore.js       # BOM state
│   │   ├── useECRStore.js       # ECR/ECO/ECN state
│   │   └── useAuthStore.js      # Auth state
│   │
│   ├── lib/
│   │   ├── db.js                # Database connection
│   │   ├── api.js               # API client (fetch wrapper)
│   │   ├── pdf.js               # PDF generation helpers
│   │   ├── stlParser.js         # STL binary/ASCII parser (DONE)
│   │   ├── objParser.js         # OBJ parser (DONE)
│   │   ├── massProperties.js    # Volume, area, footprint, watertight check
│   │   ├── costing/             # Estimator: geometry + rates → price
│   │   │   ├── defaults.js      # Default materials, process rates, finishes
│   │   │   ├── processes.js     # Cost model per process
│   │   │   ├── estimate.js      # estimatePart / suggestForPart / estimateQuote
│   │   │   └── format.js        # Money, mass, volume formatting
│   │   └── partNumber.js        # Part numbering system utilities
│   │
│   └── data/
│       ├── checklistItems.js    # Drawing checklist items (29 items, DONE)
│       ├── dfmItems.js          # DFM/DFA checklist items (33 items, DONE)
│       └── releaseItems.js      # Release checklist items (26 items)
│
├── server/
│   ├── index.js                 # Express server entry
│   ├── routes/
│   │   ├── documents.js         # CRUD for documents
│   │   ├── bom.js               # BOM management
│   │   ├── ecr.js               # ECR/ECO/ECN workflow
│   │   ├── quotes.js            # Quotations + PDF/Excel export
│   │   ├── costSettings.js      # Rate card (manager only)
│   │   ├── files.js             # File upload/download
│   │   └── auth.js              # Login, register, roles
│   │
│   ├── db/
│   │   ├── schema.js            # Drizzle schema definitions
│   │   └── migrations/          # Auto-generated migrations
│   │
│   └── services/
│       ├── pdfGenerator.js      # Generate PDF with watermark
│       ├── notifier.js          # Email/notification service
│       └── fileManager.js       # File naming, archival, version control
│
├── uploads/                     # User uploaded files (3D models, images)
│   ├── models/                  # STL, STEP, OBJ files
│   ├── images/                  # Product photos, process photos
│   └── documents/               # Generated PDFs, exported docs
│
├── templates/                   # Document templates (from Phase 1)
│   ├── Drawing_Checklist_and_ECR.xlsx
│   ├── BOM_Template.xlsx
│   ├── DFM_and_Release_Checklists.xlsx
│   ├── WI_Template.docx
│   ├── Product_Datasheet_Template.docx
│   └── Title_Block_Guide_ISO7200.md
│
└── docs/
    ├── Master_Plan.md           # Full system plan (DONE)
    └── DESIGN.md                # Symlink or copy of design spec
```

## Database schema

```sql
-- Core tables

CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,          -- bcrypt hashed
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'designer',  -- designer | reviewer | manager
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,   -- e.g., "PRD-X"
  description TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number  TEXT UNIQUE NOT NULL,   -- e.g., "DWG-001", "WI-001", "CAT-001"
  name_en     TEXT NOT NULL,
  name_vn     TEXT,
  doc_type    TEXT NOT NULL,          -- machining | wi | catalog | bom
  revision    TEXT NOT NULL DEFAULT '-',
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | in_review | approved | released | obsolete
  project_id  INTEGER REFERENCES projects(id),
  created_by  INTEGER REFERENCES users(id),
  file_path   TEXT,                   -- path to latest file
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_revisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  revision    TEXT NOT NULL,
  change_desc TEXT,
  ecr_id      INTEGER REFERENCES ecr(id),
  file_path   TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BOM tables

CREATE TABLE bom_headers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  assembly_no TEXT NOT NULL,
  revision    TEXT NOT NULL DEFAULT '-',
  total_items INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bom_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bom_id      INTEGER REFERENCES bom_headers(id),
  item_no     INTEGER NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1,  -- 0=assembly, 1=component, 2=sub, 3=raw
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

-- ECR/ECO/ECN tables

CREATE TABLE ecr (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_number  TEXT UNIQUE NOT NULL,    -- e.g., "ECR-001"
  title       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  change_type TEXT NOT NULL,           -- design | material | process | document
  priority    TEXT DEFAULT 'normal',   -- low | normal | high | urgent
  status      TEXT DEFAULT 'open',     -- open | in_review | approved | rejected | implemented | closed
  originated_by INTEGER REFERENCES users(id),
  project_id  INTEGER REFERENCES projects(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at   DATETIME
);

CREATE TABLE ecr_affected_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_id      INTEGER REFERENCES ecr(id),
  document_id INTEGER REFERENCES documents(id),
  rev_before  TEXT,
  rev_after   TEXT,
  action      TEXT                     -- update | add | remove | replace
);

CREATE TABLE ecr_approvals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_id      INTEGER REFERENCES ecr(id),
  user_id     INTEGER REFERENCES users(id),
  role        TEXT NOT NULL,           -- design | quality | production | manager
  decision    TEXT,                    -- pending | approved | rejected
  comment     TEXT,
  decided_at  DATETIME
);

CREATE TABLE ecn_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ecr_id      INTEGER REFERENCES ecr(id),
  recipient   TEXT NOT NULL,           -- vendor | oem | quality | sales
  sent_at     DATETIME,
  acknowledged_at DATETIME
);

-- Checklist results

CREATE TABLE checklist_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  checklist_type TEXT NOT NULL,        -- drawing | dfm | release
  revision    TEXT NOT NULL,
  results     TEXT NOT NULL,           -- JSON: {"0-0": "ok", "0-1": "ng", ...}
  overall     TEXT,                    -- pass | fail | conditional
  checked_by  INTEGER REFERENCES users(id),
  checked_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  remarks     TEXT
);

-- Cost estimation & quotations

CREATE TABLE cost_settings (          -- single row (id = 1): the shop rate card
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  data        TEXT NOT NULL DEFAULT '{}',  -- JSON: commercial + materials + processes + finishes
  updated_by  INTEGER REFERENCES users(id),
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quotes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_number TEXT UNIQUE NOT NULL,   -- e.g., "QT-2605-001"
  title       TEXT NOT NULL,
  customer    TEXT,
  document_id INTEGER REFERENCES documents(id),
  currency    TEXT NOT NULL DEFAULT 'VND',
  sets        INTEGER NOT NULL DEFAULT 1,
  part_count  INTEGER NOT NULL DEFAULT 0,
  total_cost  REAL,                    -- shop cost
  total_price REAL,                    -- quoted price incl. margin
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | accepted | rejected
  data        TEXT NOT NULL DEFAULT '{}',     -- full payload: parts, geometry stats, choices
  created_by  INTEGER REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3D model metadata

CREATE TABLE models_3d (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id),
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_size   INTEGER,
  format      TEXT,                    -- stl | obj | step | ipt | iam
  dim_x       REAL,
  dim_y       REAL,
  dim_z       REAL,
  triangles   INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API routes

```
Auth:
  POST   /api/auth/login              { username, password } → { token, user }
  POST   /api/auth/register           { username, password, full_name, role }

Documents:
  GET    /api/documents               ?status=&type=&project_id=
  GET    /api/documents/:id
  POST   /api/documents               { doc_number, name_en, name_vn, doc_type, project_id }
  PATCH  /api/documents/:id           { name_en, status, ... }
  PATCH  /api/documents/:id/status    { status, comment }  -- triggers workflow
  GET    /api/documents/:id/revisions

BOM:
  GET    /api/bom/:document_id
  POST   /api/bom                     { document_id, assembly_no, items: [...] }
  PUT    /api/bom/:id                 { items: [...] }
  GET    /api/bom/:id/compare/:rev    -- compare two revisions
  GET    /api/bom/:id/cost            -- calculate total cost

ECR:
  GET    /api/ecr                     ?status=&priority=
  POST   /api/ecr                     { title, reason, change_type, affected_items: [...] }
  PATCH  /api/ecr/:id/approve         { decision, comment }
  POST   /api/ecr/:id/notify          { recipients: [...] }
  GET    /api/ecr/:id/history

Files:
  POST   /api/files/upload            multipart/form-data (model, image, or document)
  GET    /api/files/:id/download
  POST   /api/files/export-pdf        { document_id, watermark }

Cost & quotes:
  GET    /api/cost-settings           → { settings|null }  (null = use shipped defaults)
  PUT    /api/cost-settings           { settings }         -- manager only
  DELETE /api/cost-settings           -- reset to defaults
  GET    /api/quotes                  ?  list summaries
  GET    /api/quotes/next-number      → { quoteNumber }
  GET    /api/quotes/:id              → full payload (reopens in the estimator)
  POST   /api/quotes                  save   |  PUT /api/quotes/:id   update
  DELETE /api/quotes/:id              -- author or manager
  POST   /api/quotes/export/pdf       { meta, rows, totals } → PDF
  POST   /api/quotes/export/excel     { meta, rows, totals } → XLSX

Checklists:
  POST   /api/checklists              { document_id, checklist_type, results }
  GET    /api/checklists/:document_id ?type=
```

## Status workflow

Documents follow a strict lifecycle:

```
Draft ──→ In Review ──→ Approved ──→ Released ──→ Obsolete
  ↑           │              │
  └───────────┘              │   (ECR triggers new revision)
        (rejected)           │
                             ↓
                    New revision (Draft)
```

Transition rules:
- `draft → in_review`: requires all checklist items passed (no NG)
- `in_review → approved`: requires reviewer sign-off (role: reviewer or manager)
- `approved → released`: requires manager sign-off + release checklist passed
- `released → obsolete`: only via ECR/ECO process
- Any status can return to `draft` if rejected (creates audit log entry)

## File naming convention

```
[PartNo]_[DocType]_Rev[X]_[YYYYMMDD].[ext]

Examples:
  HSG-001_DWG_RevA_20260514.pdf
  HSG-001_WI_Rev01_20260514.pdf
  HSG-001_SPEC_Rev01_20260514.pdf
  HSG-001_BOM_RevA_20260514.xlsx
```

## Part numbering

```
[Category]-[Sequential]-[Rev]

Categories:
  HSG = Housing / Vỏ
  PCB = Circuit board / Bo mạch
  BRK = Bracket / Giá đỡ
  FAS = Fastener / Phụ kiện kết nối
  CAB = Cable / Dây cáp
  LBL = Label / Nhãn
  PKG = Packaging / Bao bì

Part revisions: A, B, C... (skip I, O, Q, S, X, Z)
Document revisions: 01, 02, 03...
```

## Current status

### Done (prototype in single JSX file):
- [x] Dashboard with stats, recent docs table, quick actions
- [x] 3D STL Viewer with orbit controls, dimensions, wireframe toggle
- [x] Drawing Checklist (15 interactive items with OK/NG/progress)
- [x] DFM/DFA Checklist (15 interactive items)
- [x] Sidebar navigation (collapsible, grouped by phase)
- [x] UI placeholder cards for all other pages
- [x] Excel templates: Drawing Checklist, ECR/ECO, BOM, DFM, Release, Doc Tracker
- [x] Word templates: WI, Product Datasheet
- [x] Master Plan document (bilingual)
- [x] Title Block Guide (ISO 7200)

### TODO — Phase 1 (core CRUD):
- [ ] Split prototype into component files per structure above
- [ ] Set up Vite + React + Tailwind
- [ ] Implement SQLite database with schema
- [ ] Build Document CRUD (create, list, edit, status transitions)
- [ ] Build BOM Editor (inline editable table, multi-level, import from Excel)
- [ ] Build ECR form and approval workflow
- [ ] File upload for 3D models and images
- [ ] Persist checklist results to database

### Done — Cost estimation & quotation:
- [x] Mass properties from mesh (volume, surface, footprint, watertight check)
- [x] Process suggestion: CNC mill/turn, FDM, resin, SLS, laser, injection moulding
- [x] Per-part and whole-quote pricing with cost/margin split, VND + USD
- [x] Manager-editable rate card (materials, process rates, finishes, commercial)
- [x] Quote save/reopen + PDF and Excel export
- [x] Viewer shows volume, mass and the suggested route; mass feeds the title block

### Done — Assembly explorer (3D viewer, inspired by Core Matter "Humanoid Atlas"):
- [x] STEP/IGES/BREP assemblies keep their tree: one part per placed body with name, assembly path and CAD colour (`parseCadParts`, `stepParser.splitParts`)
- [x] Parts auto-sorted into bilingual systems (housing / bracket / PCB / fastener / cable / purchased / label / packaging / other) from part-number prefix + EN/VN keywords (`src/lib/assemblyLayers.js`); operator can override per part
- [x] Systems panel: per-system switch, count, "only this", show/hide all; searchable grouped part list
- [x] Explode slider 0–100 %: assembled → "component inventory" sheet (shelf-packed by system, facing the camera) (`src/lib/explodeLayout.js`)
- [x] Click-to-inspect in the viewport (raycast), selection highlight, isolate part, fit visible
- [x] BOM from assembly: instances aggregated by body name with mass and size, CSV copy, hand-off banner into BOM Manager
- [x] Assembly tree card + drill-down: focus any sub-assembly (breadcrumb "Back | All › …", Esc steps out); duplicate sibling assemblies numbered "(2)" at parse time (`src/lib/assemblyTree.js`)
- [x] Hover tooltip (part name + system) via per-frame raycast; pointer cursor over parts
- [x] "Quote assembly / sub-assembly": viewer writes `quote:viewerScope`, Quote page (`/quote?from=viewer`) aggregates identical bodies into one line with qty and skips standard fasteners

### TODO — Phase 2 (export & integration):
- [ ] PDF export with watermark (Preliminary / For Production / Approved)
- [ ] WI Document editor with step-by-step photos
- [ ] Catalog/Datasheet builder
- [ ] BOM cost calculation and revision comparison
- [ ] Document search and filter (Doc Tracker page)

### TODO — Phase 3 (polish):
- [ ] Authentication (JWT, 3 roles)
- [ ] Email notification for ECN
- [ ] Dashboard charts (documents by status, ECR trend)
- [ ] STEP file viewer (via OpenCascade.js or similar)
- [ ] Responsive mobile layout
- [ ] Data backup/export

## Key decisions

1. **SQLite over PostgreSQL**: Team is 1–3 people. SQLite is zero-config, single file, easy backup. Migrate later if needed.
2. **Bilingual everywhere**: Every user-facing string has EN + VN. Use a simple object `{ en: "...", vn: "..." }` pattern, not i18n library (overkill for 2 languages).
3. **Checklist items are hardcoded**: The 29 drawing checks, 33 DFM checks, and 26 release checks are stable (based on ISO standards). Store as JS constants, not in DB. Only checklist *results* go in DB.
4. **No real-time collaboration**: Small team, not needed. Simple optimistic UI with last-write-wins.
5. **File-based storage**: Upload files to local `uploads/` directory. No S3/cloud needed at this scale. Structured by `uploads/{type}/{partNo}/Rev{X}/`.

## Commands

```bash
# Development
npm install
npm run dev          # Vite dev server (frontend)
npm run server       # Express server (backend)
npm run dev:all      # Concurrently run both

# Database
npm run db:migrate   # Run Drizzle migrations
npm run db:seed      # Seed with sample data
npm run db:reset     # Drop and recreate

# Build
npm run build        # Production build
npm run preview      # Preview production build
```

## Environment variables

```env
PORT=3001
DATABASE_URL=./data/drawing-tool.db
JWT_SECRET=your-secret-here
UPLOAD_DIR=./uploads
```

## Important notes for Claude Code

- The prototype JSX file (`Drawing_Publishing_Tool.jsx`) contains working code for Dashboard, 3D Viewer, and Checklists. Extract and refactor, don't rewrite from scratch.
- The STL parser is tested and works for both binary and ASCII STL files. Keep it.
- Three.js r128 is used — `OrbitControls` is NOT available. The manual orbit implementation in the prototype works correctly.
- All checklist data (drawing, DFM, release) is already defined with bilingual content. Move to `src/data/` files.
- The UI design follows JLCPCB's clean card-based style. See DESIGN.md for full specifications.
- Always maintain bilingual labels. Never create a UI element with only English or only Vietnamese.
