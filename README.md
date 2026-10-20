# SubPlug

SubPlug is a production-oriented MERN (MongoDB, Express, React, Node.js) platform for selling airtime, data bundles, electricity tokens, and cable TV subscriptions in Nigeria. It includes a customer wallet, an append-only financial ledger, verified payment webhooks, provider adapters, a support desk, referrals, a staff/admin portal, and automated tests.

> **This repository ships with sandbox adapters only.** The default VTU and payment providers are deterministic mocks. They do not deliver real airtime, data, electricity, or cable services and do not move real money. Before accepting customers you must connect a licensed VTU provider and a live payment gateway, complete the production checklist in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and obtain the necessary regulatory and commercial approvals.

---

## Contents

- [What is implemented](#what-is-implemented)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Sandbox behaviour](#sandbox-behaviour)
- [Testing](#testing)
- [Production build](#production-build)
- [Security highlights](#security-highlights)
- [Documentation](#documentation)
- [Known limitations](#known-limitations)

---

## What is implemented

### Customer experience

- Registration, login, email verification, password reset, optional TOTP two-factor authentication.
- Wallet funded through a hosted checkout flow, with sandbox simulation for local development.
- Airtime purchase with network discounts and quote preview.
- Data bundle purchase from a catalogue of provider plans.
- Electricity payment with meter validation and token delivery.
- Cable TV payment with smartcard validation and package selection.
- Transaction history, filters, receipts, and a detailed status timeline.
- Immutable wallet ledger with running balance.
- Support tickets with threaded replies.
- In-app notifications, referral programme, profile and security settings.
- Responsive, mobile-first UI with light and dark themes, keyboard-friendly dialogs, and accessible form errors.

### Operations and administration

- Dashboard metrics derived from real database records.
- User search, account suspension, wallet adjustments with mandatory reasons.
- Transaction search and detail views, provider status re-checks, manual review approval/rejection.
- Funding search and re-verification.
- Plan catalogue management and provider health checks.
- Reconciliation view for wallet/ledger drift, stuck transactions, and failed refunds.
- Support ticket queue with replies and status changes.
- Immutable audit log for sensitive actions.
- Runtime settings for branding, maintenance mode, limits, discounts, pricing, referrals, and notifications.

### Financial integrity

- All amounts are **integer kobo**; no floating-point arithmetic is used for money.
- Wallet balances are a cached projection of an append-only `LedgerEntry` collection.
- Ledger rows are protected against updates and deletes at the Mongoose layer.
- Every purchase and funding operation requires an `Idempotency-Key`; payload hashes detect key reuse with different details.
- Purchases use an explicit transaction state machine with a guarded transition allow-list.
- MongoDB multi-document transactions are used when the database is a replica set.
- On a standalone development database, a process-local serialized fallback protects wallet mutations; this is **not** suitable for production.
- Provider outcomes are classified as success, definitive failure, pending, or uncertain. Only definitive failures are refunded automatically; uncertain outcomes are held for reconciliation.
- Funding is credited only after a verified provider response or a verified, deduplicated webhook.

### Security

- Short-lived JWT access cookies and rotating hashed refresh sessions with reuse detection.
- CSRF double-submit protection for every unsafe HTTP method.
- Helmet, CORS allow-list, HPP protection, request sanitisation, rate limits, and request IDs.
- Password hashing with bcrypt (cost 12), login lockout, and session revocation on password or 2FA changes.
- Role-based access control: `CUSTOMER`, `SUPPORT`, `ADMIN`; sensitive mutations are admin-only.
- Zod request validation on body, query, and route parameters.
- Audit records for authentication and administrative actions.
- Webhooks are signature-verified and deduplicated.

---

## Technology

| Layer | Technology |
| --- | --- |
| API | Node.js 20+, Express 4, TypeScript |
| Database | MongoDB 6+ with Mongoose 8 |
| Background jobs | In-process scheduler or BullMQ + Redis |
| Auth | HTTP-only JWT cookies, hashed rotating refresh sessions, TOTP |
| Web | React 18, Vite 6, TypeScript, Tailwind CSS |
| Data fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| Tests | Vitest, Supertest, Testing Library |
| Email | Nodemailer (SMTP optional in development) |

The project is an npm-workspaces monorepo.

---

## Repository layout

```text
.
├── client/                  React single-page application
│   ├── src/components/      Shared UI, layout, and domain components
│   ├── src/hooks/           React Query hooks and auth/theme providers
│   ├── src/lib/             API client, schemas, formatters, utilities
│   ├── src/pages/           Public, auth, dashboard, funding, and admin pages
│   └── vite.config.ts       Dev server and /api proxy
├── server/                  Express API
│   ├── src/config/          Environment, database, constants, logger
│   ├── src/controllers/     HTTP handlers
│   ├── src/jobs/            Reconciliation scheduler and BullMQ worker
│   ├── src/middleware/      Auth, RBAC, CSRF, validation, rate limits, errors
│   ├── src/models/          Mongoose schemas
│   ├── src/providers/       Payment and VTU adapter abstractions
│   ├── src/routes/          Versioned API routes
│   ├── src/scripts/         Catalogue and administrator seeds
│   ├── src/services/        Business logic and financial workflows
│   ├── src/validators/      Zod request schemas
│   └── tests/               Integration and unit tests
├── docs/                    Architecture, API, environment, deployment, operations
├── package.json             Workspace scripts
└── README.md
```

---

## Quick start

### Prerequisites

- Node.js 20 or newer (the verified development runtime is Node 24).
- npm 10 or newer.
- MongoDB 6 or newer. A locally installed standalone server is sufficient for development; production requires a replica set.
- Optional: Redis 6+ when `USE_QUEUES=true`.
- Optional: SMTP credentials if you want real email delivery.

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure the API

Copy the example file and edit it:

```bash
# macOS / Linux
cp server/.env.example server/.env

# Windows PowerShell
Copy-Item server/.env.example server/.env
```

At minimum, set a long random `JWT_ACCESS_SECRET` and the administrator credentials used by the seed script:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API validates its environment at boot and refuses to start when required values are missing. See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for every variable.

### 3. Configure the web client

The development defaults work without a `.env` file because Vite proxies `/api` to `http://localhost:4000`. To customise:

```bash
cp client/.env.example client/.env
```

### 4. Seed the catalogue and administrator

```bash
npm run seed
```

This creates or updates the sandbox catalogue, default settings, and the administrator defined by `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `ADMIN_PHONE`.

### 5. Start the applications

```bash
npm run dev
```

| Service | URL |
| --- | --- |
| Web application | http://localhost:5173 |
| API | http://localhost:4000 |
| API health | http://localhost:4000/health |
| API readiness | http://localhost:4000/health/ready |

Sign in to the admin portal at `/admin` with the administrator credentials from `server/.env`.

### Useful scripts

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API and web app together |
| `npm run build` | Type-check and build both workspaces |
| `npm start` | Start the compiled API (`server/dist/server.js`) |
| `npm test` | Run server and client test suites |
| `npm run typecheck` | Type-check both workspaces without emitting |
| `npm run seed` | Seed catalogue, settings, and administrator |
| `npm run seed:admin` | Seed or update only the administrator |

---

## Sandbox behaviour

### Mock VTU outcomes

The mock VTU adapter chooses an outcome from the recipient phone number:

| Phone ending | Outcome | Result in SubPlug |
| --- | --- | --- |
| `0000` | Definitive failure | Transaction becomes `FAILED`, then `REFUNDED` automatically |
| `1111` | Pending | Transaction becomes `PENDING`; reconciliation may resolve it later |
| `2222` | Uncertain / timeout | Transaction becomes `REQUIRES_REVIEW`; funds remain held |
| anything else | Success | Transaction becomes `SUCCESSFUL` |

Electricity tokens generated by the sandbox start with `SANDBOX-`. Meter validation returns clearly labelled demo customer data. No external service is contacted.

### Mock payments

With `PAYMENT_GATEWAY=mock` and `ALLOW_MOCK_PAYMENTS=true`:

1. `POST /api/v1/wallet/fund` returns an `authorizationUrl` pointing at `/mock-payment?reference=...`.
2. The mock checkout page can simulate success or failure.
3. Success is confirmed through the sandbox-only endpoint `POST /api/v1/wallet/funding/:reference/simulate`.
4. The wallet is credited only through the normal `confirmFunding` path, using the same ledger and idempotency rules as a real gateway callback.

The UI marks sandbox funding and sandbox purchases. Mock providers are rejected in production unless `ALLOW_SANDBOX_IN_PRODUCTION=true` is explicitly set.

---

## Testing

The server suite uses a dedicated MongoDB database, `subplug_test`, and runs files serially to avoid cross-file interference. MongoDB must be running locally, or `MONGODB_URI` in the test environment must point to a disposable test database.

```bash
npm test
```

Run suites separately:

```bash
npm run test -w server
npm run test -w client
```

The server tests cover ledger integrity and concurrency, idempotency and key reuse, refunds, reconciliation, funding confirmation and webhook signature verification, provider outcomes, RBAC, CSRF, and ownership boundaries. The client tests cover money formatting, validation schemas, the money input, form errors, status badges, stats, and utilities.

---

## Production build

```bash
npm run build
```

Artifacts:

- API: `server/dist/`
- Web app: `client/dist/`

Start the API from the repository root:

```bash
NODE_ENV=production npm start
```

Serve `client/dist/` from a static host or CDN, with a SPA rewrite to `index.html`. Set `VITE_API_URL` at build time when the API is on a different origin. Full instructions, including TLS, cookies, CORS, database, queues, and go-live checks, are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Security highlights

- Never commit `server/.env` or `client/.env`; both are ignored by `.gitignore`.
- Use a unique 64-character random `JWT_ACCESS_SECRET` per environment.
- Production requires MongoDB as a replica set so wallet mutations are transactional.
- Use HTTPS. When the API and web app are on different sites, set `COOKIE_SAME_SITE=none` and `COOKIE_DOMAIN` appropriately; this requires secure cookies and HTTPS.
- Configure `ADDITIONAL_CORS_ORIGINS` only with origins you control.
- Keep `AUTO_VERIFY_EMAILS=false`, `EXPOSE_DEV_EMAILS=false`, and `ALLOW_SANDBOX_IN_PRODUCTION=false` in production.
- Rotate Paystack and VTU credentials if they have ever been exposed.
- Grant `ADMIN` only to staff who need financial authority. `SUPPORT` can read operational data and reply to tickets but cannot move money or change settings.
- Review the audit log and reconciliation dashboard after every deployment that touches financial logic.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components, money model, state machine, provider abstraction, security, data model.
- [API reference](docs/API.md) — authentication, CSRF, idempotency, every endpoint, examples, and error codes.
- [Environment variables](docs/ENVIRONMENT.md) — complete configuration reference and secret generation.
- [Deployment](docs/DEPLOYMENT.md) — production topology, builds, process management, Nginx, cookies, queues, go-live checklist, rollback.
- [Backup and restore](docs/BACKUP_RESTORE.md) — backup policy, commands, restore drills, and financial verification.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — local startup, auth, CSRF, webhooks, provider outcomes, tests, and production symptoms.

---

## Known limitations

- The HTTP VTU adapter is a **template**. Field mappings and endpoint paths must be implemented against the documentation of a licensed provider before it can be used.
- The payment integration is production-shaped (initialise, verify, signed webhooks, deduplication) but has only been exercised against the mock provider; certify it against Paystack test and live keys.
- There is no KYC, AML, sanctions screening, or credit facility. Those are business and regulatory requirements outside this codebase.
- There is no SMS gateway integration; notification records are in-app only.
- Transactional email requires SMTP configuration. Without it, development logs email previews instead of sending.
- The in-process scheduler must not be used with multiple API instances. Enable Redis/BullMQ for horizontal scaling.
- There is no built-in object storage, dispute evidence upload, or chargeback workflow.
- The seeded plans and prices are sandbox data, not commercial pricing.
"# SUBPLUG" 
