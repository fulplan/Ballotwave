import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { schoolsTable } from "./schools";

export const notificationChannelEnum = pgEnum("notification_channel", ["sms", "email", "in_app"]);
export const notificationStatusEnum = pgEnum("notification_status", ["sent", "failed", "skipped"]);

export const notificationLogTable = pgTable("notification_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schoolId: text("school_id").references(() => schoolsTable.id),
  electionId: text("election_id"),
  recipientId: text("recipient_id").references(() => usersTable.id),
  recipientPhone: text("recipient_phone"),
  recipientEmail: text("recipient_email"),
  channel: notificationChannelEnum("channel").notNull(),
  event: text("event").notNull(),
  message: text("message").notNull(),
  subject: text("subject"),
  status: notificationStatusEnum("status").notNull().default("sent"),
  error: text("error"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export type NotificationLog = typeof notificationLogTable.$inferSelect;
