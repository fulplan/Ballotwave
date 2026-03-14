import { pgTable, text, real, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue"]);

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schoolId: text("school_id").notNull().references(() => schoolsTable.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  lineItems: jsonb("line_items").notNull().default([]),
  totalGhs: real("total_ghs").notNull().default(0),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  pdfUrl: text("pdf_url"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Invoice = typeof invoicesTable.$inferSelect;
