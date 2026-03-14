import { Router } from "express";
import { db, promoCodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

function requireSuperAdmin(req: any, res: any, next: any) {
  const user = (req as any).user;
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }
  next();
}

const createPromoSchema = z.object({
  code: z.string().min(3).max(30).transform(s => s.toUpperCase()),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().positive(),
  planTarget: z.string().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

router.get("/", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(promoCodesTable.createdAt);
    res.json(codes);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to load promo codes" });
  }
});

router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const data = createPromoSchema.parse(req.body);
    const existing = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, data.code)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Promo code already exists" });
      return;
    }
    const [code] = await db.insert(promoCodesTable).values({
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      planTarget: data.planTarget || null,
      maxUses: data.maxUses || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    }).returning();
    res.status(201).json(code);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to create promo code" });
    }
  }
});

router.patch("/by-code/:code", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const [updated] = await db.update(promoCodesTable)
      .set({ isActive: !!isActive, updatedAt: new Date() })
      .where(eq(promoCodesTable.code, req.params.code.toUpperCase()))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not Found", message: "Promo code not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to update promo code:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to update promo code" });
  }
});

router.delete("/by-code/:code", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [deleted] = await db.delete(promoCodesTable)
      .where(eq(promoCodesTable.code, req.params.code.toUpperCase()))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not Found", message: "Promo code not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete promo code:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to delete promo code" });
  }
});

router.patch("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const [updated] = await db.update(promoCodesTable)
      .set({ isActive: !!isActive, updatedAt: new Date() })
      .where(eq(promoCodesTable.id, req.params.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not Found", message: "Promo code not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to update promo code:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to update promo code" });
  }
});

router.delete("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [deleted] = await db.delete(promoCodesTable)
      .where(eq(promoCodesTable.id, req.params.id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not Found", message: "Promo code not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete promo code:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to delete promo code" });
  }
});

router.post("/validate", requireAuth, async (req, res) => {
  try {
    const { code, amount, plan } = req.body;
    if (!code || !amount) {
      res.status(400).json({ error: "Validation Error", message: "Code and amount required" });
      return;
    }
    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.toUpperCase()))
      .limit(1);

    if (!promo || !promo.isActive) {
      res.status(404).json({ error: "Invalid", message: "Promo code is invalid or inactive" });
      return;
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.status(400).json({ error: "Expired", message: "Promo code has expired" });
      return;
    }
    if (promo.maxUses && promo.usesCount >= promo.maxUses) {
      res.status(400).json({ error: "Exhausted", message: "Promo code usage limit reached" });
      return;
    }
    if (promo.planTarget && plan && promo.planTarget !== plan) {
      res.status(400).json({ error: "Invalid Plan", message: `This code is only valid for ${promo.planTarget} plan` });
      return;
    }

    let discount = 0;
    if (promo.discountType === "percent") {
      discount = (amount * promo.discountValue) / 100;
    } else {
      discount = Math.min(promo.discountValue, amount);
    }
    const discountedPrice = Math.max(0, amount - discount);

    res.json({
      valid: true,
      promoId: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discount: Math.round(discount * 100) / 100,
      originalPrice: amount,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
    });
  } catch (err) {
    console.error("Failed to validate promo code:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to validate promo code" });
  }
});

router.post("/apply", requireAuth, async (req, res) => {
  try {
    const { code, amount } = req.body;
    if (!code || !amount) {
      res.status(400).json({ error: "Validation Error", message: "Code and amount required" });
      return;
    }
    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.toUpperCase()))
      .limit(1);

    if (!promo || !promo.isActive) {
      res.status(404).json({ error: "Invalid", message: "Promo code is invalid or inactive" });
      return;
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.status(400).json({ error: "Expired", message: "Promo code has expired" });
      return;
    }
    if (promo.maxUses && promo.usesCount >= promo.maxUses) {
      res.status(400).json({ error: "Exhausted", message: "Promo code usage limit reached" });
      return;
    }

    let discount = 0;
    if (promo.discountType === "percent") {
      discount = (amount * promo.discountValue) / 100;
    } else {
      discount = Math.min(promo.discountValue, amount);
    }
    discount = Math.round(discount * 100) / 100;

    await db.update(promoCodesTable)
      .set({
        usesCount: sql`${promoCodesTable.usesCount} + 1`,
        totalDiscountGiven: sql`${promoCodesTable.totalDiscountGiven} + ${discount}`,
        updatedAt: new Date(),
      })
      .where(eq(promoCodesTable.id, promo.id));

    const discountedPrice = Math.max(0, Math.round((amount - discount) * 100) / 100);

    res.json({
      applied: true,
      code: promo.code,
      discount,
      originalPrice: amount,
      discountedPrice,
    });
  } catch (err) {
    console.error("Failed to apply promo code:", err);
    res.status(500).json({ error: "Internal Error", message: "Failed to apply promo code" });
  }
});

export default router;
