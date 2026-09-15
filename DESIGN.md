# DESIGN.md — UI Design System & Specifications

## Design philosophy

Industrial-utilitarian aesthetic inspired by JLCPCB and modern PLM tools. The interface should feel like a professional engineering tool — clean, information-dense when needed, but never cluttered. Every element serves a purpose.

**Core principles:**
- Clean card-based layout with generous whitespace
- Blue primary accent (professional, trustworthy — matches engineering tools)
- Information hierarchy through typography weight and color, not decoration
- Bilingual labels are a first-class requirement, not an afterthought
- Forms and checklists must be fast to complete (keyboard shortcuts, tab navigation)

**Reference:** JLCPCB Parts Manager UI — flat cards, subtle borders, blue accents, sidebar navigation with grouped sections and icons.

---

## Color system

### Primary palette

```css
:root {
  /* Primary blue — used for actions, active states, links */
  --primary-50:   #eff6ff;
  --primary-100:  #dbeafe;
  --primary-200:  #bfdbfe;
  --primary-300:  #93c5fd;
  --primary-400:  #60a5fa;
  --primary-500:  #1a6ff5;   /* Main brand blue */
  --primary-600:  #1558cc;
  --primary-700:  #0d4fba;
  --primary-800:  #1e3a5f;
  --primary-900:  #1a2744;

  /* Neutral gray — text, borders, backgrounds */
  --gray-50:    #f9fafb;
  --gray-100:   #f3f4f6;
  --gray-200:   #e5e7eb;
  --gray-300:   #d1d5db;
  --gray-400:   #9ca3af;
  --gray-500:   #6b7280;
  --gray-600:   #4b5563;
  --gray-700:   #374151;
  --gray-800:   #1f2937;
  --gray-900:   #111827;
}
```

### Semantic colors

```css
:root {
  /* Status colors — used for badges, alerts, indicators */
  --success:    #10b981;   /* Released, Pass, OK */
  --success-bg: #d1fae5;
  --success-fg: #065f46;

  --warning:    #f59e0b;   /* Draft, In Review, Pending */
  --warning-bg: #fef3c7;
  --warning-fg: #92400e;

  --danger:     #ef4444;   /* NG, Fail, Reject, Obsolete */
  --danger-bg:  #fee2e2;
  --danger-fg:  #991b1b;

  --info:       #3b82f6;   /* Info, In Review */
  --info-bg:    #dbeafe;
  --info-fg:    #1e40af;

  /* Workflow phase colors */
  --phase-design:  #7c3aed;   /* Purple — design phase */
  --phase-review:  #0f6e56;   /* Teal — review phase */
  --phase-publish: #1a6ff5;   /* Blue — publish phase */
  --phase-change:  #d4537e;   /* Pink — change management */
  --phase-deliver: #d85a30;   /* Coral — delivery/output */
}
```

### Document status color mapping

| Status | Background | Text | Border | Usage |
|--------|-----------|------|--------|-------|
| Draft | `#fef3c7` | `#92400e` | `#fbbf24` | New, not yet reviewed |
| In Review | `#dbeafe` | `#1e40af` | `#60a5fa` | Submitted for approval |
| Approved | `#d1fae5` | `#065f46` | `#34d399` | Internally approved |
| Released | `#e0e7ff` | `#3730a3` | `#818cf8` | Officially published |
| Obsolete | `#fee2e2` | `#991b1b` | `#f87171` | Superseded, do not use |

---

## Typography

### Font stack

```css
/* Primary — used everywhere */
font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace — part numbers, dimensions, code, revision numbers */
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

Import from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Scale

| Role | Size | Weight | Color | Usage |
|------|------|--------|-------|-------|
| Page title | 20px | 700 | gray-900 | h1, page headers |
| Section title | 15px | 600 | gray-800 | Card headers, section labels |
| Body | 13–14px | 400 | gray-700 | General content, descriptions |
| Small / Caption | 12px | 400 | gray-500 | Timestamps, hints, secondary info |
| Tiny / Label | 10–11px | 600 | gray-400 | Group headers in sidebar, table column headers |
| Mono values | 13px | 500 | gray-900 | Part numbers, dimensions, revision codes |

### Rules
- Vietnamese text uses the same font (DM Sans supports Vietnamese diacritics well)
- Bilingual labels: English first, Vietnamese below in smaller/lighter style
- Never bold entire sentences — only key terms or values
- Line height: 1.5 for body text, 1.3 for headings

---

## Layout

### Page structure

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (240px / 56px collapsed)  │  Content Area   │
│  ┌────────────────────────────────┐│                 │
│  │ Logo + App Name               ││  ┌───────────┐  │
│  ├────────────────────────────────┤│  │ Page Title │  │
│  │ OVERVIEW                      ││  │ + Subtitle │  │
│  │   Dashboard                   ││  ├───────────┤  │
│  │ DESIGN                        ││  │           │  │
│  │   3D Viewer                   ││  │  Content  │  │
│  │   BOM Manager                 ││  │  (cards,  │  │
│  │ REVIEW                        ││  │  tables,  │  │
│  │   Drawing Checklist           ││  │  forms)   │  │
│  │   DFM/DFA Review              ││  │           │  │
│  │ PUBLISH                       ││  │           │  │
│  │   WI Document                 ││  │           │  │
│  │   Catalog / Datasheet         ││  │           │  │
│  │   Release                     ││  └───────────┘  │
│  │ CHANGE                        ││                 │
│  │   ECR/ECO/ECN                 ││                 │
│  │   Doc Tracker                 ││                 │
│  ├────────────────────────────────┤│                 │
│  │ Version info                  ││                 │
│  └────────────────────────────────┘│                 │
└──────────────────────────────────────────────────────┘
```

