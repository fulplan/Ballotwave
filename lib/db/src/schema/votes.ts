import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { electionsTable } from "./elections";
import { candidatesTable } from "./candidates";

export const votesTable = pgTable("votes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  electionId: text("election_id").notNull().references(() => electionsTable.id),
  voterId: text("voter_id").notNull(),
  candidateId: text("candidate_id").notNull().references(() => candidatesTable.id),
  position: text("position").notNull(),
  receiptCode: text("receipt_code").notNull(),
  paymentReference: text("payment_reference"),
  votingMethod: text("voting_method").notNull().default("web"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voterReceiptsTable = pgTable("voter_receipts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  electionId: text("election_id").notNull().references(() => electionsTable.id),
  voterId: text("voter_id").notNull(),
  receiptCode: text("receipt_code").notNull().unique(),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
