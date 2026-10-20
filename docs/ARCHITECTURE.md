# Architecture

This document describes how SubPlug is structured, how money moves through the system, and which guarantees the code does and does not provide.

---

## 1. System context

```text
┌──────────────────────────┐        HTTPS / JSON        ┌──────────────────────────┐
│  React SPA (client/)     │ ─────────────────────────► │  Express API (server/)   │
│  Vite build, CDN/static  │ ◄───────────────────────── │  /api/v1                 │
└────────────┬─────────────┘                            └───────┬─────────┬────────┘
             │                                                  │         │
             │ hosted checkout redirect                          │         │ signed webhooks
             ▼                                                  ▼         ▼
      Payment gateway                                  MongoDB replica set   Payment gateway
      (Paystack / mock)                                (users, ledger,       (Paystack / mock)
                                                        transactions)
                                                                  │
                                                                  │ catalogue / purchases / status
                                                                  ▼
                                                          VTU provider adapter
                                                          (licensed HTTP provider / mock)
```

The web app is a static SPA. The API is stateless apart from its database, Redis (optional), and provider connections, so it can be scaled horizontally when queues are enabled.

---

## 2. Monorepo structure

| Path | Responsibility |
| --- | --- |
| `client/src/pages/public` | Marketing and policy pages |
| `client/src/pages/auth` | Login, registration, verification, reset, 2FA |
| `client/src/pages/dashboard` | Customer wallet and purchase flows |
| `client/src/pages/admin` | Staff and administrator portal |
| `client/src/hooks` | React Query data access and auth/theme providers |
| `client/src/lib/api.ts` | Axios client, CSRF bootstrap, one-shot refresh retry |
| `server/src/routes` | HTTP route definitions and middleware composition |
| `server/src/controllers` | Request/response translation only |
| `server/src/services` | Business logic and financial workflows |
| `server/src/models` | Mongoose schemas, indexes, and guards |
| `server/src/providers` | Payment and VTU adapter interfaces and implementations |
| `server/src/jobs` | Reconciliation scheduler and BullMQ worker |
| `server/tests` | Integration and unit tests against a test database |

Controllers do not mutate wallets directly. Financial operations are centralised in services (`walletService`, `purchaseService`, `fundingService`) so that validation, idempotency, state transitions, ledger posting, notifications, and audit logging stay consistent.

---

## 3. Request lifecycle

1. Helmet, CORS, compression, HPP, and request IDs are applied.
2. JSON is parsed; the raw body is retained for webhook signature verification.
3. Cookies are parsed and untrusted input is sanitised.
4. CSRF is enforced for every non-safe method except webhook and CSRF-bootstrap paths.
5. Global and route-specific rate limits are applied.
6. Zod validates params, query, and body before the controller runs.
7. `authenticate` verifies the access cookie (or bearer token), loads the user, and rejects suspended/inactive accounts.
8. Role middleware and resource-ownership checks run.
9. The controller calls a service; errors are normalised by the central error handler.
10. Responses use a consistent envelope and include the request ID on errors.

### Response envelope

```json
{ "data": { "...": "..." } }
```

