# BallotWave

**Next-Generation Digital Voting Infrastructure for Schools in Africa**

BallotWave is a production-ready SaaS election platform designed for Senior High Schools, Colleges, and Universities to conduct secure digital elections using Web + USSD voting with Mobile Money payments.

---

## Features

- **Multi-tenant** — Multiple schools run elections independently on the same platform
- **Web Voting** — Voters cast ballots from any browser with fraud prevention
- **USSD Voting** — Vote via mobile phone without internet (Arkesel integration-ready)
- **Mobile Money Payments** — Paystack integration for MTN, Vodafone, AirtelTigo
- **Role-Based Dashboards** — Super Admin, School Admin, Candidate, Voter
- **Real-Time Results** — Live vote counts and percentages per position
- **Analytics** — Turnout charts, votes by day, election status breakdown
- **OTP Verification** — SMS-based voter identity verification (Arkesel integration-ready)
- **Fraud Detection** — One vote per voter per election, enforced at the database level
- **Vote Receipts** — Unique receipt codes issued after every successful vote

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + TailwindCSS + Shadcn UI |
| Charts | Recharts |
| Backend | Node.js + Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT + bcrypt |
| Payments | Paystack (card + mobile money) |
| SMS/USSD | Arkesel (integration-ready) |
| API Contract | OpenAPI 3.1 + Orval codegen |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
ballotwave/
├── artifacts/
│   ├── api-server/          # Express REST API
│   │   └── src/
│   │       ├── routes/      # auth, elections, candidates, payments, analytics, users
│   │       └── lib/         # JWT auth middleware
│   └── ballotwave/          # React + Vite frontend
│       └── src/
│           ├── pages/       # landing, auth, dashboard, voter portal, results
│           └── components/  # sidebar, layout, status badges
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec (openapi.yaml)
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod validation schemas
│   └── db/                  # Drizzle ORM schema + DB connection
└── scripts/                 # Utility scripts
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes (change in production) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key for payments | Optional (demo mode without it) |
| `ARKESEL_API_KEY` | Arkesel key for SMS/USSD | Optional |
| `PORT` | Server port (auto-assigned on Replit) | Auto |

### Install & Run

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start frontend (port assigned by platform)
pnpm --filter @workspace/ballotwave run dev
```

### Regenerate API Types

After editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@ballotwave.com | password123 |
| School Admin | admin@accrashs.edu.gh | password123 |
| Voter | kwame@student.accrashs.edu.gh | password123 |

---

## API Overview

All endpoints are prefixed with `/api`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login and receive JWT |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get current user |

### Schools
| Method | Path | Description |
|---|---|---|
| GET | `/schools` | List all schools |
| POST | `/schools` | Create a school |
| GET | `/schools/:id` | Get school details |
| PATCH | `/schools/:id` | Update school |

### Elections
| Method | Path | Description |
|---|---|---|
| GET | `/elections` | List elections (filter by `schoolId`, `status`) |
| POST | `/elections` | Create election |
| GET | `/elections/:id` | Election detail with candidates |
| PATCH | `/elections/:id` | Update election |
| POST | `/elections/:id/start` | Activate election |
| POST | `/elections/:id/close` | Close election |
| GET | `/elections/:id/results` | Results by position |

### Voting
| Method | Path | Description |
|---|---|---|
| POST | `/elections/:id/vote` | Cast votes |
| GET | `/elections/:id/check-voted` | Check if current voter has voted |

### Candidates
| Method | Path | Description |
|---|---|---|
| GET | `/elections/:id/candidates` | List candidates |
| POST | `/elections/:id/candidates` | Add candidate |
| PATCH | `/elections/:id/candidates/:cid` | Update candidate |
| DELETE | `/elections/:id/candidates/:cid` | Remove candidate |

### Payments
| Method | Path | Description |
|---|---|---|
| POST | `/payments/initiate` | Initiate Paystack payment |
| POST | `/payments/verify` | Verify payment status |
| POST | `/payments/webhook` | Paystack webhook handler |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/analytics/overview` | Platform-wide stats |
| GET | `/analytics/elections/:id` | Per-election analytics |

---

## Database Schema

| Table | Description |
|---|---|
| `schools` | Tenant schools with plan (free/basic/pro/enterprise) |
| `users` | All users with roles (super_admin, school_admin, candidate, voter) |
| `elections` | Elections with status lifecycle (draft → active → closed) |
| `candidates` | Candidates per election and position |
| `votes` | Individual vote records (anonymised per voter) |
| `voter_receipts` | One receipt per voter per election (fraud prevention) |
| `payments` | Paystack payment records |

---

## Roles & Permissions

| Role | Access |
|---|---|
| `super_admin` | All schools, all elections, platform analytics, revenue |
| `school_admin` | Own school elections, candidates, voters, school analytics |
| `candidate` | View own candidacy, view results |
| `voter` | Vote in active elections, view receipt, view results |

---

## Payment Flow

1. Voter initiates payment via Paystack (`POST /payments/initiate`)
2. Redirected to Paystack checkout (card or mobile money)
3. On success, payment reference is returned
4. Frontend calls `POST /payments/verify` with reference
5. Verified reference is passed with vote submission to unlock voting
6. Paystack webhook (`POST /payments/webhook`) also updates payment status server-side

> Without a `PAYSTACK_SECRET_KEY`, the platform runs in **demo mode** — payments are automatically marked as successful, allowing full testing without a Paystack account.

---

## Deploying to Production

1. Set all required environment variables (`DATABASE_URL`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`)
2. Run database migrations: `pnpm --filter @workspace/db run push`
3. Build the frontend: `pnpm --filter @workspace/ballotwave run build`
4. Build the API: `pnpm --filter @workspace/api-server run build`
5. Serve `artifacts/ballotwave/dist/public` as static files
6. Run `artifacts/api-server/dist/index.cjs` as the Node.js server

On Replit, click **Deploy** to publish both services automatically.

---

## Integrating Paystack

1. Create a Paystack account at [paystack.com](https://paystack.com)
2. Get your secret key from the Paystack dashboard
3. Set `PAYSTACK_SECRET_KEY` in your environment variables
4. Configure your webhook URL to `https://your-domain.com/api/payments/webhook`

## Integrating Arkesel (SMS/USSD)

1. Create an account at [arkesel.com](https://arkesel.com)
2. Get your API key
3. Set `ARKESEL_API_KEY` in your environment variables
4. Update `artifacts/api-server/src/routes/users.ts` to call the Arkesel API in the `send-otp` route

---

## License

MIT
