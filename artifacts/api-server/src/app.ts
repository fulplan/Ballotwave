import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { db, electionsTable, usersTable, voterReceiptsTable, notificationLogTable, invoicesTable, schoolsTable, paymentsTable, ussdSessionLogsTable, platformSettingsTable } from "@workspace/db";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { logAudit } from "./lib/audit";
import { notifyUser } from "./lib/notify";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

async function runElectionScheduler() {
  try {
    const now = new Date();

    const toActivate = await db.select({ id: electionsTable.id, title: electionsTable.title, schoolId: electionsTable.schoolId })
      .from(electionsTable)
      .where(and(eq(electionsTable.status, "draft"), lte(electionsTable.startDate, now)));

    for (const election of toActivate) {
      await db.update(electionsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(electionsTable.id, election.id));
      await logAudit({
        action: "election.auto_started",
        entityType: "election",
        entityId: election.id,
        entityLabel: election.title,
        schoolId: election.schoolId,
        details: { reason: "scheduled start date reached" },
      });
      console.log(`[scheduler] Auto-activated election: ${election.title}`);
    }

    const toClose = await db.select({ id: electionsTable.id, title: electionsTable.title, schoolId: electionsTable.schoolId })
      .from(electionsTable)
      .where(and(eq(electionsTable.status, "active"), lte(electionsTable.endDate, now)));

    for (const election of toClose) {
      await db.update(electionsTable)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(electionsTable.id, election.id));
      await logAudit({
        action: "election.auto_closed",
        entityType: "election",
        entityId: election.id,
        entityLabel: election.title,
        schoolId: election.schoolId,
        details: { reason: "scheduled end date reached" },
      });
      console.log(`[scheduler] Auto-closed election: ${election.title}`);
    }
  } catch (err) {
    console.error("[scheduler] Error running election scheduler:", err);
  }
}

setInterval(runElectionScheduler, 60_000);
runElectionScheduler();

async function runDeadlineReminderWorker() {
  try {
    const now = new Date();
    const inFiftyMin = new Date(now.getTime() + 50 * 60_000);
    const inSeventyMin = new Date(now.getTime() + 70 * 60_000);

    const closingSoon = await db.select({
      id: electionsTable.id,
      title: electionsTable.title,
      schoolId: electionsTable.schoolId,
      endDate: electionsTable.endDate,
    }).from(electionsTable)
      .where(and(
        eq(electionsTable.status, "active"),
        gte(electionsTable.endDate, inFiftyMin),
        lte(electionsTable.endDate, inSeventyMin)
      ));

    for (const election of closingSoon) {
      const eligibleVoters = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.schoolId, election.schoolId), eq(usersTable.role, "voter"), eq(usersTable.notifyElectionReminders, true)));

      const votedUserIds = (await db.select({ voterId: voterReceiptsTable.voterId })
        .from(voterReceiptsTable)
        .where(eq(voterReceiptsTable.electionId, election.id))).map(v => v.voterId);

      const unvotedVoters = eligibleVoters.filter(v => !votedUserIds.includes(v.id));

      const alreadyReminded = (await db.select({ recipientId: notificationLogTable.recipientId })
        .from(notificationLogTable)
        .where(and(
          eq(notificationLogTable.electionId, election.id),
          eq(notificationLogTable.event, "deadline_reminder")
        ))).map(r => r.recipientId);

      const toRemind = unvotedVoters.filter(v => !alreadyReminded.includes(v.id));

      for (const voter of toRemind) {
        await notifyUser(voter.id, "Voting Deadline Approaching", `"${election.title}" closes soon! Cast your vote before it's too late.`, {
          channels: ["sms", "in_app"],
          event: "deadline_reminder",
          schoolId: election.schoolId,
          electionId: election.id,
          link: `/vote/${election.id}`,
        });
      }

      if (toRemind.length > 0) {
        console.log(`[reminder] Sent deadline reminders to ${toRemind.length} voters for "${election.title}"`);
      }
    }
  } catch (err) {
    console.error("[reminder] Error running deadline reminder:", err);
  }
}

