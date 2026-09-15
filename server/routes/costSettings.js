import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { costSettings, users } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

const router = Router();
const ROW_ID = 1; // one shop, one cost book

function readRow() {
  return db.select().from(costSettings).where(eq(costSettings.id, ROW_ID)).get() || null;
}

function parse(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

/**
 * GET /api/cost-settings
 * `settings: null` means "never configured" — the client then uses the
 * defaults it ships with, so quoting works before anyone visits the page.
 */
router.get('/', requireAuth, (_req, res) => {
  const row = readRow();
  const editor = row?.updatedBy
    ? db.select().from(users).where(eq(users.id, row.updatedBy)).get()
    : null;
  res.json({
    settings: parse(row),
    updatedAt: row?.updatedAt || null,
    updatedBy: editor ? editor.fullName || editor.username : null,
  });
});

/** PUT /api/cost-settings — managers own the rate card. */
router.put('/', requireAuth, requireRole('manager'), (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return res.status(400).json({ error: 'settings object is required' });
  }
  if (!Array.isArray(settings.materials) || !settings.materials.length) {
    return res.status(400).json({ error: 'settings.materials must be a non-empty array' });
  }
  if (!settings.processes || typeof settings.processes !== 'object') {
    return res.status(400).json({ error: 'settings.processes must be an object' });
  }

  const data = JSON.stringify(settings);
  const now = new Date().toISOString();
  const existing = readRow();
  if (existing) {
    db.update(costSettings)
      .set({ data, updatedBy: req.user.id, updatedAt: now })
      .where(eq(costSettings.id, ROW_ID))
      .run();
  } else {
    db.insert(costSettings)
      .values({ id: ROW_ID, data, updatedBy: req.user.id, updatedAt: now })
      .run();
  }

  recordAudit({
    user: req.user,
    action: 'cost_settings.update',
    entityType: 'cost_settings',
    entityId: ROW_ID,
    summary: `Updated cost rates (${settings.materials.length} materials, ${
      Object.keys(settings.processes).length
    } processes)`,
    meta: {
      currency: settings.commercial?.currency,
      marginPct: settings.commercial?.marginPct,
      overheadPct: settings.commercial?.overheadPct,
    },
  });

  res.json({ settings, updatedAt: now });
});

/** DELETE /api/cost-settings — drop back to the shipped defaults. */
router.delete('/', requireAuth, requireRole('manager'), (req, res) => {
  db.delete(costSettings).where(eq(costSettings.id, ROW_ID)).run();
  recordAudit({
    user: req.user,
    action: 'cost_settings.reset',
    entityType: 'cost_settings',
    entityId: ROW_ID,
    summary: 'Reset cost rates to defaults',
  });
  res.json({ ok: true });
});

export default router;
