import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  const user = db.select().from(users).where(eq(users.username, username)).get();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.active === 0) return res.status(403).json({ error: 'Account deactivated' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user);
  recordAudit({
    user,
    action: 'login',
    entityType: 'user',
    entityId: user.id,
    summary: `${user.username} logged in`,
  });
  return res.json({
    token,
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
  });
});

router.post('/register', async (req, res) => {
  const { username, password, fullName, role = 'designer' } = req.body || {};
  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'username, password, fullName required' });
  }
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) return res.status(409).json({ error: 'Username already exists' });
  const hash = await bcrypt.hash(password, 10);
  const [user] = db
    .insert(users)
    .values({ username, password: hash, fullName, role })
    .returning()
    .all();
  const token = signToken(user);
  recordAudit({
    user,
    action: 'user.register',
    entityType: 'user',
    entityId: user.id,
    summary: `New ${role} user registered: ${username}`,
  });
  return res.status(201).json({
    token,
    user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
  });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

export default router;
