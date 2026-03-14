import { pgTable, text, boolean, integer, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planEnum = pgEnum("plan", ["free", "basic", "pro", "enterprise"]);

export const schoolsTable = pgTable("schools", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  country: text("country").notNull().default("Ghana"),
  logoUrl: text("logo_url"),
  plan: planEnum("plan").notNull().default("free"),
  isActive: boolean("is_active").notNull().default(true),
  totalElections: integer("total_elections").notNull().default(0),
  totalVoters: integer("total_voters").notNull().default(0),
  ussdShortCode: text("ussd_short_code"),
  ussdSchoolCode: text("ussd_school_code"),
  ussdLanguage: text("ussd_language").default("en"),
  ussdEnabled: boolean("ussd_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalElections: true,
  totalVoters: true,
});

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schoolsTable.$inferSelect;
