import { Router } from "express";
import { db, electionsTable, candidatesTable, votesTable, voterReceiptsTable, schoolsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

const createElectionSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  schoolId: z.string(),
  votingType: z.enum(["web", "ussd", "both"]).default("web"),
  startDate: z.string().transform(v => new Date(v)),
  endDate: z.string().transform(v => new Date(v)),
  requiresPayment: z.boolean().default(false),
  votingFee: z.number().default(0),
  currency: z.string().default("GHS"),
  allowMultiplePositions: z.boolean().default(true),
});

const updateElectionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "closed", "cancelled"]).optional(),
  startDate: z.string().transform(v => new Date(v)).optional(),
  endDate: z.string().transform(v => new Date(v)).optional(),
  requiresPayment: z.boolean().optional(),
  votingFee: z.number().optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const { schoolId, status } = req.query;
  let query = db.select({
    id: electionsTable.id,
    title: electionsTable.title,
    description: electionsTable.description,
    schoolId: electionsTable.schoolId,
    schoolName: schoolsTable.name,
    status: electionsTable.status,
    votingType: electionsTable.votingType,
    startDate: electionsTable.startDate,
    endDate: electionsTable.endDate,
    requiresPayment: electionsTable.requiresPayment,
    votingFee: electionsTable.votingFee,
    currency: electionsTable.currency,
    totalVotes: electionsTable.totalVotes,
    totalCandidates: electionsTable.totalCandidates,
    allowMultiplePositions: electionsTable.allowMultiplePositions,
    createdAt: electionsTable.createdAt,
  }).from(electionsTable).leftJoin(schoolsTable, eq(electionsTable.schoolId, schoolsTable.id)) as any;

  const conditions = [];
  if (schoolId) conditions.push(eq(electionsTable.schoolId, schoolId as string));
  if (status) conditions.push(eq(electionsTable.status, status as any));

  const results = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(electionsTable.createdAt)
    : await query.orderBy(electionsTable.createdAt);

  res.json(results);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const data = createElectionSchema.parse(req.body);
    const [election] = await db.insert(electionsTable).values({
      ...data,
      createdById: user.id,
    }).returning();
    res.status(201).json({ ...election, schoolName: null });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Internal Error", message: "Failed to create election" });
    }
  }
});

router.get("/:electionId", requireAuth, async (req, res) => {
  const [election] = await db.select({
    id: electionsTable.id,
    title: electionsTable.title,
    description: electionsTable.description,
    schoolId: electionsTable.schoolId,
    schoolName: schoolsTable.name,
    status: electionsTable.status,
    votingType: electionsTable.votingType,
    startDate: electionsTable.startDate,
    endDate: electionsTable.endDate,
    requiresPayment: electionsTable.requiresPayment,
    votingFee: electionsTable.votingFee,
    currency: electionsTable.currency,
    totalVotes: electionsTable.totalVotes,
    totalCandidates: electionsTable.totalCandidates,
    allowMultiplePositions: electionsTable.allowMultiplePositions,
    createdAt: electionsTable.createdAt,
  }).from(electionsTable)
    .leftJoin(schoolsTable, eq(electionsTable.schoolId, schoolsTable.id))
    .where(eq(electionsTable.id, req.params.electionId))
    .limit(1);

  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }

  const candidates = await db.select().from(candidatesTable)
    .where(eq(candidatesTable.electionId, req.params.electionId))
    .orderBy(candidatesTable.position);

  const positions = [...new Set(candidates.map((c: any) => c.position))];

  res.json({ ...election, candidates, positions });
});

router.patch("/:electionId", requireAuth, async (req, res) => {
  try {
    const data = updateElectionSchema.parse(req.body);
    const [election] = await db.update(electionsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(electionsTable.id, req.params.electionId))
      .returning();
    if (!election) {
      res.status(404).json({ error: "Not Found", message: "Election not found" });
      return;
    }
    res.json({ ...election, schoolName: null });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update election" });
  }
});

