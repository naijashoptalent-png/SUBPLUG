import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Download, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { usePurchases } from '@/hooks/usePurchases';
import { SERVICE_LABELS } from '@/lib/format';

const statuses = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SUCCESSFUL', label: 'Successful' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REQUIRES_REVIEW', label: 'In review' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function toIsoStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toIsoEnd(date: string) {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}

export function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const purchasesQuery = usePurchases({
    page,
    limit: 20,
    ...(service ? { service } : {}),
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(from ? { from: toIsoStart(from) } : {}),
    ...(to ? { to: toIsoEnd(to) } : {}),
  });

  const reset = () => {
    setPage(1);
    setService('');
    setStatus('');
    setSearch('');
    setFrom('');
    setTo('');
  };

  const hasFilters = Boolean(service || status || search || from || to);

  return (
    <>
      <Helmet>
        <title>Transactions — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Activity"
        title="Transactions"
        description="Search purchases, trace fulfilment statuses, and open a receipt for any order."
        actions={
          <Link to="/dashboard/support" className={buttonStyles('outline', 'sm')}>
            Dispute a transaction
          </Link>
        }
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
            <Input
              aria-label="Search transactions"
              placeholder="Search reference or recipient"
              leading={<Search className="h-4 w-4" />}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Filter by service"
              className="field py-2.5 text-sm"
              value={service}
              onChange={(event) => {
                setService(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All services</option>
              {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              className="field py-2.5 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
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
        </div>

        {purchasesQuery.isLoading && !purchasesQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : purchasesQuery.isError ? (
          <ErrorState
            title="Transactions could not load"
            description="Try adjusting the filters or refreshing."
            onRetry={() => void purchasesQuery.refetch()}
          />
        ) : (
          <>
            <TransactionTable
              transactions={purchasesQuery.data?.transactions ?? []}
              emptyTitle={hasFilters ? 'No transactions match these filters' : 'No transactions yet'}
              emptyDescription={
                hasFilters
                  ? 'Try a different date range, status, or search term.'
                  : 'Buy airtime or data, pay a bill, and the receipt will appear here.'
              }
            />
            <Pagination pagination={purchasesQuery.data?.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Need a formal statement? Open a support ticket and include the date range.
        </p>
        <p>Status updates are fetched from the server; a browser refresh does not change a transaction.</p>
      </div>
    </>
  );
}
