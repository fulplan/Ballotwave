import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { electionsTable } from "./elections";

export const disputeStatusEnum = pgEnum("dispute_status", ["open", "investigating", "resolved", "dismissed"]);

export const disputesTable = pgTable("disputes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  electionId: text("election_id").notNull().references(() => electionsTable.id),
  reportedById: text("reported_by_id").notNull().references(() => usersTable.id),
  resolvedById: text("resolved_by_id").references(() => usersTable.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDisputeSchema = createInsertSchema(disputesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedById: true,
  resolution: true,
  resolvedAt: true,
});

export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputesTable.$inferSelect;
