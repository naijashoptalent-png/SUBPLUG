import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Send, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Select, Textarea } from '@/components/ui/Field';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminTicket, useReplyTicket } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { SupportTicket } from '@/types';

const categoryLabels: Record<string, string> = {
  TRANSACTION_DISPUTE: 'Transaction dispute',
  WALLET: 'Wallet or funding',
  ACCOUNT: 'Account and security',
  OTHER: 'Other',
};

function customerOf(ticket: SupportTicket) {
  if (typeof ticket.userId === 'string') {
    return { id: ticket.userId, name: 'Customer', email: '' };
  }
  return { id: ticket.userId._id, name: ticket.userId.fullName, email: ticket.userId.email };
}

export function AdminSupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const ticketQuery = useAdminTicket(id);
  const reply = useReplyTicket();
  const [body, setBody] = useState('');
  const [nextStatus, setNextStatus] = useState<'' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('');
  const [error, setError] = useState<string | null>(null);

  const ticket = ticketQuery.data;

  const submit = async () => {
    if (!id || !ticket) return;
    setError(null);
    if (body.trim().length < 2) {
      setError('Write a reply of at least 2 characters.');
      return;
    }
    try {
      await reply.mutateAsync({
        id,
        body: body.trim(),
        ...(nextStatus ? { status: nextStatus } : {}),
      });
      setBody('');
      setNextStatus('');
      toast.success('Reply sent to the customer');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (ticketQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Card className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (ticketQuery.isError || !ticket) {
    return (
      <Card>
        <ErrorState
          title="Ticket not found"
          description="It may have been removed, or the API could not be reached."
          onRetry={() => void ticketQuery.refetch()}
        />
      </Card>
    );
  }

  const customer = customerOf(ticket);
  const closed = ticket.status === 'CLOSED';
  const messages = ticket.messages ?? [];

  return (
    <>
      <Helmet>
        <title>{ticket.reference} — SubPlug support</title>
      </Helmet>

      <div className="mb-4">
        <Link
          to="/admin/support"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All tickets
        </Link>
      </div>

      <PageHeader
        eyebrow={`Ticket ${ticket.reference}`}
        title={ticket.subject}
        description={`Opened ${formatDateTime(ticket.createdAt)} · Last activity ${formatDateTime(ticket.lastMessageAt)}`}
        actions={
          <>
            {ticket.priority === 'HIGH' ? <Badge tone="danger">High priority</Badge> : null}
            <StatusBadge status={ticket.status} />
          </>
        }
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Conversation"
            description="Staff replies are emailed and shown in the customer's notification feed."
            action={<Badge tone="neutral">{messages.length} message{messages.length === 1 ? '' : 's'}</Badge>}
          />
          <div className="space-y-5 p-5 sm:p-6">
            {messages.map((message, index) => {
              const fromCustomer = message.authorRole === 'CUSTOMER';
              return (
                <div
                  key={message._id ?? index}
                  className={cn('flex gap-2.5', fromCustomer ? 'justify-start' : 'justify-end')}
                >
                  {fromCustomer ? (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                      fromCustomer
                        ? 'rounded-bl-md border border-line bg-surface text-ink'
                        : 'rounded-br-md bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950'
                    )}
                  >
                    <p
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider',
                        fromCustomer ? 'text-subtle' : 'text-white/65 dark:text-brand-950/60'
                      )}
                    >
                      {fromCustomer
                        ? message.authorName
                        : `${message.authorRole === 'ADMIN' ? 'Admin' : 'Support'} · ${
                            message.authorId === user?.id ? 'You' : message.authorName
                          }`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
                    <p
                      className={cn(
                        'mt-1.5 text-[10px]',
                        fromCustomer ? 'text-subtle' : 'text-white/55 dark:text-brand-950/50'
                      )}
                    >
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            {!messages.length ? <p className="text-sm text-muted">No messages recorded on this ticket.</p> : null}
          </div>

          <div className="border-t border-line p-5 sm:p-6">
            {closed ? (
              <Alert variant="info">
                This ticket is closed. A reply will reopen it if you set the status to Open or In progress.
              </Alert>
            ) : null}
            <div className={cn('space-y-3', closed && 'mt-4')}>
              {error ? <Alert variant="danger">{error}</Alert> : null}
              <Textarea
                label="Staff reply"
                rows={4}
                placeholder="Give the customer a clear update, next step, or resolution..."
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Select
                  label="Set status after replying"
                  className="sm:min-w-[230px]"
                  value={nextStatus}
                  onChange={(event) =>
                    setNextStatus(event.target.value as '' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED')
                  }
                >
                  <option value="">Automatic (open becomes in progress)</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                  <option value="OPEN">Reopen</option>
                </Select>
                <Button
                  onClick={() => void submit()}
                  isLoading={reply.isPending}
                  rightIcon={<Send className="h-3.5 w-3.5" />}
                >
                  Send reply
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ticket details" />
            <div className="space-y-4 p-5">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Reference', value: <span className="font-mono text-xs">{ticket.reference}</span> },
                  { label: 'Category', value: categoryLabels[ticket.category] ?? ticket.category },
                  { label: 'Priority', value: <Badge tone={ticket.priority === 'HIGH' ? 'danger' : 'neutral'}>{ticket.priority ?? 'NORMAL'}</Badge> },
                  { label: 'Opened', value: formatDateTime(ticket.createdAt) },
                  { label: 'Last activity', value: formatDateTime(ticket.lastMessageAt) },
                  {
                    label: 'Related transaction',
                    value: ticket.transactionReference ? (
                      <Link
                        to={`/admin/transactions/${ticket.transactionReference}`}
                        className="font-mono text-xs text-brand-700 hover:underline dark:text-brand-300"
                      >
                        {ticket.transactionReference}
                      </Link>
                    ) : (
                      '—'
                    ),
                  },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <div className="p-5">
              <p className="text-sm font-semibold">{customer.name}</p>
              {customer.email ? <p className="mt-0.5 text-xs text-muted">{customer.email}</p> : null}
              <p className="mt-2 break-all font-mono text-[10px] text-subtle">{customer.id}</p>
              <Link
                to={`/admin/users/${customer.id}`}
                className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Open customer account
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs leading-6 text-muted">
              Replies and status changes are audit-logged. Do not promise a refund or reversal unless the transaction
              record supports it. Resolve disputes by checking the provider status first.
            </p>
            {ticket.transactionReference ? (
              <Link
                to={`/admin/transactions/${ticket.transactionReference}`}
                className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Review related transaction
              </Link>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
