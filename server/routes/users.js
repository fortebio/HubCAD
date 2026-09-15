import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

const router = Router();

const ALLOWED_ROLES = ['designer', 'reviewer', 'manager'];

// Manager-only guard
function requireManager(req, res, next) {
  if (req.user?.role !== 'manager') {
    return res.status(403).json({ error: 'Manager role required' });
  }
  next();
}

router.get('/', requireAuth, requireManager, (_req, res) => {
  const rows = db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();
  res.json({ users: rows });
});

router.patch('/:id', requireAuth, requireManager, async (req, res) => {
  const id = Number(req.params.id);
  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { role, fullName, active, password } = req.body || {};

  const patch = {};
  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of ${ALLOWED_ROLES.join(', ')}` });
    }
    patch.role = role;
  }
  if (fullName !== undefined) patch.fullName = fullName;
  if (active !== undefined) patch.active = active ? 1 : 0;
  if (password) patch.password = await bcrypt.hash(password, 10);

  // Safety: prevent locking yourself out and prevent the last manager from
  // being demoted or deactivated.
  if (target.id === req.user.id) {
    if (patch.active === 0) return res.status(409).json({ error: 'Cannot deactivate yourself' });
    if (patch.role && patch.role !== 'manager') return res.status(409).json({ error: 'Cannot demote yourself' });
  }
  if (target.role === 'manager' && (patch.role && patch.role !== 'manager' || patch.active === 0)) {
    const otherManagers = db
      .select()
      .from(users)
      .where(eq(users.role, 'manager'))
      .all()
      .filter((u) => u.id !== target.id && u.active === 1);
    if (otherManagers.length === 0) {
      return res.status(409).json({ error: 'Cannot demote or deactivate the last active manager' });
    }
  }

  const [updated] = db.update(users).set(patch).where(eq(users.id, id)).returning().all();
  recordAudit({
    user: req.user,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    summary: `Updated user ${target.username}: ${Object.keys(patch).join(', ')}`,
    meta: { changed: Object.keys(patch), before: { role: target.role, active: target.active } },
  });
  res.json({
    user: {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      active: updated.active,
      createdAt: updated.createdAt,
    },
  });
});

router.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = Number(req.params.id);
  const target = db.select().from(users).where(eq(users.id, id)).get();
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(409).json({ error: 'Cannot delete yourself' });
  // Soft-delete: set inactive instead of removing (preserves audit + foreign keys)
  db.update(users).set({ active: 0 }).where(eq(users.id, id)).run();
  recordAudit({
    user: req.user,
    action: 'user.deactivate',
    entityType: 'user',
    entityId: id,
    summary: `Deactivated user ${target.username}`,
  });
  res.json({ ok: true });
});

export default router;