setInterval(runDeadlineReminderWorker, 5 * 60_000);
setTimeout(runDeadlineReminderWorker, 30_000);

async function runScheduledInvoiceGenerator() {
  try {
    const now = new Date();
    const settingsRows = await db.select().from(platformSettingsTable);
    const settingsMap = new Map(settingsRows.map((r: any) => [r.key, r.value]));
    const invoiceDay = parseInt(settingsMap.get("invoice_generation_day") || "1");

    if (now.getDate() !== invoiceDay) return;

    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const schools = await db.select().from(schoolsTable).where(eq(schoolsTable.isActive, true));
    const elections = await db.select().from(electionsTable);
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "success"));

    let generated = 0;

    for (const school of schools) {
      const existing = await db.select().from(invoicesTable)
        .where(and(
          eq(invoicesTable.schoolId, school.id),
          gte(invoicesTable.periodStart, periodStart),
          lte(invoicesTable.periodEnd, periodEnd),
        )).limit(1);
      if (existing.length > 0) continue;

      const schoolElectionIds = elections.filter(e => e.schoolId === school.id).map(e => e.id);
      const schoolPayments = payments.filter(p =>
        schoolElectionIds.includes(p.electionId) &&
        p.paidAt && new Date(p.paidAt) >= periodStart && new Date(p.paidAt) < periodEnd
      );
      const subscriptionRevenue = schoolPayments.reduce((s, p) => s + (p.amount || 0), 0);

      let ussdSessions = 0;
      try {
        const r = await db.select({ count: sql<number>`COUNT(*)::int` })
          .from(ussdSessionLogsTable)
          .where(and(eq(ussdSessionLogsTable.schoolId, school.id), gte(ussdSessionLogsTable.endedAt, periodStart), lte(ussdSessionLogsTable.endedAt, periodEnd)));
        ussdSessions = r[0]?.count ?? 0;
      } catch (_err) {
        console.error(`[invoice-scheduler] USSD count error for ${school.name}:`, _err);
      }
      const ussdCost = ussdSessions * 0.05;

      let smsSent = 0;
      try {
        const r = await db.select({ count: sql<number>`COUNT(*)::int` })
          .from(notificationLogTable)
          .where(and(
            eq(notificationLogTable.schoolId, school.id),
            eq(notificationLogTable.channel, "sms"),
            eq(notificationLogTable.status, "sent"),
            gte(notificationLogTable.sentAt, periodStart),
            lte(notificationLogTable.sentAt, periodEnd)
          ));
        smsSent = r[0]?.count ?? 0;
      } catch (_err) {
        console.error(`[invoice-scheduler] SMS count error for ${school.name}:`, _err);
      }
      const smsCost = smsSent * 0.03;

      const lineItems = [
        { description: `${school.plan} Plan Subscription`, amount: subscriptionRevenue },
        { description: `USSD Sessions (${ussdSessions} × GHS 0.05)`, amount: Math.round(ussdCost * 100) / 100 },
        { description: `SMS Notifications (${smsSent} × GHS 0.03)`, amount: Math.round(smsCost * 100) / 100 },
      ];
      const totalGhs = Math.round((subscriptionRevenue + ussdCost + smsCost) * 100) / 100;

      if (totalGhs > 0) {
        await db.insert(invoicesTable).values({
          schoolId: school.id,
          periodStart,
          periodEnd,
          lineItems,
          totalGhs,
          status: "draft",
        });
        generated++;
      }
    }

    if (generated > 0) {
      console.log(`[invoice-scheduler] Auto-generated ${generated} invoice(s) for ${periodStart.toISOString().slice(0, 7)}`);
    }
  } catch (err) {
    console.error("[invoice-scheduler] Error:", err);
  }
}

setInterval(runScheduledInvoiceGenerator, 60 * 60_000);
setTimeout(runScheduledInvoiceGenerator, 60_000);

export default app;