router.post("/:electionId/start", requireAuth, async (req, res) => {
  const [election] = await db.update(electionsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(electionsTable.id, req.params.electionId))
    .returning();
  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }
  res.json({ ...election, schoolName: null });
});

router.post("/:electionId/close", requireAuth, async (req, res) => {
  const [election] = await db.update(electionsTable)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(electionsTable.id, req.params.electionId))
    .returning();
  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }
  res.json({ ...election, schoolName: null });
});

router.get("/:electionId/results", async (req, res) => {
  const [election] = await db.select().from(electionsTable)
    .where(eq(electionsTable.id, req.params.electionId)).limit(1);
  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }

  const candidates = await db.select().from(candidatesTable)
    .where(eq(candidatesTable.electionId, req.params.electionId));

  const positions = [...new Set(candidates.map((c: any) => c.position))];
  const totalVotes = election.totalVotes;

  const positionResults = positions.map(position => {
    const positionCandidates = candidates
      .filter((c: any) => c.position === position)
      .map((c: any) => ({
        candidateId: c.id,
        name: c.name,
        voteCount: c.voteCount,
        percentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 100 * 10) / 10 : 0,
        photoUrl: c.photoUrl,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    const winner = positionCandidates[0] || null;

    return { position, candidates: positionCandidates, winner };
  });

  const registeredVoters = 100; // placeholder
  const turnoutPercentage = registeredVoters > 0 ? Math.round((totalVotes / registeredVoters) * 100) : 0;

  res.json({
    electionId: election.id,
    title: election.title,
    status: election.status,
    totalVotes,
    turnoutPercentage,
    positions: positionResults,
  });
});

// Voting
router.get("/:electionId/check-voted", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [receipt] = await db.select().from(voterReceiptsTable)
    .where(and(
      eq(voterReceiptsTable.electionId, req.params.electionId),
      eq(voterReceiptsTable.voterId, user.id)
    )).limit(1);

  res.json({ hasVoted: !!receipt, receiptCode: receipt?.receiptCode || null });
});

const castVoteSchema = z.object({
  votes: z.array(z.object({
    position: z.string(),
    candidateId: z.string(),
  })).min(1),
  paymentReference: z.string().optional(),
});

router.post("/:electionId/vote", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const data = castVoteSchema.parse(req.body);

    const [election] = await db.select().from(electionsTable)
      .where(eq(electionsTable.id, req.params.electionId)).limit(1);

    if (!election || election.status !== "active") {
      res.status(400).json({ error: "Bad Request", message: "Election is not active" });
      return;
    }

    const [existingReceipt] = await db.select().from(voterReceiptsTable)
      .where(and(
        eq(voterReceiptsTable.electionId, req.params.electionId),
        eq(voterReceiptsTable.voterId, user.id)
      )).limit(1);

    if (existingReceipt) {
      res.status(400).json({ error: "Bad Request", message: "You have already voted in this election" });
      return;
    }

    const receiptCode = "BW-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

    await db.insert(voterReceiptsTable).values({
      electionId: req.params.electionId,
      voterId: user.id,
      receiptCode,
      paymentReference: data.paymentReference,
    });

    for (const vote of data.votes) {
      await db.insert(votesTable).values({
        electionId: req.params.electionId,
        voterId: user.id,
        candidateId: vote.candidateId,
        position: vote.position,
        receiptCode,
        paymentReference: data.paymentReference,
        votingMethod: "web",
        ipAddress: req.ip,
      });

      await db.update(candidatesTable)
        .set({ voteCount: sql`${candidatesTable.voteCount} + 1`, updatedAt: new Date() })
        .where(eq(candidatesTable.id, vote.candidateId));
    }

    await db.update(electionsTable)
      .set({ totalVotes: sql`${electionsTable.totalVotes} + 1`, updatedAt: new Date() })
      .where(eq(electionsTable.id, req.params.electionId));

    res.json({ success: true, receiptCode, message: "Your vote has been cast successfully!" });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid vote data" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Internal Error", message: "Failed to cast vote" });
    }
  }
});

export default router;
