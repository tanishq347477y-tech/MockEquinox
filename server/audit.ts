import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";

export async function appendAuditLog(input: {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    metadata: input.metadata,
  });
}
