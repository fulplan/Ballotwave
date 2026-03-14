import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { electionsTable } from "./elections";
import { usersTable } from "./users";

export const applicationStatusEnum = pgEnum("application_status", ["pending", "approved", "rejected", "revision_requested"]);

export const candidateApplicationsTable = pgTable("candidate_applications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  electionId: text("election_id").notNull().references(() => electionsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  position: text("position").notNull(),
  manifesto: text("manifesto"),
  manifestoPdfUrl: text("manifesto_pdf_url"),
  videoUrl: text("video_url"),
  photoUrl: text("photo_url"),
  studentId: text("student_id"),
  department: text("department"),
  status: applicationStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedById: text("reviewed_by_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCandidateApplicationSchema = createInsertSchema(candidateApplicationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  reviewNote: true,
  reviewedById: true,
  reviewedAt: true,
});

export type InsertCandidateApplication = z.infer<typeof insertCandidateApplicationSchema>;
export type CandidateApplication = typeof candidateApplicationsTable.$inferSelect;
