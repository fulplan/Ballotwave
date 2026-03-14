import { Router } from "express";
import { db, notificationsTable, notificationLogTable, usersTable, electionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";
import { notifyUsers } from "../lib/notify";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(notificationsTable.createdAt);
  res.json(notifications.reverse());
});

router.patch("/:notificationId/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(
      eq(notificationsTable.id, req.params.notificationId),
      eq(notificationsTable.userId, user.id)
    ));
  res.json({ success: true });
});

router.post("/mark-all-read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, user.id));
  res.json({ success: true });
});

router.delete("/:notificationId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.delete(notificationsTable)
    .where(and(
      eq(notificationsTable.id, req.params.notificationId),
      eq(notificationsTable.userId, user.id)
    ));
  res.json({ success: true });
});

const broadcastSchema = z.object({
  electionId: z.string().optional(),
  departmentId: z.string().optional(),
  channel: z.enum(["sms", "email", "both"]),
  message: z.string().min(1).max(640),
  subject: z.string().optional(),
});

const broadcastRateLimits = new Map<string, number[]>();

router.post("/broadcast", requireAuth, async (req, res) => {
  const user = (req as any).user;

  if (!["super_admin", "school_admin"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Only school admins can send broadcasts" });
    return;
  }

  if (!user.schoolId && user.role !== "super_admin") {
    res.status(400).json({ error: "Bad Request", message: "No school associated with your account" });
    return;
  }

  const schoolId = user.schoolId || "platform";
  const now = Date.now();
  const hourAgo = now - 3600_000;
  const recent = (broadcastRateLimits.get(schoolId) || []).filter(t => t > hourAgo);
  if (recent.length >= 2) {
    res.status(429).json({ error: "Rate Limit", message: "Maximum 2 broadcasts per hour. Please wait before sending another." });
    return;
  }

  try {
    const data = broadcastSchema.parse(req.body);

    const conditions: any[] = [eq(usersTable.role, "voter")];
    if (user.role !== "super_admin") {
      conditions.push(eq(usersTable.schoolId, user.schoolId));
    }
    if (data.departmentId) {
      conditions.push(eq(usersTable.departmentId, data.departmentId));
    }

    const recipients = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(...conditions));

    if (data.electionId) {
      const [election] = await db.select().from(electionsTable)
        .where(eq(electionsTable.id, data.electionId)).limit(1);
      if (!election) {
        res.status(404).json({ error: "Not Found", message: "Election not found" });
        return;
      }
    }

    const userIds = recipients.map(r => r.id);
    const channels: ("sms" | "email" | "in_app")[] = ["in_app"];
    if (data.channel === "sms" || data.channel === "both") channels.push("sms");
    if (data.channel === "email" || data.channel === "both") channels.push("email");

    notifyUsers(userIds, "Announcement", data.message, {
      channels,
      event: "broadcast",
      schoolId: user.schoolId,
      electionId: data.electionId,
      emailSubject: data.subject || "BallotWave Announcement",
      emailHtml: `<h2>Announcement</h2><p>${data.message.replace(/\n/g, "<br>")}</p>`,
    }).catch(() => {});

    recent.push(now);
    broadcastRateLimits.set(schoolId, recent);

    res.json({ success: true, recipientCount: userIds.length, message: `Broadcast sent to ${userIds.length} recipients` });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Internal Error", message: "Failed to send broadcast" });
    }
  }
});

router.get("/log", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!["super_admin", "school_admin", "electoral_officer"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { electionId, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(limitStr as string) || 100, 500);

  const conditions: any[] = [];
  if (user.role !== "super_admin" && user.schoolId) {
    conditions.push(eq(notificationLogTable.schoolId, user.schoolId));
  }
  if (electionId) {
    conditions.push(eq(notificationLogTable.electionId, electionId as string));
  }

  const logs = conditions.length > 0
    ? await db.select().from(notificationLogTable)
        .where(and(...conditions))
        .orderBy(desc(notificationLogTable.sentAt))
        .limit(limit)
    : await db.select().from(notificationLogTable)
        .orderBy(desc(notificationLogTable.sentAt))
        .limit(limit);

  res.json(logs);
});

router.get("/log/stats", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!["super_admin", "school_admin", "electoral_officer"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { electionId } = req.query;
  const conditions: any[] = [];
  if (user.role !== "super_admin" && user.schoolId) {
    conditions.push(eq(notificationLogTable.schoolId, user.schoolId));
  }
  if (electionId) {
    conditions.push(eq(notificationLogTable.electionId, electionId as string));
  }

  const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db.select({
    channel: notificationLogTable.channel,
    status: notificationLogTable.status,
    count: sql<number>`count(*)::int`,
  }).from(notificationLogTable)
    .where(baseWhere)
    .groupBy(notificationLogTable.channel, notificationLogTable.status);

  const events = await db.select({
    event: notificationLogTable.event,
    count: sql<number>`count(*)::int`,
  }).from(notificationLogTable)
    .where(baseWhere)
    .groupBy(notificationLogTable.event);

  res.json({ channelStats: stats, eventStats: events });
});

export default router;
