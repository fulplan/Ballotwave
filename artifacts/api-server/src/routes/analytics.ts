import { Router } from "express";
import { db, electionsTable, schoolsTable, votesTable, paymentsTable, ussdSessionLogsTable, platformSettingsTable } from "@workspace/db";
import { eq, and, gte, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/overview", requireAuth, async (req, res) => {
  const user = (req as Record<string, unknown>).user as { role: string; schoolId: string | null };
  const allowedRoles = ["super_admin", "school_admin", "electoral_officer"];
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }

  const { schoolId } = req.query;
  const effectiveSchoolId = user.role === "super_admin" ? (schoolId as string | undefined) : user.schoolId;

  const schools = await db.select().from(schoolsTable);
  const totalSchools = schools.length;

  const elections = effectiveSchoolId
    ? await db.select().from(electionsTable).where(eq(electionsTable.schoolId, effectiveSchoolId))
    : await db.select().from(electionsTable);

  const totalElections = elections.length;
  const activeElections = elections.filter((e) => e.status === "active").length;
  const totalVotes = elections.reduce((sum, e) => sum + (e.totalVotes || 0), 0);

  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "success"));
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const electionsByStatus = [
    { status: "draft", count: elections.filter((e) => e.status === "draft").length },
    { status: "active", count: elections.filter((e) => e.status === "active").length },
    { status: "closed", count: elections.filter((e) => e.status === "closed").length },
    { status: "cancelled", count: elections.filter((e) => e.status === "cancelled").length },
  ];

  const electionIds = elections.map((e) => e.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const votesConditions = [gte(votesTable.createdAt, sevenDaysAgo)];
  if (electionIds.length > 0 && effectiveSchoolId) {
    votesConditions.push(inArray(votesTable.electionId, electionIds));
  }

  const rawVotes = electionIds.length > 0 || !effectiveSchoolId
    ? await db
        .select({
          date: sql<string>`DATE(${votesTable.createdAt})::text`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(votesTable)
        .where(and(...votesConditions))
        .groupBy(sql`DATE(${votesTable.createdAt})`)
        .orderBy(sql`DATE(${votesTable.createdAt})`)
    : [];

  const votesByDayMap: Record<string, number> = {};
  for (const row of rawVotes) {
    votesByDayMap[row.date] = row.count;
  }

  const votesByDay = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    votesByDay.push({ date: dateStr, count: votesByDayMap[dateStr] ?? 0 });
  }

  const recentActivity = elections.slice(-5).map((e) => ({
    id: e.id,
    type: "election",
    message: `Election "${e.title}" is ${e.status}`,
    timestamp: e.updatedAt || e.createdAt,
  }));

  let ussdVoteCount = 0;
  if (electionIds.length > 0) {
    const ussdVotesResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(votesTable)
      .where(and(eq(votesTable.channel, "ussd"), inArray(votesTable.electionId, electionIds)));
    ussdVoteCount = ussdVotesResult[0]?.count ?? 0;
  }
  const webVoteCount = totalVotes - ussdVoteCount;

  let totalUssdSessions = 0;
  if (effectiveSchoolId) {
    const ussdSessionCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ussdSessionLogsTable)
      .where(eq(ussdSessionLogsTable.schoolId, effectiveSchoolId));
    totalUssdSessions = ussdSessionCount[0]?.count ?? 0;
  } else {
    const ussdSessionCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ussdSessionLogsTable);
    totalUssdSessions = ussdSessionCount[0]?.count ?? 0;
  }

  const ussdGatewayCost = totalUssdSessions * 0.05;

  res.json({
    totalSchools,
    totalElections,
    activeElections,
    totalVotes,
    totalRevenue,
    recentActivity,
    electionsByStatus,
    votesByDay,
    ussd: {
      totalUssdVotes: ussdVoteCount,
      totalWebVotes: webVoteCount,
      totalUssdSessions: totalUssdSessions,
      estimatedGatewayCost: ussdGatewayCost,
      costPerVote: 0.05,
      currency: "GHS",
    },
  });
});

