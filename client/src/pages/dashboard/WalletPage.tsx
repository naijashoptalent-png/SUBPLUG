import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ExternalLink,
  Plus,
  ReceiptText,
  Wallet as WalletIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { FundWalletDialog } from '@/components/wallet/FundWalletDialog';
import { SandboxNotice } from '@/components/ui/SandboxNotice';
import { useFundings, useLedger, useWallet } from '@/hooks/useWallet';
import { formatNaira, formatPaymentGateway, formatRelative, LEDGER_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LedgerType } from '@/types';

const ledgerTypes: Array<{ value: '' | LedgerType; label: string }> = [
  { value: '', label: 'All entries' },
  { value: 'FUNDING_CREDIT', label: 'Funding' },
  { value: 'PURCHASE_DEBIT', label: 'Purchases' },
  { value: 'REFUND', label: 'Refunds' },
  { value: 'REFERRAL_REWARD', label: 'Referral rewards' },
  { value: 'ADJUSTMENT_CREDIT', label: 'Adjustments' },
];

export function WalletPage() {
  const [fundOpen, setFundOpen] = useState(false);
  const [tab, setTab] = useState<'ledger' | 'fundings'>('ledger');
  const [page, setPage] = useState(1);
  const [type, setType] = useState<'' | LedgerType>('');
  const [direction, setDirection] = useState<'' | 'CREDIT' | 'DEBIT'>('');
  const walletQuery = useWallet();
  const ledgerQuery = useLedger({
    page,
    limit: 15,
    ...(type ? { type } : {}),
    ...(direction ? { direction } : {}),
  });
  const fundingsQuery = useFundings(page, 15);

  const wallet = walletQuery.data;

  const changeTab = (next: 'ledger' | 'fundings') => {
    setTab(next);
    setPage(1);
  };

  return (
    <>
      <Helmet>
        <title>Wallet — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Money"
        title="Wallet"
        description="Every credit and debit is recorded in an append-only ledger. Your balance is a projection of those entries."
        actions={
          <Button onClick={() => setFundOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Fund wallet
          </Button>
        }
      />

      <SandboxNotice className="mt-5" />

      {walletQuery.isError ? (
        <Card className="mt-6">
          <ErrorState
            title="Your wallet could not load"
            description="We could not retrieve your balance. Try again."
            onRetry={() => void walletQuery.refetch()}
          />
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="balance-card relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-glow md:col-span-1">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-white/10" aria-hidden="true" />
          <div className="flex items-center gap-2 text-white/70">
            <WalletIcon className="h-4 w-4" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Available balance</span>
          </div>
          {walletQuery.isLoading ? (
            <div className="mt-4 h-10 w-40 animate-pulse rounded-lg bg-white/10" />
          ) : (
            <p className="mt-3 font-display text-4xl font-semibold tracking-tight">
              {formatNaira(wallet?.wallet.balanceMinor ?? 0)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {wallet?.wallet.currency ?? 'NGN'}
            </span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {wallet?.wallet.status ?? '—'}
            </span>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-white/50">
            If your wallet is frozen, contact support before making purchases.
          </p>
        </div>

        <StatCard
          label="Lifetime credited"
          value={wallet ? formatNaira(wallet.lifetimeCreditsMinor) : '—'}
          icon={ArrowDownLeft}
          tone="success"
          loading={walletQuery.isLoading}
          hint="All credits, including refunds and rewards"
        />
        <StatCard
          label="Lifetime spent"
          value={wallet ? formatNaira(wallet.lifetimeDebitsMinor) : '—'}
          icon={ArrowUpRight}
          tone="warning"
          loading={walletQuery.isLoading}
          hint="Purchases and adjustment debits"
        />
      </div>

      <div className="mt-6 card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Wallet history">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'ledger'}
              onClick={() => changeTab('ledger')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                tab === 'ledger' ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              Ledger
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'fundings'}
              onClick={() => changeTab('fundings')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                tab === 'fundings' ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              Funding attempts
            </button>
          </div>

          {tab === 'ledger' ? (
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter ledger entry type"
                className="field h-9 w-auto min-w-[150px] py-0 text-xs"
                value={type}
                onChange={(event) => {
                  setType(event.target.value as '' | LedgerType);
                  setPage(1);
                }}
              >
                {ledgerTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter ledger direction"
                className="field h-9 w-auto min-w-[120px] py-0 text-xs"
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value as '' | 'CREDIT' | 'DEBIT');
                  setPage(1);
                }}
              >
                <option value="">Both directions</option>
                <option value="CREDIT">Credits</option>
                <option value="DEBIT">Debits</option>
              </select>
            </div>
          ) : null}
        </div>

        {tab === 'ledger' ? (
          ledgerQuery.isLoading && !ledgerQuery.data ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : ledgerQuery.isError ? (
            <ErrorState title="Ledger unavailable" onRetry={() => void ledgerQuery.refetch()} />
          ) : ledgerQuery.data?.entries.length ? (
            <>
              <div className="table-wrap">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th scope="col">Entry</th>
                      <th scope="col">Reference</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Balance after</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerQuery.data.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'grid h-8 w-8 place-items-center rounded-lg',
                                entry.direction === 'CREDIT'
                                  ? 'bg-success/10 text-success'
                                  : 'bg-warning/10 text-warning'
                              )}
                            >
                              {entry.direction === 'CREDIT' ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-ink">
                                {LEDGER_LABELS[entry.type] ?? entry.type}
                              </p>
                              <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted">{entry.description}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {entry.transaction?.reference ? (
                            <Link
                              to={`/dashboard/transactions/${entry.transaction.reference}`}
                              className="font-mono text-[10px] text-brand-700 hover:underline dark:text-brand-300"
                            >
                              {entry.reference}
                            </Link>
                          ) : (
                            <span className="font-mono text-[10px] text-subtle">{entry.reference}</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              entry.direction === 'CREDIT' ? 'text-success' : 'text-ink'
                            )}
                          >
                            {entry.direction === 'CREDIT' ? '+' : '−'}
                            {formatNaira(entry.amountMinor)}
                          </span>
                        </td>
                        <td className="text-xs text-muted">{formatNaira(entry.balanceAfterMinor)}</td>
                        <td className="whitespace-nowrap text-xs text-muted">{formatRelative(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={ledgerQuery.data.pagination} onPageChange={setPage} />
            </>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No ledger entries match"
              description="Try clearing the filters or fund your wallet to create the first entry."
              action={<Button variant="outline" size="sm" onClick={() => setFundOpen(true)}>Fund wallet</Button>}
            />
          )
        ) : fundingsQuery.isLoading && !fundingsQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : fundingsQuery.isError ? (
          <ErrorState title="Funding history unavailable" onRetry={() => void fundingsQuery.refetch()} />
        ) : fundingsQuery.data?.fundings.length ? (
          <>
            <ul className="divide-y divide-line">
              {fundingsQuery.data.fundings.map((funding) => (
                <li key={funding.reference} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                    <Banknote className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{formatNaira(funding.amountMinor, { decimals: true })}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-subtle">{funding.reference}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{formatPaymentGateway(funding.gateway)}</Badge>
                    {funding.isSandbox ? <Badge tone="warning">Test</Badge> : null}
                    <StatusBadge status={funding.status} />
                  </div>
                  <p className="w-full text-[11px] text-muted sm:w-auto">{formatRelative(funding.createdAt)}</p>
                  {funding.status === 'PENDING' && funding.authorizationUrl ? (
                    <a
                      href={funding.authorizationUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      Continue <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : funding.status === 'SUCCESSFUL' ? (
                    <Link
                      to={`/wallet/funding/callback?reference=${funding.reference}`}
                      className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      Receipt
                    </Link>
                  ) : funding.status === 'PENDING' && funding.isSandbox ? (
                    <Link
                      to={`/mock-payment?reference=${funding.reference}`}
                      className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      Complete
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination pagination={fundingsQuery.data.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={Banknote}
            title="No funding attempts"
            description="When you start a top-up, the attempt and its gateway status appear here."
            action={<Button variant="outline" size="sm" onClick={() => setFundOpen(true)}>Fund wallet</Button>}
          />
        )}
      </div>

      <Card className="mt-6">
        <CardHeader title="How wallet history works" description="A transparent record you can reconcile" />
        <div className="grid gap-4 p-5 text-sm text-muted sm:grid-cols-3 sm:p-6">
          <div>
            <p className="font-semibold text-ink">Verified funding only</p>
            <p className="mt-1.5 text-xs leading-6">
              A gateway redirect is not treated as payment. Your balance changes only after the webhook or server-side
              verification confirms the payment.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Refunds are entries too</p>
            <p className="mt-1.5 text-xs leading-6">
              If a provider fails a purchase after debit, the refund appears as a separate ledger credit instead of
              erasing the original debit.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Need help?</p>
            <p className="mt-1.5 text-xs leading-6">
              Open a support ticket with the ledger or transaction reference if anything looks wrong.
            </p>
            <Link to="/dashboard/support" className={buttonStyles('outline', 'sm', 'mt-3')}>
              Contact support
            </Link>
          </div>
        </div>
      </Card>

      <FundWalletDialog open={fundOpen} onOpenChange={setFundOpen} />
    </>
  );
}
