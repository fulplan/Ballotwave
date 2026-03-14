import { Router, type Request, type Response } from "express";
import {
  db,
  ussdSessionsTable,
  ussdLockoutsTable,
  ussdSessionLogsTable,
  usersTable,
  electionsTable,
  candidatesTable,
  votesTable,
  voterReceiptsTable,
} from "@workspace/db";
import { eq, and, sql, lt } from "drizzle-orm";
import { t, type UssdLang } from "../lib/ussd-strings";
import { requireAuth } from "../lib/auth";
import { pool } from "@workspace/db";

const router = Router();

const USSD_SECRET = process.env.USSD_ARKESEL_SECRET;
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000;
const SESSION_TIMEOUT_MS = 90 * 1000;

type UssdStep =
  | "LANG_SELECT"
  | "MAIN_MENU"
  | "PHONE_AUTH"
  | "PIN_AUTH"
  | "ELECTION_LIST"
  | "POSITION_LIST"
  | "CANDIDATE_SELECT"
  | "CONFIRM"
  | "VOTED";

interface SessionState {
  lang: UssdLang;
  userId?: string;
  schoolId?: string;
  phone?: string;
  electionId?: string;
  electionTitle?: string;
  positions?: string[];
  candidateId?: string;
  candidateName?: string;
  selectedPosition?: string;
  elections?: { id: string; title: string }[];
  candidates?: { id: string; name: string; position: string }[];
}

interface UssdSessionRow {
  id: string;
  sessionId: string;
  schoolId: string | null;
  phone: string;
  step: string;
  stateJson: Record<string, unknown> | null;
  pinAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UssdResponsePayload {
  sessionOperation: "continue" | "end";
  message: string;
}

function ussdResponse(message: string, continueSession: boolean): UssdResponsePayload {
  return {
    sessionOperation: continueSession ? "continue" : "end",
    message,
  };
}

function isSessionExpired(session: UssdSessionRow): boolean {
  const lastActivity = session.updatedAt || session.createdAt;
  return Date.now() - lastActivity.getTime() > SESSION_TIMEOUT_MS;
}

function extractLatestInput(rawText: string, currentStep: UssdStep): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "";

  if (trimmed === "#" || trimmed === "00") return trimmed;

  if (currentStep === "PHONE_AUTH") {
    const parts = trimmed.split("*");
    return parts[parts.length - 1];
  }

  const parts = trimmed.split("*");
  return parts[parts.length - 1];
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const secret = req.headers["x-arkesel-secret"] || req.headers["x-ussd-secret"];

    if (!USSD_SECRET || secret !== USSD_SECRET) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const sessionId = req.body.sessionId as string;
    const phoneNumber = (req.body.phoneNumber || "") as string;
    const rawText = (req.body.text || "") as string;
    const requestType = req.body.type as string;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    if (requestType === "release") {
      const [releasedSession] = await db.select().from(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId)).limit(1);
      if (releasedSession) {
        await logSessionEnd(releasedSession as UssdSessionRow, "released");
        await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
      }
      res.json(ussdResponse("", false));
      return;
    }

    let session = await getOrCreateSession(sessionId, phoneNumber);

    if (isSessionExpired(session)) {
      await logSessionEnd(session, "expired");
      await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
      const state = parseState(session);
      res.json(ussdResponse(t(state.lang, "session_expired"), false));
      return;
    }

    const state = parseState(session);
    const lang = state.lang;
    const input = extractLatestInput(rawText, session.step as UssdStep);

    if (input === "#") {
      await logSessionEnd(session, "cancelled");
      await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
      res.json(ussdResponse(t(lang, "goodbye"), false));
      return;
    }

    if (input === "00") {
      await updateSession(sessionId, "MAIN_MENU", state);
      res.json(ussdResponse(t(lang, "main_menu"), true));
      return;
    }

    const result = await processStep(sessionId, session.step as UssdStep, input, state, session, false);
    res.json(result);
  } catch (err) {
    console.error("USSD error:", err);
    res.json(ussdResponse("An error occurred. Please try again.", false));
  }
});

