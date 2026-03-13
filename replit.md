# BallotWave

## Overview

BallotWave is a **production-ready SaaS digital voting platform** for African schools (SHS, Colleges, Universities). It supports web voting, USSD voting, mobile money payments, role-based dashboards, fraud detection, and multi-tenant school management.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **Auth**: JWT (bcryptjs)
- **Payment**: Paystack (Mobile Money / Card)
- **SMS/USSD**: Arkesel (integration-ready)
- **API codegen**: Orval (from OpenAPI spec)

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
  db/                  # Drizzle ORM schema + DB connection
```

## Demo Accounts

- **Super Admin**: admin@ballotwave.com / password123
- **School Admin**: admin@accrashs.edu.gh / password123
- **Voter**: kwame@student.accrashs.edu.gh / password123

## Features

- Multi-tenant school management with plans (free, basic, pro, enterprise)
- Election lifecycle: draft → active → closed
- Candidate management with positions and manifestos
- Web voting with fraud prevention (one vote per voter per election)
- Vote receipts with unique codes
- Election results with position-level breakdowns
- Analytics dashboard (charts, turnout, activity feed)
- Payment gateway via Paystack (Mobile Money, Card)
- OTP phone verification via Arkesel (integration-ready)
- Role-based access: super_admin, school_admin, candidate, voter

## Platform Settings Management

The super admin Settings page (`/dashboard/settings`) provides a full environment variables management system organized into 4 sections:

- **API Keys**: Paystack secret key, Arkesel API key (secret/masked fields)
- **Platform Config**: Platform name, support email, platform URL, default voting fee (text fields)
- **Feature Flags**: Enable USSD voting, enable mobile money, maintenance mode (toggle switches)
- **Boot-time Variables**: JWT secret (secret field, amber warning about restart required)

Settings are stored in the `platform_settings` DB table and loaded at runtime. The backend uses a `SETTINGS_REGISTRY` (`artifacts/api-server/src/lib/settings-registry.ts`) as a single source of truth for all settings metadata.

Maintenance mode (`maintenance_mode=true`) returns 503 for all non-super-admin API routes. Health and auth endpoints are always available.

## Environment Variables

- `DATABASE_URL` — Auto-provisioned by Replit
- `JWT_SECRET` — Change in production (can also be overridden via Settings page, requires restart)
- `PAYSTACK_SECRET_KEY` — Add to enable real Paystack integration (or set via Settings page)
- `ARKESEL_API_KEY` — Add to enable real SMS/USSD via Arkesel (or set via Settings page)
- `PORT` — Auto-assigned per service

## Running

- API Server: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/ballotwave run dev`
- DB Push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
