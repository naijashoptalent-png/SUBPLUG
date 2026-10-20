import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, LifeBuoy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAddTicketMessage, useTicket } from '@/hooks/useSupport';
import { useAuth } from '@/hooks/useAuth';
import { ticketReplySchema, type TicketReplyForm } from '@/lib/schemas';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, string> = {
  TRANSACTION_DISPUTE: 'Transaction dispute',
  WALLET: 'Wallet or funding',
  ACCOUNT: 'Account and security',
  OTHER: 'Other',
};

export function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const ticketQuery = useTicket(id);
  const addMessage = useAddTicketMessage();
  const form = useForm<TicketReplyForm>({
    resolver: zodResolver(ticketReplySchema),
    defaultValues: { body: '' },
  });

  const ticket = ticketQuery.data;

  const submit = form.handleSubmit(async (values) => {
    if (!id) return;
    try {
      await addMessage.mutateAsync({ ticketId: id, body: values.body });
      form.reset({ body: '' });
      toast.success('Reply sent');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  if (ticketQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Card className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    );
  }

  if (ticketQuery.isError || !ticket) {
    return (
      <Card>
        <ErrorState
          title="Ticket not found"
          description="It may have been removed, or it belongs to another account."
          onRetry={() => void ticketQuery.refetch()}
        />
      </Card>
    );
  }

  const closed = ticket.status === 'CLOSED';

  return (
    <>
      <Helmet>
        <title>{ticket.reference} — QuickTopUp support</title>
      </Helmet>

      <div className="mb-4">
        <Link
          to="/dashboard/support"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All tickets
        </Link>
      </div>

      <PageHeader
        eyebrow={`Ticket ${ticket.reference}`}
        title={ticket.subject}
        description={`Opened ${formatDateTime(ticket.createdAt)}`}
        actions={<StatusBadge status={ticket.status} />}
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Conversation"
            description="Messages are visible to you and the support team."
            action={
              ticket.priority === 'HIGH' ? <Badge tone="danger">High priority</Badge> : null
            }
          />
          <div className="space-y-5 p-5 sm:p-6">
            {(ticket.messages ?? []).map((message, index) => {
              const fromCustomer = message.authorRole === 'CUSTOMER';
              const mine = message.authorId === user?.id;
              return (
                <div key={message._id ?? index} className={cn('flex gap-2.5', fromCustomer ? 'justify-end' : 'justify-start')}>
                  {!fromCustomer ? (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300">
                      <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                      fromCustomer
                        ? 'rounded-br-md bg-brand-700 text-white dark:bg-brand-500 dark:text-brand-950'
                        : 'rounded-bl-md border border-line bg-surface text-ink'
                    )}
                  >
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wider', fromCustomer ? 'text-white/65 dark:text-brand-950/60' : 'text-subtle')}>
                      {mine ? 'You' : message.authorRole === 'CUSTOMER' ? message.authorName : `Support · ${message.authorName}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
                    <p className={cn('mt-1.5 text-[10px]', fromCustomer ? 'text-white/55 dark:text-brand-950/50' : 'text-subtle')}>
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line p-5 sm:p-6">
            {closed ? (
              <Alert variant="info">
                This ticket is closed. Open a new ticket if you need more help.
              </Alert>
            ) : (
              <form onSubmit={submit} className="space-y-3" noValidate>
                <Textarea
                  label="Reply"
                  rows={3}
                  placeholder="Add more information for the support team..."
                  error={form.formState.errors.body?.message}
                  {...form.register('body')}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    isLoading={addMessage.isPending}
                    rightIcon={<Send className="h-3.5 w-3.5" />}
                  >
                    Send reply
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ticket details" />
            <div className="p-5">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Reference', value: <span className="font-mono text-xs">{ticket.reference}</span> },
                  { label: 'Category', value: categoryLabels[ticket.category] ?? ticket.category },
                  { label: 'Opened', value: formatDateTime(ticket.createdAt) },
                  { label: 'Last activity', value: formatDateTime(ticket.lastMessageAt) },
                  {
                    label: 'Related transaction',
                    value: ticket.transactionReference ? (
                      <Link
                        to={`/dashboard/transactions/${ticket.transactionReference}`}
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
          <Card className="p-5">
            <p className="text-xs leading-6 text-muted">
              Do not open duplicate tickets for the same issue. Add new information here so the team keeps the full
              context.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