### Spacing system (based on 4px grid)

```
4px   — tight spacing within components (icon to label gap)
8px   — compact spacing (between inline elements)
12px  — default inner padding (inside badges, small cards)
16px  — gap between cards in a grid
20px  — card padding, section spacing
24px  — page padding (content area)
32px  — vertical gap between page sections
```

### Grid patterns

- **Dashboard stats:** 4 columns (responsive: 2 on tablet, 1 on mobile)
- **Dashboard main:** 2 columns (content + sidebar, ratio ~2:1)
- **Card grids:** `repeat(auto-fill, minmax(280px, 1fr))`
- **Checklists:** single column, full width
- **3D Viewer:** main view + info panel (side by side, info panel 240px fixed)

---

## Components

### Card

The primary container for all content. Every section of a page is a card.

```css
.card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 20px;
  transition: box-shadow 0.2s ease;
}
.card:hover {
  /* Only for clickable cards */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

No drop shadows by default. Only on hover for interactive cards.

### Badge (status)

```
┌─────────────┐
│  Released    │  Pill shape, background + text color from status map
└─────────────┘

font-size: 11px
font-weight: 600
padding: 2px 10px
border-radius: 20px (full pill)
```

### StatCard (dashboard)

```
┌─────────────────────────────────┐
│  [icon]  22px bold value        │
│          12px label             │
│          11px secondary info    │
└─────────────────────────────────┘

Icon container: 44x44px, rounded-10, colored background (tinted)
```

### Sidebar nav item

```
Active state:
  background: var(--primary-100)
  color: var(--primary-500)
  font-weight: 600
  border-right: 3px solid var(--primary-500)

Default state:
  background: transparent
  color: var(--gray-500)
  font-weight: 400
  border-right: 3px solid transparent

Hover state:
  background: var(--gray-50)
```

### Table

```css
/* Header row */
th {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--gray-500);
  padding: 8px 10px;
  border-bottom: 2px solid var(--gray-200);
  text-align: left;
}

/* Data rows */
td {
  font-size: 13px;
  padding: 10px;
  border-bottom: 1px solid var(--gray-200);
}

/* Monospace cells (part numbers, revisions) */
td.mono {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  color: var(--primary-500);
}
```

No zebra striping. Use border-bottom only. Hover highlight row optional.

### Checklist item row

```
┌────┬──────────────────────┬──────────────────────┬──────┬──────┐
│ 1  │ English text          │ Vietnamese text       │ [OK] │ [NG] │
└────┴──────────────────────┴──────────────────────┴──────┴──────┘

Grid: 32px | 1fr | 1fr | 60px | 60px

OK button active: bg #d1fae5, border #10b981, text #065f46
NG button active: bg #fee2e2, border #ef4444, text #991b1b
Default: transparent, border gray-200, text gray-400
```

### Button variants

```
Primary:   bg primary-500, text white, rounded-8
           hover: bg primary-600
           
Secondary: bg transparent, border gray-300, text gray-700, rounded-8
           hover: bg gray-50
           
Danger:    bg transparent, border danger, text danger, rounded-8
           hover: bg danger-bg
           
Ghost:     bg transparent, text primary-500
           hover: bg primary-50

Size: padding 8px 20px, font-size 13px, font-weight 500
Small: padding 5px 12px, font-size 12px
```

### File upload / drop zone

```
┌─────────────────────────────────────────┐
│                                         │
│         [icon: upload-cloud]            │
│                                         │
│     Kéo thả file vào đây               │
│     Drop file here to upload            │
│                                         │
│          [ Browse / Chọn file ]         │
│                                         │
└─────────────────────────────────────────┘

border: 2px dashed var(--gray-300)
border-radius: 16px
background: transparent

Drag hover state:
  border-color: var(--primary-500)
  background: var(--primary-50)
```

### Modal / Dialog

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}
.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
```

---

## Page specifications

### Dashboard

Stats row → Recent docs table + Quick actions sidebar

Quick action cards: icon + bilingual label, full-width buttons stacked vertically.
Workflow info banner at bottom of sidebar (blue tinted card).

### 3D Viewer

