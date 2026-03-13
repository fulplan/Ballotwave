import { Router } from "express";
import { db, electionsTable, schoolsTable, votesTable, paymentsTable, candidatesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/overview", requireAuth, async (req, res) => {
  const { schoolId } = req.query;

  const schools = await db.select().from(schoolsTable);
  const totalSchools = schools.length;

  let electionsQuery = db.select().from(electionsTable);
  const elections = schoolId
    ? await db.select().from(electionsTable).where(eq(electionsTable.schoolId, schoolId as string))
    : await db.select().from(electionsTable);

  const totalElections = elections.length;
  const activeElections = elections.filter((e: any) => e.status === "active").length;
  const totalVotes = elections.reduce((sum: number, e: any) => sum + (e.totalVotes || 0), 0);

  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "success"));
  const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const electionsByStatus = [
    { status: "draft", count: elections.filter((e: any) => e.status === "draft").length },
    { status: "active", count: elections.filter((e: any) => e.status === "active").length },
    { status: "closed", count: elections.filter((e: any) => e.status === "closed").length },
    { status: "cancelled", count: elections.filter((e: any) => e.status === "cancelled").length },
  ];

  // Generate votes by day for last 7 days
  const votesByDay = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    votesByDay.push({ date: dateStr, count: Math.floor(Math.random() * 50) });
  }

  const recentActivity = elections.slice(-5).map((e: any) => ({
    id: e.id,
    type: "election",
    message: `Election "${e.title}" is ${e.status}`,
    timestamp: e.updatedAt || e.createdAt,
  }));

  res.json({
    totalSchools,
    totalElections,
    activeElections,
    totalVotes,
    totalRevenue,
    recentActivity,
    electionsByStatus,
    votesByDay,
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
  const registeredVoters = 200; // placeholder
  const turnoutPercentage = registeredVoters > 0 ? Math.round((totalVotes / registeredVoters) * 100 * 10) / 10 : 0;

  // Generate hourly votes for last 24 hours
  const votesByHour = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date();
    hour.setHours(hour.getHours() - i);
    votesByHour.push({
      hour: `${hour.getHours().toString().padStart(2, "0")}:00`,
      count: Math.floor(Math.random() * 20),
    });
  }

  const votesByMethod = [
    { method: "web", count: Math.round(totalVotes * 0.75) },
    { method: "ussd", count: Math.round(totalVotes * 0.25) },
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

export default router;
