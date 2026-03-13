import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

const updateUserSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["super_admin", "school_admin", "candidate", "voter"]).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const { schoolId, role } = req.query;
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    role: usersTable.role,
    schoolId: usersTable.schoolId,
    studentId: usersTable.studentId,
    isVerified: usersTable.isVerified,
    isPhoneVerified: usersTable.isPhoneVerified,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);

  let result = users;
  if (schoolId) result = result.filter((u: any) => u.schoolId === schoolId);
  if (role) result = result.filter((u: any) => u.role === role);

  res.json(result);
});

router.get("/:userId", requireAuth, async (req, res) => {
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    role: usersTable.role,
    schoolId: usersTable.schoolId,
    studentId: usersTable.studentId,
    isVerified: usersTable.isVerified,
    isPhoneVerified: usersTable.isPhoneVerified,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, req.params.userId)).limit(1);

  if (!user) {
    res.status(404).json({ error: "Not Found", message: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/:userId", requireAuth, async (req, res) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const [user] = await db.update(usersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.userId))
      .returning();
    if (!user) {
      res.status(404).json({ error: "Not Found", message: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      schoolId: user.schoolId,
      studentId: user.studentId,
      isVerified: user.isVerified,
      isPhoneVerified: user.isPhoneVerified,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update user" });
  }
});

router.post("/send-otp", requireAuth, async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const user = (req as any).user;
  await db.update(usersTable)
    .set({ otpCode: otp, otpExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  const { getArkeselApiKey } = await import("../lib/settings");
  const arkeselKey = await getArkeselApiKey();

  if (arkeselKey) {
    try {
      await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": arkeselKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: "BallotWave",
          message: `Your BallotWave verification code is: ${otp}`,
          recipients: [phone],
        }),
      });
    } catch (e) {
      console.error("Arkesel SMS error:", e);
    }
  } else {
    console.log(`OTP for ${phone}: ${otp} (no Arkesel key configured)`);
  }

  res.json({ success: true, message: "OTP sent to your phone" });
});

router.post("/:userId/verify-otp", requireAuth, async (req, res) => {
  const { otp } = req.body;
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.id, req.params.userId)).limit(1);

  if (!user) {
    res.status(404).json({ error: "Not Found", message: "User not found" });
    return;
  }

  if (user.otpCode !== otp) {
    res.status(400).json({ error: "Bad Request", message: "Invalid OTP" });
    return;
  }

  if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
    res.status(400).json({ error: "Bad Request", message: "OTP has expired" });
    return;
  }

  await db.update(usersTable)
    .set({ isPhoneVerified: true, otpCode: null, otpExpiresAt: null, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.userId));

  res.json({ success: true, message: "Phone verified successfully" });
});

export default router;
