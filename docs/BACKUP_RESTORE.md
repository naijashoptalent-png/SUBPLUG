# Backup and Restore

The MongoDB database is the system of record. Wallet balances are a cached projection, but both the wallet documents and the immutable ledger must be restored together. Restoring only one of them creates financial drift.

This runbook covers logical backups, managed point-in-time recovery, restore drills, and post-restore verification. Adapt retention to your regulatory, tax, and contractual obligations.

---

## 1. What to back up

| Asset | Why | Method |
| --- | --- | --- |
| MongoDB database | Users, wallets, ledger, transactions, fundings, tickets, settings, audit logs | Atlas continuous backup / `mongodump` / volume snapshot |
| API secrets and environment | Required to run the restored system | Secret manager export under access control |
| Client build artifacts | Reproducible rollback | CI artifact storage / release registry |
| Provider configuration | Payment/VTU credentials, webhook URLs, the runtime `providerRouting` setting, and any legacy `VTU_CATALOGUE_FILE` mapping | Encrypted configuration repository or runbook |
| TLS certificates and DNS records | Service continuity | Certificate manager / infrastructure-as-code |
| Audit exports | Investigation and compliance | Periodic encrypted export if retention exceeds database policy |

Redis is not a source of truth. BullMQ jobs can be recreated by the scheduler; do not rely on Redis backups for financial recovery.

---

## 2. Backup policy

A practical starting point for a small production deployment:

| Backup | Frequency | Retention | Notes |
| --- | --- | --- | --- |
| Continuous / PITR | Continuous | 7–35 days | Preferred; Atlas or equivalent |
| Daily logical dump | Daily | 30 days | Encrypted, off-site |
| Weekly full | Weekly | 12 weeks | Separate storage account/region |
| Monthly archive | Monthly | 12 months | Immutable/object-lock storage where possible |
| Pre-release snapshot | Before each release | 7 days | Speeds rollback |
| Restore drill | Quarterly | — | Must be evidenced, not assumed |

Define and document:

- **RPO** (maximum acceptable data loss): with PITR, often minutes; with daily dumps, up to 24 hours.
- **RTO** (maximum acceptable downtime): depends on cluster size and whether a standby is available.

Financial and audit records may have statutory retention requirements. Confirm them with legal/compliance before deleting old backups.

---

## 3. Managed MongoDB (recommended)

If using MongoDB Atlas:

1. Enable cloud backup or continuous cloud backup for the cluster.
2. Choose a snapshot schedule and retention consistent with policy.
3. Enable point-in-time recovery if the tier supports it.
4. Restrict backup restore permissions to a small operations group.
5. Enable encryption at rest and TLS.
6. Periodically restore to a separate project/cluster and run the verification steps below.

Atlas restore is performed from the cluster's Backup tab or API. Never restore over the production cluster without an approved change and a final snapshot.

---

## 4. Logical backup with mongodump

### Prerequisites

- MongoDB Database Tools installed (`mongodump`, `mongorestore`, `mongosh`).
- A dedicated backup user with read access (and restore privileges only for the restore environment).
- TLS connection string if required.
- Enough local disk for the compressed archive.

### Replica set backup (recommended)

`--oplog` captures oplog entries during the dump so the backup is consistent at a point in time. It is supported for replica sets, not sharded clusters.

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p /backups/subplug

mongodump \
  --uri="$MONGODB_URI" \
  --oplog \
  --gzip \
  --archive="/backups/subplug/subplug-$STAMP.archive.gz"

sha256sum "/backups/subplug/subplug-$STAMP.archive.gz" \
  > "/backups/subplug/subplug-$STAMP.archive.gz.sha256"
```

### Standalone development database

```bash
mongodump \
  --uri="mongodb://127.0.0.1:27017/subplug" \
  --gzip \
  --archive="/backups/subplug-dev-$(date +%Y%m%d).archive.gz"
```

A standalone dump is not transactionally consistent across collections. Use it only for development or as a best-effort secondary copy.

### Windows PowerShell

```powershell
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
New-Item -ItemType Directory -Force C:\backups\subplug | Out-Null

mongodump --uri="$env:MONGODB_URI" --oplog --gzip `
  --archive="C:\backups\subplug\subplug-$stamp.archive.gz"

Get-FileHash "C:\backups\subplug\subplug-$stamp.archive.gz" -Algorithm SHA256 |
  Format-List
```

### Upload off-site

