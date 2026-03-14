import { Router } from "express";
import { db, candidatesTable, electionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sql } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { checkCandidateLimit } from "../lib/plan-limits";
import { logAudit, auditFromReq } from "../lib/audit";

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const createCandidateSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(2),
  position: z.string().min(2),
  manifesto: z.string().optional(),
  photoUrl: z.string().optional(),
  studentId: z.string().optional(),
  department: z.string().optional(),
});

const updateCandidateSchema = z.object({
  position: z.string().optional(),
  manifesto: z.string().optional(),
  photoUrl: z.string().optional(),
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

    const limitCheck = await checkCandidateLimit(electionId);
    if (!limitCheck.allowed) {
      res.status(403).json({ error: "Plan Limit Reached", message: limitCheck.message });
      return;
    }

    const data = createCandidateSchema.parse(req.body);
    const [candidate] = await db.insert(candidatesTable).values({
      electionId,
      ...data,
      isApproved: true,
    }).returning();

    await db.update(electionsTable)
      .set({ totalCandidates: sql`${electionsTable.totalCandidates} + 1`, updatedAt: new Date() })
      .where(eq(electionsTable.id, electionId));

    await logAudit({
      ...auditFromReq(req),
      action: "candidate.add",
      entityType: "candidate",
      entityId: candidate.id,
      entityLabel: `${data.name} for ${data.position}`,
      details: { electionId, position: data.position },
    });

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

    if (typeof data.isApproved === "boolean") {
      await logAudit({
        ...auditFromReq(req),
        action: data.isApproved ? "candidate.approve" : "candidate.reject",
        entityType: "candidate",
        entityId: candidateId,
        entityLabel: candidate.name,
        details: { electionId, position: candidate.position },
      });
    }

    res.json(candidate);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update candidate" });
  }
});

router.delete("/:candidateId", requireAuth, async (req, res) => {
  const { electionId, candidateId } = req.params;
  const [deleted] = await db.delete(candidatesTable)
    .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.electionId, electionId)))
    .returning();

  await db.update(electionsTable)
    .set({ totalCandidates: sql`GREATEST(${electionsTable.totalCandidates} - 1, 0)`, updatedAt: new Date() })
    .where(eq(electionsTable.id, electionId));

  if (deleted) {
    await logAudit({
      ...auditFromReq(req),
      action: "candidate.remove",
      entityType: "candidate",
      entityId: candidateId,
      entityLabel: deleted.name,
      details: { electionId },
    });
  }

  res.json({ success: true, message: "Candidate removed" });
});

router.post("/:candidateId/photo", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const { electionId, candidateId } = req.params;
    if (!req.file) {
      res.status(400).json({ error: "Bad Request", message: "No photo file provided" });
      return;
    }

    if (!req.file.mimetype.startsWith("image/")) {
      res.status(400).json({ error: "Bad Request", message: "File must be an image (JPEG, PNG, WebP)" });
      return;
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const [candidate] = await db.update(candidatesTable)
      .set({ photoUrl: dataUrl, updatedAt: new Date() })
      .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.electionId, electionId)))
      .returning();

    if (!candidate) {
      res.status(404).json({ error: "Not Found", message: "Candidate not found" });
      return;
    }

    res.json({ success: true, photoUrl: dataUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to upload photo" });
  }
});

export default router;
