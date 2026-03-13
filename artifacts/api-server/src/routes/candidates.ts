import { Router } from "express";
import { db, candidatesTable, electionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router = Router({ mergeParams: true });

const createCandidateSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(2),
  position: z.string().min(2),
  manifesto: z.string().optional(),
  photoUrl: z.string().url().optional(),
  studentId: z.string().optional(),
  department: z.string().optional(),
});

const updateCandidateSchema = z.object({
  position: z.string().optional(),
  manifesto: z.string().optional(),
  photoUrl: z.string().url().optional(),
  isApproved: z.boolean().optional(),
});

router.get("/", async (req, res) => {
  const { electionId } = req.params;
  const candidates = await db.select().from(candidatesTable)
    .where(eq(candidatesTable.electionId, electionId))
    .orderBy(candidatesTable.position, candidatesTable.name);
  res.json(candidates);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { electionId } = req.params;
    const data = createCandidateSchema.parse(req.body);
    const [candidate] = await db.insert(candidatesTable).values({
      electionId,
      ...data,
      isApproved: true,
    }).returning();

    await db.update(electionsTable)
      .set({ totalCandidates: sql`${electionsTable.totalCandidates} + 1`, updatedAt: new Date() })
      .where(eq(electionsTable.id, electionId));

    res.status(201).json(candidate);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to add candidate" });
    }
  }
});

router.patch("/:candidateId", requireAuth, async (req, res) => {
  try {
    const { electionId, candidateId } = req.params;
    const data = updateCandidateSchema.parse(req.body);
    const [candidate] = await db.update(candidatesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(candidatesTable.id, candidateId),
        eq(candidatesTable.electionId, electionId)
      ))
      .returning();
    if (!candidate) {
      res.status(404).json({ error: "Not Found", message: "Candidate not found" });
      return;
    }
    res.json(candidate);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update candidate" });
  }
});

router.delete("/:candidateId", requireAuth, async (req, res) => {
  const { electionId, candidateId } = req.params;
  await db.delete(candidatesTable)
    .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.electionId, electionId)));

  await db.update(electionsTable)
    .set({ totalCandidates: sql`GREATEST(${electionsTable.totalCandidates} - 1, 0)`, updatedAt: new Date() })
    .where(eq(electionsTable.id, electionId));

  res.json({ success: true, message: "Candidate removed" });
});

export default router;
