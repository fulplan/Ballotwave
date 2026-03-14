import { db, auditLogsTable } from "@workspace/db";

interface AuditParams {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  schoolId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId,
      userEmail: params.userEmail,
      userRole: params.userRole,
      schoolId: params.schoolId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      details: params.details ? JSON.stringify(params.details) : undefined,
      ipAddress: params.ipAddress,
    });
  } catch (e) {
    console.error("[audit] Failed to log audit event:", e);
  }
}

export function auditFromReq(req: any) {
  const user = req.user;
  return {
    userId: user?.id,
    userEmail: user?.email,
    userRole: user?.role,
    schoolId: user?.schoolId,
    ipAddress: req.ip || req.headers["x-forwarded-for"] as string || undefined,
  };
}