```bash
aws s3 cp "/backups/subplug/subplug-$STAMP.archive.gz" \
  "s3://company-backups/subplug/$STAMP/" \
  --sse aws:kms

aws s3 cp "/backups/subplug/subplug-$STAMP.archive.gz.sha256" \
  "s3://company-backups/subplug/$STAMP/" \
  --sse aws:kms
```

Use object lock/immutability if available. Restrict delete permissions. Test that the backup account cannot modify production data.

### Encryption

- Prefer storage-level encryption plus TLS in transit.
- If exporting outside the managed service, encrypt with a trusted tool (for example `age` or GPG) before upload.
- Store encryption keys separately from backups.
- Record the key ID/version with the backup manifest.

### Backup manifest

For every backup, record:

```text
timestamp (UTC)
database name and cluster/replica set
MongoDB version
tool version
archive path and SHA-256
encryption key identifier
operator/automation identity
retention/expiry date
restore test status
```

---

## 5. Restore procedure

### Principles

1. Restore to a **staging/new** database first whenever possible.
2. Never run `--drop` against production without explicit approval and a fresh backup.
3. Restore the whole database, including the ledger and audit logs.
4. After restore, verify ledger-to-wallet reconciliation before reopening traffic.
5. Keep the API in maintenance mode during a production restore.

### Restore to a staging database

```bash
mongorestore \
  --uri="mongodb://staging-host:27017/subplug_restore?replicaSet=rs0" \
  --gzip \
  --archive="/backups/subplug/subplug-20261020T120000Z.archive.gz" \
  --nsFrom="subplug.*" \
  --nsTo="subplug_restore.*" \
  --oplogReplay
```

Notes:

- `--oplogReplay` applies the captured oplog tail. Use it only when restoring an oplog-enabled dump to a compatible replica set.
- `--nsFrom`/`--nsTo` rename the database during restore. Adjust names to match your archive.
- Without `--drop`, existing documents may conflict. On a fresh staging database, that is fine and safer.

### Restore over a production database (approved change only)

1. Enable maintenance mode.
2. Stop or drain API traffic.
3. Take a final backup of the current production database.
4. Restore with `--drop` only after confirming the target URI and database name.
5. Rebuild/verify indexes.
6. Run verification queries.
7. Restart the API.
8. Verify health and a read-only customer flow.
9. Exit maintenance mode.
10. Monitor reconciliation and error logs closely.

Example:

```bash
mongorestore \
  --uri="$MONGODB_URI" \
  --gzip \
  --archive="/backups/subplug/subplug-20261020T120000Z.archive.gz" \
  --drop \
  --oplogReplay
```

Double-check `$MONGODB_URI` before running. A restore into the wrong cluster is destructive and difficult to undo.

### Atlas PITR restore

1. Open the cluster's backup/restore page.
2. Choose point in time or snapshot.
3. Restore to a new cluster first.
4. Validate.
5. Cut over the connection string or promote the restored cluster according to the provider's procedure.

---

## 6. Post-restore verification

Run these checks before serving customers.

### Counts and status distribution