router.post("/simulate", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Record<string, unknown>).user as { role: string };
    if (!["super_admin", "school_admin", "electoral_officer"].includes(user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }

    const sessionId = req.body.sessionId as string;
    const userInput = (req.body.input || "") as string;
    const phoneNumber = (req.body.phoneNumber || "") as string;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const [existingSession] = await db
      .select()
      .from(ussdSessionsTable)
      .where(eq(ussdSessionsTable.sessionId, sessionId))
      .limit(1);

    if (!existingSession) {
      await db
        .insert(ussdSessionsTable)
        .values({
          sessionId,
          phone: phoneNumber,
          step: "LANG_SELECT",
          stateJson: { lang: "en" },
        })
        .returning();

      res.json({
        ...ussdResponse(t("en", "welcome"), true),
        step: "LANG_SELECT",
      });
      return;
    }

    const state = parseState(existingSession);
    const lang = state.lang;
    const trimmedInput = userInput.trim();

    if (trimmedInput === "#") {
      await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
      res.json({ ...ussdResponse(t(lang, "goodbye"), false), step: "END" });
      return;
    }

    if (trimmedInput === "00") {
      await updateSession(sessionId, "MAIN_MENU", state);
      res.json({ ...ussdResponse(t(lang, "main_menu"), true), step: "MAIN_MENU" });
      return;
    }

    const result = await processStep(sessionId, existingSession.step as UssdStep, trimmedInput, state, existingSession, true);
    const [updatedSession] = await db
      .select()
      .from(ussdSessionsTable)
      .where(eq(ussdSessionsTable.sessionId, sessionId))
      .limit(1);

    res.json({
      ...result,
      step: updatedSession?.step || "END",
    });
  } catch (err) {
    console.error("USSD simulate error:", err);
    res.json({ ...ussdResponse("An error occurred. Please try again.", false), step: "ERROR" });
  }
});

async function getOrCreateSession(sessionId: string, phone: string): Promise<UssdSessionRow> {
  const [existing] = await db
    .select()
    .from(ussdSessionsTable)
    .where(eq(ussdSessionsTable.sessionId, sessionId))
    .limit(1);

  if (existing) return existing as UssdSessionRow;

  const [created] = await db
    .insert(ussdSessionsTable)
    .values({
      sessionId,
      phone: phone || "",
      step: "LANG_SELECT",
      stateJson: { lang: "en" },
    })
    .returning();

  return created as UssdSessionRow;
}

function parseState(session: UssdSessionRow): SessionState {
  const raw = session.stateJson as Record<string, unknown> | null;
  return {
    lang: ((raw?.lang as string) || "en") as UssdLang,
    userId: raw?.userId as string | undefined,
    schoolId: raw?.schoolId as string | undefined,
    phone: raw?.phone as string | undefined,
    electionId: raw?.electionId as string | undefined,
    electionTitle: raw?.electionTitle as string | undefined,
    positions: raw?.positions as string[] | undefined,
    candidateId: raw?.candidateId as string | undefined,
    candidateName: raw?.candidateName as string | undefined,
    selectedPosition: raw?.selectedPosition as string | undefined,
    elections: raw?.elections as { id: string; title: string }[] | undefined,
    candidates: raw?.candidates as { id: string; name: string; position: string }[] | undefined,
  };
}

