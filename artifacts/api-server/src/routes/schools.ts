import { Router } from "express";
import { db, schoolsTable, invoicesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const createSchoolSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().default("Ghana"),
  plan: z.enum(["free", "basic", "pro", "enterprise"]).default("free"),
});

const updateSchoolSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  isActive: z.boolean().optional(),
  plan: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
});

const ussdConfigSchema = z.object({
  ussdShortCode: z.string().min(1).optional(),
  ussdSchoolCode: z.string().min(1).optional(),
  ussdLanguage: z.enum(["en", "tw", "ha"]).optional(),
  ussdEnabled: z.boolean().optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const schools = await db.select().from(schoolsTable).orderBy(schoolsTable.createdAt);
  res.json(schools);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = createSchoolSchema.parse(req.body);
    const slug = slugify(data.name) + "-" + Date.now().toString(36);
    const [school] = await db.insert(schoolsTable).values({
      ...data,
      slug,
    }).returning();
    res.status(201).json(school);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to create school" });
    }
  }
});

router.get("/:schoolId", requireAuth, async (req, res) => {
  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, req.params.schoolId)).limit(1);
  if (!school) {
    res.status(404).json({ error: "Not Found", message: "School not found" });
    return;
  }
  res.json(school);
});

router.patch("/:schoolId", requireAuth, async (req, res) => {
  try {
    const data = updateSchoolSchema.parse(req.body);
    const [school] = await db.update(schoolsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolsTable.id, req.params.schoolId))
      .returning();
    if (!school) {
      res.status(404).json({ error: "Not Found", message: "School not found" });
      return;
    }
    res.json(school);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update school" });
  }
});

router.get("/:schoolId/ussd-config", requireAuth, async (req, res) => {
  const user = (req as Record<string, unknown>).user as { role: string; schoolId: string | null };
  if (user.role !== "super_admin" && user.role !== "school_admin" && user.role !== "electoral_officer") {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }
  if ((user.role === "school_admin" || user.role === "electoral_officer") && user.schoolId !== req.params.schoolId) {
    res.status(403).json({ error: "Forbidden", message: "You can only view your own school's USSD config" });
    return;
  }

  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, req.params.schoolId)).limit(1);
  if (!school) {
    res.status(404).json({ error: "Not Found", message: "School not found" });
    return;
  }
  const ussdAvailable = school.plan === "pro" || school.plan === "enterprise";
  res.json({
    ussdShortCode: school.ussdShortCode || "",
    ussdSchoolCode: school.ussdSchoolCode || "",
    ussdLanguage: school.ussdLanguage || "en",
    ussdEnabled: school.ussdEnabled || false,
    ussdAvailable,
    dialString: school.ussdShortCode && school.ussdSchoolCode
      ? `*${school.ussdShortCode}*${school.ussdSchoolCode}#`
      : null,
  });
});

router.patch("/:schoolId/ussd-config", requireAuth, async (req, res) => {
  try {
    const user = (req as Record<string, unknown>).user as { role: string; schoolId: string | null };
    if (user.role !== "super_admin" && user.role !== "school_admin") {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }

    if (user.role === "school_admin" && user.schoolId !== req.params.schoolId) {
      res.status(403).json({ error: "Forbidden", message: "You can only manage your own school's USSD config" });
      return;
    }

    const data = ussdConfigSchema.parse(req.body);
    const [school] = await db.update(schoolsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolsTable.id, req.params.schoolId))
      .returning();

    if (!school) {
      res.status(404).json({ error: "Not Found", message: "School not found" });
      return;
    }

    res.json({
      ussdShortCode: school.ussdShortCode || "",
      ussdSchoolCode: school.ussdSchoolCode || "",
      ussdLanguage: school.ussdLanguage || "en",
      ussdEnabled: school.ussdEnabled || false,
      dialString: school.ussdShortCode && school.ussdSchoolCode
        ? `*${school.ussdShortCode}*${school.ussdSchoolCode}#`
        : null,
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to update USSD config" });
    }
  }
});

router.get("/:id/invoices", requireAuth, async (req, res) => {
  const user = (req as Record<string, unknown>).user as { role: string; schoolId: string | null };
  const schoolId = req.params.id;

  if (user.role !== "super_admin" && user.schoolId !== schoolId) {
    res.status(403).json({ error: "Forbidden", message: "Not authorized to view this school's invoices" });
    return;
  }

  try {
    const invoices = await db.select().from(invoicesTable)
      .where(eq(invoicesTable.schoolId, schoolId))
      .orderBy(desc(invoicesTable.createdAt));
    res.json(invoices);
  } catch (err) {
    console.error("Failed to load school invoices:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to load invoices" });
  }
});

export default router;
