import { Router } from "express";
import { db, invoicesTable, schoolsTable, paymentsTable, electionsTable, ussdSessionLogsTable, notificationLogTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { notifyUser } from "../lib/notify";

const router = Router();

function requireSuperAdmin(req: any, res: any, next: any) {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }
  next();
}

router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let invoices;
    if (status && typeof status === "string") {
      invoices = await db.select({
        invoice: invoicesTable,
        schoolName: schoolsTable.name,
        schoolPlan: schoolsTable.plan,
      })
        .from(invoicesTable)
        .leftJoin(schoolsTable, eq(invoicesTable.schoolId, schoolsTable.id))
        .where(eq(invoicesTable.status, status as any))
        .orderBy(desc(invoicesTable.createdAt));
    } else {
      invoices = await db.select({
        invoice: invoicesTable,
        schoolName: schoolsTable.name,
        schoolPlan: schoolsTable.plan,
      })
        .from(invoicesTable)
        .leftJoin(schoolsTable, eq(invoicesTable.schoolId, schoolsTable.id))
        .orderBy(desc(invoicesTable.createdAt));
    }
    res.json(invoices.map(r => ({
      ...r.invoice,
      schoolName: r.schoolName,
      schoolPlan: r.schoolPlan,
    })));
  } catch (err) {
    console.error("Failed to load invoices:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load invoices" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const [invoice] = await db.select({
      invoice: invoicesTable,
      schoolName: schoolsTable.name,
      schoolPlan: schoolsTable.plan,
    })
      .from(invoicesTable)
      .leftJoin(schoolsTable, eq(invoicesTable.schoolId, schoolsTable.id))
      .where(eq(invoicesTable.id, req.params.id))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ error: "Not Found", message: "Invoice not found" });
      return;
    }
    if (user.role !== "super_admin" && user.schoolId !== invoice.invoice.schoolId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }
    res.json({ ...invoice.invoice, schoolName: invoice.schoolName, schoolPlan: invoice.schoolPlan });
  } catch (err) {
    console.error("Failed to load invoice:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load invoice" });
  }
});

router.post("/:id/send", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [updated] = await db.update(invoicesTable)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not Found", message: "Invoice not found" });
      return;
    }

    const schoolAdmins = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.schoolId, updated.schoolId),
        eq(usersTable.role, "school_admin"),
        eq(usersTable.isActive, true)
      ));
    const [school] = await db.select({ name: schoolsTable.name }).from(schoolsTable).where(eq(schoolsTable.id, updated.schoolId)).limit(1);
    const schoolName = school?.name || "your school";
    const periodLabel = new Date(updated.periodStart).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

    for (const admin of schoolAdmins) {
      await notifyUser(admin.id, "Invoice Ready", `Your invoice for ${schoolName} (${periodLabel}) of GHS ${updated.totalGhs.toFixed(2)} has been sent. Please review and make payment.`, {
        channels: ["email", "in_app", "sms"],
        event: "invoice_sent",
        schoolId: updated.schoolId,
        link: "/dashboard/invoices",
      });
    }

    res.json({ success: true, invoice: updated, notifiedAdmins: schoolAdmins.length });
  } catch (err) {
    console.error("Invoice send error:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to send invoice" });
  }
});

router.post("/:id/mark-paid", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [updated] = await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not Found", message: "Invoice not found" });
      return;
    }
    res.json({ success: true, invoice: updated });
  } catch (err) {
    console.error("Failed to mark invoice as paid:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to mark invoice as paid" });
  }
});

