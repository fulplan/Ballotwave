import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";

export const ussdSessionsTable = pgTable("ussd_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull().unique(),
  schoolId: text("school_id").references(() => schoolsTable.id),
  phone: text("phone").notNull(),
  step: text("step").notNull().default("LANG_SELECT"),
  stateJson: jsonb("state_json").$type<Record<string, any>>().default({}),
  pinAttempts: integer("pin_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UssdSession = typeof ussdSessionsTable.$inferSelect;
