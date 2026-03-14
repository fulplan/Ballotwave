# BallotWave

## Overview

BallotWave is a **production-ready multi-tenant SaaS digital voting platform** for African schools (SHS, Colleges, Universities). It supports web voting, USSD voting, mobile money payments, role-based dashboards, fraud detection, and full school management.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Recharts + Framer Motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **Auth**: JWT (bcryptjs)
- **Payment**: Paystack (Mobile Money / Card)
- **SMS/USSD**: Arkesel (integration-ready)
- **API codegen**: Orval (from OpenAPI spec)
- **Toasts**: Sonner

## Structure

```text
artifacts/
  api-server/          # Express API server (port 8080)
  ballotwave/          # React + Vite frontend (port 26139, preview: /)
  mockup-sandbox/      # Design sandbox
lib/
  api-spec/            # OpenAPI 3.1 spec + Orval config
  api-client-react/    # Generated React Query hooks
  api-zod/             # Generated Zod schemas
  db/                  # Drizzle ORM schema + DB connection + seed script
```

## Demo Accounts

- **Super Admin**: admin@ballotwave.com / password123
- **School Admin**: admin@accrashs.edu.gh / password123
- **Electoral Officer**: officer@accrashs.edu.gh / password123
- **Observer**: observer@accrashs.edu.gh / password123
- **Voter**: kwame@student.accrashs.edu.gh / password123

## DB Schema

Tables:
- `users` — all roles including new `electoral_officer` and `observer`, with `departmentId`, `yearLevel`, `isActive`, `resetToken`, `resetTokenExpiry`
- `schools` — multi-tenant institutions with `subscriptionPlan` (free/basic/pro/enterprise), USSD config (ussdShortCode, ussdSchoolCode, ussdLanguage, ussdEnabled)
- `departments` — faculty/department groupings per school
- `elections` — full lifecycle, with `slug`, `registeredVoters`, `resultsPublished`, `nominationsOpen`
- `candidates` — per election, with `isApproved`, `voteCount`, `photoUrl` (base64)
- `candidate_applications` — self-nomination applications with status workflow (pending/approved/rejected/revision_requested), review notes, reviewer tracking
- `votes` — vote records with `receiptCode`, `channel` (web/ussd)
- `voter_receipts` — anonymous vote verification receipts
- `payments` — Paystack payment tracking
- `platform_settings` — key-value config
- `notifications` — per-user notification feed
- `disputes` — voting issue reports with status workflow
- `audit_logs` — platform-wide audit trail (action, actor, target, metadata)
- `ussd_sessions` — USSD session state machine (sessionId, phone, step, stateJson, createdAt, updatedAt)
- `ussd_lockouts` — durable PIN brute-force lockout tracking per phone (phone, pinAttempts, lockedUntil)
- `ussd_session_logs` — persistent USSD session history for analytics (sessionId, schoolId, phone, outcome, costGhs, startedAt, endedAt)
- `notification_log` — notification delivery tracking (channel: sms/email/in_app, status: sent/failed/skipped)
- `invoices` — monthly school invoices (schoolId, periodStart, periodEnd, lineItems JSON, totalGhs, status: draft/sent/paid/overdue)
- `promo_codes` — promotional discount codes (code, discountType: percent/flat, discountValue, planTarget, maxUses, usesCount, expiresAt)

## Roles

| Role | Capabilities |
|------|-------------|
| `super_admin` | Platform-wide: schools, analytics, settings, revenue, invoices, promo codes, payout settings |
| `school_admin` | School: elections, users, departments, disputes, analytics |
| `electoral_officer` | Elections management, disputes, analytics |
| `observer` | Read-only: elections, disputes |
| `candidate` | Election participant |
| `voter` | Vote, verify receipt, submit disputes |

## Features

