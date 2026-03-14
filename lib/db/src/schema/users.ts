import { pgTable, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";

export const roleEnum = pgEnum("role", ["super_admin", "school_admin", "electoral_officer", "candidate", "voter", "observer"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  role: roleEnum("role").notNull().default("voter"),
  schoolId: text("school_id").references(() => schoolsTable.id),
  departmentId: text("department_id"),
  studentId: text("student_id"),
  yearLevel: text("year_level"),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
  otpCode: text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at"),
  ussdPin: text("ussd_pin"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  notifyElectionReminders: boolean("notify_election_reminders").notNull().default(true),
  notifyResultAnnouncements: boolean("notify_result_announcements").notNull().default(true),
  notifyPlatformAnnouncements: boolean("notify_platform_announcements").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  otpCode: true,
  otpExpiresAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
