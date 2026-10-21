# Environment and Configuration

SubPlug reads API configuration from `server/.env` (or real process environment variables) and validates it with Zod at boot. Missing or malformed values stop the process with a message that names the invalid variable; secret values are not printed.

The web client reads `VITE_*` variables at **build time** from `client/.env` or the shell.

> Keep `server/.env` and `client/.env` out of version control. `.gitignore` excludes them. A `.env.example` file is safe to commit only when it contains placeholders, never real credentials or connection strings.

---

## 1. Files

| File | Purpose |
| --- | --- |
| `server/.env.example` | Documented API template |
| `server/.env` | Local API configuration (ignored) |
| `client/.env.example` | Web client template |
| `client/.env` | Local web configuration (ignored) |

Create local files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

---

## 2. Required API variables

These have no safe production default and must be set deliberately.

| Variable | Example | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/subplug` | Use a replica set URI in production, e.g. Atlas `mongodb+srv://…` |
| `JWT_ACCESS_SECRET` | 96 hex characters | At least 32 characters. Generate randomly and keep secret |
| `ADMIN_EMAIL` | `owner@example.com` | Used only by the seed script |
| `ADMIN_PASSWORD` | strong unique password | At least 12 characters with upper, lower, digit, symbol |

Generate a signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The seed refuses weak administrator passwords and refuses to promote an existing non-admin account with the same email. Re-running the seed does not reset an existing administrator's password.

---

## 3. Complete API reference

### Runtime and network

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `4000` | API listen port |
| `API_BASE_URL` | `http://localhost:4000` | Public API origin, used for production cookie checks |
| `CLIENT_URL` | `http://localhost:5173` | Web origin used for CORS, email links, and checkout redirects |
| `ADDITIONAL_CORS_ORIGINS` | empty | Comma-separated extra browser origins |
| `TRUST_PROXY` | `1` | Express trust proxy setting. `false`/`0` when directly exposed; a hop count or `true` behind a trusted proxy |

`CLIENT_URL` and `API_BASE_URL` must be absolute URLs. `ADDITIONAL_CORS_ORIGINS` entries must exactly match the browser origin, including scheme and port, with no trailing slash.

### Database

| Variable | Default | Description |
| --- | --- | --- |
| `MONGODB_URI` | none | MongoDB connection string. Include the database name |
| `REQUIRE_REPLICA_SET` | `true` | In production, refuse to boot on a standalone server because wallet writes would not be atomic |

Production requires a replica set. A single-node replica set is acceptable for a small single-server deployment; MongoDB Atlas provides one by default.

### Authentication and cookies

| Variable | Default | Description |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | none | HMAC secret for access and 2FA challenge tokens |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh session lifetime |
| `COOKIE_DOMAIN` | empty | Optional parent domain, e.g. `.example.com`. Leave empty for host-only cookies |
| `COOKIE_SAME_SITE` | `lax` | `lax`, `strict`, or `none` |
| `TRUST_PROXY` | `1` | See above; required for correct secure-cookie and client-IP handling behind a proxy |

`COOKIE_SAME_SITE=none` requires HTTPS. Use it only when the web app and API are on different sites (for example `app.example.com` and `api.example.com` are same-site, so `lax` is usually sufficient; entirely different registrable domains require `none`).

The access and refresh cookies are HTTP-only. The CSRF cookie is intentionally readable by JavaScript.

### Administrator seed

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_EMAIL` | none | Administrator email |
| `ADMIN_PASSWORD` | none | Initial password; never reset by re-seeding |
| `ADMIN_NAME` | `Platform Administrator` | Display name |
| `ADMIN_PHONE` | `08000000000` | Normalised Nigerian phone number |

### Payment gateway

| Variable | Default | Description |
| --- | --- | --- |
| `PAYMENT_GATEWAY` | `mock` | `mock` or `paystack` |
| `PAYSTACK_SECRET_KEY` | empty | Paystack secret key (server only) |
| `PAYSTACK_PUBLIC_KEY` | empty | Reserved for client-side checkout; not required by the current API flow |
| `PAYSTACK_BASE_URL` | `https://api.paystack.co` | Gateway API base URL |
| `ALLOW_MOCK_PAYMENTS` | `true` | Allows the sandbox simulation path in non-production. Production simulation is always blocked |
| `PAYMENT_CURRENCY` | `NGN` | Must match the gateway and ledger currency |
| `ALLOW_SANDBOX_IN_PRODUCTION` | `false` | Emergency override that permits mock payment/VTU providers in production. Leave false |

