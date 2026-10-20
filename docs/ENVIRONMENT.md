# Environment and Configuration

QuickTopUp reads API configuration from `server/.env` (or real process environment variables) and validates it with Zod at boot. Missing or malformed values stop the process with a message that names the invalid variable; secret values are not printed.

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
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/quicktopup` | Use a replica set URI in production, e.g. Atlas `mongodb+srv://…` |
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

In production with `PAYMENT_GATEWAY=mock`, boot fails unless `ALLOW_SANDBOX_IN_PRODUCTION=true`. Never enable that override for a live service.

### VTU provider

| Variable | Default | Description |
| --- | --- | --- |
| `VTU_PROVIDER` | `mock` | `mock` or `http` |
| `ALLOW_MOCK_VTU` | `true` | Documents intent; mock providers are blocked in production by the provider guard unless the global sandbox override is set |
| `VTU_API_BASE_URL` | empty | Licensed provider API origin |
| `VTU_API_KEY` | empty | Provider API key |
| `VTU_API_SECRET` | empty | Provider API secret |
| `VTU_TIMEOUT_MS` | `15000` | Outbound request timeout |
| `VTU_PATH_NETWORKS` | empty | Path for network list |
| `VTU_PATH_DATA_PLANS` | empty | Path for data plans |
| `VTU_PATH_ELECTRICITY_PROVIDERS` | empty | Path for discos |
| `VTU_PATH_CABLE_PROVIDERS` | empty | Path for cable networks |
| `VTU_PATH_VALIDATE_METER` | empty | Path for meter validation |
| `VTU_PATH_VALIDATE_SMARTCARD` | empty | Path for smartcard validation |
| `VTU_PATH_AIRTIME` | empty | Path for airtime purchase |
| `VTU_PATH_DATA` | empty | Path for data purchase |
| `VTU_PATH_ELECTRICITY` | empty | Path for electricity payment |
| `VTU_PATH_CABLE` | empty | Path for cable payment |
| `VTU_PATH_STATUS` | empty | Path for status query |

The HTTP adapter is a **template**. Complete the request/response mapping in `server/src/providers/httpVtuProvider.ts` against your provider's contract, then test every service in sandbox before going live.

In production with `VTU_PROVIDER=mock`, boot fails unless `ALLOW_SANDBOX_IN_PRODUCTION=true`.

### Redis and background workers

| Variable | Default | Description |
| --- | --- | --- |
| `USE_QUEUES` | `false` | Use BullMQ/Redis for reconciliation |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection string |
| `RECONCILE_INTERVAL_MS` | `300000` | Reconciliation interval, minimum 30 seconds |

Set `USE_QUEUES=true` when running more than one API instance. Without it, each API process starts its own in-process timers and reconciliation work may duplicate (the underlying operations remain idempotent, but duplicate provider queries and jobs are undesirable).

### Email

| Variable | Default | Description |
| --- | --- | --- |
| `EMAIL_FROM` | `QuickTopUp <no-reply@example.com>` | Sender header |
| `EMAIL_HOST` | empty | SMTP host. When empty, email is skipped |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_SECURE` | `false` | `true` for implicit TLS (usually port 465) |
| `EMAIL_USER` | empty | SMTP username |
| `EMAIL_PASSWORD` | empty | SMTP password |
| `EXPOSE_DEV_EMAILS` | `false` | Development only: return verification/reset URLs in API responses |
| `AUTO_VERIFY_EMAILS` | `false` | Development only: mark new accounts verified automatically |

Without SMTP, the API logs email previews in development and logs an error in production; financial workflows continue. Never enable `EXPOSE_DEV_EMAILS` or `AUTO_VERIFY_EMAILS` in production.

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
| `VITE_APP_NAME` | `QuickTopUp` | Display name used by the client |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Development-only proxy target for Vite (from `client/.env` or the shell) |

`VITE_API_URL` is embedded in the built JavaScript. Changing it requires a rebuild. It is not a secret.

For a same-origin production deployment, put the SPA and API behind one domain and leave `VITE_API_URL` empty; serve `/api` through the reverse proxy. For a split deployment, set `VITE_API_URL` to the API origin and configure cookies/CORS accordingly.

---

## 5. Local MongoDB options

### Standalone (development only)

The default `MONGODB_URI=mongodb://127.0.0.1:27017/quicktopup` works with a local standalone server. The API logs a warning that transactions are unavailable and uses the in-process serialized fallback. This is acceptable for local development and tests, not production.

### Single-node replica set with Docker

```bash
docker run --name quicktopup-mongo \
  -p 27017:27017 \
  -d mongo:7 \
  --replSet rs0 \
  --bind_ip_all

docker exec -it quicktopup-mongo mongosh --eval \
  "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

Use:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/quicktopup?replicaSet=rs0
```

Verify:

```bash
docker exec -it quicktopup-mongo mongosh --eval "rs.status().ok"
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