router.post("/generate", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const schools = await db.select().from(schoolsTable).where(eq(schoolsTable.isActive, true));
    const elections = await db.select().from(electionsTable);
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "success"));

    const generated: string[] = [];

    for (const school of schools) {
      const existing = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.schoolId, school.id),
          gte(invoicesTable.periodStart, periodStart),
          lte(invoicesTable.periodEnd, periodEnd),
        )).limit(1);
      if (existing.length > 0) continue;

      const schoolElectionIds = elections.filter(e => e.schoolId === school.id).map(e => e.id);
      const schoolPayments = payments.filter(p =>
        schoolElectionIds.includes(p.electionId) &&
        p.paidAt && new Date(p.paidAt) >= periodStart && new Date(p.paidAt) < periodEnd
      );
      const subscriptionRevenue = schoolPayments.reduce((s, p) => s + (p.amount || 0), 0);

      let ussdSessions = 0;
      try {
        const r = await db.select({ count: sql<number>`COUNT(*)::int` })
          .from(ussdSessionLogsTable)
          .where(and(
            eq(ussdSessionLogsTable.schoolId, school.id),
            gte(ussdSessionLogsTable.endedAt, periodStart),
            lte(ussdSessionLogsTable.endedAt, periodEnd),
          ));
        ussdSessions = r[0]?.count ?? 0;
      } catch (_err) {
        console.error(`[invoice-gen] USSD count error for ${school.name}:`, _err);
      }
      const ussdCost = ussdSessions * 0.05;

      let ussdVotes = 0;
      try {
        const r = await db.execute(
          sql`SELECT COUNT(*)::int as count FROM votes WHERE channel = 'ussd' AND election_id IN (SELECT id FROM elections WHERE school_id = ${school.id}) AND created_at >= ${periodStart} AND created_at < ${periodEnd}`
        );
        const rows = r as unknown as { rows: Array<{ count: number }> };
        ussdVotes = Number(rows.rows?.[0]?.count ?? 0);
      } catch (_err) {
        console.error(`[invoice-gen] USSD votes count error for ${school.name}:`, _err);
      }

      let smsSent = 0;
      try {
        const r = await db.select({ count: sql<number>`COUNT(*)::int` })
          .from(notificationLogTable)
          .where(and(
            eq(notificationLogTable.schoolId, school.id),
            eq(notificationLogTable.channel, "sms"),
            eq(notificationLogTable.status, "sent"),
            gte(notificationLogTable.sentAt, periodStart),
            lte(notificationLogTable.sentAt, periodEnd),
          ));
        smsSent = r[0]?.count ?? 0;
      } catch (_err) {
        console.error(`[invoice-gen] SMS count error for ${school.name}:`, _err);
      }
      const smsCost = smsSent * 0.03;

      const registeredVoters = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(usersTable)
        .where(and(eq(usersTable.schoolId, school.id), eq(usersTable.role, "voter"), eq(usersTable.isActive, true)));
      const voterCount = registeredVoters[0]?.count ?? 0;

      const lineItems = [
        { description: `${school.plan} Plan Subscription`, amount: subscriptionRevenue },
        { description: `USSD Sessions (${ussdSessions} × GHS 0.05)`, amount: Math.round(ussdCost * 100) / 100 },
        { description: `USSD Votes Cast: ${ussdVotes}`, amount: 0 },
        { description: `SMS Notifications (${smsSent} × GHS 0.03)`, amount: Math.round(smsCost * 100) / 100 },
        { description: `Registered Voters: ${voterCount}`, amount: 0 },
      ];
      const totalGhs = Math.round((subscriptionRevenue + ussdCost + smsCost) * 100) / 100;

      if (totalGhs > 0) {
        await db.insert(invoicesTable).values({
          schoolId: school.id,
          periodStart,
          periodEnd,
          lineItems,
          totalGhs,
          status: "draft",
        });
        generated.push(school.name);
      }
    }

    res.json({ success: true, generated, count: generated.length });
  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to generate invoices" });
  }
});

router.get("/:id/download", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const [result] = await db.select({
      invoice: invoicesTable,
      schoolName: schoolsTable.name,
      schoolPlan: schoolsTable.plan,
    })
      .from(invoicesTable)
      .leftJoin(schoolsTable, eq(invoicesTable.schoolId, schoolsTable.id))
      .where(eq(invoicesTable.id, req.params.id))
      .limit(1);

    if (!result) {
      res.status(404).json({ error: "Not Found", message: "Invoice not found" });
      return;
    }
    if (user.role !== "super_admin" && user.schoolId !== result.invoice.schoolId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }

    const inv = result.invoice;
    const schoolName = result.schoolName || "Unknown School";
    const periodLabel = `${new Date(inv.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — ${new Date(inv.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

    const items = (inv.lineItems as Array<{ description: string; amount: number }>);
    const itemLines = items.map(item => `  ${item.description.padEnd(50)} GHS ${item.amount.toFixed(2)}`).join("\n");

    const content = [
      "=" .repeat(70),
      "                         BALLOTWAVE INVOICE",
      "=".repeat(70),
      "",
      `Invoice ID:    ${inv.id}`,
      `School:        ${schoolName} (${result.schoolPlan || "free"} plan)`,
      `Period:        ${periodLabel}`,
      `Status:        ${inv.status.toUpperCase()}`,
      inv.sentAt ? `Sent:          ${new Date(inv.sentAt).toLocaleDateString("en-GB")}` : null,
      inv.paidAt ? `Paid:          ${new Date(inv.paidAt).toLocaleDateString("en-GB")}` : null,
      `Generated:     ${new Date(inv.createdAt).toLocaleDateString("en-GB")}`,
      "",
      "-".repeat(70),
      "  LINE ITEMS",
      "-".repeat(70),
      itemLines,
      "-".repeat(70),
      `  ${"TOTAL".padEnd(50)} GHS ${inv.totalGhs.toFixed(2)}`,
      "=".repeat(70),
      "",
      "BallotWave — Secure Digital Elections for African Schools",
      `Generated on ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${inv.id.slice(0, 8)}.txt"`);
    res.send(content);
  } catch (err) {
    console.error("Failed to download invoice:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to generate invoice download" });
  }
});

router.get("/school/:schoolId", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "super_admin" && user.schoolId !== req.params.schoolId) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized" });
      return;
    }
    const invoices = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.schoolId, req.params.schoolId))
      .orderBy(desc(invoicesTable.createdAt));
    res.json(invoices);
  } catch (err) {
    console.error("Failed to load school invoices:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load invoices" });
  }
});

export default router;
