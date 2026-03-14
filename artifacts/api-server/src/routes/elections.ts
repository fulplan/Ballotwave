import { Router } from "express";
import { db, electionsTable, candidatesTable, votesTable, voterReceiptsTable, schoolsTable, candidateApplicationsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";
import { checkElectionLimit } from "../lib/plan-limits";
import { logAudit, auditFromReq } from "../lib/audit";
import { notifyUser, notifyUsers, getEligibleVoterIds, getOfficerIds } from "../lib/notify";

const router = Router();

const createElectionSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  schoolId: z.string(),
  departmentId: z.string().optional(),
  votingType: z.enum(["web", "ussd", "both"]).default("web"),
  startDate: z.string().transform(v => new Date(v)),
  endDate: z.string().transform(v => new Date(v)),
  requiresPayment: z.boolean().default(false),
  votingFee: z.number().default(0),
  currency: z.string().default("GHS"),
  allowMultiplePositions: z.boolean().default(true),
  registeredVoters: z.number().default(0),
  eligibleDepartments: z.array(z.string()).optional().nullable(),
  eligibleYearLevels: z.array(z.string()).optional().nullable(),
});

const updateElectionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "closed", "cancelled"]).optional(),
  startDate: z.string().transform(v => new Date(v)).optional(),
  endDate: z.string().transform(v => new Date(v)).optional(),
  requiresPayment: z.boolean().optional(),
  votingFee: z.number().optional(),
  registeredVoters: z.number().optional(),
  resultsPublished: z.boolean().optional(),
  eligibleDepartments: z.array(z.string()).optional().nullable(),
  eligibleYearLevels: z.array(z.string()).optional().nullable(),
});

function electionFields() {
  return {
    id: electionsTable.id,
    title: electionsTable.title,
    description: electionsTable.description,
    schoolId: electionsTable.schoolId,
    schoolName: schoolsTable.name,
    departmentId: electionsTable.departmentId,
    status: electionsTable.status,
    votingType: electionsTable.votingType,
    startDate: electionsTable.startDate,
    endDate: electionsTable.endDate,
    requiresPayment: electionsTable.requiresPayment,
    votingFee: electionsTable.votingFee,
    currency: electionsTable.currency,
    totalVotes: electionsTable.totalVotes,
    totalCandidates: electionsTable.totalCandidates,
    registeredVoters: electionsTable.registeredVoters,
    allowMultiplePositions: electionsTable.allowMultiplePositions,
    resultsPublished: electionsTable.resultsPublished,
    slug: electionsTable.slug,
    eligibleDepartments: electionsTable.eligibleDepartments,
    eligibleYearLevels: electionsTable.eligibleYearLevels,
    nominationsOpen: electionsTable.nominationsOpen,
    createdAt: electionsTable.createdAt,
  };
}

function isVoterEligible(election: any, voter: any): boolean {
  const depts = election.eligibleDepartments as string[] | null;
  const levels = election.eligibleYearLevels as string[] | null;

  if (depts && depts.length > 0) {
    if (!voter.departmentId || !depts.includes(voter.departmentId)) return false;
  }

  if (levels && levels.length > 0) {
    if (!voter.yearLevel || !levels.includes(voter.yearLevel)) return false;
  }

  return true;
}

