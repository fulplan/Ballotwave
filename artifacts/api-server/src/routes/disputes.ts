import { Router } from "express";
import { db, disputesTable, usersTable, electionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

const createDisputeSchema = z.object({
  electionId: z.string(),
  subject: z.string().min(5),
  description: z.string().min(10),
});

const resolveDisputeSchema = z.object({
  status: z.enum(["investigating", "resolved", "dismissed"]),
  resolution: z.string().optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const { electionId, schoolId } = req.query;
  const user = (req as any).user;

  const disputes = await db.select({
    id: disputesTable.id,
    electionId: disputesTable.electionId,
    subject: disputesTable.subject,
    description: disputesTable.description,
    status: disputesTable.status,
    resolution: disputesTable.resolution,
    resolvedAt: disputesTable.resolvedAt,
    createdAt: disputesTable.createdAt,
    reportedByName: usersTable.name,
    reportedById: disputesTable.reportedById,
  }).from(disputesTable)
    .leftJoin(usersTable, eq(disputesTable.reportedById, usersTable.id))
    .orderBy(disputesTable.createdAt);

  let result = disputes;
  if (electionId) result = result.filter((d: any) => d.electionId === electionId);
  // If school_admin or electoral_officer, filter by their school's elections
  if (user.role === 'voter') {
    result = result.filter((d: any) => d.reportedById === user.id);
  }

  res.json(result.reverse());
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const data = createDisputeSchema.parse(req.body);
    const [dispute] = await db.insert(disputesTable).values({
      ...data,
      reportedById: user.id,
    }).returning();
    res.status(201).json(dispute);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to submit dispute" });
    }
  }
});

router.patch("/:disputeId", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const data = resolveDisputeSchema.parse(req.body);
    const [dispute] = await db.update(disputesTable)
      .set({
        ...data,
        resolvedById: user.id,
        resolvedAt: data.status === "resolved" || data.status === "dismissed" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(disputesTable.id, req.params.disputeId))
      .returning();
    if (!dispute) {
      res.status(404).json({ error: "Not Found", message: "Dispute not found" });
      return;
    }
    res.json(dispute);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update dispute" });
  }
});

export default router;
