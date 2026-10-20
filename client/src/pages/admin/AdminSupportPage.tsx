import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ClipboardList, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminTickets } from '@/hooks/useAdmin';
import { formatRelative } from '@/lib/format';
import type { SupportTicket } from '@/types';

const categoryLabels: Record<SupportTicket['category'], string> = {
  TRANSACTION_DISPUTE: 'Transaction dispute',
  WALLET: 'Wallet or funding',
  ACCOUNT: 'Account and security',
  OTHER: 'Other',
};

const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

function customerOf(ticket: SupportTicket) {
  if (typeof ticket.userId === 'string') {
    return { id: ticket.userId, name: 'Customer', email: '' };
  }
  return { id: ticket.userId._id, name: ticket.userId.fullName, email: ticket.userId.email };
}

export function AdminSupportPage() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');

  const ticketsQuery = useAdminTickets({
    page,
    limit: 20,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
  });

  const hasFilters = Boolean(search || status);

  const reset = () => {
    setPage(1);
    setSearch('');
    setStatus('');
  };

  return (
    <>
      <Helmet>
        <title>Support — QuickTopUp operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Operations"
        title="Support"
        description="Customer conversations across disputes, wallet issues, and account questions. Reply with context and move the ticket to a clear status."
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-[1.5fr_0.8fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search tickets"
                placeholder="Ticket reference, subject, or transaction reference"
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
              aria-label="Filter tickets by status"
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

        {ticketsQuery.isLoading && !ticketsQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : ticketsQuery.isError ? (
          <ErrorState title="Tickets could not load" onRetry={() => void ticketsQuery.refetch()} />
        ) : ticketsQuery.data?.tickets.length ? (
          <>
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Category</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Messages</th>
                    <th scope="col">Last activity</th>
                    <th scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsQuery.data.tickets.map((ticket) => {
                    const customer = customerOf(ticket);
                    return (
                      <tr key={ticket._id}>
                        <td>
                          <Link to={`/admin/support/${ticket._id}`} className="block max-w-[280px]">
                            <p className="truncate text-xs font-semibold text-ink">{ticket.subject}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-subtle">{ticket.reference}</p>
                          </Link>
                        </td>
                        <td>
                          <p className="max-w-[180px] truncate text-xs text-ink">{customer.name}</p>
                          {customer.email ? (
                            <p className="max-w-[180px] truncate text-[10px] text-subtle">{customer.email}</p>
                          ) : (
                            <p className="font-mono text-[10px] text-subtle">{customer.id}</p>
                          )}
                        </td>
                        <td className="text-xs text-muted">{categoryLabels[ticket.category] ?? ticket.category}</td>
                        <td>
                          <Badge tone={ticket.priority === 'HIGH' ? 'danger' : 'neutral'}>
                            {ticket.priority ?? 'NORMAL'}
                          </Badge>
                        </td>
                        <td><StatusBadge status={ticket.status} /></td>
                        <td className="text-xs text-muted">{ticket.messages?.length ?? 0}</td>
                        <td className="whitespace-nowrap text-xs text-muted">{formatRelative(ticket.lastMessageAt)}</td>
                        <td className="text-right">
                          <Link
                            to={`/admin/support/${ticket._id}`}
                            className="inline-grid h-8 w-8 place-items-center rounded-lg text-subtle transition hover:bg-surface hover:text-ink"
                            aria-label={`Open ${ticket.reference}`}
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination pagination={ticketsQuery.data.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No tickets match' : 'No support tickets'}
            description={
              hasFilters
                ? 'Try a different status or search term.'
                : 'Tickets opened by customers will appear here.'
            }
          />
        )}
      </Card>
    </>
  );
}
