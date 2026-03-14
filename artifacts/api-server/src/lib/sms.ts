import { db, notificationLogTable } from "@workspace/db";

export async function sendSms(
  phone: string,
  message: string,
  opts?: { schoolId?: string; electionId?: string; recipientId?: string; event?: string }
): Promise<boolean> {
  const arkeselKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || "BallotWave";

  if (!arkeselKey) {
    console.warn("[sms] ARKESEL_API_KEY not configured, skipping SMS");
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientPhone: phone,
      channel: "sms",
      event: opts?.event || "unknown",
      message,
      status: "skipped",
      error: "ARKESEL_API_KEY not configured",
    });
    return false;
  }

  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": arkeselKey },
      body: JSON.stringify({ sender: senderId, recipients: [phone], message }),
    });

    const ok = res.ok;
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientPhone: phone,
      channel: "sms",
      event: opts?.event || "unknown",
      message,
      status: ok ? "sent" : "failed",
      error: ok ? undefined : `HTTP ${res.status}`,
    });
    return ok;
  } catch (err: any) {
    console.error("[sms] Send failed:", err);
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientPhone: phone,
      channel: "sms",
      event: opts?.event || "unknown",
      message,
      status: "failed",
      error: err?.message || "Unknown error",
    });
    return false;
  }
}
