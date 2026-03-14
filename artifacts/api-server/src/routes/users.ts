import { Router } from "express";
import { db, usersTable, voterReceiptsTable, electionsTable, ussdLockoutsTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { hashPassword } from "../lib/auth";
import { logAudit, auditFromReq } from "../lib/audit";
import { z } from "zod";

const router = Router();

const updateUserSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["super_admin", "school_admin", "electoral_officer", "candidate", "voter", "observer"]).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().optional(),
  yearLevel: z.string().optional(),
  studentId: z.string().optional(),
});

const bulkImportSchema = z.object({
  schoolId: z.string(),
  users: z.array(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    studentId: z.string().optional(),
    departmentId: z.string().optional(),
    yearLevel: z.string().optional(),
    phone: z.string().optional(),
  })),
});

function safeUser(user: any) {
  const { passwordHash, otpCode, otpExpiresAt, ...safe } = user;
  return safe;
}

router.get("/", requireAuth, async (req, res) => {
  const { schoolId, role } = req.query;
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    role: usersTable.role,
    schoolId: usersTable.schoolId,
    departmentId: usersTable.departmentId,
    studentId: usersTable.studentId,
    yearLevel: usersTable.yearLevel,
    isVerified: usersTable.isVerified,
    isActive: usersTable.isActive,
    isPhoneVerified: usersTable.isPhoneVerified,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);

  let result = users;
  if (schoolId) result = result.filter((u) => u.schoolId === schoolId);
  if (role) result = result.filter((u) => u.role === role);

  const lockouts = await db.select().from(ussdLockoutsTable);
  const lockoutMap = new Map(lockouts.map((l) => [l.phone, l]));

  const enriched = result.map((u) => {
    const lockout = u.phone ? lockoutMap.get(u.phone) : null;
    return {
      ...u,
      ussdLocked: lockout?.lockedUntil ? new Date(lockout.lockedUntil) > new Date() : false,
      ussdLockedUntil: lockout?.lockedUntil || null,
      ussdPinAttempts: lockout?.pinAttempts || 0,
    };
  });

  res.json(enriched);
});

router.get("/:userId", requireAuth, async (req, res) => {
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    role: usersTable.role,
    schoolId: usersTable.schoolId,
    departmentId: usersTable.departmentId,
    studentId: usersTable.studentId,
    yearLevel: usersTable.yearLevel,
    isVerified: usersTable.isVerified,
    isActive: usersTable.isActive,
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
    res.json(safeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: "Failed to update user" });
  }
});

router.delete("/:userId", requireAuth, async (req, res) => {
  await db.update(usersTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.userId));
  res.json({ success: true, message: "User deactivated" });
});

// Bulk import students from CSV data
router.post("/bulk-import", requireAuth, async (req, res) => {
  try {
    const { schoolId, users } = bulkImportSchema.parse(req.body);
    const defaultPassword = hashPassword("changeme123");
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const userData of users) {
      try {
        const existing = await db.select({ id: usersTable.id })
          .from(usersTable).where(eq(usersTable.email, userData.email)).limit(1);
        if (existing.length > 0) {
          results.skipped++;
          continue;
        }
        await db.insert(usersTable).values({
          name: userData.name,
          email: userData.email,
          passwordHash: defaultPassword,
          phone: userData.phone,
          role: "voter",
          schoolId,
          studentId: userData.studentId,
          departmentId: userData.departmentId,
          yearLevel: userData.yearLevel,
          isVerified: true,
          isPhoneVerified: false,
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`${userData.email}: ${e.message}`);
      }
    }

    res.json({ success: true, ...results, message: `Imported ${results.created} users, skipped ${results.skipped}` });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", message: err.errors[0]?.message });
    } else {
      res.status(500).json({ error: "Internal Error", message: "Failed to import users" });
    }
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
        headers: { "api-key": arkeselKey, "Content-Type": "application/json" },
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
    console.log(`OTP for ${phone}: ${otp}`);
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

router.get("/:userId/vote-history", requireAuth, async (req, res) => {
  const requestingUser = (req as any).user;
  const { userId } = req.params;

  if (requestingUser.id !== userId && requestingUser.role !== "super_admin" && requestingUser.role !== "school_admin") {
    res.status(403).json({ error: "Forbidden", message: "Not authorized" });
    return;
  }

  const receipts = await db.select().from(voterReceiptsTable)
    .where(eq(voterReceiptsTable.voterId, userId));

  const history = await Promise.all(
    receipts.map(async (receipt: any) => {
      const [election] = await db.select({ title: electionsTable.title })
        .from(electionsTable)
        .where(eq(electionsTable.id, receipt.electionId))
        .limit(1);
      return {
        electionId: receipt.electionId,
        electionTitle: election?.title || "Unknown Election",
        receiptCode: receipt.receiptCode,
        votedAt: receipt.createdAt,
      };
    })
  );

  res.json({ history });
});

router.patch("/:userId/notification-preferences", requireAuth, async (req, res) => {
  const requestingUser = (req as any).user;
  const { userId } = req.params;

  if (requestingUser.id !== userId && requestingUser.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Not authorized" });
    return;
  }

  const schema = z.object({
    notifyElectionReminders: z.boolean().optional(),
    notifyResultAnnouncements: z.boolean().optional(),
    notifyPlatformAnnouncements: z.boolean().optional(),
  });

  try {
    const data = schema.parse(req.body);
    const [updated] = await db.update(usersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not Found", message: "User not found" });
      return;
    }
    res.json({
      notifyElectionReminders: updated.notifyElectionReminders,
      notifyResultAnnouncements: updated.notifyResultAnnouncements,
      notifyPlatformAnnouncements: updated.notifyPlatformAnnouncements,
    });
  } catch (err: any) {
    res.status(400).json({ error: "Bad Request", message: err.message || "Invalid data" });
  }
});

router.get("/:userId/notification-preferences", requireAuth, async (req, res) => {
  const requestingUser = (req as any).user;
  const { userId } = req.params;

  if (requestingUser.id !== userId && requestingUser.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden", message: "Not authorized" });
    return;
  }

  const [user] = await db.select({
    notifyElectionReminders: usersTable.notifyElectionReminders,
    notifyResultAnnouncements: usersTable.notifyResultAnnouncements,
    notifyPlatformAnnouncements: usersTable.notifyPlatformAnnouncements,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user) {
    res.status(404).json({ error: "Not Found", message: "User not found" });
    return;
  }
  res.json(user);
});

router.post("/:userId/ussd-pin", requireAuth, async (req, res) => {
  const requestingUser = (req as Record<string, unknown>).user as { id: string; role: string };
  const { userId } = req.params;
  const { pin } = req.body as { pin: string };

  if (requestingUser.id !== userId && requestingUser.role !== "super_admin" && requestingUser.role !== "school_admin") {
    res.status(403).json({ error: "Forbidden", message: "Not authorized" });
    return;
  }

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "Bad Request", message: "PIN must be exactly 4 digits" });
    return;
  }

  const hashedPin = hashPassword(pin);
  await db.update(usersTable)
    .set({ ussdPin: hashedPin, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ success: true, message: "USSD PIN set successfully" });
});

export default router;