- Multi-tenant school management with subscription plans (free/basic/pro/enterprise)
- Plan enforcement: per-tier election and candidate limits
- Election lifecycle: draft → active → closed, with publish results
- Candidate management with per-position approval/rejection and photo upload
- Candidate self-nomination: voters can nominate themselves for positions when nominations are open
- Nomination review workflow: admins approve/reject/request-revision on nomination applications
- Approved nominations automatically promoted to official candidates with notifications
- Manifesto viewer in voting portal and election detail page
- "My Nominations" tracker in voter profile page
- Web voting with fraud prevention (one vote per election)
- Vote receipts with unique BW-XXXXX-XXXX codes
- Anonymous vote verification at `/verify-vote` (public)
- Results export to CSV
- Live results with animated vote bars and winner highlighting
- Public results page at `/results/:slug` (no auth required when published)
- Copy-to-clipboard share link for published results
- Voter turnout percentage and registered voter tracking
- Departments management (CRUD)
- User management with bulk CSV import and deactivation (blocked from login when deactivated)
- Notification center (per user, real-time polling)
- Dispute log with status workflow (open → investigating → resolved/dismissed)
- Analytics dashboard (real DB queries for turnout, votesByDay, votesByHour)
- Paystack payment integration for paid elections (real popup + polling)
- Arkesel SMS integration for OTP and USSD
- Platform-level settings management
- Forgot/reset/change password flow
- Audit log (platform-wide, filterable by action/actor, paginated)
- Voter profile page with voting history
- Rate limiting on auth endpoints
- Error boundary wrapping entire app
- USSD voting system via Arkesel: full state machine (language select → phone auth → PIN auth → election list → position → candidate → confirm → vote)
- USSD vote casting with transactional integrity (PostgreSQL transactions)
- USSD PIN brute-force protection: 5 attempts = 1hr lockout per phone number
- USSD config page for school admins (short code, school code, language)
- USSD testing simulator on election detail page (admin-only)
- USSD analytics in overview endpoint (sessions, votes by channel, gateway cost at GHS 0.05/vote)
- Trilingual USSD menus: English, Twi, Hausa
- **Dark mode**: `next-themes` ThemeProvider, `.dark` class on HTML element, toggle in sidebar footer and Profile page
- **PWA**: `manifest.json` with BallotWave branding + SVG icons, `<meta>` tags in `index.html` for installability
- **Mobile responsive**: BottomNav component for voter role on mobile (< md breakpoint); sidebar uses SidebarTrigger
- **Skeleton loading states**: `SkeletonCard`, `SkeletonTable`, `SkeletonStat` replacing full-page spinners on Elections, Users, Departments, Analytics pages
- **EmptyState component**: Reusable icon + title + description + action button across Elections, Departments, voter dashboard
- **Offline vote queue**: Votes stored to localStorage when offline; auto-submitted on `window.online` event; offline banner shown
- **Landing page**: Added nav links (How It Works, Channels, Pricing), stats bar (120+ schools, 84K+ votes, 99.9% uptime), How It Works section (3-step), Channels section (Web vs USSD cards), full Pricing section (4 plan cards: Starter GHS 150 / Growth GHS 450 / University GHS 1,200 / Enterprise custom)
- **Election scheduling**: DB columns `eligibleDepartments` (JSON) + `eligibleYearLevels` (JSON) added to elections table; `app.ts` runs a 60-second `setInterval` that auto-activates Draft elections when `startDate <= now` and auto-closes Active elections when `endDate <= now`, each logged to audit trail
- **Voter eligibility filtering**: Elections form has department multi-select checkboxes (from school departments) + Year Level 1–6 checkboxes; backend enforces eligibility in GET /elections (voter-only filter) and POST /vote (403 if ineligible); "Scheduled" amber badge on draft elections with future startDate
- **Voter dashboard upcoming elections**: Voter home shows "Upcoming Elections" section for draft elections with future startDate; each card shows a live per-second countdown timer

## API Routes

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/change-password

GET    /api/schools
POST   /api/schools
GET    /api/schools/:id
PATCH  /api/schools/:id

