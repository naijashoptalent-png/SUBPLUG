# Deployment Guide

This guide covers a production deployment of SubPlug on Linux with a managed MongoDB replica set, an optional managed Redis instance, a Node process manager, Nginx, and static hosting for the React build.

> **Do not go live with sandbox providers.** Set `PAYMENT_GATEWAY=paystack`, `VTU_PROVIDER=sme`, and complete provider certification first. Never set `ALLOW_SANDBOX_IN_PRODUCTION=true` for a real service. Until Paystack keys are configured, mock wallet funding must not be represented as real money.

---

## 1. Recommended topology

```text
                    ┌─────────────────────────────┐
  Browsers ────────►│ CDN / static host           │
                    │ client/dist (SPA)           │
                    └──────────────┬──────────────┘
                                   │ /api/* (same origin, recommended)
                                   ▼
                    ┌─────────────────────────────┐
                    │ Nginx / load balancer + TLS │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Node API (1..n instances)   │
                    │ server/dist/server.js       │
                    └───────┬─────────────┬───────┘
                            │             │
                 ┌──────────▼───┐   ┌─────▼──────────┐
                 │ MongoDB      │   │ Redis (optional│
                 │ replica set  │   │ BullMQ workers)│
                 └──────────────┘   └────────────────┘
                            │
                 ┌──────────▼──────────┐
                 │ Payment + VTU APIs  │
                 └─────────────────────┘
```

Same-origin deployment (SPA and API under one domain, e.g. `https://subplug.example` with `/api` proxied) is the simplest and avoids cross-site cookie configuration.

Supported alternatives:

- Two subdomains: `app.example.com` and `api.example.com` with `COOKIE_DOMAIN=.example.com` and `COOKIE_SAME_SITE=lax`.
- Separate sites: static host plus API domain with HTTPS, `COOKIE_SAME_SITE=none`, and explicit CORS origins.

---

## 2. Prerequisites

| Component | Requirement |
| --- | --- |
| Node.js | 20 LTS or newer; pin the major version in production |
| npm | 10+ |
| MongoDB | 6+ replica set; managed service recommended |
| Redis | Optional, 6+ with TLS if remote |
| Reverse proxy | Nginx, Caddy, or a platform load balancer with TLS |
| DNS/TLS | Certificate for the web and API hostnames |
| Secrets | Managed secret store or platform environment variables |
| Payment | Live Paystack account, webhook secret, business verification |
| VTU | Licensed provider contract, credentials, API documentation, sandbox certification |

---

## 3. Build and release

From a clean checkout on the build host or CI:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Artifacts:

```text
server/dist/      Node API
client/dist/      Static SPA
```

Build the client with the production API origin if it is not same-origin:

```bash
# Linux/macOS
VITE_API_URL=https://api.example.com npm run build

# PowerShell
$env:VITE_API_URL = "https://api.example.com"
npm run build
```

If the SPA and API share an origin, leave `VITE_API_URL` empty so requests go to `/api/v1` on the same host.

Deploy `client/dist/` to a static host/CDN and `server/dist/` plus production dependencies to the API host:

```bash
npm ci --omit=dev
NODE_ENV=production node server/dist/server.js
```

The API package expects `server/.env` when running `npm start`, or process environment variables provided by the platform. Prefer the platform's secret store over a file on disk.

---

## 4. Production environment

Minimum API configuration:

