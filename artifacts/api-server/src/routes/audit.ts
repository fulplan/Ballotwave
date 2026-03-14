import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { schoolId, entityType, limit = "50", offset = "0" } = req.query;

  const conditions: any[] = [];

  if (user.role === "school_admin" || user.role === "electoral_officer") {
    const sid = user.schoolId;
    if (sid) conditions.push(eq(auditLogsTable.schoolId, sid));
  } else if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Not authorized to view audit logs" });
    return;
  }

  if (schoolId && user.role === "super_admin") {
    conditions.push(eq(auditLogsTable.schoolId, schoolId as string));
  }

  if (entityType) {
    conditions.push(eq(auditLogsTable.entityType, entityType as string));
  }

  const logs = await db.select().from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(parseInt(limit as string))
    .offset(parseInt(offset as string));

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({ logs, total: count });
});

export default router;
