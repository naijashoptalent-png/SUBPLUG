# API Reference

Version prefix: `/api/v1`

Local base URL: `http://localhost:4000/api/v1`

All request and response bodies are JSON unless noted. Amounts are integer **kobo**.

---

## 1. Conventions

### Success envelope

```json
{ "data": { } }
```

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Enter a valid Nigerian phone number",
    "details": [{ "path": "phone", "message": "Enter a valid Nigerian phone number" }]
  },
  "requestId": "…"
}
```

`details` is optional. A stack or internal error message is included only in non-production `5xx` responses.

### Common status codes

| Status | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created (registration, funding initialisation, purchases, tickets) |
| `400` | Validation or business input error |
| `401` | Missing/expired session |
| `402` | Insufficient wallet balance |
| `403` | CSRF failure, role denial, suspended account, or sandbox restriction |
| `404` | Resource not found or not owned by the caller |
| `409` | Conflict, duplicate, idempotency mismatch, invalid state transition |
| `429` | Rate limited |
| `503` | Database unavailable, provider disabled, or maintenance mode |

### Pagination

Query parameters: `page` (default 1), `limit` (default 20, max 100).

Paginated responses include:

```json
{
  "pagination": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "pages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Time and identifiers

- Timestamps are ISO-8601 UTC strings.
- MongoDB identifiers are 24-character hex strings.
- Transaction and funding references are uppercase strings such as `TXN_…` and `FUND_…`.

---

## 2. Authentication, CSRF, and cookies

Authentication uses HTTP-only cookies:

| Cookie | Purpose | Scope |
| --- | --- | --- |
| `qt_access` | Short-lived JWT access token | `/` |
| `qt_refresh` | Rotating refresh token | `/api/v1/auth` |
| `qt_csrf` | Readable CSRF token (not HTTP-only) | `/` |

For non-cookie clients, `Authorization: Bearer <access token>` is also accepted on authenticated routes.

### CSRF bootstrap

Every unsafe request must include `X-CSRF-Token` matching the `qt_csrf` cookie.

```http
GET /api/v1/auth/csrf
```

```json
{ "data": { "csrfToken": "…" } }
```

Send `Cookie: qt_csrf=…` and `X-CSRF-Token: …` on `POST`, `PATCH`, `PUT`, and `DELETE`. Webhook routes and `/auth/csrf` are exempt.

If the token expires or the cookie is cleared, the API returns:

```json
{ "error": { "code": "CSRF_VALIDATION_FAILED", "message": "Security token missing or invalid. Refresh the page and try again." } }
```

Fetch a new token and retry once.

### Session refresh

- Access tokens expire after `ACCESS_TOKEN_TTL_MINUTES` (default 15).
- Refresh tokens expire after `REFRESH_TOKEN_TTL_DAYS` (default 7) and rotate on every use.
- Reuse of an old refresh token revokes the whole session family.
- `POST /auth/refresh` requires CSRF and the refresh cookie. It sets new access and refresh cookies.
- Login/registration responses set cookies; the JSON body does not contain tokens.

### Authentication endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/auth/csrf` | Public | Issue CSRF cookie/token |
| `POST` | `/auth/register` | Public + CSRF | Create customer account |
| `POST` | `/auth/login` | Public + CSRF | Sign in |
| `POST` | `/auth/2fa/login` | Public + CSRF | Complete a TOTP challenge |
| `POST` | `/auth/refresh` | Refresh cookie + CSRF | Rotate tokens |
| `POST` | `/auth/logout` | Access cookie + CSRF | Revoke current session |
| `GET` | `/auth/me` | Access cookie | Profile + wallet projection |
| `PATCH` | `/auth/me` | Access cookie + CSRF | Update name/phone |
| `POST` | `/auth/change-password` | Access cookie + CSRF | Change password; revokes sessions |
| `POST` | `/auth/forgot-password` | Public + CSRF | Request reset email |
| `POST` | `/auth/reset-password` | Public + CSRF | Consume reset token |
| `POST` | `/auth/2fa/setup` | Access cookie + CSRF | Create TOTP secret and QR code |
| `POST` | `/auth/2fa/enable` | Access cookie + CSRF | Confirm and enable TOTP |
| `POST` | `/auth/2fa/disable` | Access cookie + CSRF | Disable TOTP; revokes sessions |

#### Register

```http
POST /api/v1/auth/register
Content-Type: application/json
X-CSRF-Token: …

{
  "fullName": "Ada Example",
  "email": "ada@example.com",
  "phone": "08031234567",
  "password": "Customer#2026",
  "confirmPassword": "Customer#2026",
  "referralCode": "ADA123",
  "acceptTerms": true
}
```

Password requirements: 10–128 characters, at least one lowercase, uppercase, digit, and symbol. Nigerian phone numbers are normalised to `+234…`. `referralCode` is optional.

```json
{
  "data": {
    "user": { "id": "…", "fullName": "Ada Example", "email": "ada@example.com", "phone": "+2348031234567", "role": "CUSTOMER", "status": "ACTIVE", "emailVerified": false, "twoFactorEnabled": false, "referralCode": "ADA123" },
    "verificationRequired": true
  }
}
```

Registration creates an account that can be used immediately.

#### Login

```http
POST /api/v1/auth/login
X-CSRF-Token: …

{ "email": "ada@example.com", "password": "Customer#2026" }
```

Success:

```json
{ "data": { "user": { "id": "…", "role": "CUSTOMER", "…": "…" } } }
```

If TOTP is enabled, the response is `{ "requiresTwoFactor": true, "challengeToken": "…" }`; no auth cookies are set until `POST /auth/2fa/login` succeeds with `{ challengeToken, code }`.

Five failed attempts lock the account for 15 minutes (`ACCOUNT_LOCKED`).

#### Current user

```http
GET /api/v1/auth/me
```

```json
{
  "data": {
    "id": "…",
    "fullName": "Ada Example",
    "email": "ada@example.com",
    "phone": "+2348031234567",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "referralCode": "ADA123",
    "wallet": { "id": "…", "balanceMinor": 100000, "currency": "NGN", "status": "ACTIVE" }
  }
}
```

---

## 3. Public catalogue and settings

These endpoints are public and cache-friendly. User-specific quotes are not stored.

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| `GET` | `/services` | — | Service cards plus the live/sandbox flag |
| `GET` | `/services/networks` | — | Airtime networks |
| `GET` | `/services/data-plans` | `network?` | Enabled data plans |
| `GET` | `/services/electricity-providers` | — | Discos and electricity fee |
| `GET` | `/services/cable-providers` | — | Cable networks |
| `GET` | `/services/cable-packages` | `network` (required) | Cable packages |
| `GET` | `/services/airtime-quote` | `network`, `amountMinor` | Discount/fee/payable quote |
| `POST` | `/services/validate-meter` | Auth + CSRF | Validate a meter before payment |
| `POST` | `/services/validate-smartcard` | Auth + CSRF | Validate a smartcard before payment |
| `GET` | `/services/public-settings` | — | Branding, support, maintenance, sandbox flags, enabled payment methods |
| `POST` | `/services/contact` | Public + CSRF | Contact form (rate limited) |

If a service's routed provider is not configured, or the service has not been certified for live purchases, `/services` reports that service with `enabled: false`. The electricity and cable catalogue endpoints then return empty `providers`/`packages` arrays rather than another provider's data, and the web client shows **Temporarily unavailable** instead of a purchase form. This is deliberate fail-closed behaviour: a disabled service never falls back to a different provider.

### Airtime quote example

```http
GET /api/v1/services/airtime-quote?network=MTN&amountMinor=10000
```

```json
{
  "data": {
    "network": "MTN",
    "faceValueMinor": 10000,
    "discountMinor": 200,
    "feeMinor": 0,
    "payableMinor": 9800
  }
}
```

The discount comes from the runtime `discounts` setting, not from a fixed hard-coded value. In live SME mode the quote returns `discountPercent: 0` and `discountMinor: 0` because the provider deducts the full face value; configured airtime discounts apply to sandbox/demo purchases only.

### Data plans

```http
GET /api/v1/services/data-plans?network=MTN
```

```json
{
  "data": [
    {
      "id": "66f1c2a4f3b9a81234567890",
      "providerPlanId": "1",
      "network": "MTN",
      "name": "110MB",
      "dataVolume": "110MB",
      "validity": "1 Day",
      "category": "GIFTING",
      "categoryLabel": "Gifting",
      "priceMinor": 11016,
      "isSandbox": false,
      "available": true
    }
  ]
}
```

`name` is the clean bundle name only. Plans are grouped by the provider's plan family in `category`/`categoryLabel`: `Standard`, `Corporate`, `Gifting`, `Coupon`, `Share`, or `Other`. The provider identity and raw provider family are not returned to customers. The provider's `SME` family is displayed as `Standard` to avoid exposing the provider name.

### Meter validation

```http
POST /api/v1/services/validate-meter
X-CSRF-Token: …

{ "disco": "IKEDC", "meterNumber": "1234567890", "meterType": "PREPAID" }
```

```json
{
  "data": {
    "valid": true,
    "customerName": "SANDBOX CUSTOMER (DEMO DATA)",
    "customerAddress": "Demo address — not a real utility customer",
    "meterType": "PREPAID",
    "isSandbox": true,
    "message": "Sandbox validation only — no utility was contacted."
  }
}
```

The client must receive `valid: true` before enabling the electricity payment button. The server repeats validation rules at purchase time. The demo customer fields above come from the mock VTU adapter; with the live SME adapter, names and addresses come from the provider and `isSandbox` is `false`.

### Public settings example

```json
{
  "data": {
    "branding": {
      "name": "SubPlug",
      "tagline": "Top up life, simply.",
      "primaryColor": "#0f766e",
      "supportEmail": "support@example.com",
      "supportPhone": "+2348000000000"
    },
    "support": {
      "email": "support@example.com",
      "phone": "+2348000000000",
      "whatsapp": "",
      "hours": "Mon–Sat, 8:00–20:00 WAT"
    },
    "maintenance": { "enabled": false, "message": "…" },
    "referralsEnabled": true,
    "environment": {
      "vtuSandbox": false,
      "paymentSandbox": true,
      "paymentGateway": "paystack",
      "paymentMethods": [
        { "key": "paystack", "name": "Paystack", "isSandbox": false },
        { "key": "flutterwave", "name": "Flutterwave", "isSandbox": true }
      ]
    }
  }
}
```

`paymentGateway` is the default method; `paymentMethods` lists the gateways customers may choose for a top-up (in display order). `vtuSandbox` and `paymentSandbox` are independent. A mixed environment (`vtuSandbox: false`, `paymentSandbox: true`) means test wallet funding can still trigger real VTU purchases; the UI must say so explicitly. Public settings intentionally exclude sensitive configuration, limits, pricing, discounts, and notification controls.

---

## 4. Wallet and funding

All wallet routes require an authenticated user. Funding creation requires a verified email and is blocked during maintenance.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/wallet` | Wallet projection, lifetime totals, recent activity |
| `GET` | `/wallet/ledger` | Paginated immutable ledger |
| `GET` | `/wallet/fundings` | Paginated funding attempts |
| `GET` | `/wallet/funding/:reference` | Single funding attempt |
| `POST` | `/wallet/fund` | Initialise funding (idempotent) |
| `POST` | `/wallet/funding/:reference/verify` | Re-verify with gateway |
| `POST` | `/wallet/funding/:reference/simulate` | Sandbox-only success/failure simulation |

### Wallet overview

```http
GET /api/v1/wallet
```

```json
{
  "data": {
    "wallet": { "id": "…", "balanceMinor": 100000, "currency": "NGN", "status": "ACTIVE", "updatedAt": "…" },
    "lifetimeCreditsMinor": 150000,
    "lifetimeDebitsMinor": 50000,
    "activity": [{ "date": "2026-10-20", "creditsMinor": 100000, "debitsMinor": 0 }]
  }
}
```

### Ledger

```http
GET /api/v1/wallet/ledger?page=1&limit=20&direction=DEBIT&type=PURCHASE_DEBIT
```

```json
{
  "data": {
    "entries": [
      {
        "id": "…",
        "type": "PURCHASE_DEBIT",
        "direction": "DEBIT",
        "amountMinor": 9800,
        "balanceAfterMinor": 90200,
        "currency": "NGN",
        "reference": "DR_…",
        "description": "MTN airtime of ₦100.00 to +2348031234567",
        "transaction": { "reference": "TXN_…", "service": "AIRTIME", "status": "SUCCESSFUL" },
        "fundingId": null,
        "createdAt": "…"
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 20, "pages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

`type` accepts: `FUNDING_CREDIT`, `PURCHASE_DEBIT`, `REFUND`, `ADJUSTMENT_CREDIT`, `ADJUSTMENT_DEBIT`, `REFERRAL_REWARD`, `REVERSAL`.

### Initialise funding

```http
POST /api/v1/wallet/fund
X-CSRF-Token: …
Idempotency-Key: fund-2026-10-20-001

{ "amountMinor": 100000, "gateway": "flutterwave" }
```

- `amountMinor` must be an integer within `limits.fundingMinMinor`…`fundingMaxMinor`.
- `gateway` is optional and must be one of the keys returned in `environment.paymentMethods`. Omit it to use the default gateway. An unavailable key returns `400 PAYMENT_GATEWAY_UNAVAILABLE`.
- `Idempotency-Key`: 8–100 characters, `[A-Za-z0-9_-]`.

```json
{
  "data": {
    "reference": "FUND_…",
    "amountMinor": 100000,
    "status": "PENDING",
    "authorizationUrl": "http://localhost:5173/mock-payment?reference=FUND_…",
    "gateway": "mock",
    "isSandbox": true,
    "duplicate": false
  }
}
```

Replaying the same key with the same amount and gateway returns the original funding with `duplicate: true` and does not create a new checkout. Reusing the key with a different amount or gateway returns `409 IDEMPOTENCY_MISMATCH`.

### Verify funding

```http
POST /api/v1/wallet/funding/FUND_…/verify
X-CSRF-Token: …
```

Asks the gateway stored on the funding record for the authoritative state. Credit is posted only when verification confirms success. This endpoint is idempotent when called repeatedly.

### Sandbox simulation

Only available for funding records created by a sandbox gateway.

```http
POST /api/v1/wallet/funding/FUND_…/simulate
X-CSRF-Token: …

{ "outcome": "success" }
```

`outcome` is `success` or `failed`. A success simulation credits the wallet through the standard confirmation path; a failed simulation marks the funding failed without crediting. This route is not a shortcut around verification.

### Payment webhooks

```http
POST /api/v1/webhooks/paystack
X-Paystack-Signature: <HMAC-SHA512 of raw body using PAYSTACK_SECRET_KEY>
```

```http
POST /api/v1/webhooks/flutterwave
verif-hash: <FLUTTERWAVE_WEBHOOK_SECRET_HASH>
```

The API:

1. Verifies the gateway signature against the raw request body.
2. Deduplicates the event in `PaymentEvent` (gateway + event ID).
3. Rejects an event whose gateway does not match the funding's original gateway.
4. Re-verifies the referenced funding with that gateway.
5. Credits the wallet idempotently.

Responses: `200` for accepted/duplicate/ignored events, `401 INVALID_SIGNATURE` for bad signatures. Webhook endpoints do not require CSRF.

> Configure Paystack to send `charge.success` to `https://api.example.com/api/v1/webhooks/paystack` and Flutterwave to send payments to `https://api.example.com/api/v1/webhooks/flutterwave` with the same secret hash as `FLUTTERWAVE_WEBHOOK_SECRET_HASH`. Do not place middleware that rewrites or re-serialises the raw body in front of either endpoint.

---

## 5. Purchases

All purchase routes require authentication, a verified email, and CSRF on `POST`. Wallet balance must cover `payableMinor`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/purchases` | Paginated transaction list |
| `GET` | `/purchases/summary` | Dashboard summary |
| `GET` | `/purchases/:reference` | Own transaction detail |
| `POST` | `/purchases/airtime` | Buy airtime |
| `POST` | `/purchases/data` | Buy a data bundle |
| `POST` | `/purchases/electricity` | Pay an electricity bill |
| `POST` | `/purchases/cable` | Pay a cable subscription |

### List filters

`page`, `limit`, `service` (`AIRTIME`/`DATA`/`ELECTRICITY`/`CABLE`), `status` (`CREATED`, `PENDING`, `PROCESSING`, `SUCCESSFUL`, `FAILED`, `REVERSED`, `REFUNDED`, `REQUIRES_REVIEW`), `search`, `from`, `to` (ISO datetimes).

### Airtime

```http
POST /api/v1/purchases/airtime
X-CSRF-Token: …
Idempotency-Key: airtime-2026-10-20-001

{ "network": "MTN", "phone": "08031234567", "amountMinor": 10000 }
```

### Data

```http
POST /api/v1/purchases/data
Idempotency-Key: data-2026-10-20-001

{ "network": "MTN", "phone": "08031234567", "providerPlanId": "MTN-1GB-30D" }
```

Use a `providerPlanId` returned by `GET /services/data-plans`. The plan's selling price is read server-side; the client cannot set the price.

### Electricity

```http
POST /api/v1/purchases/electricity
Idempotency-Key: power-2026-10-20-001

{ "disco": "IKEDC", "meterNumber": "1234567890", "meterType": "PREPAID", "amountMinor": 50000 }
```

The UI must validate the meter first. Successful prepaid purchases return a fulfillment token and units:

```json
{
  "data": {
    "reference": "TXN_…",
    "service": "ELECTRICITY",
    "status": "SUCCESSFUL",
    "amountMinor": 50000,
    "payableMinor": 50000,
    "feeMinor": 0,
    "discountMinor": 0,
    "fulfillment": {
      "token": "SANDBOX-…",
      "units": "0.0",
      "customerName": "SANDBOX CUSTOMER (DEMO DATA)"
    }
  }
}
```

Real tokens are delivered by the licensed provider. In the sandbox they always start with `SANDBOX-`.

### Cable

```http
POST /api/v1/purchases/cable
Idempotency-Key: cable-2026-10-20-001

{ "cableProvider": "DSTV", "smartcardNumber": "1234567890", "providerPlanId": "DSTV-COMPACT" }
```

Validate the smartcard first. Prices come from the enabled catalogue plan.

### Purchase response semantics

| `status` | Meaning | Wallet effect |
| --- | --- | --- |
| `SUCCESSFUL` | Provider confirmed delivery | Debit retained |
| `FAILED` | Definitive provider failure | Debit retained until refund completes |
| `REFUNDED` | Refund ledger entry posted | Debit reversed |
| `PENDING` | Provider has not finalised | Debit retained; scheduled reconciliation |
| `PROCESSING` | Submitted and awaiting outcome | Debit retained |
| `REQUIRES_REVIEW` | Ambiguous outcome or manual hold | Debit retained pending staff action |

Replays with the same key return the original transaction plus `"duplicate": true` and never debit twice. Purchases above `limits.manualReviewThresholdMinor` return `heldForReview: true` and are not sent to the provider until an administrator approves them.

### Dashboard summary

```http
GET /api/v1/purchases/summary
```

Returns counts and amounts derived from the caller's transactions, for example totals for successful, pending, and failed purchases, and the most recent transactions. It does not return invented sample data.

---

## 6. Support

Authenticated customers and staff can use these routes.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/support/tickets` | Open a ticket |
| `GET` | `/support/tickets` | List own tickets |
| `GET` | `/support/tickets/:id` | Read a ticket and messages |
| `POST` | `/support/tickets/:id/messages` | Add a customer message |

### Create ticket

```http
POST /api/v1/support/tickets
X-CSRF-Token: …

{
  "subject": "Airtime not delivered",
  "category": "TRANSACTION_DISPUTE",
  "message": "My MTN top-up has been pending for ten minutes. Please check it.",
  "transactionReference": "TXN_…"
}
```

Categories: `TRANSACTION_DISPUTE`, `WALLET`, `ACCOUNT`, `OTHER`. If a transaction reference is supplied it must belong to the caller. Disputes are created with `HIGH` priority.

Customers can read only their own tickets; staff access is controlled by admin routes.

---

## 7. Notifications and referrals

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/notifications` | Paginated notification inbox plus unread count |
| `POST` | `/notifications/:id/read` | Mark one notification read |
| `POST` | `/notifications/read-all` | Mark all read |
| `GET` | `/referrals` | Referral code, invite link, referred users, rewards |

Referral rewards are granted only after the referred customer completes a qualifying purchase. Reward amounts and qualification thresholds come from the `referrals` runtime setting.

---

## 8. Admin API

All admin routes require an authenticated `SUPPORT` or `ADMIN` user. Mutating and sensitive routes require `ADMIN`.

### Read-only operations

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/overview` | SUPPORT/ADMIN | Metrics for `days` (1–365) |
| `GET` | `/admin/users` | SUPPORT/ADMIN | Search/filter users |
| `GET` | `/admin/users/:id` | SUPPORT/ADMIN | User detail, wallet, transactions |
| `GET` | `/admin/transactions` | SUPPORT/ADMIN | Search/filter transactions |
| `GET` | `/admin/transactions/:reference` | SUPPORT/ADMIN | Transaction detail incl. provider data |
| `GET` | `/admin/fundings` | SUPPORT/ADMIN | Search/filter fundings |
| `GET` | `/admin/plans` | SUPPORT/ADMIN | Catalogue plans |
| `GET` | `/admin/providers` | SUPPORT/ADMIN | Provider records, health, routes, and switch options |
| `GET` | `/admin/support/tickets` | SUPPORT/ADMIN | Ticket queue |
| `GET` | `/admin/support/tickets/:id` | SUPPORT/ADMIN | Ticket detail |
| `POST` | `/admin/support/tickets/:id/reply` | SUPPORT/ADMIN | Reply and optionally change status |

Query filters:

- Users: `search`, `status`, `role`, pagination.
- Transactions: all customer filters plus `userId`, `provider`.
- Fundings: `status`, `search`, `userId`.
- Plans: `service`, `network`, `search`.
- Support: `status`, `search`.
- Overview: `days`.

### ADMIN-only operations

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `PATCH` | `/admin/users/:id/status` | `{ status, reason }` | Activate or suspend a user |
| `POST` | `/admin/wallet/adjust` | `{ userId, amountMinor, direction, reason, idempotencyKey }` | Post an audited credit/debit |
| `POST` | `/admin/transactions/:reference/approve` | — | Approve a held transaction and submit it |
| `POST` | `/admin/transactions/:reference/reject` | `{ reason }` | Reject and refund a held transaction |
| `POST` | `/admin/transactions/:reference/check-status` | — | Query the VTU provider |
| `POST` | `/admin/fundings/:reference/recheck` | — | Re-verify funding with the gateway |
| `POST` | `/admin/plans/sync` | — | Sync catalogue from the provider |
| `PATCH` | `/admin/plans/:id` | `{ enabled?, sellingPriceMinor?, name? }` | Update a plan |
| `GET` | `/admin/settings` | — | Read runtime settings |
| `PATCH` | `/admin/settings` | `{ key, value, confirm? }` | Update a runtime setting |
| `GET` | `/admin/audit-logs` | — | Audit trail with filters |
| `POST` | `/admin/providers/check` | — | Health-check configured providers |
| `POST` | `/admin/providers/routing` | `{ service, provider }` | Switch airtime/data route and sync the target catalogue |
| `GET` | `/admin/reconciliation` | — | Drift, backlog, and reconciliation summary |

#### Provider routing switch

```http
POST /api/v1/admin/providers/routing
X-CSRF-Token: …

{
  "service": "DATA",
  "provider": "maskawasub"
}
```

`service` is `AIRTIME` or `DATA`; `provider` is `sme` or `maskawasub`. The server:

1. verifies the target adapter is configured;
2. performs a read-only catalogue preflight against the target;
3. persists the route in the `providerRouting` setting and updates the in-process route;
4. for data, synchronizes the target catalogue and disables plans belonging to the previous provider;
5. returns the new route and `purchasable` state.

If the preflight or sync fails, the previous route is restored and the endpoint returns `503`. Airtime needs no catalogue sync because its network list comes from the adapter.

The response also reports `purchasable`. If MaskawaSub has not passed live certification for the selected service, the switch is still allowed for catalogue staging, but the storefront hides that service and purchases fail closed before any debit. Cable and electricity are fixed to MaskawaSub and cannot be switched through this endpoint. Education/exam PINs, airtime-to-cash, and recharge-card PINs are not implemented yet.

#### Wallet adjustment

```http
POST /api/v1/admin/wallet/adjust
X-CSRF-Token: …

{
  "userId": "…",
  "amountMinor": 50000,
  "direction": "CREDIT",
  "reason": "Goodwill credit approved by support lead",
  "idempotencyKey": "adj-2026-10-20-001"
}
```

Reasons are mandatory (10–300 characters). The adjustment is posted to the ledger, attributed to the admin, and written to the audit log. A debit cannot take a wallet below zero; if it would, the API returns `402 INSUFFICIENT_BALANCE`.

#### Reject a held transaction

```http
POST /api/v1/admin/transactions/TXN_…/reject
X-CSRF-Token: …

{ "reason": "Provider rejected the meter number after manual verification" }
```

The transaction is moved to `FAILED` and then `REFUNDED`; the wallet credit is posted with a unique refund key, so a retry cannot double-refund.

#### Update settings

```http
PATCH /api/v1/admin/settings
X-CSRF-Token: …

{ "key": "limits", "value": { "fundingMinMinor": 10000, "fundingMaxMinor": 100000000, "…": "…" } }
```

Unknown setting keys are rejected with `INVALID_SETTING_KEY`. Values are merged into the existing setting document and audited; operators must keep the documented value shapes. Enabling maintenance mode requires `confirm: "ENABLE MAINTENANCE"` and creates a dedicated audit event.

---

## 9. Health and diagnostics

These routes are outside `/api/v1`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness plus database status (`200`/`503`) |
| `GET` | `/health/live` | Process liveness |
| `GET` | `/health/ready` | Readiness, transaction support, active VTU adapter |

```json
{
  "data": {
    "status": "ok",
    "database": "connected",
    "uptimeSeconds": 42,
    "timestamp": "2026-10-20T12:00:00.000Z",
    "version": "1.0.0"
  }
}
```

Readiness example:

```json
{
  "data": {
    "ready": true,
    "mongoTransactions": true,
    "provider": "http"
  }
}
```

Health endpoints do not require authentication and should be reachable only by your load balancer/monitoring system.

---

## 10. Idempotency and retry guidance

| Operation | Header | Replay result |
| --- | --- | --- |
| Create funding | `Idempotency-Key` required | Original funding, `duplicate: true` |
| Any purchase | `Idempotency-Key` required | Original transaction, `duplicate: true` |
| Admin adjustment | `idempotencyKey` in body | Original ledger entry |
| Funding verification | None; idempotent by funding state | `alreadyProcessed` where applicable |
| Webhook | Provider event ID | Duplicate ignored/acknowledged |

Client retry rules:

- Safe to retry: `GET`, `POST /auth/refresh` (with current cookie), funding verification, notifications read.
- Retry only with the **same** idempotency key: funding creation and purchases after a timeout.
- Never generate a new key merely because a request timed out; doing so can create a second purchase.
- Do not retry an ambiguous purchase by changing the phone number or plan.

---

## 11. Error codes

| Code | Typical status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod or Mongoose validation failed |
| `INVALID_PHONE` | 400 | Phone could not be normalised to a Nigerian number |
| `EMAIL_TAKEN` / `PHONE_TAKEN` | 409 | Account already exists |
| `INVALID_REFERRAL_CODE` / `SELF_REFERRAL` | 400 | Referral problem |
| `UNAUTHENTICATED` | 401 | No access token |
| `SESSION_EXPIRED` | 401 | Access token expired or invalid |
| `INVALID_SESSION` | 401 | Refresh token not found |
| `ACCOUNT_SUSPENDED` / `ACCOUNT_INACTIVE` | 403 | Account cannot transact |
| `CSRF_VALIDATION_FAILED` | 403 | Missing or mismatched CSRF token |
| `FORBIDDEN` | 403 | Role or ownership denial |
| `INSUFFICIENT_BALANCE` | 402 | Wallet cannot cover the debit |
| `WALLET_FROZEN` | 403 | Wallet is not active |
| `IDEMPOTENCY_MISMATCH` | 409 | Key reused with different details |
| `AMOUNT_OUT_OF_RANGE` | 400 | Outside configured limits |
| `PAYMENT_GATEWAY_UNAVAILABLE` | 400/503 | Requested funding method is disabled or not configured |
| `PLAN_NOT_FOUND` / `PLAN_NETWORK_MISMATCH` | 404/400 | Invalid catalogue selection |
| `EMAIL_NOT_VERIFIED` | 403 | Purchase/funding attempted before verification |
| `MAINTENANCE_MODE` | 503 | Maintenance guard active |
| `INVALID_STATE_TRANSITION` / `STATE_RACE` | 409 | Concurrent or illegal status change |
| `TICKET_CLOSED` | 409 | Cannot message a closed ticket |
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_SIGNATURE` | 401 | Webhook signature/hash verification failed |
| `VTU_MOCK_DISABLED` / sandbox errors | 503/403 | Mock adapters blocked in production |

Error messages are user-safe. Do not display raw provider responses to customers; provider payloads are retained for staff reconciliation and redacted in logs.
