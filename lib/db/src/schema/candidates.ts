import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { electionsTable } from "./elections";
import { usersTable } from "./users";

export const candidatesTable = pgTable("candidates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  electionId: text("election_id").notNull().references(() => electionsTable.id),
  userId: text("user_id").references(() => usersTable.id),
  name: text("name").notNull(),
  position: text("position").notNull(),
  manifesto: text("manifesto"),
  photoUrl: text("photo_url"),
  studentId: text("student_id"),
  department: text("department"),
  voteCount: integer("vote_count").notNull().default(0),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  voteCount: true,
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
