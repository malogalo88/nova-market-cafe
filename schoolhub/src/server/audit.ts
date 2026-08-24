import { db } from "@/lib/db";

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  meta?: unknown;
}

/** Record an important action in the audit log. Never throws. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        summary: entry.summary,
        meta: entry.meta === undefined ? null : JSON.stringify(entry.meta)
      }
    });
  } catch (err) {
    console.error("[audit] failed to record entry", err);
  }
}
