import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.enum(["super_admin", "school_admin", "candidate", "voter"]).default("voter"),
  schoolId: z.string().optional(),
  studentId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function safeUser(user: any) {
  const { passwordHash, otpCode, otpExpiresAt, ...safe } = user;
  return safe;
}

router.post("/register", async (req, res) => {
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
      role: data.role,
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

router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
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
    studentId: user.studentId,
    isVerified: user.isVerified,
    isPhoneVerified: user.isPhoneVerified,
    createdAt: user.createdAt,
  });
});

export default router;