```javascript
use subplug

db.users.countDocuments()
db.wallets.countDocuments()
db.ledgerentries.countDocuments()
db.transactions.countDocuments()
db.walletfundings.countDocuments()
db.auditlogs.countDocuments()

db.transactions.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

Compare against the pre-restore baseline or the backup manifest. Large unexplained differences require investigation.

### Ledger-to-wallet reconciliation

```javascript
db.wallets.aggregate([
  {
    $lookup: {
      from: "ledgerentries",
      localField: "_id",
      foreignField: "walletId",
      as: "entries"
    }
  },
  {
    $project: {
      userId: 1,
      storedBalanceMinor: "$balanceMinor",
      ledgerBalanceMinor: {
        $subtract: [
          {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$entries",
                    as: "e",
                    cond: { $eq: ["$$e.direction", "CREDIT"] }
                  }
                },
                as: "c",
                in: "$$c.amountMinor"
              }
            }
          },
          {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$entries",
                    as: "e",
                    cond: { $eq: ["$$e.direction", "DEBIT"] }
                  }
                },
                as: "d",
                in: "$$d.amountMinor"
              }
            }
          }
        ]
      }
    }
  },
  {
    $match: {
      $expr: { $ne: ["$storedBalanceMinor", "$ledgerBalanceMinor"] }
    }
  }
])
```

Expected result: no documents. Any row is a financial discrepancy and must be investigated before reopening.

The authenticated admin reconciliation page (`/admin/reconciliation`) runs the same class of check against a limited batch. It detects drift but does not repair it automatically.

### Duplicate and orphan checks

```javascript
// Duplicate ledger idempotency keys should be impossible due to the unique index.
db.ledgerentries.aggregate([
  { $group: { _id: "$idempotencyKey", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])

// Ledger rows whose transaction is missing.
db.ledgerentries.aggregate([
  { $match: { transactionId: { $ne: null } } },
  {
    $lookup: {
      from: "transactions",
      localField: "transactionId",
      foreignField: "_id",
      as: "tx"
    }
  },
  { $match: { tx: { $size: 0 } } }
])

// Refunded transactions without a refund ledger entry.
db.transactions.aggregate([
  { $match: { status: "REFUNDED" } },
  {
    $lookup: {
      from: "ledgerentries",
      let: { txId: "$_id" },
      pipeline: [
        { $match: { $expr: { $and: [ { $eq: ["$transactionId", "$$txId"] }, { $eq: ["$type", "REFUND"] } ] } } }
      ],
      as: "refunds"
    }
  },
  { $match: { refunds: { $size: 0 } } }
])
```

### Index verification

```javascript
db.users.getIndexes()
db.wallets.getIndexes()
db.ledgerentries.getIndexes()
db.transactions.getIndexes()
db.walletfundings.getIndexes()
db.sessions.getIndexes()
```

Confirm at minimum:

- unique `users.email`, `users.phone`, `users.referralCode`
- unique `ledgerentries.reference`, `ledgerentries.idempotencyKey`
- unique `transactions.reference`, `transactions.(userId, idempotencyKey)`
- unique `walletfundings.reference`, `walletfundings.(userId, idempotencyKey)`
- unique `wallets.userId`

### Application checks

```bash
curl -fsS https://api.example.com/health/ready
```

Then:

1. Sign in as an admin.
2. Open reconciliation and confirm no drift.
3. Read a known customer wallet and compare with a ledger sum.
4. Verify recent transactions and fundings are present.
5. Confirm webhooks are being accepted after restart.
6. Check that the active providers and environment flags are correct (no sandbox in production).

---

## 7. Restore drills

At least quarterly:

1. Pick a random backup.
2. Restore it to an isolated database/cluster.
3. Start a staging API against it with mock/sandbox providers and a separate test wallet dataset. Never point the restored production database at live Paystack keys during a drill.
4. Run the verification queries and application checks.
5. Record the time taken, issues, and operator.
6. Fix the runbook if anything was unclear.

A backup that has never been restored is an assumption, not a recovery plan.

---

## 8. Partial recovery scenarios

### Accidental user deletion

Restore the user, wallet, ledger entries, transactions, sessions, notifications, and referrals for that user from a snapshot. Do **not** restore only the user document; the wallet and ledger must match.

Prefer doing this in a staging database, exporting the relevant documents, and importing them with a reviewed script. Financial history must remain immutable.

### Accidental wallet adjustment

Post a compensating audited adjustment through the admin API. Do not edit or delete ledger rows. Record the reason and incident reference.

### Corrupted index

Rebuild the affected index during a maintenance window. For unique indexes, first check for duplicates:

```javascript
db.ledgerentries.aggregate([
  { $group: { _id: "$idempotencyKey", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

Resolve duplicates with finance/engineering review before recreating the unique index. Never delete ledger rows to make an index build succeed.

### Redis loss

Redis loss affects scheduled jobs, not stored financial data. Restart the API or let BullMQ reconnect. The scheduler recreates repeatable jobs. Confirm reconciliation resumes and no duplicate provider submissions occur (purchases are never automatically retried).

---

## 9. Security of backups

- Encrypt backups at rest and in transit.
- Use separate credentials and storage accounts for backup and production.
- Enable MFA on the backup provider.
- Restrict restore permissions to a named operations group.
- Log backup, download, and restore actions.
- Expire backups according to policy, but never delete the only copy of financial/audit records before the retention period ends.
- Test that deleted production credentials cannot access backups after offboarding.

---

## 10. Recovery communication template

When a restore affects customers:

```text
We experienced a service disruption affecting wallet and purchase records between
[START] and [END] WAT. We restored from a verified backup taken at [TIME] and
reconciled wallet balances against the ledger. If you notice a missing or
duplicate transaction, contact support with the reference and timestamp.
```

Do not claim that no data was lost until reconciliation confirms it.