In production with `PAYMENT_GATEWAY=mock`, boot fails unless `ALLOW_SANDBOX_IN_PRODUCTION=true`. Never enable that override for a live service. Do not migrate a development database containing mock-funded wallets into production: those credits are real ledger entries and can be spent on live VTU purchases.

### VTU provider

| Variable | Default | Description |
| --- | --- | --- |
| `VTU_PROVIDER` | `mock` | Primary provider: `mock`, `sme`, or `maskawasub` |
| `VTU_BACKUP_PROVIDER` | empty | Optional secondary provider used for catalogue/health checks. Purchases are never retried automatically after submission |
| `ALLOW_MOCK_VTU` | `true` | Documents intent; mock providers are blocked in production unless the global sandbox override is set |
| `VTU_API_BASE_URL` | empty | SME API origin, normally `https://smeapi.com.ng` |
| `VTU_API_KEY` | empty | SME API key. Server-side only; send as `Authorization: Token <key>` |
| `VTU_TIMEOUT_MS` | `15000` | Outbound request timeout for VTU calls |
| `VTU_CATALOGUE_FILE` | empty | Optional JSON file with SME cable/electricity numeric IDs enabled on the account |
| `CATALOGUE_SYNC_INTERVAL_MS` | `900000` | Background catalogue refresh interval, minimum 60 seconds |
| `VTU_AIRTIME_PROVIDER` | empty | Initial airtime route. Empty means `VTU_PROVIDER`; an admin can switch it at runtime |
| `VTU_DATA_PROVIDER` | empty | Initial data route. Empty means `VTU_PROVIDER`; an admin can switch it at runtime |
| `VTU_CABLE_PROVIDER` | `maskawasub` | Legacy value. Cable is fixed to MaskawaSub in the provider resolver |
| `VTU_ELECTRICITY_PROVIDER` | `maskawasub` | Legacy value. Electricity is fixed to MaskawaSub in the provider resolver |
| `VTU_EDUCATION_PROVIDER` | empty | Reserved for education/exam PINs; when implemented they must be MaskawaSub-only |
| `VTU_AIRTIME_TO_CASH_PROVIDER` | empty | Reserved; when implemented it must be MaskawaSub-only |
| `VTU_RECHARGE_CARD_PROVIDER` | empty | Reserved; when implemented it must be MaskawaSub-only |

Airtime and data can be switched between `sme` and `maskawasub` from **Admin → Providers**. The selected routes are stored in the `providerRouting` system setting and override the environment values after the next request; a restart is not required. The switch endpoint validates the target adapter, performs a read-only catalogue preflight, and synchronizes data plans from the selected provider. It never retries a submitted order. Cable and electricity are always MaskawaSub; there is no SME fallback.

`VTU_BACKUP_PROVIDER` keeps an adapter available for health/catalogue checks. It is not a failover mechanism.

The `sme` adapter uses these documented endpoints:

| Operation | Endpoint |
| --- | --- |
| Account and provider balance | `GET /api/user/` |
| Data plans | `GET /api/dataplans/` |
| Airtime purchase | `POST /api/airtime/` |
| Data purchase | `POST /api/data/` |
| Cable validation | `POST /api/cabletv/verify/` |
| Cable purchase | `POST /api/cabletv/` |
| Electricity validation | `POST /api/electricity/verify/` |
| Electricity purchase | `POST /api/electricity/` |
| Transaction status | `POST /api/status/` |

Airtime and data require only `VTU_API_BASE_URL` and `VTU_API_KEY`. The live adapter currently offers MTN, Glo, and Airtel; 9mobile is disabled until its numeric network ID is confirmed with the provider.

The SME adapter still contains optional cable/electricity catalogue support, but the provider resolver routes both services to MaskawaSub. The `VTU_CATALOGUE_FILE` example below is therefore not used for customer cable/electricity purchases in this deployment. Copy `server/config/vtu-catalogue.example.json` to a private file only if you are maintaining that adapter path directly:

```json
{
  "cableProviders": [{ "code": "DSTV", "name": "DStv", "providerId": "123" }],
  "cablePackages": [
    {
      "providerPlanId": "456",
      "network": "DSTV",
      "name": "DStv Compact",
      "validity": "1 month",
      "costNaira": 19000
    }
  ],
  "electricityProviders": [{ "code": "IKEDC", "name": "Ikeja Electric", "providerId": "789" }]
}
```

