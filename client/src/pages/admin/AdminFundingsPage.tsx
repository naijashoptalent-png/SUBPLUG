import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { Banknote, Eye, RotateCcw, RotateCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminFundings, useApproveManualFunding, useRecheckFunding } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, formatNaira, formatRelative } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import type { Funding, FundingStatus } from '@/types';

const statuses: FundingStatus[] = ['PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED', 'REQUIRES_REVIEW'];

const recheckable: FundingStatus[] = ['PENDING', 'REQUIRES_REVIEW'];

function isRecheckable(status: FundingStatus) {
  return recheckable.includes(status);
}

export function AdminFundingsPage() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [userId, setUserId] = useState(searchParams.get('userId') ?? '');
  const [selected, setSelected] = useState<Funding | null>(null);
  const recheck = useRecheckFunding();
  const approveManual = useApproveManualFunding();

  const fundingsQuery = useAdminFundings({
    page,
    limit: 20,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
    ...(userId.trim() ? { userId: userId.trim() } : {}),
  });

  const reset = () => {
    setPage(1);
    setSearch('');
    setStatus('');
    setUserId('');
  };

  const hasFilters = Boolean(search || status || userId);

  const runRecheck = async (funding: Funding) => {
    try {
      await recheck.mutateAsync(funding.reference);
      toast.success(`Funding ${funding.reference} was rechecked with the gateway`);
      setSelected(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const runManualApproval = async (funding: Funding) => {
    try {
      await approveManual.mutateAsync(funding.reference);
      toast.success(`Manual funding ${funding.reference} was verified and credited`);
      setSelected(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <Helmet>
        <title>Wallet fundings — SubPlug operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Operations"
        title="Wallet fundings"
        description="Every gateway funding attempt, including uncredited and review cases. Rechecking asks the gateway for the authoritative status; it never marks an unverified payment as successful."
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-[1.5fr_0.7fr_0.9fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search funding references"
                placeholder="Search funding reference"
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
              aria-label="Filter fundings by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <input
              aria-label="Filter by exact user ID"
              placeholder="Filter by user ID"
              className="field py-2.5 font-mono text-[11px]"
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
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

        {fundingsQuery.isLoading && !fundingsQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : fundingsQuery.isError ? (
          <ErrorState title="Fundings could not load" onRetry={() => void fundingsQuery.refetch()} />
        ) : fundingsQuery.data?.fundings.length ? (
          <>
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Gateway</th>
                    <th scope="col">Created</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {fundingsQuery.data.fundings.map((funding) => (
                    <tr key={funding.reference}>
                      <td>
                        <p className="font-mono text-[11px] font-semibold text-ink">{funding.reference}</p>
                        {funding.gatewayReference ? (
                          <p className="mt-0.5 max-w-[200px] truncate font-mono text-[10px] text-subtle">
                            {funding.gatewayReference}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        {funding.userId ? (
                          <Link
                            to={`/admin/users/${funding.userId}`}
                            className="font-mono text-[10px] text-brand-700 hover:underline dark:text-brand-300"
                          >
                            {funding.userId}
                          </Link>
                        ) : (
                          <span className="text-xs text-subtle">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs font-semibold">{formatNaira(funding.amountMinor)}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={funding.status} />
                          {funding.isSandbox ? <Badge tone="warning">Sandbox</Badge> : null}
                        </div>
                      </td>
                      <td className="text-xs capitalize text-muted">{funding.gateway}</td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {funding.createdAt ? formatRelative(funding.createdAt) : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && funding.gateway === 'manual' && funding.status === 'PENDING' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void runManualApproval(funding)}
                              isLoading={approveManual.isPending && approveManual.variables === funding.reference}
                            >
                              Approve transfer
                            </Button>
                          ) : isAdmin && funding.gateway !== 'manual' && isRecheckable(funding.status) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void runRecheck(funding)}
                              isLoading={recheck.isPending && recheck.variables === funding.reference}
                              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                            >
                              Recheck
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(funding)}
                            leftIcon={<Eye className="h-3.5 w-3.5" />}
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={fundingsQuery.data.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={Banknote}
            title={hasFilters ? 'No fundings match' : 'No funding attempts yet'}
            description={
              hasFilters
                ? 'Try a different status, reference, or user ID.'
                : 'Funding attempts appear here as soon as a customer starts a payment.'
            }
          />
        )}
      </Card>

      <p className="mt-4 text-[11px] text-subtle">
        Only an administrator can recheck a funding. Support staff can review the status and reference to help a customer.
      </p>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected ? `Funding ${selected.reference}` : 'Funding details'}
        description="Gateway and ledger state for this wallet funding."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && isAdmin && selected.gateway === 'manual' && selected.status === 'PENDING' ? (
              <Button
                onClick={() => void runManualApproval(selected)}
                isLoading={approveManual.isPending}
                leftIcon={<Banknote className="h-3.5 w-3.5" />}
              >
                Verify and credit transfer
              </Button>
            ) : selected && isAdmin && selected.gateway !== 'manual' && isRecheckable(selected.status) ? (
              <Button
                onClick={() => void runRecheck(selected)}
                isLoading={recheck.isPending}
                leftIcon={<RotateCw className="h-3.5 w-3.5" />}
              >
                Recheck with gateway
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: 'Reference', value: <span className="font-mono text-xs">{selected.reference}</span> },
                { label: 'Amount', value: formatNaira(selected.amountMinor), mono: false },
                { label: 'Status', value: <StatusBadge status={selected.status} /> },
                { label: 'Gateway', value: selected.gateway },
                { label: 'Gateway reference', value: <span className="font-mono text-xs">{selected.gatewayReference ?? '—'}</span> },
                ...(selected.gateway === 'manual'
                  ? [
                      {
                        label: 'Sender name',
                        value: typeof selected.gatewayPayload?.senderName === 'string' ? selected.gatewayPayload.senderName : '—',
                      },
                      {
                        label: 'Sending bank',
                        value: typeof selected.gatewayPayload?.senderBank === 'string' ? selected.gatewayPayload.senderBank : '—',
                      },
                    ]
                  : []),
                { label: 'Mode', value: selected.isSandbox ? <Badge tone="warning">Sandbox</Badge> : <Badge tone="success">Live</Badge> },
                { label: 'Customer', value: selected.userId ? <span className="font-mono text-xs">{selected.userId}</span> : '—' },
                {
                  label: 'Created',
                  value: selected.createdAt ? formatDateTime(selected.createdAt) : '—',
                },
                { label: 'Paid at', value: selected.paidAt ? formatDateTime(selected.paidAt) : '—' },
                { label: 'Verified at', value: selected.verifiedAt ? formatDateTime(selected.verifiedAt) : '—' },
                { label: 'Credited at', value: selected.creditedAt ? formatDateTime(selected.creditedAt) : '—' },
              ]}
              columns={2}
            />
            {selected.failureReason ? (
              <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
                <p className="font-semibold">Failure reason</p>
                <p className="mt-0.5">{selected.failureReason}</p>
              </div>
            ) : null}
            {selected.reviewReason ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                <p className="font-semibold">Review reason</p>
                <p className="mt-0.5">{selected.reviewReason}</p>
              </div>
            ) : null}
            {selected.userId ? (
              <Link
                to={`/admin/users/${selected.userId}`}
                className="inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Open customer account
              </Link>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
