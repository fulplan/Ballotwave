import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, key))
    .limit(1);
  return row?.value || "";
}

export async function getPaystackSecret(): Promise<string> {
  const dbValue = await getSetting("paystack_secret_key");
  return dbValue || process.env.PAYSTACK_SECRET_KEY || "";
}

export async function getArkeselApiKey(): Promise<string> {
  const dbValue = await getSetting("arkesel_api_key");
  return dbValue || process.env.ARKESEL_API_KEY || "";
}

export async function getJwtSecret(): Promise<string> {
  const dbValue = await getSetting("jwt_secret");
  return dbValue || process.env.JWT_SECRET || "ballotwave-super-secret-2024";
}
