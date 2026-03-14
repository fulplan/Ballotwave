import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const ussdLockoutsTable = pgTable("ussd_lockouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  phone: text("phone").notNull().unique(),
  pinAttempts: integer("pin_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UssdLockout = typeof ussdLockoutsTable.$inferSelect;