Errors:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient wallet balance",
    "details": []
  },
  "requestId": "…"
}
```

---

## 4. Authentication and sessions

- Access token: signed JWT, 15 minutes by default, stored in an HTTP-only `qt_access` cookie.
- Refresh token: 48 random bytes, stored only as a SHA-256 hash in the `Session` collection, in the HTTP-only `qt_refresh` cookie scoped to `/api/v1/auth`.
- Every refresh rotates the token. Reuse of an already-rotated token revokes the entire session family, which detects replay/theft.
- Sessions store user agent, IP, expiry, and revocation time.
- CSRF uses a readable `qt_csrf` cookie plus the `X-CSRF-Token` header (double submit). The SPA fetches a token at startup, retries once on `CSRF_VALIDATION_FAILED`, and refreshes the token after login.
- A login with TOTP enabled returns a five-minute challenge token instead of auth cookies; `POST /auth/2fa/login` completes the exchange.
- Password changes and 2FA disable revoke all sessions and clear cookies.
- Login failures are counted; after five failures the account is locked for 15 minutes.
- Email verification is required before funding or purchasing, controlled by the `registration` setting and enforced by `requireVerifiedEmail`.

### CSRF rules

| Request type | Requirement |
| --- | --- |
| `GET`, `HEAD`, `OPTIONS` | No CSRF check |
| `POST`, `PATCH`, `PUT`, `DELETE` | `X-CSRF-Token` must equal the `qt_csrf` cookie |
| `/api/v1/webhooks/*` | Exempt; protected by provider signature verification |
| `/api/v1/auth/csrf` | Exempt; issues the cookie/token |
| `/health*` | Exempt |

---

## 5. Money model

### Units

All monetary values are **integer kobo** (`₦1 = 100 kobo`). Field names end in `Minor` to make the unit explicit. The client formats kobo for display and converts user input once, at the form boundary. No floating-point arithmetic is used in the API.

### Wallet projection and ledger

```text
Wallet.balanceMinor  = cached projection used for fast reads and conditional debits
LedgerEntry[]        = append-only source of truth
```

Every financial movement writes one immutable `LedgerEntry` with:

- `walletId`, `userId`, `type`, `direction` (`CREDIT`/`DEBIT`), `amountMinor`
- `balanceAfterMinor`
- globally unique `reference` and `idempotencyKey`
- optional `transactionId`, `fundingId`, `createdBy`, and metadata

Mongoose `pre` hooks block `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, and `deleteMany` on ledger entries. Corrections are made by posting a new, authorised entry (for example `ADJUSTMENT_CREDIT`), never by editing history.

### Posting algorithm

For a debit:

1. Validate that the amount is a positive safe integer.
2. Look up the ledger idempotency key. If it exists, verify the same user, amount, type, and direction; otherwise return `IDEMPOTENCY_MISMATCH`.
3. Ensure the wallet exists.
4. Atomically update the wallet with filter `{ userId, status: 'ACTIVE', balanceMinor: { $gte: amount } }` and `$inc: { balanceMinor: -amount }`.
5. If no wallet matches, distinguish "wallet frozen" from "insufficient balance".
6. Insert the ledger row with the resulting balance.

The conditional update is what prevents negative balances under concurrency. Unique indexes on `reference` and `idempotencyKey` are the final defence against duplicate postings.

### Transactions versus standalone mode

| Deployment | Behaviour |
| --- | --- |
| MongoDB replica set | `runInTransaction` opens a session, starts a transaction, and commits wallet projection + ledger row atomically |
| Standalone MongoDB (development) | A process-local mutex serialises wallet operations per user; unique constraints and reconciliation catch anomalies |

The fallback is explicitly **not production-safe** because it only protects a single Node process. In production, `connectDatabase` refuses to start when `REQUIRE_REPLICA_SET=true` and the server is standalone.

### Idempotency

- Funding and purchases require an `Idempotency-Key` header matching `^[A-Za-z0-9_-]{8,100}$`.
- The request body is canonicalised and hashed (`requestHash`).
- Replaying the same key with the same payload returns the original result with `duplicate: true`.
- Replaying the same key with a different payload returns `409 IDEMPOTENCY_MISMATCH`.
- Admin wallet adjustments also require an idempotency key.
- Funding webhooks are deduplicated through a unique `PaymentEvent` record and idempotent `confirmFunding`.

---

## 6. Purchase state machine

The transition allow-list lives in `server/src/services/transactionStateMachine.ts`:

| From | Allowed to |
| --- | --- |
| `CREATED` | `PENDING`, `FAILED` |
| `PENDING` | `PROCESSING`, `FAILED`, `REQUIRES_REVIEW` |
| `PROCESSING` | `SUCCESSFUL`, `FAILED`, `REQUIRES_REVIEW` |
| `REQUIRES_REVIEW` | `PROCESSING`, `SUCCESSFUL`, `FAILED` |
| `SUCCESSFUL` | `REVERSED` |
| `FAILED` | `REFUNDED` |
| `REVERSED` | terminal |
| `REFUNDED` | terminal |

Transitions use a conditional update on the current status, so two workers cannot both complete the same purchase. Each transition appends to `statusHistory` with a timestamp, reason, and optional actor.

### Purchase flow

```text
Validate request
   │
   ├─ Idempotency replay? ──► return original result
   │
   ├─ Check limits, daily spend, catalogue, verification
   │
   ├─ Create transaction (CREATED) + debit wallet + status PENDING
   │
   ├─ Manual review threshold? ──► REQUIRES_REVIEW (no provider call)
   │
   ├─ Submit to provider (never retried automatically)
   │
   ├─ SUCCESS  ──► SUCCESSFUL, store fulfillment details
   ├─ FAILED   ──► FAILED, then refund via REFUND ledger entry ──► REFUNDED
   ├─ PENDING  ──► PENDING with nextReconcileAt
   └─ UNCERTAIN──► REQUIRES_REVIEW, funds held
```

### Outcome semantics

| Provider outcome | Meaning | System action |
| --- | --- | --- |
| `SUCCESS` | Provider confirms delivery | Mark successful; store token/units/recipient data |
| `FAILED` | Provider definitively rejected | Mark failed, refund the wallet debit |
| `PENDING` | Provider accepted but has not finalised | Keep funds debited, schedule reconciliation |
| `UNCERTAIN` | Timeout or ambiguous response | Hold for manual review; never auto-retry |

A late provider success after a local failure/refund is treated as a critical discrepancy: the transaction is moved to `REQUIRES_REVIEW`, a notification is created, and staff must reconcile it. The system never silently keeps both the refund and the delivered service.

### Manual review

Transactions at or above the configured `manualReviewThresholdMinor` are held before provider submission. Administrators can:

- Approve and submit to the provider (`POST /admin/transactions/:reference/approve`).
- Reject with a reason, which refunds the debit (`POST /admin/transactions/:reference/reject`).
- Re-check provider status (`POST /admin/transactions/:reference/check-status`).

---

## 7. Funding flow

```text
Customer requests funding (amount + idempotency key)
   │
   ├─ Validate amount against runtime limits and account status
   ├─ Create WalletFunding (PENDING) with provider initialize()
   ├─ Return authorizationUrl (hosted checkout)
   │
   ▼
Customer completes/fails checkout at the gateway
   │
   ├─ Browser callback ──► POST /wallet/funding/:reference/verify
   ├─ Gateway webhook ──► POST /webhooks/paystack (signature verified)
   └─ Scheduler ────────► periodic verify for stale PENDING fundings
   │
   ▼
Provider verification says SUCCESS?
   ├─ No  ──► keep PENDING or mark FAILED/REQUIRES_REVIEW
   └─ Yes ──► confirmFunding()
               ├─ Guard against double credit
               ├─ Post FUNDING_CREDIT ledger entry (idempotency: funding id)
               ├─ Mark funding SUCCESSFUL with paid/verified/credited timestamps
               ├─ In-app notification + optional email receipt
               └─ Audit entry
```

Webhook handling:

1. Verify the raw-body HMAC signature before trusting any field.
2. Insert a unique `PaymentEvent` (provider + event ID/hash) to deduplicate retries.
3. Re-verify the transaction with the provider API rather than trusting the webhook payload alone.
4. Call `confirmFunding`, which is idempotent at the database level.
5. Mark the event processed; failures remain visible for retry.

Sandbox simulation uses the same `confirmFunding` path, so it exercises production logic. It is restricted to funding records flagged `isSandbox`.

---

## 8. Catalogue and pricing

- `ServicePlan` stores provider plan IDs, network/package metadata, provider cost, selling price, and enabled state.
- `seed.ts` pulls the sandbox catalogue from the active VTU adapter and applies the runtime pricing settings.
- Data prices apply `pricing.dataMarkupPercent` over provider cost. Cable prices apply `pricing.cableMarkupPercent`. Airtime uses `discounts.airtimePercent` per network.
- Electricity can apply `pricing.electricityFeeMinor`.
- Administrators can enable/disable plans, rename them, and override selling prices. `preserveManualPlanPricing` protects manual overrides during catalogue synchronisation.
- Purchase services re-read the plan and runtime limits at purchase time; the client's displayed price is never trusted.

Airtime quotes are available from `GET /services/airtime-quote`, and the purchase response includes `amountMinor`, `discountMinor`, `feeMinor`, and `payableMinor`.

---

## 9. Provider abstraction

### VTU provider

```ts
interface VtuProvider {
  key: string;
  name: string;
  isSandbox: boolean;
  getNetworks(): Promise<ProviderNetwork[]>;
  getDataPlans(network?: string): Promise<ProviderDataPlan[]>;
  getElectricityProviders(): Promise<ProviderDisco[]>;
  getCableProviders(): Promise<ProviderCableNetwork[]>;
  getCablePackages(network: string): Promise<ProviderCablePackage[]>;
  validateMeter(input): Promise<MeterValidation>;
  validateSmartcard(input): Promise<SmartcardValidation>;
  purchase(request): Promise<ProviderPurchaseResult>;
  queryStatus(reference): Promise<ProviderStatusResult>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
```

Two implementations exist:

- `MockVtuProvider` — deterministic sandbox, no network calls, clearly flagged.
- `HttpVtuProvider` — a configurable template using `VTU_PATH_*` mappings. It must be completed and certified against a licensed provider's API before production use.

Provider selection happens once and is cached. Mock adapters are blocked in production unless `ALLOW_SANDBOX_IN_PRODUCTION=true` is explicitly set.

### Payment provider

`PaymentProvider` exposes `initialize`, `verify`, `parseWebhook`, and `isSandbox`. Implementations:

- `MockPaymentProvider` — local checkout redirect and simulation endpoint.
- `PaystackProvider` — Paystack initialise/verify plus HMAC-SHA512 webhook verification.

The adapter contract is intentionally small so another gateway can be added without changing funding services.

---

## 10. Reconciliation and background work

The scheduler runs every `RECONCILE_INTERVAL_MS` (default five minutes) and performs:

1. **Transaction reconciliation** — query `PROCESSING`/`REQUIRES_REVIEW` transactions with `nextReconcileAt` due and fewer than eight attempts; ask the provider for status; apply the outcome idempotently.
2. **Funding reconciliation** — verify `PENDING` fundings older than two minutes; credit only confirmed payments.
3. **Refund retries** — retry refunds for failed transactions that have no `refundedAt`.
4. **Stale pending detection** — flag `PENDING` transactions that never reached the provider. If a debit exists, hold for human review; if not, mark failed.
5. **Wallet drift check** — recompute each wallet from its ledger and log discrepancies without mutating data.

With `USE_QUEUES=true`, BullMQ and Redis own the schedule. Without Redis, timers run inside the API process, which is only safe for a single instance.

### Admin reconciliation tools

- `GET /admin/reconciliation` returns wallet/ledger discrepancies, counts by status, stale items, and refund backlog.
- `POST /admin/fundings/:reference/recheck` re-verifies a funding with the gateway.
- `POST /admin/transactions/:reference/check-status` queries the VTU provider.
- `POST /admin/wallet/adjust` posts an audited adjustment; it never edits ledger history.
- `GET /admin/audit-logs` exposes the immutable audit trail.

---

## 11. Data model

| Collection | Purpose | Key constraints |
| --- | --- | --- |
| `users` | Identity, role, status, 2FA, referral links | unique email, unique phone, unique referral code |
| `sessions` | Refresh-session families | hashed token, family ID, expiry, revocation |
| `wallets` | Cached balance projection | one per user, non-negative balance |
| `ledgerentries` | Immutable financial history | unique reference and idempotency key; update/delete guards |
| `transactions` | Purchases and state history | unique reference; unique `(userId, idempotencyKey)` |
| `walletfundings` | Checkout attempts | unique reference; unique `(userId, idempotencyKey)` |
| `payment_events` | Verified webhook events | unique provider event key |
| `serviceplans` | Data and cable catalogue | unique provider plan ID |
| `providers` | Provider health/configuration metadata | unique key |
| `supporttickets` | Customer support threads | ticket number, owner, status, messages |
| `notifications` | In-app inbox | per-user read state |
| `referrals` | Referral attribution and rewards | unique referred user |
| `auditlogs` | Security and operational trail | indexed actor/action/entity/time |
| `systemsettings` | Runtime configuration | key/value documents |

Passwords, 2FA secrets, verification tokens, reset tokens, API credentials, and hidden fulfillment fields are excluded from serialisation or selected only when explicitly needed.

---

## 12. Security model

| Control | Implementation |
| --- | --- |
| Password storage | bcrypt cost 12 |
| Session storage | SHA-256 hashes of random refresh tokens |
| Token theft detection | Refresh rotation + family revocation on reuse |
| CSRF | Double-submit cookie/header comparison using timing-safe equality |
| Transport | Secure cookies in production; HSTS enabled |
| CORS | Explicit allow-list with credentials |
| Input validation | Zod schemas for body/query/params |
| Injection | Mongoose parameterised queries; regex inputs escaped |
| Sanitisation | Recursive removal of `$`/dotted keys and prototype-pollution keys |
| Rate limiting | Global, auth, password-reset, financial, webhook, contact |
| RBAC | Route-level role guards plus ownership checks in services |
| Audit | Sensitive actions recorded with actor, IP, user agent, request ID |
| Webhooks | Raw-body HMAC verification and event deduplication |
| Headers | Helmet; CSP configured on the static frontend (API returns JSON) |

Roles:

| Role | Capabilities |
| --- | --- |
| `CUSTOMER` | Own wallet, purchases, tickets, notifications, referrals |
| `SUPPORT` | Read operational views and reply to tickets |
| `ADMIN` | All support capabilities plus money movement, user status, plans, settings, audit, reconciliation |

---

## 13. Observability

- Structured JSON logs via Pino in production, pretty logs in development.
- Request IDs propagated in logs and error responses.
- `/health` reports process and database status.
- `/health/ready` reports readiness plus whether Mongo transactions are available and which VTU adapter is active.
- Provider calls, funding events, reconciliation cycles, audit actions, and financial discrepancies are logged with references.
- The admin overview and reconciliation pages derive metrics from the database; no sample statistics are injected.

---

## 14. Scaling and operational boundaries

- The API is stateless and can run multiple instances behind a load balancer.
- When running more than one instance, set `USE_QUEUES=true` and provide Redis so reconciliation is not duplicated.
- MongoDB should be a replica set in production. Use a managed service with point-in-time backups.
- Webhook endpoints must be publicly reachable over HTTPS and excluded from any WAF body rewriting that would break signature verification.
- Long provider calls are bounded by `VTU_TIMEOUT_MS`; purchase submission is never automatically retried.
- Sessions and audit logs grow over time; define retention policies with legal and finance stakeholders.

---

## 15. What this architecture deliberately does not do

- It does not treat the wallet balance as the source of truth.
- It does not mark a purchase successful without a provider confirmation.
- It does not retry an ambiguous purchase automatically.
- It does not refund a pending or uncertain purchase solely because the client timed out.
- It does not allow negative balances or ledger edits.
- It does not expose provider cost or margin fields to customers.
- It does not use mock providers silently in production.