GET    /api/elections
POST   /api/elections
GET    /api/elections/:id
PATCH  /api/elections/:id
POST   /api/elections/:id/start
POST   /api/elections/:id/close
POST   /api/elections/:id/publish-results
GET    /api/elections/:id/results
GET    /api/elections/:id/results/export       (CSV download)
GET    /api/elections/:id/verify/:receiptCode  (public)
GET    /api/elections/:id/check-voted
POST   /api/elections/:id/vote

GET    /api/elections/:id/candidates
POST   /api/elections/:id/candidates
PATCH  /api/elections/:id/candidates/:candidateId
DELETE /api/elections/:id/candidates/:candidateId
POST   /api/elections/:id/candidates/:candidateId/photo  (multer, base64 storage)

GET    /api/elections/public/:slug/results  (no auth, only if published)

GET    /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id                (soft deactivate)
POST   /api/users/bulk-import        (CSV upload)
POST   /api/users/send-otp
POST   /api/users/:id/verify-otp
GET    /api/users/:id/vote-history   (own user or admin)
POST   /api/users/:id/ussd-pin      (set 4-digit USSD PIN)

GET    /api/audit                    (school_admin+, filterable, paginated)

GET    /api/departments
POST   /api/departments
PATCH  /api/departments/:id
DELETE /api/departments/:id

GET    /api/notifications
PATCH  /api/notifications/:id/read
POST   /api/notifications/mark-all-read
DELETE /api/notifications/:id

GET    /api/disputes
POST   /api/disputes
PATCH  /api/disputes/:id

GET    /api/analytics/overview        (admin roles only, school-scoped for non-super-admin)
GET    /api/analytics/elections/:id
GET    /api/analytics/schools/:id    (per-school USSD metrics, sessions/day, monthly cost)

GET    /api/payments/verify/:reference
POST   /api/payments/webhook
POST   /api/payments/initiate

GET    /api/settings
POST   /api/settings
GET    /api/settings/payouts                   (super_admin: payout config per tier)
PATCH  /api/settings/payouts                   (super_admin: update payout config)

GET    /api/analytics/revenue                  (super_admin: MRR, ARR, monthly revenue, top schools, USSD costs)
GET    /api/revenue/overview                   (super_admin: alias for analytics/revenue)

GET    /api/promos                             (super_admin: list all promo codes)
POST   /api/promos                             (super_admin: create promo code)
PATCH  /api/promos/by-code/:code                (super_admin: toggle by code)
DELETE /api/promos/by-code/:code                (super_admin: delete by code)
PATCH  /api/promos/:id                         (super_admin: toggle active/inactive)
DELETE /api/promos/:id                         (super_admin: delete promo code)
POST   /api/promos/validate                    (authenticated: validate code for checkout)
POST   /api/promos/apply                       (authenticated: apply code, increments usesCount + totalDiscountGiven)

GET    /api/invoices                           (super_admin: list all invoices)
GET    /api/invoices/:id                       (super_admin or school admin own)
POST   /api/invoices/:id/send                  (super_admin: mark as sent)
POST   /api/invoices/:id/mark-paid             (super_admin: mark as paid)
POST   /api/invoices/generate                  (super_admin: auto-generate monthly invoices)
GET    /api/invoices/school/:schoolId           (school admin: own school invoices)

POST   /api/ussd                              (Arkesel USSD webhook, secret-validated)
POST   /api/ussd/simulate                     (admin-only USSD testing simulator)

GET    /api/schools/:id/invoices              (super_admin or school_admin own school)
GET    /api/schools/:id/ussd-config
PATCH  /api/schools/:id/ussd-config           (school_admin own school only, super_admin any)
```

## Seed Script

Run: `DATABASE_URL=$DATABASE_URL /path/to/tsx lib/db/src/seed.ts`

Creates demo school, all role accounts, departments, elections, and candidates.