router.get("/elections/:electionId", requireAuth, async (req, res) => {
  const { electionId } = req.params;
  const [election] = await db.select().from(electionsTable)
    .where(eq(electionsTable.id, electionId)).limit(1);

  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }

  const totalVotes = election.totalVotes;
  const registeredVoters = election.registeredVoters || 0;
  const turnoutPercentage = registeredVoters > 0 ? Math.round((totalVotes / registeredVoters) * 100 * 10) / 10 : 0;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rawHourly = await db
    .select({
      hour: sql<string>`TO_CHAR(DATE_TRUNC('hour', ${votesTable.createdAt}), 'HH24:00')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(votesTable)
    .where(and(
      eq(votesTable.electionId, electionId),
      gte(votesTable.createdAt, twentyFourHoursAgo)
    ))
    .groupBy(sql`DATE_TRUNC('hour', ${votesTable.createdAt})`)
    .orderBy(sql`DATE_TRUNC('hour', ${votesTable.createdAt})`);

  const hourlyMap: Record<string, number> = {};
  for (const row of rawHourly) {
    hourlyMap[row.hour] = row.count;
  }

  const votesByHour = [];
  for (let i = 23; i >= 0; i--) {
    const h = new Date();
    h.setHours(h.getHours() - i, 0, 0, 0);
    const key = `${h.getHours().toString().padStart(2, "0")}:00`;
    votesByHour.push({ hour: key, count: hourlyMap[key] ?? 0 });
  }

  const webCount = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(votesTable)
    .where(and(eq(votesTable.electionId, electionId), eq(votesTable.votingMethod, "web")));

  const ussdCount = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(votesTable)
    .where(and(eq(votesTable.electionId, electionId), eq(votesTable.votingMethod, "ussd")));

  const votesByMethod = [
    { method: "web", count: webCount[0]?.count ?? 0 },
    { method: "ussd", count: ussdCount[0]?.count ?? 0 },
  ];

  res.json({
    electionId,
    title: election.title,
    totalRegisteredVoters: registeredVoters,
    totalVotes,
    turnoutPercentage,
    votesByHour,
    votesByMethod,
    fraudAlerts: 0,
  });
});

router.get("/schools/:schoolId", requireAuth, async (req, res) => {
  const user = (req as Record<string, unknown>).user as { role: string; schoolId: string | null };
  const allowedRoles = ["super_admin", "school_admin", "electoral_officer"];
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  if (user.role !== "super_admin" && user.schoolId !== req.params.schoolId) {
    res.status(403).json({ error: "Forbidden", message: "Not authorized for this school" });
    return;
  }

  const { schoolId } = req.params;

  const elections = await db.select().from(electionsTable).where(eq(electionsTable.schoolId, schoolId));
  const electionIds = elections.map((e) => e.id);
  const totalElections = elections.length;
  const activeElections = elections.filter((e) => e.status === "active").length;
  const totalVotes = elections.reduce((sum, e) => sum + (e.totalVotes || 0), 0);

  let ussdVoteCount = 0;
  let webVoteCount = 0;
  if (electionIds.length > 0) {
    const ussdResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(votesTable)
      .where(and(eq(votesTable.channel, "ussd"), inArray(votesTable.electionId, electionIds)));
    ussdVoteCount = ussdResult[0]?.count ?? 0;
    webVoteCount = totalVotes - ussdVoteCount;
  }

  const sessionCount = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(ussdSessionLogsTable)
    .where(eq(ussdSessionLogsTable.schoolId, schoolId));
  const totalUssdSessions = sessionCount[0]?.count ?? 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const monthlySessionsResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(ussdSessionLogsTable)
    .where(and(
      eq(ussdSessionLogsTable.schoolId, schoolId),
      gte(ussdSessionLogsTable.endedAt, thirtyDaysAgo)
    ));
  const monthlyUssdSessions = monthlySessionsResult[0]?.count ?? 0;

  const sessionsByDay = await db
    .select({
      date: sql<string>`DATE(${ussdSessionLogsTable.endedAt})::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(ussdSessionLogsTable)
    .where(and(
      eq(ussdSessionLogsTable.schoolId, schoolId),
      gte(ussdSessionLogsTable.endedAt, thirtyDaysAgo)
    ))
    .groupBy(sql`DATE(${ussdSessionLogsTable.endedAt})`)
    .orderBy(sql`DATE(${ussdSessionLogsTable.endedAt})`);

  const ussdGatewayCost = totalUssdSessions * 0.05;
  const monthlyGatewayCost = monthlyUssdSessions * 0.05;

  res.json({
    schoolId,
    totalElections,
    activeElections,
    totalVotes,
    ussd: {
      totalUssdVotes: ussdVoteCount,
      totalWebVotes: webVoteCount,
      totalUssdSessions,
      monthlyUssdSessions,
      sessionsByDay,
      estimatedGatewayCost: ussdGatewayCost,
      monthlyGatewayCost,
      costPerSession: 0.05,
      currency: "GHS",
    },
  });
});

router.get("/revenue", requireAuth, async (req, res) => {
  const user = (req as Record<string, unknown>).user as { role: string };
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }

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
      const school = sId ? schoolMap.get(sId) : undefined;
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
      console.error("[analytics/revenue] Failed to count USSD votes:", _err);
    }

    const ussdGatewayCost = totalUssdSessions * 0.05;
    const totalRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);

    const settingsRows = await db.select().from(platformSettingsTable);
    const settingsMap = new Map(settingsRows.map((r: { key: string; value: string }) => [r.key, r.value]));
    const ussdPassthrough = settingsMap.get("payout_ussd_passthrough") === "true";
    const ussdRevenueCollected = ussdPassthrough ? ussdGatewayCost : 0;
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
  } catch (err) {
    console.error("Revenue analytics error:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load revenue data" });
  }
});

export default router;
