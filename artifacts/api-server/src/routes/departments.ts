import { Router } from "express";
import { db, departmentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

const createDepartmentSchema = z.object({
  schoolId: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const { schoolId } = req.query;
  let departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  if (schoolId) {
    departments = departments.filter((d: any) => d.schoolId === schoolId);
  }
  res.json(departments);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = createDepartmentSchema.parse(req.body);
    const [dept] = await db.insert(departmentsTable).values(data).returning();
    res.status(201).json(dept);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to create department" });
    }
  }
});

router.patch("/:departmentId", requireAuth, async (req, res) => {
  try {
    const data = updateDepartmentSchema.parse(req.body);
    const [dept] = await db.update(departmentsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departmentsTable.id, req.params.departmentId))
      .returning();
    if (!dept) {
      res.status(404).json({ error: "Not Found", message: "Department not found" });
      return;
    }
    res.json(dept);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update department" });
  }
});

router.delete("/:departmentId", requireAuth, async (req, res) => {
  await db.delete(departmentsTable).where(eq(departmentsTable.id, req.params.departmentId));
  res.json({ success: true, message: "Department deleted" });
});

export default router;