Header: title + upload button (primary blue).
Main area: Three.js canvas in a card (no padding). Drag-drop overlay when no file loaded.
Side panel (when model loaded): dimensions with color-coded axis dots, triangle count, wireframe toggle, color swatches.
Bottom bar: view angle buttons (front/back/left/right/top/iso) in a pill-shaped group.

### Drawing Checklist / DFM Review

Progress bar in header area: `X OK / Y NG / Z total` with green fill bar.
Sections as separate cards. Each card has a section icon + title.
Each item is a 5-column grid row with OK/NG buttons.

### BOM Manager

Editable table with inline editing (click cell to edit).
BOM level column with indentation (level 0 = no indent, level 1 = 16px, level 2 = 32px).
Level 0 rows: light blue background. Level 1: white. Level 2: gray-50.
Actions column: delete button (ghost danger).
Footer: total items count + total cost.
Toolbar: Add Item, Import Excel, Export Excel, Compare Revisions.

### ECR / ECO / ECN

Kanban-style or list view of ECRs by status.
ECR detail modal: form with reason, affected items (searchable doc list), change type radio buttons, priority select.
Approval section: role + name + approve/reject buttons.
Timeline view showing ECR → ECO → ECN progression.

### Document Tracker

Filterable, sortable table with all documents.
Filters: status (multi-select chips), type (multi-select), date range.
Search bar searches doc number + name.
Bulk status update for manager role.

### Release Manager

Three-column layout matching the three output branches:
- Column A (coral accent): Vendor package
- Column B (blue accent): OEM package  
- Column C (amber accent): Sales package

Each column is a checklist card. All three must pass before release button activates.

---

## Iconography

Use Tabler Icons (outline style) — already loaded in the artifact environment.

### Icon mapping for navigation

| Page | Icon |
|------|------|
| Dashboard | `ti-layout-dashboard` |
| 3D Viewer | `ti-3d-cube-sphere` |
| BOM Manager | `ti-list-details` |
| Drawing Checklist | `ti-checklist` |
| DFM Review | `ti-settings-check` |
| WI Document | `ti-file-description` |
| Catalog | `ti-presentation` |
| Release | `ti-rocket` |
| ECR/ECO/ECN | `ti-replace` |
| Doc Tracker | `ti-timeline` |

### Status icons

| Status | Icon |
|--------|------|
| Draft | `ti-edit` |
| In Review | `ti-clock` |
| Approved | `ti-circle-check` |
| Released | `ti-send` |
| Obsolete | `ti-archive` |

---

## Responsive breakpoints

```css
/* Desktop (default) */
/* Everything as designed above */

/* Tablet (< 1024px) */
@media (max-width: 1024px) {
  /* Sidebar collapses to icon-only (56px) */
  /* Dashboard stats: 2 columns */
  /* 3D viewer: info panel stacks below */
}

/* Mobile (< 640px) */
@media (max-width: 640px) {
  /* Sidebar becomes bottom tab bar (56px height) */
  /* Only show 5 most important pages as tabs */
  /* Dashboard stats: 1 column */
  /* Checklists: hide VN column, show on expand */
  /* Tables: horizontal scroll */
}
```

---

## Animation

Minimal, purposeful animations only:

```css
/* Page transitions */
.page-enter { opacity: 0; transform: translateY(8px); }
.page-enter-active { opacity: 1; transform: translateY(0); transition: all 0.2s ease; }

/* Card hover */
.card-interactive:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

/* Button press */
button:active { transform: scale(0.98); }

/* Status change */
.badge { transition: all 0.15s ease; }

/* Sidebar collapse */
.sidebar { transition: width 0.2s ease; }

/* Progress bar fill */
.progress-fill { transition: width 0.3s ease; }
```

No loading spinners — use skeleton screens (gray pulsing blocks) for loading states.

---

## Dark mode (Phase 3)

Not needed initially. When implemented, swap:
- Backgrounds: `#0e1117` (page), `#161b22` (cards), `#21262d` (elevated)
- Text: `#e6edf3` (primary), `#8b949e` (secondary)
- Borders: `#30363d`
- Primary blue stays the same
- Status colors stay the same (they work on both light and dark)

---

## File references

| File | Purpose |
|------|---------|
| `Drawing_Publishing_Tool.jsx` | Working prototype — extract components from here |
| `3D_Viewer_STL.jsx` | Standalone 3D viewer (fuller version with color picker) |
| `Master_Plan_Technical_Drawing_Publishing.md` | Full workflow documentation |
| `Title_Block_Guide_ISO7200.md` | ISO 7200 title block setup guide |
| `Drawing_Checklist_and_ECR.xlsx` | Checklist + ECR form + Doc tracker templates |
| `BOM_Template.xlsx` | BOM template with sample data |
| `DFM_and_Release_Checklists.xlsx` | DFM + Release checklist templates |
| `WI_Template.docx` | Work instruction template |
| `Product_Datasheet_Template.docx` | Catalog/datasheet template |
