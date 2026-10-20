import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, LifeBuoy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useCreateTicket, useTickets } from '@/hooks/useSupport';
import { supportTicketSchema, type SupportTicketForm } from '@/lib/schemas';
import { formatRelative } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

const categories = [
  { value: 'TRANSACTION_DISPUTE', label: 'Transaction dispute' },
  { value: 'WALLET', label: 'Wallet or funding' },
  { value: 'ACCOUNT', label: 'Account and security' },
  { value: 'OTHER', label: 'Something else' },
] as const;

const categoryLabels: Record<string, string> = Object.fromEntries(categories.map((item) => [item.value, item.label]));

export function SupportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticketsQuery = useTickets(page);
  const createTicket = useCreateTicket();
  const prefilledReference = searchParams.get('reference') ?? '';

  const form = useForm<SupportTicketForm>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: '',
      category: prefilledReference ? 'TRANSACTION_DISPUTE' : 'WALLET',
      message: '',
      transactionReference: prefilledReference,
    },
  });

  useEffect(() => {
    if (prefilledReference) {
      form.setValue('transactionReference', prefilledReference);
      form.setValue('category', 'TRANSACTION_DISPUTE');
      setOpen(true);
    }
  }, [prefilledReference, form]);

  const showForm = () => {
    setError(null);
    setOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const ticket = await createTicket.mutateAsync({
        subject: values.subject,
        category: values.category,
        message: values.message,
        ...(values.transactionReference ? { transactionReference: values.transactionReference } : {}),
      });
      toast.success('Support ticket opened');
      form.reset({ subject: '', category: 'WALLET', message: '', transactionReference: '' });
      setOpen(false);
      navigate(`/dashboard/support/${ticket._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <>
      <Helmet>
        <title>Support — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Help centre"
        title="Support"
        description="Open a ticket for transaction issues, funding problems, or account questions. Include a reference where possible."
        actions={
          <Button onClick={showForm} leftIcon={<Plus className="h-4 w-4" />}>
            New ticket
          </Button>
        }
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Your tickets" description="Replies from our support team appear in the ticket thread." />
          {ticketsQuery.isLoading && !ticketsQuery.data ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : ticketsQuery.isError ? (
            <ErrorState title="Tickets could not load" onRetry={() => void ticketsQuery.refetch()} />
          ) : ticketsQuery.data?.tickets.length ? (
            <>
              <ul className="divide-y divide-line">
                {ticketsQuery.data.tickets.map((ticket) => (
                  <li key={ticket._id}>
                    <Link
                      to={`/dashboard/support/${ticket._id}`}
                      className="flex items-center gap-3 px-5 py-4 transition hover:bg-surface"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                        <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{ticket.subject}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                          <span className="font-mono">{ticket.reference}</span>
                          <span aria-hidden="true">·</span>
                          <span>{categoryLabels[ticket.category] ?? ticket.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelative(ticket.lastMessageAt)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {ticket.priority === 'HIGH' ? <Badge tone="danger">High</Badge> : null}
                        <StatusBadge status={ticket.status} />
                        <ChevronRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination pagination={ticketsQuery.data.pagination} onPageChange={setPage} />
            </>
          ) : (
            <EmptyState
              icon={LifeBuoy}
              title="No support tickets"
              description="If something is not right with a purchase or your wallet, open a ticket and we will investigate."
              action={<Button onClick={showForm}>Open a ticket</Button>}
            />
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">What to include</h2>
            <ul className="mt-3 space-y-2.5 text-xs leading-6 text-muted">
              <li>• The transaction reference, if your issue is about a purchase.</li>
              <li>• The funding reference, if a wallet top-up is missing.</li>
              <li>• The phone number or meter number involved.</li>
              <li>• What you expected and what actually happened.</li>
            </ul>
            <p className="mt-3 text-[11px] leading-5 text-subtle">
              Never send your password, one-time authenticator code, or full card details.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Response times</h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              Tickets are answered in the order received. Transaction disputes may require a provider check, so include
              the reference and allow time for the provider to respond.
            </p>
          </Card>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Open a support ticket"
        description="Give us enough detail to investigate without asking follow-up questions."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={createTicket.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="support-ticket-form" isLoading={createTicket.isPending}>
              Submit ticket
            </Button>
          </>
        }
      >
        <form id="support-ticket-form" onSubmit={submit} className="space-y-4" noValidate>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input
            label="Subject"
            placeholder="Briefly describe the issue"
            error={form.formState.errors.subject?.message}
            {...form.register('subject')}
          />
          <Select label="Category" error={form.formState.errors.category?.message} {...form.register('category')}>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>
          <Input
            label="Transaction or funding reference (optional)"
            placeholder="e.g. TXN-..."
            error={form.formState.errors.transactionReference?.message}
            {...form.register('transactionReference')}
          />
          <Textarea
            label="What happened?"
            placeholder="Include what you were trying to do, the number involved, and any error message."
            rows={5}
            error={form.formState.errors.message?.message}
            {...form.register('message')}
          />
        </form>
      </Dialog>
    </>
  );
}
