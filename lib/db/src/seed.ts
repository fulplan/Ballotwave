import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

async function seed() {
  console.log("🌱 Seeding database...");

  // Create super admin
  const [superAdmin] = await db.insert(schema.usersTable).values({
    name: "BallotWave Admin",
    email: "admin@ballotwave.com",
    passwordHash: hashPassword("password123"),
    role: "super_admin",
    isVerified: true,
  }).onConflictDoNothing().returning();
  console.log("✅ Super admin created:", superAdmin?.email || "already exists");

  // Create a school
  const [school] = await db.insert(schema.schoolsTable).values({
    name: "Accra Senior High School",
    slug: "accrashs",
    email: "admin@accrashs.edu.gh",
    phone: "+233244000001",
    country: "Ghana",
    plan: "pro",
    isActive: true,
  }).onConflictDoNothing().returning();

  const schoolId = school?.id;
  if (!schoolId) {
    const [existing] = await db.select().from(schema.schoolsTable).limit(1);
    if (!existing) {
      console.error("No school found!");
      return;
    }
    console.log("✅ School already exists");
    await runWithSchool(existing.id);
    return;
  }
  console.log("✅ School created:", school.name);
  await runWithSchool(schoolId);
}

async function runWithSchool(schoolId: string) {
  // Departments
  const depts = await Promise.all([
    db.insert(schema.departmentsTable).values({ schoolId, name: "Science", description: "Physics, Chemistry, Biology" }).onConflictDoNothing().returning(),
    db.insert(schema.departmentsTable).values({ schoolId, name: "Arts", description: "Literature, History, Geography" }).onConflictDoNothing().returning(),
    db.insert(schema.departmentsTable).values({ schoolId, name: "Business", description: "Accounting, Economics, Commerce" }).onConflictDoNothing().returning(),
  ]);
  const sciDeptId = depts[0]?.[0]?.id;
  console.log("✅ Departments created");

  // School admin
  const [schoolAdmin] = await db.insert(schema.usersTable).values({
    name: "School Admin",
    email: "admin@accrashs.edu.gh",
    passwordHash: hashPassword("password123"),
    role: "school_admin",
    schoolId,
    isVerified: true,
  }).onConflictDoNothing().returning();
  console.log("✅ School admin created:", schoolAdmin?.email || "already exists");

  // Electoral officer
  await db.insert(schema.usersTable).values({
    name: "Electoral Officer",
    email: "officer@accrashs.edu.gh",
    passwordHash: hashPassword("password123"),
    role: "electoral_officer",
    schoolId,
    isVerified: true,
  }).onConflictDoNothing().returning();

  // Observer
  await db.insert(schema.usersTable).values({
    name: "Observer Account",
    email: "observer@accrashs.edu.gh",
    passwordHash: hashPassword("password123"),
    role: "observer",
    schoolId,
    isVerified: true,
  }).onConflictDoNothing().returning();

  // Voter
  const [voter] = await db.insert(schema.usersTable).values({
    name: "Kwame Mensah",
    email: "kwame@student.accrashs.edu.gh",
    passwordHash: hashPassword("password123"),
    role: "voter",
    schoolId,
    departmentId: sciDeptId,
    studentId: "STU-2024-001",
    yearLevel: "Year 3",
    isVerified: true,
  }).onConflictDoNothing().returning();
  console.log("✅ Voter created:", voter?.email || "already exists");

  // More voters
  const voterNames = [
    ["Ama Owusu", "ama@student.accrashs.edu.gh", "STU-2024-002"],
    ["Kofi Asante", "kofi@student.accrashs.edu.gh", "STU-2024-003"],
    ["Abena Boateng", "abena@student.accrashs.edu.gh", "STU-2024-004"],
    ["Yaw Darko", "yaw@student.accrashs.edu.gh", "STU-2024-005"],
  ];
  for (const [name, email, studentId] of voterNames) {
    await db.insert(schema.usersTable).values({
      name, email,
      passwordHash: hashPassword("password123"),
      role: "voter",
      schoolId,
      studentId,
      isVerified: true,
    }).onConflictDoNothing();
  }
  console.log("✅ Additional voters created");

  // Elections
  const now = new Date();
  const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [srcElection] = await db.insert(schema.electionsTable).values({
    title: "2024 SRC General Election",
    description: "Annual election for the Student Representative Council of Accra SHS",
    schoolId,
    status: "active",
    votingType: "both",
    startDate: oneHourAgo,
    endDate: inThreeDays,
    registeredVoters: 500,
    totalVotes: 127,
    totalCandidates: 6,
    slug: "2024-src-general-election",
  }).onConflictDoNothing().returning();

  const [closedElection] = await db.insert(schema.electionsTable).values({
    title: "2023 Prefect Election",
    description: "Election for house prefects",
    schoolId,
    status: "closed",
    votingType: "web",
    startDate: past,
    endDate: new Date(past.getTime() + 3 * 24 * 60 * 60 * 1000),
    registeredVoters: 300,
    totalVotes: 256,
    totalCandidates: 4,
    resultsPublished: true,
    slug: "2023-prefect-election",
  }).onConflictDoNothing().returning();

  console.log("✅ Elections created");

  if (srcElection?.id) {
    // Candidates for active election
    const candidateData = [
      { name: "Akosua Frimpong", position: "President", department: "Science", manifesto: "A safer, more inclusive SRC for all students", voteCount: 67 },
      { name: "Emmanuel Asare", position: "President", department: "Arts", manifesto: "Building bridges between students and administration", voteCount: 60 },
      { name: "Adwoa Boateng", position: "Vice President", department: "Business", manifesto: "Supporting every student's academic journey", voteCount: 127 },
      { name: "Kweku Mensah", position: "Secretary", department: "Science", manifesto: "Transparency and accountability in all SRC activities", voteCount: 127 },
      { name: "Abena Sarpong", position: "Financial Secretary", department: "Business", manifesto: "Prudent management of student funds", voteCount: 89 },
      { name: "Yaw Acheampong", position: "Financial Secretary", department: "Arts", manifesto: "Inclusive budgeting for all student activities", voteCount: 38 },
    ];
    for (const c of candidateData) {
      await db.insert(schema.candidatesTable).values({
        electionId: srcElection.id,
        ...c,
        isApproved: true,
      }).onConflictDoNothing();
    }
    console.log("✅ Candidates created for active election");
  }

  if (closedElection?.id) {
    const prefectCandidates = [
      { name: "Kofi Osei", position: "Head Prefect", voteCount: 142 },
      { name: "Ama Nyarko", position: "Head Prefect", voteCount: 114 },
      { name: "Kwame Tetteh", position: "Assistant Head Prefect", voteCount: 256 },
    ];
    for (const c of prefectCandidates) {
      await db.insert(schema.candidatesTable).values({
        electionId: closedElection.id,
        ...c,
        department: "Science",
        isApproved: true,
      }).onConflictDoNothing();
    }
    console.log("✅ Candidates created for closed election");
  }

  // Platform settings
  await db.insert(schema.platformSettingsTable).values({
    key: "platform_name",
    value: "BallotWave",
  }).onConflictDoNothing();
  await db.insert(schema.platformSettingsTable).values({
    key: "contact_email",
    value: "support@ballotwave.com",
  }).onConflictDoNothing();

  console.log("✅ Platform settings created");
  console.log("\n🎉 Seed complete!");
  console.log("Demo accounts:");
  console.log("  Super Admin:    admin@ballotwave.com / password123");
  console.log("  School Admin:   admin@accrashs.edu.gh / password123");
  console.log("  Elec. Officer:  officer@accrashs.edu.gh / password123");
  console.log("  Observer:       observer@accrashs.edu.gh / password123");
  console.log("  Voter:          kwame@student.accrashs.edu.gh / password123");
}

seed().catch(console.error).finally(() => pool.end());