```dotenv
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.example.com
CLIENT_URL=https://app.example.com
ADDITIONAL_CORS_ORIGINS=
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/subplug?retryWrites=true&w=majority
REQUIRE_REPLICA_SET=true
JWT_ACCESS_SECRET=<96-random-hex-characters>
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_DOMAIN=.example.com
COOKIE_SAME_SITE=lax
TRUST_PROXY=1

ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=<strong-unique-password>
ADMIN_NAME=Platform Owner
ADMIN_PHONE=08000000000

PAYMENT_GATEWAY=paystack
PAYSTACK_SECRET_KEY=<live-or-test-secret>
PAYSTACK_PUBLIC_KEY=<public-key>
PAYSTACK_BASE_URL=https://api.paystack.co
ALLOW_MOCK_PAYMENTS=false
PAYMENT_CURRENCY=NGN

VTU_PROVIDER=sme
ALLOW_MOCK_VTU=false
VTU_API_BASE_URL=https://smeapi.com.ng
VTU_API_KEY=<key>
VTU_TIMEOUT_MS=15000
# Cable/electricity only. Populate with confirmed numeric IDs, never guesses.
VTU_CATALOGUE_FILE=server/config/vtu-catalogue.json

USE_QUEUES=true
REDIS_URL=rediss://default:PASSWORD@redis.example.com:6379
RECONCILE_INTERVAL_MS=300000
CATALOGUE_SYNC_INTERVAL_MS=900000

EMAIL_FROM="SubPlug <no-reply@example.com>"
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=<smtp-user>
EMAIL_PASSWORD=<smtp-password>
EXPOSE_DEV_EMAILS=false
AUTO_VERIFY_EMAILS=false

LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=20
TRANSACTION_EMAIL_ALERTS=true
```

