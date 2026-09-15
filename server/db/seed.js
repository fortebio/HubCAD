import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, sqlite } from './client.js';
import { initSchema } from './init.js';
import { users, projects, documents, ecr, ecrAffectedItems, bomHeaders, bomItems } from './schema.js';

initSchema();

const userCount = sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount > 0) {
  console.log(`[seed] DB already has ${userCount} users — skipping seed.`);
  process.exit(0);
}

console.log('[seed] inserting seed data...');

const hash = (pwd) => bcrypt.hashSync(pwd, 10);

const insertedUsers = db
  .insert(users)
  .values([
    { username: 'designer', password: hash('designer'), fullName: 'Nguyễn Văn Designer', role: 'designer' },
    { username: 'reviewer', password: hash('reviewer'), fullName: 'Trần Thị Reviewer', role: 'reviewer' },
    { username: 'manager', password: hash('manager'), fullName: 'Lê Văn Manager', role: 'manager' },
  ])
  .returning()
  .all();

const designerId = insertedUsers.find((u) => u.role === 'designer').id;

const insertedProjects = db
  .insert(projects)
  .values([
    { name: 'Forte Bio Reader', code: 'PRD-A', description: 'Portable biosensor reader', createdBy: designerId },
    { name: 'Sample Cartridge', code: 'PRD-B', description: 'Disposable cartridge for reader', createdBy: designerId },
  ])
  .returning()
  .all();

const projA = insertedProjects[0].id;
const projB = insertedProjects[1].id;

const insertedDocs = db
  .insert(documents)
  .values([
    {
      docNumber: 'DWG-HSG-001',
      nameEn: 'Main housing — top cover',
      nameVn: 'Vỏ chính — nắp trên',
      docType: 'machining',
      revision: 'A',
      status: 'released',
      projectId: projA,
      createdBy: designerId,
    },
    {
      docNumber: 'DWG-HSG-002',
      nameEn: 'Main housing — bottom shell',
      nameVn: 'Vỏ chính — đáy',
      docType: 'machining',
      revision: 'B',
      status: 'approved',
      projectId: projA,
      createdBy: designerId,
    },
    {
      docNumber: 'WI-001',
      nameEn: 'Assembly work instruction — reader unit',
      nameVn: 'Hướng dẫn lắp ráp — bộ đọc',
      docType: 'wi',
      revision: '02',
      status: 'in_review',
      projectId: projA,
      createdBy: designerId,
    },
    {
      docNumber: 'CAT-001',
      nameEn: 'Product datasheet — Forte Bio Reader',
      nameVn: 'Tờ thông số — Forte Bio Reader',
      docType: 'catalog',
      revision: '01',
      status: 'draft',
      projectId: projA,
      createdBy: designerId,
    },
    {
      docNumber: 'BOM-001',
      nameEn: 'BOM — reader assembly',
      nameVn: 'Danh mục vật liệu — bộ đọc',
      docType: 'bom',
      revision: 'A',
      status: 'approved',
      projectId: projA,
      createdBy: designerId,
    },
    {
      docNumber: 'DWG-BRK-003',
      nameEn: 'PCB mounting bracket',
      nameVn: 'Giá đỡ PCB',
      docType: 'machining',
      revision: '-',
      status: 'draft',
      projectId: projB,
      createdBy: designerId,
    },
  ])
  .returning()
  .all();

const bomDocId = insertedDocs.find((d) => d.docNumber === 'BOM-001').id;

const [bomHeader] = db
  .insert(bomHeaders)
  .values([{ documentId: bomDocId, assemblyNo: 'ASM-001', revision: 'A', totalItems: 6 }])
  .returning()
  .all();

db.insert(bomItems)
  .values([
    { bomId: bomHeader.id, itemNo: 1, level: 0, partNumber: 'ASM-001', descEn: 'Reader assembly', descVn: 'Bộ đọc hoàn chỉnh', qty: 1, unit: 'pcs' },
    { bomId: bomHeader.id, itemNo: 2, level: 1, partNumber: 'HSG-001-A', descEn: 'Top cover', descVn: 'Nắp trên', qty: 1, unit: 'pcs', material: 'ABS', vendor: 'CNC-VN-01', unitCost: 12.5 },
    { bomId: bomHeader.id, itemNo: 3, level: 1, partNumber: 'HSG-002-B', descEn: 'Bottom shell', descVn: 'Vỏ đáy', qty: 1, unit: 'pcs', material: 'ABS', vendor: 'CNC-VN-01', unitCost: 14.0 },
    { bomId: bomHeader.id, itemNo: 4, level: 1, partNumber: 'PCB-001-A', descEn: 'Main PCB', descVn: 'Bo mạch chính', qty: 1, unit: 'pcs', vendor: 'JLCPCB', unitCost: 38.0 },
    { bomId: bomHeader.id, itemNo: 5, level: 1, partNumber: 'BRK-003-A', descEn: 'PCB bracket', descVn: 'Giá đỡ PCB', qty: 2, unit: 'pcs', material: 'AL-6061', vendor: 'CNC-VN-02', unitCost: 4.5 },
    { bomId: bomHeader.id, itemNo: 6, level: 1, partNumber: 'FAS-M3X8', descEn: 'M3x8 screw', descVn: 'Vít M3x8', qty: 8, unit: 'pcs', vendor: 'McMaster', unitCost: 0.05 },
  ])
  .run();

db.insert(ecr)
  .values([
    {
      ecrNumber: 'ECR-001',
      title: 'Increase wall thickness of bottom shell',
      reason: 'Drop test failure — cracks at corners',
      description: 'Change wall thickness from 2.0mm to 2.5mm on bottom shell to pass 1m drop test.',
      changeType: 'design',
      priority: 'high',
      status: 'in_review',
      originatedBy: designerId,
      projectId: projA,
    },
    {
      ecrNumber: 'ECR-002',
      title: 'Switch bracket material to AL-6061',
      reason: 'Cost reduction — supplier change',
      description: 'Replace stainless steel bracket with AL-6061 to reduce cost by ~30%.',
      changeType: 'material',
      priority: 'normal',
      status: 'approved',
      originatedBy: designerId,
      projectId: projA,
    },
  ])
  .returning()
  .all();

console.log('[seed] done.');
console.log('[seed] users: designer/designer, reviewer/reviewer, manager/manager');
process.exit(0);