async function processStep(
  sessionId: string,
  step: UssdStep,
  input: string,
  state: SessionState,
  session: UssdSessionRow,
  isSimulator: boolean
): Promise<UssdResponsePayload> {
  const lang = state.lang;

  switch (step) {
    case "LANG_SELECT": {
      const langMap: Record<string, UssdLang> = { "1": "en", "2": "tw", "3": "ha" };
      const selectedLang = langMap[input];
      if (!selectedLang) {
        return ussdResponse(t(lang, "welcome"), true);
      }
      state.lang = selectedLang;
      await updateSession(sessionId, "PHONE_AUTH", state);
      return ussdResponse(t(selectedLang, "enter_phone"), true);
    }

    case "MAIN_MENU": {
      if (input === "1") {
        return await showElectionList(sessionId, state);
      }
      if (input === "0") {
        await updateSession(sessionId, "LANG_SELECT", state);
        return ussdResponse(t(lang, "welcome"), true);
      }
      return ussdResponse(t(lang, "main_menu"), true);
    }

    case "PHONE_AUTH": {
      if (input === "0") {
        await updateSession(sessionId, "LANG_SELECT", state);
        return ussdResponse(t(lang, "welcome"), true);
      }

      const phone = input.replace(/\s+/g, "");
      if (!phone || phone.length < 9) {
        return ussdResponse(t(lang, "enter_phone"), true);
      }

      const normalizedPhone = normalizePhone(phone);
      let foundUser = await findUserByPhone(normalizedPhone);

      if (!foundUser && phone.startsWith("0")) {
        const altPhone = "+233" + phone.slice(1);
        foundUser = await findUserByPhone(altPhone);
      }

      if (!foundUser) {
        return ussdResponse(t(lang, "phone_not_found"), false);
      }

      const lockout = await checkPhoneLockout(foundUser.phone || normalizedPhone);
      if (lockout) {
        return ussdResponse(t(lang, "account_locked"), false);
      }

      state.userId = foundUser.id;
      state.schoolId = foundUser.schoolId || undefined;
      state.phone = foundUser.phone || normalizedPhone;
      await updateSession(sessionId, "PIN_AUTH", state, foundUser.schoolId || undefined);
      return ussdResponse(t(lang, "enter_pin"), true);
    }

    case "PIN_AUTH": {
      if (input === "0") {
        await updateSession(sessionId, "PHONE_AUTH", state);
        return ussdResponse(t(lang, "enter_phone"), true);
      }

      const phoneForLockout = state.phone || session.phone;
      const phoneLockout = await checkPhoneLockout(phoneForLockout);
      if (phoneLockout) {
        return ussdResponse(t(lang, "account_locked"), false);
      }

      if (!state.userId) {
        await updateSession(sessionId, "PHONE_AUTH", state);
        return ussdResponse(t(lang, "enter_phone"), true);
      }

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, state.userId))
        .limit(1);

      if (!user) {
        return ussdResponse(t(lang, "phone_not_found"), false);
      }

      if (input.length !== 4 || !/^\d{4}$/.test(input)) {
        return ussdResponse(t(lang, "enter_pin"), true);
      }

      const bcrypt = await import("bcryptjs");
      const pinHash = user.ussdPin || user.passwordHash;
      const pinValid = await bcrypt.compare(input, pinHash);

      if (!pinValid) {
        const attempts = await incrementPinAttempts(phoneForLockout);
        if (attempts >= MAX_PIN_ATTEMPTS) {
          await lockPhone(phoneForLockout);
          return ussdResponse(t(lang, "account_locked"), false);
        }
        const remaining = String(MAX_PIN_ATTEMPTS - attempts);
        return ussdResponse(t(lang, "invalid_pin", { remaining }), true);
      }

      await resetPinAttempts(phoneForLockout);
      return await showElectionList(sessionId, state);
    }

    case "ELECTION_LIST": {
      if (input === "0") {
        await updateSession(sessionId, "MAIN_MENU", state);
        return ussdResponse(t(lang, "main_menu"), true);
      }

      const idx = parseInt(input, 10);
      if (!state.elections || isNaN(idx) || idx < 1 || idx > state.elections.length) {
        return ussdResponse(t(lang, "invalid_input"), true);
      }

      const election = state.elections[idx - 1];
      state.electionId = election.id;
      state.electionTitle = election.title;

      return await showPositionList(sessionId, state);
    }

    case "POSITION_LIST": {
      if (input === "0") {
        return await showElectionList(sessionId, state);
      }

      const idx = parseInt(input, 10);
      if (!state.positions || isNaN(idx) || idx < 1 || idx > state.positions.length) {
        return ussdResponse(t(lang, "invalid_input"), true);
      }

      const position = state.positions[idx - 1];
      state.selectedPosition = position;

      return await showCandidateList(sessionId, state);
    }

    case "CANDIDATE_SELECT": {
      if (input === "0") {
        return await showPositionList(sessionId, state);
      }

      const idx = parseInt(input, 10);
      if (!state.candidates || isNaN(idx) || idx < 1 || idx > state.candidates.length) {
        return ussdResponse(t(lang, "invalid_input"), true);
      }

      const candidate = state.candidates[idx - 1];
      state.candidateId = candidate.id;
      state.candidateName = candidate.name;

      await updateSession(sessionId, "CONFIRM", state);
      return ussdResponse(
        t(lang, "confirm_vote", {
          candidate: candidate.name,
          position: state.selectedPosition || "",
        }),
        true
      );
    }

    case "CONFIRM": {
      if (input === "0") {
        return await showCandidateList(sessionId, state);
      }

      if (input !== "1") {
        return ussdResponse(
          t(lang, "confirm_vote", {
            candidate: state.candidateName || "",
            position: state.selectedPosition || "",
          }),
          true
        );
      }

      return await castUssdVote(sessionId, state, isSimulator);
    }

    case "VOTED": {
      await logSessionEnd(session, "voted");
      await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
      return ussdResponse(t(lang, "goodbye"), false);
    }

    default:
      return ussdResponse(t(lang, "welcome"), true);
  }
}