Airtime and data work with the SME API base URL and key. Cable and electricity stay disabled until confirmed numeric provider/plan IDs are added to `VTU_CATALOGUE_FILE`. See [ENVIRONMENT.md](ENVIRONMENT.md#vtu-provider) for the file schema and every variable.

See [ENVIRONMENT.md](ENVIRONMENT.md) for descriptions and validation rules.

### Cookie and CORS matrix

| Setup | API_BASE_URL | CLIENT_URL | COOKIE_DOMAIN | COOKIE_SAME_SITE | VITE_API_URL |
| --- | --- | --- | --- | --- | --- |
| Same origin (`app.example.com/api`) | `https://app.example.com` | `https://app.example.com` | empty | `lax` | empty |
| Subdomains | `https://api.example.com` | `https://app.example.com` | `.example.com` | `lax` | `https://api.example.com` |
| Different sites | `https://api.vendor.com` | `https://app.customer.com` | empty | `none` | `https://api.vendor.com` |

For the different-sites case:

- HTTPS is mandatory.
- Add the web origin to `ADDITIONAL_CORS_ORIGINS` if it differs from `CLIENT_URL`.
- Keep `credentials: true` behavior in mind: wildcard CORS origins are not allowed.
- Test login and refresh in a real browser, not only with curl, because third-party cookie policies may block the flow.

---

## 5. Database preparation

1. Create a MongoDB replica set or Atlas cluster.
2. Create a least-privilege application user with read/write access to the application database.
3. Restrict network access to the API egress addresses.
4. Enable encryption at rest and TLS.
5. Set the connection string with the database name.
6. Verify transactions:

```bash
mongosh "$MONGODB_URI" --eval "db.adminCommand({ hello: 1 }).setName"
```

7. Start the API once so Mongoose can create collections and indexes, or run the seed.
8. Confirm indexes exist:

```javascript
db.transactions.getIndexes()
db.ledgerentries.getIndexes()
db.walletfundings.getIndexes()
db.users.getIndexes()
```

Unique indexes are part of the financial safety model. Do not drop or recreate them casually.

### Seed the administrator and catalogue

```bash
NODE_ENV=production npm run seed
```

`seed` is idempotent for the catalogue and does not reset an existing administrator password. Run it once during initial provisioning, then use the admin UI for plan/price changes.

---

## 6. Process management

### systemd example

`/etc/systemd/system/subplug-api.service`:

```ini
[Unit]
Description=SubPlug API
After=network.target

[Service]
Type=simple
User=subplug
Group=subplug
WorkingDirectory=/srv/subplug
Environment=NODE_ENV=production
EnvironmentFile=/etc/subplug/api.env
ExecStart=/usr/bin/node /srv/subplug/server/dist/server.js
Restart=always
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/subplug
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now subplug-api
sudo systemctl status subplug-api
sudo journalctl -u subplug-api -f
```

Set restrictive permissions on the environment file:

```bash
sudo chown root:subplug /etc/subplug/api.env
sudo chmod 640 /etc/subplug/api.env
```

### PM2 alternative

```bash
pm2 start server/dist/server.js --name subplug-api --update-env
pm2 save
pm2 startup
```

Use **one** API process unless `USE_QUEUES=true` and Redis are configured. PM2 cluster mode with the in-process scheduler duplicates reconciliation timers.

---

## 7. Nginx reverse proxy

Same-origin example (`https://app.example.com`):

```nginx
upstream subplug_api {
    server 127.0.0.1:4000;
    keepalive 32;
}

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /srv/subplug/client/dist;
    index index.html;

    # Security headers for the SPA. Adjust CSP to the assets you actually use.
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location /api/ {
        proxy_pass http://subplug_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        client_max_body_size 1m;
    }

    location = /health {
        proxy_pass http://subplug_api;
        proxy_set_header Host $host;
        access_log off;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

Notes:

- Do not buffer or rewrite the request body for `/api/v1/webhooks/`; signature verification needs the raw bytes.
- `proxy_set_header X-Forwarded-Proto $scheme` plus `TRUST_PROXY=1` gives Express the correct protocol and client IP.
- Enable gzip/brotli at the proxy for JS/CSS, or let the CDN handle it.
- If the API is on a separate host, proxy `/api/` to that upstream or use the split-domain cookie matrix.

### Static SPA caching

- `index.html`: no-cache or short cache, so new releases are picked up.
- Hashed assets in `/assets/`: long cache with immutable.
- Service workers are not used; no cache invalidation beyond normal deployment is required.

---

## 8. Webhook and provider configuration

### Paystack

1. Set live/test secret and public keys.
2. Configure the webhook URL: `https://api.example.com/api/v1/webhooks/paystack`.
3. Enable the charge success event.
4. Confirm the dashboard webhook secret matches `PAYSTACK_SECRET_KEY`.
5. Make a low-value live/test payment and verify:
   - funding record becomes `SUCCESSFUL`;
   - exactly one `FUNDING_CREDIT` ledger entry exists;
   - replaying the webhook does not credit twice.

### VTU provider

1. Set `VTU_PROVIDER=sme`, `VTU_API_BASE_URL=https://smeapi.com.ng`, and a server-side-only `VTU_API_KEY`.
2. Confirm `/api/user/` through the admin provider health check and note the provider wallet balance.
3. Run `npm run seed` and verify the live data-plan count, networks, costs, and customer prices.
4. Confirm cable/electricity IDs in the SME API account, add them to `VTU_CATALOGUE_FILE`, and sync again. Never guess IDs.
5. Make a low-value live airtime purchase to a controlled number with explicit approval, then verify:
   - the provider reference and delivery;
   - exactly one wallet debit and ledger entry;
   - the local transaction becomes `SUCCESSFUL` only on a definitive provider result.
6. Exercise a definitive failure, pending response, and timeout in a controlled way. Confirm uncertain outcomes become `REQUIRES_REVIEW` and are never auto-retried.
7. Confirm the provider status endpoint semantics and keep reconciliation enabled.
8. Review `CATALOGUE_SYNC_INTERVAL_MS`; live prices can change and stale costs are a commercial risk.

### MaskawaSub (secondary provider)

1. Put `MASKAWASUB_API_KEY` in the server environment only. Never place it in a `VITE_*` variable or commit it.
2. Confirm the read-only catalogue through the admin provider health check. The adapter reads `GET /api/user/` and `GET /api/disco/`; it deliberately does not read `/api/history/` or `/api/sms/`.
3. Keep `MASKAWASUB_LIVE_PURCHASES=false` and `MASKAWASUB_CERTIFIED_SERVICES=` empty until the provider has confirmed, in writing or through a funded certification, the exact request fields and per-reference status contract for each service.
4. Do not enable MaskawaSub cable, electricity, airtime, or data for customers before that certification. `VTU_CABLE_PROVIDER=maskawasub`, `VTU_ELECTRICITY_PROVIDER=maskawasub`, `VTU_AIRTIME_PROVIDER=maskawasub`, and `VTU_DATA_PROVIDER=maskawasub` may be used to stage a route, but `listServices` hides any service whose provider is not certified for live purchases.
5. Certify one service at a time with a controlled low-value purchase. After the service passes, set `MASKAWASUB_CERTIFIED_SERVICES` to **only** that service (for example `CABLE`) and set `MASKAWASUB_LIVE_PURCHASES=true`:
   - submit the purchase and record the provider reference;
   - confirm exactly one wallet debit;
   - confirm the provider's own dashboard/history shows exactly one order;
   - confirm success, definitive failure, pending, timeout, and duplicate-reference behaviour;
   - confirm the per-reference status query before enabling reconciliation.
   Leave every other service out of the allowlist until it has passed its own certification.
6. If a status contract is unavailable, set `MASKAWASUB_LIVE_PURCHASES=false` and clear `MASKAWASUB_CERTIFIED_SERVICES`. Uncertain outcomes must not be auto-refunded or retried on the other provider.
7. Education/exam pins, airtime-to-cash, and recharge-card PINs are **not enabled** in this codebase. Do not add routes for them until their request schemas, settlement rules, and status contracts are confirmed.

### Webhook exposure

- Webhooks must be reachable without authentication but with signature verification.
- Do not put a WAF rule in front of webhooks that blocks provider IPs or rewrites JSON.
- Return `2xx` quickly; heavy work is already handled synchronously in this implementation, so keep database and provider calls healthy. If provider verification is slow, consider queueing in a future iteration.

---

## 9. Health checks and monitoring

| Check | Endpoint | Expected |
| --- | --- | --- |
| Liveness | `/health/live` | `200` |
| Readiness | `/health/ready` | `200`, `ready: true`, `mongoTransactions: true` in production |
| Database + process | `/health` | `200`, `status: ok` |

Configure the load balancer to use `/health/ready` and alert on:

- readiness failures;
- `5xx` rate;
- reconciliation cycle errors;
- `WALLET DRIFT DETECTED` log entries;
- funding stuck in `PENDING` beyond the expected gateway window;
- transactions in `REQUIRES_REVIEW` older than the support SLA;
- webhook signature failures;
- provider health checks;
- Redis/BullMQ failures when queues are enabled;
- disk, memory, event-loop lag, and MongoDB connection pool saturation.

Logs are structured JSON in production. Ship them to your log platform and retain financial/audit logs according to policy.

---

## 10. Go-live checklist

### Security

- [ ] HTTPS enforced on web and API.
- [ ] `JWT_ACCESS_SECRET` is random, unique, and not the placeholder.
- [ ] `NODE_ENV=production`, `AUTO_VERIFY_EMAILS=false`, `EXPOSE_DEV_EMAILS=false`.
- [ ] `ALLOW_SANDBOX_IN_PRODUCTION` is unset or `false`.
- [ ] `PAYMENT_GATEWAY=paystack`, `VTU_PROVIDER=sme`.
- [ ] `VTU_API_KEY` is stored only in the server environment and has been rotated if exposed.
- [ ] `MASKAWASUB_API_KEY` is server-only; `MASKAWASUB_LIVE_PURCHASES=false` and `MASKAWASUB_CERTIFIED_SERVICES=` unless that exact service has passed certification.
- [ ] Per-service routes (`VTU_AIRTIME_PROVIDER`, `VTU_DATA_PROVIDER`, `VTU_CABLE_PROVIDER`, `VTU_ELECTRICITY_PROVIDER`, etc.) point only at certified providers.
- [ ] CORS contains only intended origins.
- [ ] Cookies have correct domain, SameSite, and Secure attributes.
- [ ] MongoDB/Redis are not publicly reachable.
- [ ] Admin accounts use unique strong passwords and TOTP where possible.
- [ ] Rate limits reviewed for expected traffic.
- [ ] SMTP configured; verification and reset emails tested.
- [ ] Audit log and reconciliation pages accessible to the right staff.

### Rotating exposed provider keys

Treat both VTU API keys as account credentials: they can read provider catalogue/account data and, when live purchases are enabled, submit orders.

1. In the SME dashboard, create a new API key. If multiple active keys are supported, keep the old key active until the new one has passed the health check.
2. In the MaskawaSub dashboard, create a new API key. MaskawaSub live purchases are disabled, so this rotation has no customer-facing purchase impact.
3. Update only `server/.env`:
   - `VTU_API_KEY=<new SME key>`
   - `MASKAWASUB_API_KEY=<new MaskawaSub key>`
4. Never paste the new keys into chat, tickets, docs, client environment variables, or git. Do not put them in `VITE_*` variables.
5. Restart the API so it reloads `server/.env`.
6. Run the admin provider health check. Both providers must be healthy. A key test is a read-only health check, not a live purchase.
7. Revoke/delete the old keys in both dashboards. Confirm they no longer authenticate. If a key was committed or included in a build artifact, rotate it again and purge the old value from git history and deployment logs.
8. Review both provider dashboards for unexpected activity or balance changes.

### Financial

- [ ] Replica set confirmed; `mongoTransactions: true`.
- [ ] Production uses a clean database with no mock-funded wallets or sandbox ledger entries.
- [ ] Seed completed; plans and prices reviewed.
- [ ] Runtime limits, discounts, markups, referral reward, and manual-review threshold reviewed.
- [ ] Live airtime quote confirmed at face value (`discountMinor: 0`); do not fund customer discounts from platform margin without an explicit pricing decision.
- [ ] Test funding credits exactly once and appears in ledger.
- [ ] Test airtime, data, electricity, and cable success paths.
- [ ] Test definitive failure produces exactly one refund.
- [ ] Test pending/uncertain outcomes do not auto-refund.
- [ ] Test idempotent replay of funding and purchases.
- [ ] Test admin hold/approve/reject flow.
- [ ] Test wallet adjustment permissions and audit entries.
- [ ] Reconcile a sample of wallets against ledger sums.
- [ ] Backups enabled and a restore has been rehearsed (see [BACKUP_RESTORE.md](BACKUP_RESTORE.md)).

### Operational

- [ ] Health checks and alerts configured.
- [ ] Log retention configured.
- [ ] On-call/support rota and escalation path defined.
- [ ] Maintenance mode tested (requires confirmation phrase).
- [ ] Rollback plan and previous artifact retained.
- [ ] Legal pages, support contacts, and branding reviewed.
- [ ] Provider contracts, regulatory requirements, and customer terms in place.

---

## 11. Deployment procedure

1. Announce the release window if customer impact is possible.
2. Take or confirm a recent database backup.
3. Build and test the new artifact in CI.
4. Deploy the API artifact and install production dependencies.
5. Run database migrations/index creation if the release includes schema changes (Mongoose creates indexes at startup; review `autoIndex` behavior for large collections).
6. Restart the API process and wait for readiness.
7. Verify `/health` and `/health/ready`.
8. Deploy the client build to the CDN/static host.
9. Smoke-test login, wallet read, a sandbox/test funding, and a low-value purchase with provider test credentials.
10. Check the reconciliation page and error logs.
11. Invalidate CDN caches for `index.html` if necessary.
12. Announce completion.

### Rolling restarts

- With multiple instances and Redis queues, restart instances one at a time behind the load balancer.
- With a single instance, expect a short downtime during restart; drain the load balancer first.
- Never run schema-destructive operations as part of an automatic startup hook.

---

## 12. Rollback

1. Stop routing traffic to the new API instance(s).
2. Redeploy the previous known-good API and client artifacts.
3. Restore the database only if the release performed an incompatible data migration; prefer forward fixes for financial data.
4. Reconcile wallets and review audit logs for actions performed during the bad release.
5. Communicate to affected customers if balances or purchases were impacted.

Keep at least the previous two release artifacts and their lockfiles.

---

## 13. Scaling notes

- API instances are stateless; scale horizontally behind the load balancer.
- Use Redis/BullMQ before adding instances.
- MongoDB connection pool defaults to 20 per process; size it against the cluster's connection limit.
- Provider rate limits may require queueing or throttling outbound purchase calls.
- Static assets belong on a CDN, not the API process.
- Session and audit collections grow continuously; plan indexes and retention.
- Cash-heavy workloads should be monitored for reconciliation backlog, not just HTTP latency.

---

## 14. Maintenance mode

Administrators can enable maintenance mode from the admin settings page. Customer funding and purchase mutations return `503 MAINTENANCE_MODE`; login, verification, support, admin access, and signed webhooks remain available. The API requires the confirmation phrase `ENABLE MAINTENANCE` when enabling it.

Use maintenance mode for provider outages or planned changes that would make purchases unreliable. Do not use it to hide unresolved financial discrepancies.

---

## 15. Related documents

- [Environment reference](ENVIRONMENT.md)
- [Backup and restore](BACKUP_RESTORE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Architecture](ARCHITECTURE.md)
- [API reference](API.md)
