import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  BookOpenCheck,
  CircleAlert,
  Clock,
  RefreshCw,
  Scale,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/States';
import { useReconciliation } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatNaira, formatNumber } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import type { ReconciliationResult } from '@/types';

function Difference({ minor }: { minor: number }) {
  const tone = minor > 0 ? 'text-success' : minor < 0 ? 'text-danger' : 'text-muted';
  return <span className={`font-semibold ${tone}`}>{formatNaira(minor, { sign: true })}</span>;
}

export function AdminReconciliationPage() {
  const { isAdmin } = useAuth();
  const reconciliation = useReconciliation();
  const [result, setResult] = useState<ReconciliationResult | null>(null);

  const run = async () => {
    try {
      const data = await reconciliation.mutateAsync();
      setResult(data);
      if (data.discrepancies.length === 0) {
        toast.success(`Ledger matched for ${data.checked} wallet${data.checked === 1 ? '' : 's'}`);
      } else {
        toast.warning(`${data.discrepancies.length} wallet discrepanc${data.discrepancies.length === 1 ? 'y' : 'ies'} found`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const discrepancies = result?.discrepancies ?? [];
  const hasDiscrepancies = discrepancies.length > 0;

  return (
    <>
      <Helmet>
        <title>Reconciliation — QuickTopUp operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Operations"
        title="Wallet reconciliation"
        description="Compare every wallet's recorded balance with the sum of its immutable ledger entries. A difference means the projection and the ledger disagree and needs investigation."
        actions={
          isAdmin ? (
            <Button
              onClick={() => void run()}
              isLoading={reconciliation.isPending}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Run reconciliation
            </Button>
          ) : undefined
        }
      />

      {!isAdmin ? (
        <Alert variant="info" className="mt-5">
          Reconciliation is restricted to administrators because it inspects financial records. Ask an administrator to run
          it for you.
        </Alert>
      ) : null}

      {!result ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader title="What this run checks" description="A read-only integrity pass over wallet records" />
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <Scale className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Recorded balance vs ledger sum</p>
                  <p className="mt-0.5 text-sm text-muted">
                    Each wallet's stored balance is compared with the sum of credits minus debits in the ledger. The
                    ledger is the source of truth; the stored balance is only a projection.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info/10 text-info">
                  <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Up to 200 wallets per run</p>
                  <p className="mt-0.5 text-sm text-muted">
                    The check is intentionally bounded to keep the request fast. Run it again after resolving issues or
                    use a scheduled job for full-population checks.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Operational queue snapshot</p>
                  <p className="mt-0.5 text-sm text-muted">
                    The run also counts pending transactions, transactions in review, and fundings in review so finance
                    and support can see outstanding work.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Reconciliation is logged</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Every run writes an audit record with the number of wallets checked and discrepancies found. It does not
                  change balances automatically; corrections must be made through audited adjustments.
                </p>
                <Link to="/admin/audit" className={buttonStyles('outline', 'sm', 'mt-4')}>
                  Open audit log
                </Link>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <>
          {result.snapshot.environment.mongoTransactions ? (
            <Alert variant="success" title="Transactional writes are enabled" className="mt-5">
              Wallet and ledger updates are protected by MongoDB transactions.
            </Alert>
          ) : (
            <Alert variant="warning" title="Serialized fallback is active" className="mt-5">
              MongoDB transactions are not available in this environment. Financial writes use the development
              serialization fallback. This is not suitable for production.
            </Alert>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Wallets checked</p>
                <Wallet className="h-4 w-4 text-muted" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{formatNumber(result.checked)}</p>
              <p className="mt-1 text-xs text-muted">{formatNumber(result.snapshot.walletCount)} wallets recorded in total</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Ledger entries</p>
                <BookOpenCheck className="h-4 w-4 text-muted" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{formatNumber(result.snapshot.ledgerCount)}</p>
              <p className="mt-1 text-xs text-muted">Immutable debit and credit records</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Open transactions</p>
                <Clock className="h-4 w-4 text-muted" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{formatNumber(result.snapshot.pendingTransactions)}</p>
              <p className="mt-1 text-xs text-muted">
                {formatNumber(result.snapshot.transactionsInReview)} in review · {formatNumber(result.snapshot.fundingsInReview)} fundings in review
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Discrepancies</p>
                <CircleAlert className={`h-4 w-4 ${hasDiscrepancies ? 'text-danger' : 'text-muted'}`} aria-hidden="true" />
              </div>
              <p className={`mt-3 text-2xl font-semibold ${hasDiscrepancies ? 'text-danger' : 'text-success'}`}>
                {formatNumber(discrepancies.length)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {hasDiscrepancies ? 'Investigate before making adjustments' : 'Recorded balances agree with the ledger'}
              </p>
            </Card>
          </div>

          <Card className="mt-5 overflow-hidden">
            <CardHeader
              title="Discrepancy report"
              description="Recorded balance minus computed ledger balance, per wallet"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void run()}
                  isLoading={reconciliation.isPending}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Run again
                </Button>
              }
            />
            {hasDiscrepancies ? (
              <div className="table-wrap">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th scope="col">User ID</th>
                      <th scope="col">Recorded balance</th>
                      <th scope="col">Ledger balance</th>
                      <th scope="col">Difference</th>
                      <th scope="col"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map((item) => (
                      <tr key={item.userId}>
                        <td className="font-mono text-[10px]">{item.userId}</td>
                        <td className="whitespace-nowrap text-xs">{formatNaira(item.recordedMinor)}</td>
                        <td className="whitespace-nowrap text-xs">{formatNaira(item.computedMinor)}</td>
                        <td className="whitespace-nowrap text-xs"><Difference minor={item.differenceMinor} /></td>
                        <td className="text-right">
                          <Link
                            to={`/admin/users/${item.userId}`}
                            className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                          >
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No discrepancies found"
                description={`All ${result.checked} checked wallets agree with their ledger entries.`}
              />
            )}
          </Card>

          <Card className="mt-5">
            <CardHeader title="Run snapshot" description="Environment and record counts for this check" />
            <div className="p-5">
              <DescriptionList
                items={[
                  { label: 'Environment', value: <Badge tone="neutral">{result.snapshot.environment.nodeEnv}</Badge> },
                  {
                    label: 'MongoDB transactions',
                    value: (
                      <Badge tone={result.snapshot.environment.mongoTransactions ? 'success' : 'warning'}>
                        {result.snapshot.environment.mongoTransactions ? 'Enabled' : 'Fallback active'}
                      </Badge>
                    ),
                  },
                  { label: 'Wallets recorded', value: formatNumber(result.snapshot.walletCount) },
                  { label: 'Ledger entries', value: formatNumber(result.snapshot.ledgerCount) },
                  { label: 'Pending or processing transactions', value: formatNumber(result.snapshot.pendingTransactions) },
                  { label: 'Transactions in review', value: formatNumber(result.snapshot.transactionsInReview) },
                  { label: 'Fundings in review', value: formatNumber(result.snapshot.fundingsInReview) },
                ]}
                columns={2}
              />
            </div>
          </Card>
        </>
      )}
    </>
  );
}