Do not guess these values. Then set `VTU_CATALOGUE_FILE=server/config/vtu-catalogue.json` (relative to the server process working directory) and run `npm run seed`.

In production with `VTU_PROVIDER=mock`, boot fails unless `ALLOW_SANDBOX_IN_PRODUCTION=true`. The SME adapter requires `VTU_API_BASE_URL` and `VTU_API_KEY`; the MaskawaSub adapter requires `MASKAWASUB_API_BASE_URL` and `MASKAWASUB_API_KEY`.

#### MaskawaSub (secondary provider)

| Variable | Default | Description |
| --- | --- | --- |
| `MASKAWASUB_API_BASE_URL` | `https://maskawasub.com` | MaskawaSub origin |
| `MASKAWASUB_API_KEY` | empty | MaskawaSub API key. Server-side only; send as `Authorization: Token <key>` |
| `MASKAWASUB_LIVE_PURCHASES` | `false` | Global live-purchase gate. Must remain false until a funded purchase/status certification has been signed off |
| `MASKAWASUB_CERTIFIED_SERVICES` | empty | Comma-separated per-service allowlist (for example `CABLE`). Empty means no service may purchase, even if the global gate is open |

MaskawaSub catalogue reads use `GET /api/user/` (data plans, cable packages, balance), `GET /api/disco/` (electricity providers), and the account snapshot's `Cableplan`/`Exam`/`recharge` sections. The adapter deliberately does **not** call `/api/history/` or `/api/sms/`: during read-only probing those endpoints returned account-wide records that could contain third-party personal data.

Live purchase, validation and status request contracts for MaskawaSub were not certified against a funded transaction in this repository. `MASKAWASUB_LIVE_PURCHASES=false` makes the adapter fail closed before any wallet debit. Even when the global gate is open, a service must also appear in `MASKAWASUB_CERTIFIED_SERVICES`; an empty or mistyped allowlist therefore disables every live purchase. Certify one service at a time and add only that service to the allowlist. Do not add education/airtime-to-cash/recharge-card routes until the provider confirms the request fields and per-reference status query. Airtime-to-cash additionally needs a defined settlement/refund policy because it is not an instant wallet purchase.

Per-service routing selects a provider before the wallet is touched. It is not a retry mechanism: after a request has been submitted, an uncertain outcome remains `REQUIRES_REVIEW` and is reconciled against the *original* provider.

### Redis and background workers

| Variable | Default | Description |
| --- | --- | --- |
| `USE_QUEUES` | `false` | Use BullMQ/Redis for reconciliation and catalogue sync |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection string |
| `RECONCILE_INTERVAL_MS` | `300000` | Reconciliation interval, minimum 30 seconds |
| `CATALOGUE_SYNC_INTERVAL_MS` | `900000` | Live VTU catalogue refresh interval, minimum 60 seconds |

Set `USE_QUEUES=true` when running more than one API instance. Without it, each API process starts its own in-process timers and reconciliation/catalogue-sync work may duplicate (the underlying operations remain idempotent, but duplicate provider queries and jobs are undesirable).

The catalogue refresh keeps live data-plan prices and availability current. A failed or empty provider response is logged and leaves the last known-good catalogue in place.

### Email

| Variable | Default | Description |
| --- | --- | --- |
| `EMAIL_FROM` | `SubPlug <no-reply@example.com>` | Sender header |
| `EMAIL_HOST` | empty | SMTP host. When empty, email is skipped |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_SECURE` | `false` | `true` for implicit TLS (usually port 465) |
| `EMAIL_USER` | empty | SMTP username |
| `EMAIL_PASSWORD` | empty | SMTP password |
| `EXPOSE_DEV_EMAILS` | `false` | Development only: return verification/reset URLs in API responses |

Without SMTP, the API logs password-reset email previews in development and logs an error in production. Never enable `EXPOSE_DEV_EMAILS` in production.

### Security and operations

| Variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Global rate-limit window |
| `RATE_LIMIT_MAX` | `300` | Global requests per window |
| `AUTH_RATE_LIMIT_MAX` | `20` | Failed auth attempts per 15-minute window |
| `TRANSACTION_EMAIL_ALERTS` | `true` | Send purchase/funding receipts when SMTP is configured |
| `METRICS_TOKEN` | empty | Reserved for a future metrics endpoint; currently unused |

Rate limits use the Express `trust proxy` configuration. If `TRUST_PROXY` is wrong, clients may share a proxy IP and be limited together, or spoofed IP headers may be trusted.

---

## 4. Client variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | empty | API origin, e.g. `https://api.example.com`. Empty means same-origin `/api` (development proxy) |
| `VITE_APP_NAME` | `SubPlug` | Display name used by the client |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Development-only proxy target for Vite (from `client/.env` or the shell) |

