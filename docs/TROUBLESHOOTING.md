# Troubleshooting

Start with the health endpoints and the API log. Most failures fall into environment configuration, MongoDB transactions, cookies/CSRF, provider behaviour, or a stale build.

```bash
curl -s http://localhost:4000/health
curl -s http://localhost:4000/health/ready
```

```json
{"status":"ok","database":"connected"}
```

If the API is not running, fix that first. The web app cannot compensate for an unavailable API.

---

## 1. The API will not start

### Environment validation error

Symptom: the process exits immediately with `Invalid environment configuration: …`.

Cause: a missing or malformed variable in `server/.env`.

Fix:

1. Compare `server/.env` with `server/.env.example`.
2. Check that `MONGODB_URI`, `JWT_ACCESS_SECRET` (32+ characters), and URLs are present.
3. Do not quote values unless the quotes are intended.
4. Restart the process; environment values are read at boot.

### MongoDB connection timeout

Symptom: `MongooseServerSelectionError`, `ECONNREFUSED`, or a 10-second delay followed by a database error.

Check:

```bash
# Is MongoDB listening?
# Linux/macOS
lsof -iTCP:27017 -sTCP:LISTEN

# Windows PowerShell
Get-NetTCPConnection -LocalPort 27017 -State Listen
```

Verify the URI with `mongosh`:

```bash
mongosh "mongodb://127.0.0.1:27017/subplug" --eval "db.runCommand({ ping: 1 })"
```

For Atlas:

- confirm the cluster is running;
- confirm the database user and password;
- confirm the API host's IP is allowed in Network Access;
- URL-encode special characters in the password;
- ensure the URI includes a database name.

### Production refuses to start on a standalone database

Symptom:

```text
MongoDB is running as a standalone server. Multi-document transactions are unavailable…
```

Cause: `REQUIRE_REPLICA_SET=true` and `NODE_ENV=production`, but MongoDB is standalone.

Fix: use a replica set (Atlas, or initiate a single-node replica set). Do not set `REQUIRE_REPLICA_SET=false` in production unless you have explicitly accepted the risk; wallet atomicity is not guaranteed.

### Mock provider blocked in production

Symptom: `Mock payments are not allowed in production` or `Mock VTU provider is not allowed in production`.

Fix: set `PAYMENT_GATEWAY=paystack` and `VTU_PROVIDER=sme` with valid credentials. Do not set `ALLOW_SANDBOX_IN_PRODUCTION=true` for a live service.

### SME API says `VTU_NOT_CONFIGURED` or startup fails

Set both `VTU_API_BASE_URL=https://smeapi.com.ng` and a valid `VTU_API_KEY` in `server/.env`, then restart the API. The key must stay server-side. Do not put it in a `VITE_*` variable.

### SME catalogue sync fails

- Check the provider health card in Admin → Providers.
- Confirm `/api/user/` returns `status: "success"` and a numeric balance.
- Confirm `/api/dataplans/` returns a non-empty `data` array. A failed or empty response leaves the previous catalogue unchanged.
- Confirm MongoDB is reachable; a connection reset during bulk upsert can abort the sync.
- Re-run `npm run seed` after fixing connectivity.
- Remember that provider prices can change; the scheduled sync runs every `CATALOGUE_SYNC_INTERVAL_MS`.

### Cable or electricity is disabled

