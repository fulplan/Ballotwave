import { db, notificationsTable, usersTable, notificationLogTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendSms } from "./sms";
import { sendEmail } from "./email";

interface NotifyOpts {
  schoolId?: string;
  electionId?: string;
  event: string;
}

export async function notifyUser(
  userId: string,
  title: string,
  message: string,
  opts: NotifyOpts & { channels: ("sms" | "email" | "in_app")[]; emailSubject?: string; emailHtml?: string; link?: string }
) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return;

  const promises: Promise<any>[] = [];

  if (opts.channels.includes("in_app")) {
    promises.push(
      db.insert(notificationsTable).values({
        userId,
        title,
        message,
        type: opts.event,
        link: opts.link,
      }).then(() => {
        return db.insert(notificationLogTable).values({
          schoolId: opts.schoolId,
          electionId: opts.electionId,
          recipientId: userId,
          channel: "in_app",
          event: opts.event,
          message,
          status: "sent",
        });
      })
    );
  }

  if (opts.channels.includes("sms") && user.phone) {
    promises.push(
      sendSms(user.phone, message, {
        schoolId: opts.schoolId,
        electionId: opts.electionId,
        recipientId: userId,
        event: opts.event,
      })
    );
  }

  if (opts.channels.includes("email") && user.email) {
    promises.push(
      sendEmail(user.email, opts.emailSubject || title, opts.emailHtml || `<p>${message}</p>`, {
        schoolId: opts.schoolId,
        electionId: opts.electionId,
        recipientId: userId,
        event: opts.event,
      })
    );
  }

  await Promise.allSettled(promises);
}

export async function notifyUsers(
  userIds: string[],
  title: string,
  message: string,
  opts: NotifyOpts & { channels: ("sms" | "email" | "in_app")[]; emailSubject?: string; emailHtml?: string; link?: string }
) {
  if (userIds.length === 0) return;

  const batchSize = 50;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const promises = batch.map(uid => notifyUser(uid, title, message, opts));
    await Promise.allSettled(promises);
  }
}

export async function getEligibleVoterIds(schoolId: string): Promise<string[]> {
  const voters = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.schoolId, schoolId), eq(usersTable.role, "voter")));
  return voters.map(v => v.id);
}

export async function getSchoolAdminIds(schoolId: string): Promise<string[]> {
  const admins = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.schoolId, schoolId), eq(usersTable.role, "school_admin")));
  return admins.map(a => a.id);
}

export async function getOfficerIds(schoolId: string): Promise<string[]> {
  const officers = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.schoolId, schoolId),
        inArray(usersTable.role, ["school_admin", "electoral_officer"])
      )
    );
  return officers.map(o => o.id);
}