`VITE_API_URL` is embedded in the built JavaScript. Changing it requires a rebuild. It is not a secret.

For a same-origin production deployment, put the SPA and API behind one domain and leave `VITE_API_URL` empty; serve `/api` through the reverse proxy. For a split deployment, set `VITE_API_URL` to the API origin and configure cookies/CORS accordingly.

---

## 5. Local MongoDB options

### Standalone (development only)

The default `MONGODB_URI=mongodb://127.0.0.1:27017/subplug` works with a local standalone server. The API logs a warning that transactions are unavailable and uses the in-process serialized fallback. This is acceptable for local development and tests, not production.

### Single-node replica set with Docker

```bash
docker run --name subplug-mongo \
  -p 27017:27017 \
  -d mongo:7 \
  --replSet rs0 \
  --bind_ip_all

docker exec -it subplug-mongo mongosh --eval \
  "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

Use:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/subplug?replicaSet=rs0
```

Verify:

```bash
docker exec -it subplug-mongo mongosh --eval "rs.status().ok"
```

### Native MongoDB

Start `mongod` with `--replSet rs0`, then run `rs.initiate()` once in `mongosh`. Exact service configuration depends on your operating system.

### MongoDB Atlas

Create a cluster, a database user, and a network access rule. Use the SRV URI with the target database name. Atlas clusters are replica sets, so transactions and `REQUIRE_REPLICA_SET=true` work.

---

## 6. Redis (optional)

For a single API instance, leave `USE_QUEUES=false`. For multiple instances:

```dotenv
USE_QUEUES=true
REDIS_URL=redis://user:password@redis-host:6379
```

Use TLS (`rediss://`) when Redis is reached over an untrusted network. The application falls back to in-process timers and logs an error if BullMQ cannot connect, so a Redis outage does not stop purchases; however, reconciliation may be delayed.

---

## 7. Environment validation rules

At boot, the API checks:

- Required strings are present and URLs are valid.
- Integers are non-negative (and above required minimums).
- `NODE_ENV` is one of the supported values.
- `JWT_ACCESS_SECRET` is at least 32 characters.
- In production:
  - `JWT_ACCESS_SECRET` is not the example placeholder.
  - A mock payment gateway or mock VTU provider is rejected unless `ALLOW_SANDBOX_IN_PRODUCTION=true`.
  - `COOKIE_SAME_SITE=none` requires an HTTPS `API_BASE_URL`.
- On database connect:
  - Production with `REQUIRE_REPLICA_SET=true` refuses a standalone server.

The client has no runtime environment validation; invalid `VITE_API_URL` produces network errors in the browser.

---

## 8. Configuration change matrix

| Change | Restart required? | Notes |
| --- | --- | --- |
| API `.env` values | Yes | Process reads them at boot |
| Client `VITE_*` values | Rebuild + deploy | Values are compiled into assets |
| Runtime settings (branding, limits, pricing, maintenance) | No | Updated via admin UI/API; cached up to 15 seconds |
| Catalogue plans | No | Seed/sync or admin plan updates |
| Redis/queue mode | Yes | Scheduler is initialised at boot |
| JWT secret | Yes | Invalidates all existing access tokens; refresh sessions remain in the database but issued access tokens stop verifying |

---

## 9. Secret handling

- Use a secret manager in production (hosting platform secrets, AWS Secrets Manager, Azure Key Vault, etc.), not a committed file.
- Give each environment a distinct JWT secret and distinct payment/provider credentials.
- Restrict MongoDB and Redis network access to the API.
- Never put Paystack or VTU secrets in `VITE_*` variables; those are shipped to browsers.
- Rotate credentials after any suspected exposure and review the audit log for unusual administrative actions.
- Back up secrets separately from database backups, under access control.
