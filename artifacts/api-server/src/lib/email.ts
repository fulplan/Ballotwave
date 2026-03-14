import { db, notificationLogTable } from "@workspace/db";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { schoolId?: string; electionId?: string; recipientId?: string; event?: string }
): Promise<boolean> {
  const mailgunKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "noreply@ballotwave.com";

  if (mailgunKey && mailgunDomain) {
    return sendViaMailgun(to, subject, html, mailgunKey, mailgunDomain, fromEmail, opts);
  }

  if (sendgridKey) {
    return sendViaSendgrid(to, subject, html, sendgridKey, fromEmail, opts);
  }

  console.warn("[email] No email provider configured (MAILGUN_API_KEY or SENDGRID_API_KEY), skipping");
  await db.insert(notificationLogTable).values({
    schoolId: opts?.schoolId,
    electionId: opts?.electionId,
    recipientId: opts?.recipientId,
    recipientEmail: to,
    channel: "email",
    event: opts?.event || "unknown",
    message: html,
    subject,
    status: "skipped",
    error: "No email provider configured",
  });
  return false;
}

async function sendViaMailgun(
  to: string, subject: string, html: string,
  apiKey: string, domain: string, from: string,
  opts?: { schoolId?: string; electionId?: string; recipientId?: string; event?: string }
): Promise<boolean> {
  try {
    const form = new URLSearchParams();
    form.append("from", `BallotWave <${from}>`);
    form.append("to", to);
    form.append("subject", subject);
    form.append("html", html);

    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      body: form,
    });

    const ok = res.ok;
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientEmail: to,
      channel: "email",
      event: opts?.event || "unknown",
      message: html,
      subject,
      status: ok ? "sent" : "failed",
      error: ok ? undefined : `Mailgun HTTP ${res.status}`,
    });
    return ok;
  } catch (err: any) {
    console.error("[email] Mailgun send failed:", err);
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientEmail: to,
      channel: "email",
      event: opts?.event || "unknown",
      message: html,
      subject,
      status: "failed",
      error: err?.message || "Unknown error",
    });
    return false;
  }
}

async function sendViaSendgrid(
  to: string, subject: string, html: string,
  apiKey: string, from: string,
  opts?: { schoolId?: string; electionId?: string; recipientId?: string; event?: string }
): Promise<boolean> {
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: "BallotWave" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    const ok = res.ok || res.status === 202;
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientEmail: to,
      channel: "email",
      event: opts?.event || "unknown",
      message: html,
      subject,
      status: ok ? "sent" : "failed",
      error: ok ? undefined : `SendGrid HTTP ${res.status}`,
    });
    return ok;
  } catch (err: any) {
    console.error("[email] SendGrid send failed:", err);
    await db.insert(notificationLogTable).values({
      schoolId: opts?.schoolId,
      electionId: opts?.electionId,
      recipientId: opts?.recipientId,
      recipientEmail: to,
      channel: "email",
      event: opts?.event || "unknown",
      message: html,
      subject,
      status: "failed",
      error: err?.message || "Unknown error",
    });
    return false;
  }
}