async function showElectionList(
  sessionId: string,
  state: SessionState
): Promise<UssdResponsePayload> {
  const lang = state.lang;
  const conditions = [eq(electionsTable.status, "active" as "draft" | "active" | "closed" | "cancelled")];
  if (state.schoolId) {
    conditions.push(eq(electionsTable.schoolId, state.schoolId));
  }

  const elections = await db
    .select({ id: electionsTable.id, title: electionsTable.title })
    .from(electionsTable)
    .where(and(...conditions));

  if (elections.length === 0) {
    await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
    return ussdResponse(t(lang, "no_active_elections"), false);
  }

  state.elections = elections;
  await updateSession(sessionId, "ELECTION_LIST", state);

  const list = elections.map((e, i) => `${i + 1}. ${e.title}`).join("\n");
  return ussdResponse(t(lang, "select_election", { list }), true);
}

async function showPositionList(
  sessionId: string,
  state: SessionState
): Promise<UssdResponsePayload> {
  const lang = state.lang;
  if (!state.electionId) {
    return await showElectionList(sessionId, state);
  }

  const candidates = await db
    .select({ position: candidatesTable.position })
    .from(candidatesTable)
    .where(and(eq(candidatesTable.electionId, state.electionId), eq(candidatesTable.isApproved, true)));

  const positions = [...new Set(candidates.map((c) => c.position))];
  if (positions.length === 0) {
    await updateSession(sessionId, "ELECTION_LIST", state);
    return ussdResponse(t(lang, "invalid_input"), true);
  }

  state.positions = positions;
  await updateSession(sessionId, "POSITION_LIST", state);

  const list = positions.map((p, i) => `${i + 1}. ${p}`).join("\n");
  return ussdResponse(
    t(lang, "select_position", { list, election: state.electionTitle || "" }),
    true
  );
}

async function showCandidateList(
  sessionId: string,
  state: SessionState
): Promise<UssdResponsePayload> {
  const lang = state.lang;
  if (!state.electionId || !state.selectedPosition) {
    return await showPositionList(sessionId, state);
  }

  const candidates = await db
    .select({ id: candidatesTable.id, name: candidatesTable.name, position: candidatesTable.position })
    .from(candidatesTable)
    .where(
      and(
        eq(candidatesTable.electionId, state.electionId),
        eq(candidatesTable.position, state.selectedPosition),
        eq(candidatesTable.isApproved, true)
      )
    );

  state.candidates = candidates;
  await updateSession(sessionId, "CANDIDATE_SELECT", state);

  const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
  return ussdResponse(
    t(lang, "select_candidate", { list, position: state.selectedPosition }),
    true
  );
}

async function castUssdVote(
  sessionId: string,
  state: SessionState,
  isSimulator: boolean
): Promise<UssdResponsePayload> {
  const lang = state.lang;

  if (!state.userId || !state.electionId || !state.candidateId || !state.selectedPosition) {
    return ussdResponse(t(lang, "vote_failed", { reason: "Missing vote data" }), false);
  }

  if (isSimulator) {
    const simulatedReceipt = "SIM-" + Date.now().toString(36).toUpperCase();
    await updateSession(sessionId, "VOTED", state);
    return ussdResponse(t(lang, "vote_success", { receipt: simulatedReceipt + " (SIMULATED)" }), false);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const electionResult = await client.query(
      "SELECT id, status FROM elections WHERE id = $1 LIMIT 1",
      [state.electionId]
    );
    const election = electionResult.rows[0];

    if (!election || election.status !== "active") {
      await client.query("ROLLBACK");
      return ussdResponse(t(lang, "election_not_active"), false);
    }

    const receiptResult = await client.query(
      "SELECT id FROM voter_receipts WHERE election_id = $1 AND voter_id = $2 LIMIT 1",
      [state.electionId, state.userId]
    );

    if (receiptResult.rows.length > 0) {
      await client.query("ROLLBACK");
      await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));
      return ussdResponse(t(lang, "already_voted"), false);
    }

    const receiptCode =
      "BW-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const receiptId = crypto.randomUUID();
    await client.query(
      "INSERT INTO voter_receipts (id, election_id, voter_id, receipt_code, created_at) VALUES ($1, $2, $3, $4, NOW())",
      [receiptId, state.electionId, state.userId, receiptCode]
    );

    const voteId = crypto.randomUUID();
    await client.query(
      "INSERT INTO votes (id, election_id, voter_id, candidate_id, position, receipt_code, voting_method, channel, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())",
      [voteId, state.electionId, state.userId, state.candidateId, state.selectedPosition, receiptCode, "ussd", "ussd"]
    );

    await client.query(
      "UPDATE candidates SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = $1",
      [state.candidateId]
    );

    await client.query(
      "UPDATE elections SET total_votes = total_votes + 1, updated_at = NOW() WHERE id = $1",
      [state.electionId]
    );

    await client.query("COMMIT");

    const [sessionForLog] = await db.select().from(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId)).limit(1);
    if (sessionForLog) {
      await logSessionEnd(sessionForLog as UssdSessionRow, "voted");
    }
    await db.delete(ussdSessionsTable).where(eq(ussdSessionsTable.sessionId, sessionId));

    sendUssdSmsConfirmation(state.phone || "", receiptCode, state.electionTitle || "Election", lang);

    return ussdResponse(t(lang, "vote_success", { receipt: receiptCode }), false);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("USSD vote transaction error:", err);
    return ussdResponse(t(lang, "vote_failed", { reason: "Transaction failed" }), false);
  } finally {
    client.release();
  }
}

