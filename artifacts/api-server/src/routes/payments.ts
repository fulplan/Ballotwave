import { Router } from "express";
import { db, paymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getPaystackSecret } from "../lib/settings";
import { z } from "zod";

const router = Router();

const initiateSchema = z.object({
  electionId: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["card", "mobile_money", "bank_transfer"]).default("mobile_money"),
  mobileMoneyProvider: z.enum(["mtn", "vodafone", "airteltigo"]).optional(),
});

const verifySchema = z.object({
  reference: z.string(),
});

router.post("/initiate", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const data = initiateSchema.parse(req.body);
    const paystackSecret = await getPaystackSecret();

    const reference = "BW-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    let authorizationUrl = `https://checkout.paystack.com/simulated/${reference}`;
    let status = "pending";

    if (paystackSecret) {
      try {
        const paystackBody: any = {
          email: data.email,
          amount: Math.round(data.amount * 100),
          reference,
          currency: "GHS",
          channels: data.paymentMethod === "mobile_money" ? ["mobile_money"] : ["card"],
        };

        if (data.paymentMethod === "mobile_money" && data.phone) {
          paystackBody.mobile_money = {
            phone: data.phone,
            provider: data.mobileMoneyProvider || "mtn",
          };
        }

        const response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paystackBody),
        });

        const result = (await response.json()) as any;
        if (result.status) {
          authorizationUrl = result.data.authorization_url;
        }
      } catch (e) {
        console.error("Paystack API error:", e);
      }
    }

    await db.insert(paymentsTable).values({
      electionId: data.electionId,
      voterId: user.id,
      email: data.email,
      phone: data.phone,
      amount: data.amount,
      currency: "GHS",
      reference,
      authorizationUrl,
      status: "pending",
      paymentMethod: data.paymentMethod,
      mobileMoneyProvider: data.mobileMoneyProvider,
    });

    res.json({ reference, authorizationUrl, status: "pending" });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to initiate payment" });
    }
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { reference } = verifySchema.parse(req.body);
    const paystackSecret = await getPaystackSecret();

    const [payment] = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.reference, reference)).limit(1);

    if (!payment) {
      res.status(404).json({ error: "Not Found", message: "Payment not found" });
      return;
    }

    let status = payment.status;
    let paidAt = payment.paidAt;

    if (paystackSecret && status === "pending") {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${paystackSecret}` },
        });
        const result = (await response.json()) as any;
        if (result.status && result.data.status === "success") {
          status = "success";
          paidAt = new Date();
          await db.update(paymentsTable)
            .set({ status: "success", paidAt: new Date(), updatedAt: new Date() })
            .where(eq(paymentsTable.reference, reference));
        }
      } catch (e) {
        console.error("Paystack verify error:", e);
      }
    } else if (!paystackSecret && status === "pending") {
      status = "success";
      paidAt = new Date();
      await db.update(paymentsTable)
        .set({ status: "success", paidAt: new Date(), updatedAt: new Date() })
        .where(eq(paymentsTable.reference, reference));
    }

    res.json({
      success: status === "success",
      reference,
      status,
      amount: payment.amount,
      paidAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to verify payment" });
  }
});

router.post("/webhook", async (req, res) => {
  const event = req.body;
  if (event.event === "charge.success") {
    const reference = event.data?.reference;
    if (reference) {
      await db.update(paymentsTable)
        .set({ status: "success", paidAt: new Date(), updatedAt: new Date() })
        .where(eq(paymentsTable.reference, reference));
    }
  }
  res.json({ success: true });
});

export default router;
