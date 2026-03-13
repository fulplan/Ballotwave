import { pgTable, text, boolean, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";
import { usersTable } from "./users";

export const electionStatusEnum = pgEnum("election_status", ["draft", "active", "closed", "cancelled"]);
export const votingTypeEnum = pgEnum("voting_type", ["web", "ussd", "both"]);

export const electionsTable = pgTable("elections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  schoolId: text("school_id").notNull().references(() => schoolsTable.id),
  createdById: text("created_by_id").references(() => usersTable.id),
  status: electionStatusEnum("status").notNull().default("draft"),
  votingType: votingTypeEnum("voting_type").notNull().default("web"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  requiresPayment: boolean("requires_payment").notNull().default(false),
  votingFee: real("voting_fee").default(0),
  currency: text("currency").default("GHS"),
  totalVotes: integer("total_votes").notNull().default(0),
  totalCandidates: integer("total_candidates").notNull().default(0),
  allowMultiplePositions: boolean("allow_multiple_positions").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertElectionSchema = createInsertSchema(electionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalVotes: true,
  totalCandidates: true,
});

export type InsertElection = z.infer<typeof insertElectionSchema>;
export type Election = typeof electionsTable.$inferSelect;
