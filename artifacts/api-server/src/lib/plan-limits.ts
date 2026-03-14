import { db, electionsTable, candidatesTable, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PLAN_LIMITS = {
  free:       { elections: 2,  candidatesPerElection: 10 },
  basic:      { elections: 10, candidatesPerElection: 30 },
  pro:        { elections: 50, candidatesPerElection: 100 },
  enterprise: { elections: Infinity, candidatesPerElection: Infinity },
};

export async function checkElectionLimit(schoolId: string): Promise<{ allowed: boolean; message?: string }> {
  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, schoolId)).limit(1);
  if (!school) return { allowed: false, message: "School not found" };

  const plan = school.plan as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  if (limits.elections === Infinity) return { allowed: true };

  const elections = await db.select({ id: electionsTable.id })
    .from(electionsTable)
    .where(eq(electionsTable.schoolId, schoolId));

  if (elections.length >= limits.elections) {
    return {
      allowed: false,
      message: `Your ${plan} plan allows a maximum of ${limits.elections} elections. Please upgrade to add more.`,
    };
  }
  return { allowed: true };
}

export async function checkCandidateLimit(electionId: string): Promise<{ allowed: boolean; message?: string }> {
  const [election] = await db.select().from(electionsTable)
    .where(eq(electionsTable.id, electionId)).limit(1);
  if (!election) return { allowed: false, message: "Election not found" };

  const [school] = await db.select().from(schoolsTable)
    .where(eq(schoolsTable.id, election.schoolId)).limit(1);
  if (!school) return { allowed: true };

  const plan = school.plan as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  if (limits.candidatesPerElection === Infinity) return { allowed: true };

  const candidates = await db.select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(eq(candidatesTable.electionId, electionId));

  if (candidates.length >= limits.candidatesPerElection) {
    return {
      allowed: false,
      message: `Your ${plan} plan allows a maximum of ${limits.candidatesPerElection} candidates per election. Please upgrade to add more.`,
    };
  }
  return { allowed: true };
}

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
}
