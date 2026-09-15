import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('designer'),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  username: text('username'),
  role: text('role'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: integer('entity_id'),
  summary: text('summary').notNull(),
  meta: text('meta'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  docNumber: text('doc_number').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameVn: text('name_vn'),
  docType: text('doc_type').notNull(),
  revision: text('revision').notNull().default('-'),
  status: text('status').notNull().default('draft'),
  projectId: integer('project_id').references(() => projects.id),
  createdBy: integer('created_by').references(() => users.id),
  filePath: text('file_path'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const documentRevisions = sqliteTable('document_revisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').references(() => documents.id),
  revision: text('revision').notNull(),
  changeDesc: text('change_desc'),
  ecrId: integer('ecr_id'),
  filePath: text('file_path'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bomHeaders = sqliteTable('bom_headers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').references(() => documents.id),
  assemblyNo: text('assembly_no').notNull(),
  revision: text('revision').notNull().default('-'),
  totalItems: integer('total_items').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bomItems = sqliteTable('bom_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bomId: integer('bom_id').references(() => bomHeaders.id, { onDelete: 'cascade' }),
  itemNo: integer('item_no').notNull(),
  level: integer('level').notNull().default(1),
  partNumber: text('part_number').notNull(),
  descEn: text('desc_en').notNull(),
  descVn: text('desc_vn'),
  qty: real('qty').notNull().default(1),
  unit: text('unit').default('pcs'),
  material: text('material'),
  vendor: text('vendor'),
  unitCost: real('unit_cost'),
  leadTime: text('lead_time'),
  remarks: text('remarks'),
});

export const ecr = sqliteTable('ecr', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ecrNumber: text('ecr_number').notNull().unique(),
  title: text('title').notNull(),
  reason: text('reason').notNull(),
  description: text('description'),
  changeType: text('change_type').notNull(),
  priority: text('priority').default('normal'),
  status: text('status').default('open'),
  originatedBy: integer('originated_by').references(() => users.id),
  projectId: integer('project_id').references(() => projects.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  closedAt: text('closed_at'),
});

export const ecrAffectedItems = sqliteTable('ecr_affected_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ecrId: integer('ecr_id').references(() => ecr.id, { onDelete: 'cascade' }),
  documentId: integer('document_id').references(() => documents.id),
  revBefore: text('rev_before'),
  revAfter: text('rev_after'),
  action: text('action'),
});

export const ecrApprovals = sqliteTable('ecr_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ecrId: integer('ecr_id').references(() => ecr.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  role: text('role').notNull(),
  decision: text('decision').default('pending'),
  comment: text('comment'),
  decidedAt: text('decided_at'),
});

export const ecnNotifications = sqliteTable('ecn_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ecrId: integer('ecr_id').references(() => ecr.id, { onDelete: 'cascade' }),
  recipient: text('recipient').notNull(),
  sentAt: text('sent_at'),
  acknowledgedAt: text('acknowledged_at'),
});

export const checklistResults = sqliteTable('checklist_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').references(() => documents.id),
  checklistType: text('checklist_type').notNull(),
  revision: text('revision').notNull(),
  results: text('results').notNull(),
  overall: text('overall'),
  checkedBy: integer('checked_by').references(() => users.id),
  checkedAt: text('checked_at').default(sql`CURRENT_TIMESTAMP`),
  remarks: text('remarks'),
});

export const wiContent = sqliteTable('wi_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').unique().references(() => documents.id, { onDelete: 'cascade' }),
  meta: text('meta').notNull().default('{}'),
  steps: text('steps').notNull().default('[]'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const catalogContent = sqliteTable('catalog_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').unique().references(() => documents.id, { onDelete: 'cascade' }),
  data: text('data').notNull().default('{}'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bomSnapshots = sqliteTable('bom_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bomId: integer('bom_id').references(() => bomHeaders.id, { onDelete: 'cascade' }),
  revision: text('revision').notNull(),
  items: text('items').notNull(),
  totalCost: real('total_cost'),
  note: text('note'),
  snapshottedBy: integer('snapshotted_by').references(() => users.id),
  snapshottedAt: text('snapshotted_at').default(sql`CURRENT_TIMESTAMP`),
});

export const drawingSheets = sqliteTable('drawing_sheets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').unique().references(() => documents.id, { onDelete: 'cascade' }),
  viewFront: text('view_front'),
  viewTop: text('view_top'),
  viewSide: text('view_side'),
  viewIso: text('view_iso'),
  dimX: real('dim_x'),
  dimY: real('dim_y'),
  dimZ: real('dim_z'),
  triangles: integer('triangles'),
  sourceFile: text('source_file'),
  notes: text('notes'),
  scale: text('scale').default('1:1'),
  projection: text('projection').default('third_angle'),
  tolerance: text('tolerance').default('ISO 2768-mK'),
  material: text('material'),
  surfaceFinish: text('surface_finish'),
  // ISO 7200 extras
  weight: real('weight'),
  sheetSize: text('sheet_size').default('A4'),
  designer: text('designer'),
  checker: text('checker'),
  approver: text('approver'),
  approverDate: text('approver_date'),
  generalNotes: text('general_notes'),
  treatment: text('treatment'),
  standardRef: text('standard_ref').default('ISO 128 / ISO 7200'),
  customer: text('customer'),
  templateId: text('template_id').default('iso-a4-landscape'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const models3d = sqliteTable('models_3d', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').references(() => documents.id),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  format: text('format'),
  dimX: real('dim_x'),
  dimY: real('dim_y'),
  dimZ: real('dim_z'),
  triangles: integer('triangles'),
  uploadedBy: integer('uploaded_by').references(() => users.id),
  uploadedAt: text('uploaded_at').default(sql`CURRENT_TIMESTAMP`),
});

export const costSettings = sqliteTable('cost_settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull().default('{}'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const quotes = sqliteTable('quotes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quoteNumber: text('quote_number').notNull().unique(),
  title: text('title').notNull(),
  customer: text('customer'),
  documentId: integer('document_id').references(() => documents.id),
  currency: text('currency').notNull().default('VND'),
  sets: integer('sets').notNull().default(1),
  partCount: integer('part_count').notNull().default(0),
  totalCost: real('total_cost'),
  totalPrice: real('total_price'),
  status: text('status').notNull().default('draft'),
  data: text('data').notNull().default('{}'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});