router.get("/", requireAuth, async (req, res) => {
  const { schoolId, status } = req.query;
  const user = (req as any).user;

  const query = db.select(electionFields()).from(electionsTable)
    .leftJoin(schoolsTable, eq(electionsTable.schoolId, schoolsTable.id)) as any;

  const conditions = [];
  if (schoolId) conditions.push(eq(electionsTable.schoolId, schoolId as string));
  if (status) conditions.push(eq(electionsTable.status, status as any));

  const results = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(electionsTable.createdAt)
    : await query.orderBy(electionsTable.createdAt);

  if (user.role === "voter") {
    const filtered = results.filter((e: any) => isVoterEligible(e, user));
    res.json(filtered);
    return;
  }

  res.json(results);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const data = createElectionSchema.parse(req.body);

    const limitCheck = await checkElectionLimit(data.schoolId);
    if (!limitCheck.allowed) {
      res.status(403).json({ error: "Plan Limit Reached", message: limitCheck.message });
      return;
    }

    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    const [election] = await db.insert(electionsTable).values({
      ...data,
      slug,
      createdById: user.id,
    }).returning();

    await logAudit({
      ...auditFromReq(req),
      action: "election.create",
      entityType: "election",
      entityId: election.id,
      entityLabel: election.title,
      details: { schoolId: data.schoolId },
    });

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

router.get("/my-nominations/all", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const applications = await db.select({
    id: candidateApplicationsTable.id,
    electionId: candidateApplicationsTable.electionId,
    electionTitle: electionsTable.title,
    position: candidateApplicationsTable.position,
    status: candidateApplicationsTable.status,
    reviewNote: candidateApplicationsTable.reviewNote,
    createdAt: candidateApplicationsTable.createdAt,
  }).from(candidateApplicationsTable)
    .leftJoin(electionsTable, eq(candidateApplicationsTable.electionId, electionsTable.id))
    .where(eq(candidateApplicationsTable.userId, user.id))
    .orderBy(desc(candidateApplicationsTable.createdAt));

  res.json(applications);
});

router.get("/:electionId", requireAuth, async (req, res) => {
  const [election] = await db.select(electionFields()).from(electionsTable)
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
  await logAudit({
    ...auditFromReq(req),
    schoolId: election.schoolId,
    action: "election.start",
    entityType: "election",
    entityId: election.id,
    entityLabel: election.title,
  });

  getEligibleVoterIds(election.schoolId).then(voterIds => {
    notifyUsers(voterIds, "Election Opened", `"${election.title}" is now open for voting! Cast your vote before the deadline.`, {
      channels: ["sms", "in_app"],
      event: "election_opened",
      schoolId: election.schoolId,
      electionId: election.id,
      link: `/vote/${election.id}`,
    });
  }).catch(() => {});

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
  await logAudit({
    ...auditFromReq(req),
    schoolId: election.schoolId,
    action: "election.close",
    entityType: "election",
    entityId: election.id,
    entityLabel: election.title,
  });
  res.json({ ...election, schoolName: null });
});

router.post("/:electionId/publish-results", requireAuth, async (req, res) => {
  const [election] = await db.update(electionsTable)
    .set({ resultsPublished: true, updatedAt: new Date() })
    .where(eq(electionsTable.id, req.params.electionId))
    .returning();
  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }
  await logAudit({
    ...auditFromReq(req),
    schoolId: election.schoolId,
    action: "election.publish_results",
    entityType: "election",
    entityId: election.id,
    entityLabel: election.title,
  });

  (async () => {
    try {
      const voterIds = await getEligibleVoterIds(election.schoolId);
      await notifyUsers(voterIds, "Results Published", `Results for "${election.title}" are now available! Check them out.`, {
        channels: ["sms", "email", "in_app"],
        event: "results_published",
        schoolId: election.schoolId,
        electionId: election.id,
        emailSubject: `Election Results: ${election.title}`,
        emailHtml: `<h2>Results Published</h2><p>The results for <strong>${election.title}</strong> are now available on BallotWave.</p>`,
        link: `/dashboard/elections/${election.id}/results`,
      });

      const candidates = await db.select().from(candidatesTable)
        .where(eq(candidatesTable.electionId, election.id));
      const positions = [...new Set(candidates.map(c => c.position))];
      for (const pos of positions) {
        const posCandidates = candidates.filter(c => c.position === pos).sort((a, b) => b.voteCount - a.voteCount);
        const winner = posCandidates[0];
        if (winner && winner.userId) {
          await notifyUser(winner.userId, "Congratulations!", `You won the ${pos} position in "${election.title}"!`, {
            channels: ["sms", "in_app"],
            event: "winner_declared",
            schoolId: election.schoolId,
            electionId: election.id,
            link: `/dashboard/elections/${election.id}/results`,
          });
        }
      }
    } catch (err) {
      console.error("[notify] results_published error:", err);
    }
  })();

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
  const registeredVoters = election.registeredVoters || 0;

  const positionResults = positions.map(position => {
    const positionCandidates = candidates
      .filter((c: any) => c.position === position)
      .map((c: any) => ({
        candidateId: c.id,
        name: c.name,
        photoUrl: c.photoUrl,
        department: c.department,
        voteCount: c.voteCount,
        percentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    const winner = positionCandidates[0] || null;
    return { position, candidates: positionCandidates, winner };
  });

  const turnoutPercentage = registeredVoters > 0 ? Math.round((totalVotes / registeredVoters) * 100) : 0;

  res.json({
    electionId: election.id,
    title: election.title,
    slug: election.slug,
    status: election.status,
    resultsPublished: election.resultsPublished,
    totalVotes,
    registeredVoters,
    turnoutPercentage,
    positions: positionResults,
  });
});

router.get("/public/:slug/results", async (req, res) => {
  const { slug } = req.params;
  const [election] = await db.select().from(electionsTable)
    .where(eq(electionsTable.slug, slug)).limit(1);

  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }

  if (!election.resultsPublished) {
    res.status(403).json({ error: "Forbidden", message: "Results have not been published yet" });
    return;
  }

  const candidates = await db.select().from(candidatesTable)
    .where(eq(candidatesTable.electionId, election.id));

  const positions = [...new Set(candidates.map((c: any) => c.position))];
  const totalVotes = election.totalVotes;
  const registeredVoters = election.registeredVoters || 0;
  const turnoutPercentage = registeredVoters > 0 ? Math.round((totalVotes / registeredVoters) * 100) : 0;

  const positionResults = positions.map(position => {
    const positionCandidates = candidates
      .filter((c: any) => c.position === position)
      .map((c: any) => ({
        candidateId: c.id,
        name: c.name,
        photoUrl: c.photoUrl,
        department: c.department,
        voteCount: c.voteCount,
        percentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    const winner = positionCandidates[0] || null;
    return { position, candidates: positionCandidates, winner };
  });

  res.json({
    electionId: election.id,
    title: election.title,
    description: election.description,
    status: election.status,
    resultsPublished: true,
    totalVotes,
    registeredVoters,
    turnoutPercentage,
    positions: positionResults,
  });
});

router.get("/:electionId/results/export", requireAuth, async (req, res) => {
  const [election] = await db.select().from(electionsTable)
    .where(eq(electionsTable.id, req.params.electionId)).limit(1);
  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }

  const candidates = await db.select().from(candidatesTable)
    .where(eq(candidatesTable.electionId, req.params.electionId))
    .orderBy(candidatesTable.position, candidatesTable.voteCount);

  const totalVotes = election.totalVotes;
  const rows = [
    ["Position", "Candidate Name", "Department", "Votes", "Percentage", "Result"],
    ...candidates.map((c: any) => {
      const pct = totalVotes > 0 ? ((c.voteCount / totalVotes) * 100).toFixed(1) : "0.0";
      const positionCands = candidates.filter((x: any) => x.position === c.position);
      const isWinner = positionCands.sort((a: any, b: any) => b.voteCount - a.voteCount)[0]?.id === c.id;
      return [c.position, c.name, c.department || "", c.voteCount, `${pct}%`, isWinner && election.status === "closed" ? "WINNER" : ""];
    })
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const filename = `${election.title.replace(/[^a-z0-9]/gi, "_")}_results.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

router.get("/:electionId/verify/:receiptCode", async (req, res) => {
  const { electionId, receiptCode } = req.params;
  const [receipt] = await db.select().from(voterReceiptsTable)
    .where(and(
      eq(voterReceiptsTable.electionId, electionId),
      eq(voterReceiptsTable.receiptCode, receiptCode)
    )).limit(1);

  if (!receipt) {
    res.json({ verified: false, message: "This receipt code was not found in our records." });
    return;
  }

  res.json({
    verified: true,
    receiptCode: receipt.receiptCode,
    electionId: receipt.electionId,
    votedAt: receipt.createdAt,
    message: "Your vote was successfully recorded.",
  });
});

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

    if (!isVoterEligible(election, user)) {
      res.status(403).json({ error: "Forbidden", message: "You are not eligible to vote in this election based on your department or year level." });
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

    notifyUser(user.id, "Vote Confirmed", `Your vote in "${election.title}" has been recorded. Receipt: ${receiptCode}`, {
      channels: ["sms", "in_app"],
      event: "vote_cast",
      schoolId: election.schoolId,
      electionId: election.id,
      link: `/dashboard/elections/${election.id}`,
    }).catch(() => {});

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

function isSafeUrl(url: string): boolean {
  if (url.startsWith("data:")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const ALLOWED_VIDEO_HOSTS = [
  "youtube.com", "www.youtube.com", "youtu.be",
  "vimeo.com", "www.vimeo.com", "player.vimeo.com",
];

function isAllowedVideoUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_VIDEO_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

const nominationSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  position: z.string().min(2),
  manifesto: z.string().optional(),
  manifestoPdfUrl: z.string().min(1, "Manifesto PDF is required").refine(isSafeUrl, "Invalid manifesto URL"),
  videoUrl: z.string().url().optional().or(z.literal("")).refine((v) => !v || isAllowedVideoUrl(v), "Video URL must be from YouTube or Vimeo"),
  photoUrl: z.string().min(1, "Candidate photo is required").refine(isSafeUrl, "Invalid photo URL"),
  department: z.string().optional(),
  studentId: z.string().optional(),
});

async function sendNominationSms(phone: string | null | undefined, message: string) {
  if (!phone) return;
  const arkeselKey = process.env.ARKESEL_API_KEY;
  if (!arkeselKey) return;
  try {
    await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": arkeselKey },
      body: JSON.stringify({ sender: "BallotWave", recipients: [phone], message }),
    });
  } catch (err) {
    console.error("SMS send failed:", err);
  }
}

router.patch("/:electionId/nominations-open", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (!["super_admin", "school_admin", "electoral_officer"].includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Only admins can toggle nominations" });
    return;
  }
  const [existing] = await db.select().from(electionsTable).where(eq(electionsTable.id, req.params.electionId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }
  if (user.role !== "super_admin" && existing.schoolId !== user.schoolId) {
    res.status(403).json({ error: "Forbidden", message: "You can only manage elections in your school" });
    return;
  }
  const { open } = req.body;
  const [election] = await db.update(electionsTable)
    .set({ nominationsOpen: !!open, updatedAt: new Date() })
    .where(eq(electionsTable.id, req.params.electionId))
    .returning();
  await logAudit({
    ...auditFromReq(req),
    schoolId: election.schoolId,
    action: open ? "election.nominations_opened" : "election.nominations_closed",
    entityType: "election",
    entityId: election.id,
    entityLabel: election.title,
  });
  res.json({ ...election, schoolName: null });
});

router.post("/:electionId/nominate", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    if (user.role !== "voter") {
      res.status(403).json({ error: "Forbidden", message: "Only voters can self-nominate" });
      return;
    }

    const data = nominationSchema.parse(req.body);

    if (data.photoUrl && data.photoUrl.startsWith("data:")) {
      if (!data.photoUrl.startsWith("data:image/")) {
        res.status(400).json({ error: "Bad Request", message: "Photo must be an image file" });
        return;
      }
      const sizeBytes = Math.ceil((data.photoUrl.length * 3) / 4);
      if (sizeBytes > 2 * 1024 * 1024) {
        res.status(400).json({ error: "Bad Request", message: "Photo must be under 2MB" });
        return;
      }
    }
    if (data.manifestoPdfUrl && data.manifestoPdfUrl.startsWith("data:")) {
      if (!data.manifestoPdfUrl.startsWith("data:application/pdf")) {
        res.status(400).json({ error: "Bad Request", message: "Manifesto must be a PDF file" });
        return;
      }
      const sizeBytes = Math.ceil((data.manifestoPdfUrl.length * 3) / 4);
      if (sizeBytes > 5 * 1024 * 1024) {
        res.status(400).json({ error: "Bad Request", message: "Manifesto PDF must be under 5MB" });
        return;
      }
    }

    const [election] = await db.select().from(electionsTable)
      .where(eq(electionsTable.id, req.params.electionId)).limit(1);

    if (!election) {
      res.status(404).json({ error: "Not Found", message: "Election not found" });
      return;
    }

    if (user.schoolId !== election.schoolId) {
      res.status(403).json({ error: "Forbidden", message: "You can only nominate in your own school's elections" });
      return;
    }

    if (!isVoterEligible(election, user)) {
      res.status(403).json({ error: "Forbidden", message: "You are not eligible for this election based on your department or year level" });
      return;
    }

    if (!election.nominationsOpen) {
      res.status(400).json({ error: "Bad Request", message: "Nominations are not currently open for this election" });
      return;
    }

    const existing = await db.select().from(candidateApplicationsTable)
      .where(and(
        eq(candidateApplicationsTable.electionId, req.params.electionId),
        eq(candidateApplicationsTable.userId, user.id),
        eq(candidateApplicationsTable.position, data.position)
      )).limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "You have already applied for this position in this election" });
      return;
    }

    const [application] = await db.insert(candidateApplicationsTable).values({
      electionId: req.params.electionId,
      userId: user.id,
      name: data.name,
      position: data.position,
      manifesto: data.manifesto,
      manifestoPdfUrl: data.manifestoPdfUrl,
      videoUrl: data.videoUrl || null,
      photoUrl: data.photoUrl,
      studentId: data.studentId || user.studentId,
      department: data.department || user.department,
    }).returning();

    const officerIds = await getOfficerIds(election.schoolId);
    const nomMsg = `${user.name} has applied for ${data.position} in "${election.title}"`;
    notifyUsers(officerIds, "New Nomination Application", nomMsg, {
      channels: ["email", "in_app"],
      event: "nomination_submitted",
      schoolId: election.schoolId,
      electionId: election.id,
      emailSubject: `New Nomination: ${data.position} - ${election.title}`,
      emailHtml: `<h2>New Nomination Application</h2><p>${nomMsg}</p><p>Please review it in the BallotWave dashboard.</p>`,
      link: `/dashboard/elections/${election.id}?tab=nominations`,
    }).catch(() => {});

    await logAudit({
      ...auditFromReq(req),
      schoolId: election.schoolId,
      action: "nomination.submit",
      entityType: "nomination",
      entityId: application.id,
      entityLabel: `${user.name} for ${data.position}`,
      details: { electionId: req.params.electionId, position: data.position },
    });

    res.status(201).json(application);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Internal Error", message: "Failed to submit nomination" });
    }
  }
});

router.get("/:electionId/nominations", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status: filterStatus } = req.query;

  const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, req.params.electionId)).limit(1);
  if (!election) {
    res.status(404).json({ error: "Not Found", message: "Election not found" });
    return;
  }

  const isAdmin = ["super_admin", "school_admin", "electoral_officer"].includes(user.role);
  if (isAdmin && user.role !== "super_admin" && election.schoolId !== user.schoolId) {
    res.status(403).json({ error: "Forbidden", message: "You can only view nominations for your school's elections" });
    return;
  }

  const conditions = [eq(candidateApplicationsTable.electionId, req.params.electionId)];

  if (!isAdmin) {
    conditions.push(eq(candidateApplicationsTable.userId, user.id));
  }

  if (filterStatus) {
    conditions.push(eq(candidateApplicationsTable.status, filterStatus as any));
  }

  const applications = await db.select().from(candidateApplicationsTable)
    .where(and(...conditions))
    .orderBy(desc(candidateApplicationsTable.createdAt));

  res.json(applications);
});

router.patch("/:electionId/nominations/:appId/resubmit", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "voter") {
      res.status(403).json({ error: "Forbidden", message: "Only voters can resubmit nominations" });
      return;
    }

    const [existing] = await db.select().from(candidateApplicationsTable)
      .where(and(
        eq(candidateApplicationsTable.id, req.params.appId),
        eq(candidateApplicationsTable.electionId, req.params.electionId),
        eq(candidateApplicationsTable.userId, user.id)
      )).limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Application not found" });
      return;
    }

    if (existing.status !== "revision_requested") {
      res.status(400).json({ error: "Bad Request", message: "Only revision-requested nominations can be resubmitted" });
      return;
    }

    const { name, position, manifesto, manifestoPdfUrl, videoUrl, photoUrl, department } = req.body;

    if (photoUrl && typeof photoUrl === "string") {
      if (!isSafeUrl(photoUrl)) {
        res.status(400).json({ error: "Bad Request", message: "Invalid photo URL" });
        return;
      }
      if (photoUrl.startsWith("data:") && !photoUrl.startsWith("data:image/")) {
        res.status(400).json({ error: "Bad Request", message: "Photo must be an image file" });
        return;
      }
      if (photoUrl.startsWith("data:")) {
        const sizeBytes = Math.ceil((photoUrl.length * 3) / 4);
        if (sizeBytes > 2 * 1024 * 1024) {
          res.status(400).json({ error: "Bad Request", message: "Photo must be under 2MB" });
          return;
        }
      }
    }
    if (manifestoPdfUrl && typeof manifestoPdfUrl === "string") {
      if (!isSafeUrl(manifestoPdfUrl)) {
        res.status(400).json({ error: "Bad Request", message: "Invalid manifesto URL" });
        return;
      }
      if (manifestoPdfUrl.startsWith("data:") && !manifestoPdfUrl.startsWith("data:application/pdf")) {
        res.status(400).json({ error: "Bad Request", message: "Manifesto must be a PDF file" });
        return;
      }
      if (manifestoPdfUrl.startsWith("data:")) {
        const sizeBytes = Math.ceil((manifestoPdfUrl.length * 3) / 4);
        if (sizeBytes > 5 * 1024 * 1024) {
          res.status(400).json({ error: "Bad Request", message: "Manifesto PDF must be under 5MB" });
          return;
        }
      }
    }
    if (videoUrl && typeof videoUrl === "string" && !isAllowedVideoUrl(videoUrl)) {
      res.status(400).json({ error: "Bad Request", message: "Video URL must be from YouTube or Vimeo" });
      return;
    }

    const [updated] = await db.update(candidateApplicationsTable)
      .set({
        name: name || existing.name,
        position: position || existing.position,
        manifesto: manifesto !== undefined ? manifesto : existing.manifesto,
        manifestoPdfUrl: manifestoPdfUrl !== undefined ? manifestoPdfUrl : existing.manifestoPdfUrl,
        videoUrl: videoUrl !== undefined ? (videoUrl || null) : existing.videoUrl,
        photoUrl: photoUrl !== undefined ? photoUrl : existing.photoUrl,
        department: department !== undefined ? department : existing.department,
        status: "pending",
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(candidateApplicationsTable.id, req.params.appId))
      .returning();

    const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, req.params.electionId)).limit(1);
    if (election) {
      const admins = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(
          eq(usersTable.schoolId, election.schoolId),
          sql`${usersTable.role} IN ('school_admin', 'electoral_officer')`
        ));
      for (const admin of admins) {
        await db.insert(notificationsTable).values({
          userId: admin.id,
          title: "Nomination Resubmitted",
          message: `${user.name} has resubmitted their nomination for ${updated.position} in "${election.title}"`,
          type: "nomination",
          link: `/dashboard/elections/${election.id}`,
        });
      }
    }

    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Internal Error", message: "Failed to resubmit nomination" });
  }
});

const nominationReviewHandler = async (req: any, res: any) => {
  try {
    const user = (req as any).user;
    if (!["super_admin", "school_admin", "electoral_officer"].includes(user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Only admins can review nominations" });
      return;
    }

    const [election] = await db.select().from(electionsTable).where(eq(electionsTable.id, req.params.electionId)).limit(1);
    if (!election) {
      res.status(404).json({ error: "Not Found", message: "Election not found" });
      return;
    }
    if (user.role !== "super_admin" && election.schoolId !== user.schoolId) {
      res.status(403).json({ error: "Forbidden", message: "You can only manage elections in your school" });
      return;
    }

    const { status, reviewNote } = req.body;
    if (!["approved", "rejected", "revision_requested"].includes(status)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid status" });
      return;
    }

    if ((status === "rejected" || status === "revision_requested") && (!reviewNote || !reviewNote.trim())) {
      res.status(400).json({ error: "Bad Request", message: "A reason is required when rejecting or requesting revision" });
      return;
    }

    const [existingApp] = await db.select().from(candidateApplicationsTable)
      .where(and(
        eq(candidateApplicationsTable.id, req.params.appId),
        eq(candidateApplicationsTable.electionId, req.params.electionId)
      )).limit(1);

    if (!existingApp) {
      res.status(404).json({ error: "Not Found", message: "Application not found" });
      return;
    }

    if (existingApp.status === "approved") {
      res.status(400).json({ error: "Bad Request", message: "This nomination has already been approved" });
      return;
    }

    const [application] = await db.update(candidateApplicationsTable)
      .set({
        status,
        reviewNote: reviewNote || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(candidateApplicationsTable.id, req.params.appId),
        eq(candidateApplicationsTable.electionId, req.params.electionId)
      ))
      .returning();

    const [applicantUser] = await db.select({ phone: usersTable.phone }).from(usersTable)
      .where(eq(usersTable.id, application.userId)).limit(1);
    const applicantPhone = applicantUser?.phone;

    if (status === "approved") {
      const [existingCandidate] = await db.select().from(candidatesTable)
        .where(and(
          eq(candidatesTable.electionId, application.electionId),
          eq(candidatesTable.userId, application.userId),
          eq(candidatesTable.position, application.position)
        )).limit(1);

      if (existingCandidate) {
        await db.update(candidatesTable)
          .set({
            name: application.name,
            manifesto: application.manifesto,
            manifestoPdfUrl: application.manifestoPdfUrl,
            videoUrl: application.videoUrl,
            photoUrl: application.photoUrl,
            department: application.department,
            studentId: application.studentId,
            isApproved: true,
            updatedAt: new Date(),
          })
          .where(eq(candidatesTable.id, existingCandidate.id));
      } else {
        await db.insert(candidatesTable).values({
          electionId: application.electionId,
          userId: application.userId,
          name: application.name,
          position: application.position,
          manifesto: application.manifesto,
          manifestoPdfUrl: application.manifestoPdfUrl,
          videoUrl: application.videoUrl,
          photoUrl: application.photoUrl,
          studentId: application.studentId,
          department: application.department,
          isApproved: true,
        });

        await db.update(electionsTable)
          .set({ totalCandidates: sql`${electionsTable.totalCandidates} + 1`, updatedAt: new Date() })
          .where(eq(electionsTable.id, application.electionId));
      }

      const approvedMsg = `Your nomination for ${application.position} has been approved. You are now an official candidate!`;
      notifyUser(application.userId, "Nomination Approved!", approvedMsg, {
        channels: ["sms", "email", "in_app"],
        event: "nomination_approved",
        schoolId: election.schoolId,
        electionId: application.electionId,
        emailSubject: "Your Nomination Has Been Approved",
        emailHtml: `<h2>Nomination Approved</h2><p>${approvedMsg}</p>`,
        link: `/dashboard/elections/${application.electionId}`,
      }).catch(() => {});
    } else if (status === "rejected") {
      const rejectedMsg = `Your nomination for ${application.position} was not approved. Reason: ${reviewNote}`;
      notifyUser(application.userId, "Nomination Not Approved", rejectedMsg, {
        channels: ["sms", "email", "in_app"],
        event: "nomination_rejected",
        schoolId: election.schoolId,
        electionId: application.electionId,
        emailSubject: "Your Nomination Was Not Approved",
        emailHtml: `<h2>Nomination Rejected</h2><p>${rejectedMsg}</p>`,
        link: `/dashboard/elections/${application.electionId}`,
      }).catch(() => {});
    } else if (status === "revision_requested") {
      const revisionMsg = `Your nomination for ${application.position} needs revision. Note: ${reviewNote}`;
      notifyUser(application.userId, "Nomination Needs Revision", revisionMsg, {
        channels: ["sms", "email", "in_app"],
        event: "nomination_revision",
        schoolId: election.schoolId,
        electionId: application.electionId,
        emailSubject: "Revision Requested for Your Nomination",
        emailHtml: `<h2>Revision Requested</h2><p>${revisionMsg}</p>`,
        link: `/dashboard/elections/${application.electionId}`,
      }).catch(() => {});
    }

    await logAudit({
      ...auditFromReq(req),
      action: `nomination.${status}`,
      entityType: "nomination",
      entityId: application.id,
      entityLabel: `${application.name} for ${application.position}`,
      details: { electionId: req.params.electionId, status, reviewNote },
    });

    res.json(application);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Internal Error", message: "Failed to review nomination" });
  }
};

router.patch("/:electionId/nominations/:appId/review", requireAuth, nominationReviewHandler);
router.patch("/:electionId/nominations/:appId", requireAuth, nominationReviewHandler);

export default router;