Expected until confirmed numeric provider/plan IDs are configured. Add them to `VTU_CATALOGUE_FILE` as described in [ENVIRONMENT.md](ENVIRONMENT.md#vtu-provider), restart the API, and run `npm run seed`. Do not guess IDs; a wrong ID can misdirect a real transaction.

### A live SME purchase is stuck in `REQUIRES_REVIEW`

Do not retry it. Check the provider dashboard and query status from the admin transaction page. If the provider has no record, treat it as a reconciliation incident; if it was delivered, resolve manually with an audited action.

### Port already in use

Symptom: `EADDRINUSE`.

Find and stop the old process:

```powershell
# Windows
Get-NetTCPConnection -LocalPort 4000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID>
```

```bash
# Linux/macOS
lsof -iTCP:4000 -sTCP:LISTEN
kill <PID>
```

Or change `PORT` and update the Vite proxy/API URL.

### `tsx watch` appears to hang on Windows

The development server can take several seconds to compile and connect. If there is no output after 20–30 seconds:

1. Confirm MongoDB is running.
2. Confirm no other process owns port 4000.
3. Run the server directly to see errors:

```bash
npx tsx server/src/server.ts
```

4. Check the terminal was started from the repository root or the correct workspace.

---

## 2. The web app loads but API calls fail

### Vite proxy connection refused

Symptom in the browser: `500` or network error on `/api/v1/...`; Vite terminal shows `http proxy error: ECONNREFUSED`.

Cause: the API is not running on the proxy target.

Fix:

1. Start the API: `npm run dev -w server`.
2. Confirm `http://localhost:4000/health`.
3. Confirm `client/vite.config.ts` targets `http://localhost:4000` or the value in `VITE_API_PROXY_TARGET`.
4. Restart Vite after changing proxy configuration.

### Production client calls the wrong API origin

Symptom: requests go to the static host's `/api` and return the SPA HTML or 404.

Cause: `VITE_API_URL` was not set at build time, or the static host has no `/api` proxy.

Fix:

- For same-origin deployment, configure the reverse proxy to forward `/api/` to the API.
- For split deployment, rebuild with `VITE_API_URL=https://api.example.com` and redeploy. Vite variables are compile-time.

### CORS error

Symptom: browser blocks the response; API logs `CORS_ORIGIN_DENIED`.

Fix:

1. Add the exact browser origin to `CLIENT_URL` or `ADDITIONAL_CORS_ORIGINS`.
2. Include scheme and port, e.g. `https://app.example.com`, not `app.example.com/`.
3. Restart the API.
4. Do not use `*` with credentials.

---

## 3. Login and cookies

### `401 UNAUTHENTICATED` immediately after login

Possible causes:

- Cookies are blocked (third-party cookie policy, incognito settings, browser extensions).
- The API and client are on different sites and `COOKIE_SAME_SITE` is `lax`.
- `COOKIE_DOMAIN` does not match the API host.
- The frontend uses `http://` but cookies are marked `Secure` because `NODE_ENV=production`.
- A proxy strips `Set-Cookie`.

Check the browser devtools Network tab:

- login response should include `Set-Cookie` for `qt_access`, `qt_refresh`, `qt_csrf`;
- subsequent requests should send them;
- cookie `Domain`, `Path`, `SameSite`, and `Secure` must match the deployment.

Fix matrix:

| Deployment | Cookie setting |
| --- | --- |
| Same origin | `COOKIE_DOMAIN` empty, `COOKIE_SAME_SITE=lax` |
| Subdomains of one site | `COOKIE_DOMAIN=.example.com`, `COOKIE_SAME_SITE=lax` |
| Different sites | `COOKIE_SAME_SITE=none`, HTTPS, likely empty `COOKIE_DOMAIN` |

After changing cookie settings, sign out/in and clear old cookies.

### `403 CSRF_VALIDATION_FAILED`

The `X-CSRF-Token` header does not match the `qt_csrf` cookie.

Fixes:

1. Call `GET /api/v1/auth/csrf` first and keep the cookie.
2. Ensure the SPA sends `withCredentials: true` (the bundled client does).
3. Confirm a proxy is not stripping the `X-CSRF-Token` header or rewriting cookies.
4. If the cookie expired, fetch a new token and retry. The bundled client does this once automatically.
5. After login/logout, reset the cached CSRF token if you are writing a custom client.

### Refresh loop / session expired message

- Access token expired; the client attempts one refresh. If refresh fails, it emits a session-expired event and stops.
- Reuse of an old refresh token revokes the session family. This is expected theft detection. Sign in again.
- Changing a password or disabling 2FA revokes all sessions by design.

Check that `/api/v1/auth/refresh` is reachable and that the `qt_refresh` cookie path is `/api/v1/auth`.

### Account locked

Five failed logins lock the account for 15 minutes. Wait, or have an administrator unlock/reset the account according to your support policy. Do not repeatedly retry during the lock window.

### Email verification loop

- In development, `AUTO_VERIFY_EMAILS=true` skips verification.
- With SMTP unconfigured and `EXPOSE_DEV_EMAILS=true`, use the `devVerificationUrl` returned by registration or resend.
- In production, configure SMTP and confirm the verification email link points at `CLIENT_URL`.
- Check the `registration` runtime setting if registration is disabled or verification is required.

---

## 4. Funding problems

### Wallet not credited after mock checkout

1. Confirm `POST /wallet/funding/:reference/simulate` returned success.
2. Read `GET /wallet/funding/:reference` and check `status`.
3. Read `GET /wallet/ledger` and look for a `FUNDING_CREDIT`.
4. Check the API log for `Funding review required`, amount mismatches, or provider errors.
5. Verify you are using the same user account that created the funding.

The mock simulation is only available for funding records created by a sandbox gateway. It is blocked in production.

### Webhook not crediting

Symptom: Paystack shows deliveries failing or the funding stays `PENDING`.

Check:

- URL is exactly `https://api.example.com/api/v1/webhooks/paystack`.
- `PAYSTACK_SECRET_KEY` matches the dashboard webhook secret.
- The proxy passes the **raw** body unchanged.
- The endpoint is publicly reachable over HTTPS.
- CSRF is not required for webhooks (it is exempt).
- Response is `2xx`; inspect the API log for `INVALID_SIGNATURE`.
- Duplicate deliveries are acknowledged without double credit; check `PaymentEvent` if investigating.

If the gateway never delivered, use `POST /wallet/funding/:reference/verify` or wait for reconciliation.

### Funding status `REQUIRES_REVIEW`

Usually an amount, currency, or reference mismatch between the local funding and the gateway. Do not manually credit the wallet. An administrator should compare the gateway dashboard, funding record, and ledger, then resolve through a documented adjustment only if warranted.

---

## 5. Purchase problems

### `INSUFFICIENT_BALANCE`

The wallet cannot cover `payableMinor`. Check the displayed quote and the wallet balance. In sandbox mode, airtime discounts can make the payable amount lower than the face value. A live SME quote has no discount because the provider deducts the full face value; fees can still add to the payable amount.

### `EMAIL_NOT_VERIFIED`

Verify the customer's email or adjust the `registration` setting only if policy allows. Staff roles bypass this check.

### `REQUIRES_REVIEW`

Expected for:

- purchases at or above the manual-review threshold;
- provider timeout or ambiguous responses (including the mock phone suffix `2222`);
- late provider success after refund;
- stale pending transactions.

Administrators must review the provider dashboard and the transaction timeline. Never blindly approve; confirm delivery at the provider first. Rejecting a held transaction refunds it.

### `PENDING` forever

- The mock VTU adapter returns pending for phone numbers ending `1111`; a live provider may also leave a purchase pending.
- In production, the provider may not have finalised. The scheduler queries status with backoff (up to eight attempts).
- Check `nextReconcileAt`, `reconciliationAttempts`, and provider status.
- Use admin `check-status` to force a query.
- If the provider has no record, treat it as a reconciliation incident; do not auto-retry a purchase.

### `FAILED` but balance unchanged

Refunds happen after the failure transition. Check for a `REFUND` ledger entry and `refundedAt` on the transaction. If the refund is missing, the scheduler's refund retry should pick it up. If it repeatedly fails, investigate ledger constraints and unique keys rather than editing rows.

### Electricity token missing

- Tokens are provider-issued and only present on successful prepaid transactions.
- Sandbox tokens start with `SANDBOX-`.
- The API returns them only to the owning customer and staff with the right access.
- If the provider did not return a token, treat the purchase as incomplete and reconcile; do not fabricate one.

### Duplicate purchase

Use the same `Idempotency-Key` when retrying. A new key creates a new purchase. If a duplicate debit occurred, compare the transaction references and ledger entries; refunds/adjustments must be audited.

---

## 6. Admin and RBAC

### `403` on `/admin`

- The account must have role `SUPPORT` or `ADMIN`.
- Check the role in the database or admin user list.
- A customer account cannot self-promote. Use `seedAdmin` or a controlled database change with audit.

### Support can read but cannot mutate

Expected. `SUPPORT` has read access and ticket replies. Wallet adjustments, user suspension, plan changes, settings, audit, and reconciliation are `ADMIN` only.

### Admin sees stale metrics

The overview is computed per request. Runtime settings are cached for up to 15 seconds. Refresh the page; if data is still wrong, check the filters (`days`) and the database.

### Audit log empty

Audit entries are created for authentication and sensitive actions, not every GET. Perform an action such as a wallet adjustment or plan update, then refresh with the correct filters.

---

## 7. Tests

### Server tests cannot connect to MongoDB

Symptom: timeouts or `MongooseServerSelectionError` in `server/tests/setup.ts`.

Fix:

1. Start MongoDB locally.
2. Confirm `mongodb://127.0.0.1:27017` is reachable.
3. Ensure the test user can create/drop the `subplug_test` database.
4. Run only the server suite: `npm run test -w server`.

Tests deliberately use a separate database and run files serially. Do not point tests at production.

### Test cleanup fails on ledger/audit guards

The test setup deletes collection contents directly to bypass intentional application-layer immutability guards. If you change cleanup to use model methods, deletion will fail by design. See `server/tests/setup.ts`.

### Client tests fail with a DOM error

The client suite uses `jsdom` via `client/vitest.config.ts`. Confirm:

- `npm install` completed at the root;
- `client/src/test/setup.ts` is present;
- you are running `npm run test -w client`, not the server Vitest config.

### Type errors after changing Vite

The client uses `vitest.config.ts` separately from `vite.config.ts` because Vitest and Vite can otherwise resolve duplicate Vite type versions. Keep the configs separate unless you verify the dependency graph.

---

## 8. Build and deployment

### `npm run build` fails on TypeScript but dev works

`tsx` runs without full type-checking. Run:

```bash
npm run typecheck
```

Fix all reported errors before building. Common causes are implicit `any`, unused variables under strict settings, and mismatched API response types.

### Blank page after deploy

- Check that `index.html` is served for unknown routes (SPA fallback).
- Check the browser console for 404s on `/assets/...`; the base path must match the host.
- Confirm `VITE_API_URL` was set at build time if the API is not same-origin.
- Confirm the CDN is not caching an old `index.html`.

### API works directly but not through Nginx

- Confirm `proxy_pass` and the `/api/` location.
- Confirm `TRUST_PROXY=1` and `X-Forwarded-Proto` are set.
- Confirm `client_max_body_size` is at least the JSON limit (1 MB).
- Check for cookie rewriting or missing headers.
- For webhooks, disable request-body buffering/rewriting.

### HSTS or secure-cookie problems on staging

Staging with `NODE_ENV=production` sets secure cookies and HSTS. Use HTTPS on staging, or run staging with `NODE_ENV=development` and non-production secrets. Never disable TLS protections on the public production site.

---

## 9. Logs and diagnostics

### Useful commands

```bash
# API health
curl -s http://localhost:4000/health | jq

# readiness (transaction mode and provider)
curl -s http://localhost:4000/health/ready | jq

# recent API logs (systemd)
journalctl -u subplug-api -n 200 --no-pager

# recent API logs (PM2)
pm2 logs subplug-api --lines 200

# MongoDB replica set status
mongosh "$MONGODB_URI" --eval "rs.status()"

# Indexes
mongosh "$MONGODB_URI" --eval "db.transactions.getIndexes()"
```

### What to include in an incident report

- UTC timestamp and timezone.
- User ID, transaction/funding reference.
- Request ID from the error response (`requestId`).
- Expected vs actual wallet balance and ledger entries.
- Provider reference/status and gateway dashboard evidence.
- Whether the action was a retry and which idempotency key was used.
- Recent deployments or configuration changes.
- Relevant redacted log lines.

Never include full cookies, passwords, 2FA secrets, API keys, or unredacted provider payloads in tickets.

### Reconciliation first

For any suspected money issue:

1. Compare the wallet projection with the ledger sum.
2. Check transaction status history.
3. Check funding status and gateway verification.
4. Check for duplicate idempotency keys or missing refunds.
5. Freeze changes and escalate before posting an adjustment.

The admin reconciliation page and the queries in [BACKUP_RESTORE.md](BACKUP_RESTORE.md) are the starting point.

---

## 10. Escalation checklist

Escalate immediately when:

- wallet balance and ledger disagree;
- a refund is duplicated or missing;
- a provider reports success after a local failure/refund;
- webhook signatures fail continuously;
- admin credentials or API keys are suspected compromised;
- database restore or failover occurred;
- mass transactions are stuck in `PENDING`/`REQUIRES_REVIEW`;
- customers report missing electricity tokens or duplicate debits.

Preserve logs and database state before making changes. Do not delete records to “clean up” an incident.
