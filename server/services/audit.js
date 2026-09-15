import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';

// Lightweight audit-log writer. Never throws — audit failures must not break
// the caller's request flow.
export function recordAudit({ user, action, entityType = null, entityId = null, summary, meta = null }) {
  try {
    db.insert(auditLog)
      .values({
        userId: user?.id || null,
        username: user?.username || null,
        role: user?.role || null,
        action,
        entityType,
        entityId,
        summary,
        meta: meta ? JSON.stringify(meta) : null,
      })
      .run();
  } catch (e) {
    console.warn('[audit] failed to record event', e.message);
  }
}
