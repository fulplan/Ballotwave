import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { electionsTable } from "./elections";

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed", "abandoned"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "mobile_money", "bank_transfer"]);

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  electionId: text("election_id").notNull().references(() => electionsTable.id),
  voterId: text("voter_id").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("GHS"),
  reference: text("reference").notNull().unique(),
  authorizationUrl: text("authorization_url"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("mobile_money"),
  mobileMoneyProvider: text("mobile_money_provider"),
  paidAt: timestamp("paid_at"),
  gatewayResponse: text("gateway_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
