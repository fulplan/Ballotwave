import { pgTable, text, timestamp, real } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";

export const ussdSessionLogsTable = pgTable("ussd_session_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull(),
  schoolId: text("school_id").references(() => schoolsTable.id),
  phone: text("phone").notNull(),
  outcome: text("outcome").notNull().default("completed"),
  costGhs: real("cost_ghs").notNull().default(0.05),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at").notNull().defaultNow(),
});

export type UssdSessionLog = typeof ussdSessionLogsTable.$inferSelect;
