import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { useAdminTransactions } from '@/hooks/useAdmin';
import { SERVICE_LABELS } from '@/lib/format';

function toIsoStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}
function toIsoEnd(date: string) {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}

const statuses = [
  'CREATED',
  'PENDING',
  'PROCESSING',
  'SUCCESSFUL',
  'FAILED',
  'REQUIRES_REVIEW',
  'REFUNDED',
  'REVERSED',
];

export function AdminTransactionsPage() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [userId, setUserId] = useState(searchParams.get('userId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const transactionsQuery = useAdminTransactions({
    page,
    limit: 20,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(service ? { service } : {}),
    ...(status ? { status } : {}),
    ...(userId.trim() ? { userId: userId.trim() } : {}),
    ...(from ? { from: toIsoStart(from) } : {}),
    ...(to ? { to: toIsoEnd(to) } : {}),
  });

  const reset = () => {
    setPage(1);
    setSearch('');
    setService('');
    setStatus('');
    setUserId('');
    setFrom('');
    setTo('');
  };

  const hasFilters = Boolean(search || service || status || userId || from || to);

  return (
    <>
      <Helmet>
        <title>Transactions — SubPlug operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Operations"
        title="Transactions"
        description="Full transaction search across customers. Open a transaction to trace provider status or resolve a review."
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search transactions"
                placeholder="Reference, phone, or recipient"
                className="field py-2.5 pl-10 text-sm"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="field py-2.5 text-sm"
              aria-label="Filter by service"
              value={service}
              onChange={(event) => {
                setService(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All services</option>
              {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="field py-2.5 text-sm"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((option) => (
                <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <input
              type="date"
              aria-label="From date"
              className="field py-2.5 text-sm"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
            <input
              type="date"
              aria-label="To date"
              className="field py-2.5 text-sm"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!hasFilters}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              className="h-[42px]"
            >
              Reset
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              aria-label="Filter by user ID"
              placeholder="Filter by exact user ID"
              className="field h-9 max-w-sm py-0 font-mono text-[11px]"
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setPage(1);
              }}
            />
            {userId ? (
              <Badge tone="info">
                User filter active
                <button
                  type="button"
                  className="ml-1 font-semibold underline underline-offset-2"
                  onClick={() => {
                    setUserId('');
                    setPage(1);
                  }}
                >
                  clear
                </button>
              </Badge>
            ) : null}
          </div>
        </div>

        {transactionsQuery.isLoading && !transactionsQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : transactionsQuery.isError ? (
          <ErrorState title="Transactions could not load" onRetry={() => void transactionsQuery.refetch()} />
        ) : (
          <>
            <TransactionTable
              transactions={transactionsQuery.data?.transactions ?? []}
              linkBase="/admin/transactions"
              showUser
              emptyTitle={hasFilters ? 'No transactions match' : 'No transactions recorded'}
              emptyDescription={
                hasFilters ? 'Try a different date range or filter.' : 'Transactions will appear here as customers buy.'
              }
            />
            <Pagination pagination={transactionsQuery.data?.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
