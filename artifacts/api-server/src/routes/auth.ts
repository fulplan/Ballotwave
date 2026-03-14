import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Too many attempts. Please try again in 15 minutes." },
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  schoolId: z.string().optional(),
  studentId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

function safeUser(user: any) {
  const { passwordHash, otpCode, otpExpiresAt, resetToken, resetTokenExpiry, ...safe } = user;
  return safe;
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, data.email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "Email already registered" });
      return;
    }

    const [user] = await db.insert(usersTable).values({
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
      phone: data.phone,
      role: "voter",
      schoolId: data.schoolId,
      studentId: data.studentId,
      isVerified: true,
      isPhoneVerified: false,
    }).returning();

    const token = await signToken(user.id, user.role);
    res.status(201).json({ user: safeUser(user), token });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Registration failed" });
    }
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: "Forbidden", message: "Your account has been deactivated. Contact your school administrator." });
      return;
    }

    const token = await signToken(user.id, user.role);
    res.json({ user: safeUser(user), token });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: "Invalid email or password format" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Login failed" });
    }
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    schoolId: user.schoolId,
    departmentId: user.departmentId,
    studentId: user.studentId,
    yearLevel: user.yearLevel,
    isVerified: user.isVerified,
    isActive: user.isActive,
    isPhoneVerified: user.isPhoneVerified,
    createdAt: user.createdAt,
  });
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user) {
      res.json({ success: true, message: "If that email exists, a reset link has been sent." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await db.update(usersTable)
      .set({ resetToken: token, resetTokenExpiry: expiry, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    console.log(`[password-reset] Token for ${email}: ${token}`);

    res.json({
      success: true,
      message: "Password reset instructions have been sent.",
      ...(process.env.NODE_ENV !== "production" ? { _devToken: token } : {}),
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: "Invalid email address" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to process request" });
    }
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.resetToken, token)).limit(1);

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      res.status(400).json({ error: "Bad Request", message: "Invalid or expired reset token." });
      return;
    }

    await db.update(usersTable)
      .set({
        passwordHash: hashPassword(password),
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Password has been reset successfully." });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to reset password" });
    }
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (!dbUser || !verifyPassword(currentPassword, dbUser.passwordHash)) {
      res.status(400).json({ error: "Bad Request", message: "Current password is incorrect." });
      return;
    }

    await db.update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message || "Invalid data" });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to change password" });
    }
  }
});

export default router;
