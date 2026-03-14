import { Router } from "express";
import { db, paymentsTable, schoolsTable, electionsTable, ussdSessionLogsTable, platformSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function requireSuperAdmin(req: any, res: any, next: any) {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }
  next();
}

router.get("/overview", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "success"));
    const schools = await db.select().from(schoolsTable);
    const schoolMap = new Map(schools.map(s => [s.id, s]));

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyPayments = payments.filter(p => p.paidAt && new Date(p.paidAt) >= thisMonth);
    const mrr = monthlyPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const arr = mrr * 12;

    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const rev = payments
        .filter(p => p.paidAt && new Date(p.paidAt) >= d && new Date(p.paidAt) < dEnd)
        .reduce((s, p) => s + (p.amount || 0), 0);
      monthlyRevenue.push({ month: label, revenue: Math.round(rev * 100) / 100 });
    }

    const elections = await db.select().from(electionsTable);
    const electionSchoolMap = new Map(elections.map(e => [e.id, e.schoolId]));

    const revenueByPlan: Record<string, number> = { free: 0, basic: 0, pro: 0, enterprise: 0 };
    for (const p of payments) {
      const sId = electionSchoolMap.get(p.electionId);
      const school = sId ? schoolMap.get(sId) : null;
      const plan = school?.plan || "free";
      revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (p.amount || 0);
    }
    const revenueByPlanArr = Object.entries(revenueByPlan).map(([plan, revenue]) => ({ plan, revenue: Math.round(revenue * 100) / 100 }));

    const schoolRevenue: Record<string, number> = {};
    for (const p of payments) {
      const sId = electionSchoolMap.get(p.electionId);
      if (sId) schoolRevenue[sId] = (schoolRevenue[sId] || 0) + (p.amount || 0);
    }
    const topSchools = Object.entries(schoolRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sId, revenue]) => {
        const school = schoolMap.get(sId);
        return { schoolId: sId, name: school?.name || "Unknown", plan: school?.plan || "free", revenue: Math.round(revenue * 100) / 100 };
      });

    const ussdSessions = await db.select({ count: sql<number>`COUNT(*)::int` }).from(ussdSessionLogsTable);
    const totalUssdSessions = ussdSessions[0]?.count ?? 0;

    let totalUssdVotes = 0;
    try {
      const r = await db.execute(sql`SELECT COUNT(*)::int as count FROM votes WHERE channel = 'ussd'`);
      const rows = r as unknown as { rows: Array<{ count: number }> };
      totalUssdVotes = Number(rows.rows?.[0]?.count ?? 0);
    } catch (_err) {
      console.error("[revenue] Failed to count USSD votes:", _err);
    }

    const ussdGatewayCost = totalUssdSessions * 0.05;
    const totalRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);

    const settingsRows = await db.select().from(platformSettingsTable);
    const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]));
    const ussdPassthrough = settingsMap.get("payout_ussd_passthrough") === "true";

    let ussdRevenueCollected = 0;
    if (ussdPassthrough) {
      ussdRevenueCollected = ussdGatewayCost;
    }
    const netUssdRevenue = Math.round((ussdRevenueCollected - ussdGatewayCost) * 100) / 100;

    res.json({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      monthlyRevenue,
      revenueByPlan: revenueByPlanArr,
      topSchools,
      ussd: {
        totalUssdSessions,
        totalUssdVotes,
        estimatedGatewayCost: Math.round(ussdGatewayCost * 100) / 100,
        ussdRevenueCollected: Math.round(ussdRevenueCollected * 100) / 100,
        netUssdRevenue,
        ussdPassthrough,
        costPerSession: 0.05,
        currency: "GHS",
      },
    });
  } catch (err: any) {
    console.error("Revenue overview error:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load revenue data" });
  }
});

export default router;