function sendUssdSmsConfirmation(phone: string, receiptCode: string, electionTitle: string, lang: UssdLang) {
  if (!phone) return;

  const arkeselApiKey = process.env.ARKESEL_API_KEY;
  if (!arkeselApiKey) {
    console.log(`[USSD SMS] Would send confirmation to ${phone}: Receipt ${receiptCode} for "${electionTitle}"`);
    return;
  }

  const message = lang === "en"
    ? `BallotWave: Your vote in "${electionTitle}" was recorded. Receipt: ${receiptCode}. Thank you!`
    : `BallotWave: Wo aba wɔ "${electionTitle}" mu akɔ. Receipt: ${receiptCode}. Yɛda wo ase!`;

  fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": arkeselApiKey,
    },
    body: JSON.stringify({
      sender: "BallotWave",
      message,
      recipients: [phone],
    }),
  }).catch((err: unknown) => {
    console.error("[USSD SMS] Failed to send confirmation:", err);
  });
}

async function logSessionEnd(session: UssdSessionRow, outcome: string) {
  try {
    await db.insert(ussdSessionLogsTable).values({
      sessionId: session.sessionId,
      schoolId: session.schoolId || undefined,
      phone: session.phone,
      outcome,
      costGhs: 0.05,
      startedAt: session.createdAt,
      endedAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to log USSD session:", err);
  }
}

async function updateSession(
  sessionId: string,
  step: UssdStep,
  state: SessionState,
  schoolId?: string
) {
  const updateData: Record<string, unknown> = {
    step,
    stateJson: state as Record<string, unknown>,
    updatedAt: new Date(),
  };
  if (schoolId) {
    updateData.schoolId = schoolId;
  }
  await db
    .update(ussdSessionsTable)
    .set(updateData)
    .where(eq(ussdSessionsTable.sessionId, sessionId));
}

function normalizePhone(phone: string): string {
  if (phone.startsWith("+")) return phone;
  if (phone.startsWith("233")) return "+" + phone;
  if (phone.startsWith("0")) return "+233" + phone.slice(1);
  return phone;
}

async function findUserByPhone(phone: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1);
  return user || null;
}

async function checkPhoneLockout(phone: string): Promise<boolean> {
  if (!phone) return false;
  const [lockout] = await db
    .select()
    .from(ussdLockoutsTable)
    .where(eq(ussdLockoutsTable.phone, phone))
    .limit(1);

  if (!lockout) return false;
  return lockout.lockedUntil !== null && new Date(lockout.lockedUntil) > new Date();
}

async function incrementPinAttempts(phone: string): Promise<number> {
  const [existing] = await db
    .select()
    .from(ussdLockoutsTable)
    .where(eq(ussdLockoutsTable.phone, phone))
    .limit(1);

  if (!existing) {
    await db.insert(ussdLockoutsTable).values({ phone, pinAttempts: 1 });
    return 1;
  }

  const newAttempts = (existing.pinAttempts || 0) + 1;
  await db
    .update(ussdLockoutsTable)
    .set({ pinAttempts: newAttempts, updatedAt: new Date() })
    .where(eq(ussdLockoutsTable.phone, phone));
  return newAttempts;
}

async function lockPhone(phone: string) {
  const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  await db
    .update(ussdLockoutsTable)
    .set({ lockedUntil, updatedAt: new Date() })
    .where(eq(ussdLockoutsTable.phone, phone));
}

async function resetPinAttempts(phone: string) {
  const [existing] = await db
    .select()
    .from(ussdLockoutsTable)
    .where(eq(ussdLockoutsTable.phone, phone))
    .limit(1);

  if (existing) {
    await db
      .update(ussdLockoutsTable)
      .set({ pinAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(ussdLockoutsTable.phone, phone));
  }
}

export default router;
