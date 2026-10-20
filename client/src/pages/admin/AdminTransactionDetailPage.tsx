import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RotateCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import { CopyButton } from '@/components/ui/CopyButton';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { ServiceIcon, serviceLabel } from '@/components/ui/ServiceIcon';
import {
  useAdminTransaction,
  useApproveTransaction,
  useCheckTransactionStatus,
  useRejectTransaction,
} from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, formatNaira, STATUS_LABELS } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export function AdminTransactionDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const { isAdmin } = useAuth();
  const transactionQuery = useAdminTransaction(reference);
  const approve = useApproveTransaction();
  const reject = useRejectTransaction();
  const checkStatus = useCheckTransactionStatus();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const transaction = transactionQuery.data;

  if (transactionQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <Card className="space-y-4 p-6">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (transactionQuery.isError || !transaction) {
    return (
      <Card>
        <ErrorState
          title="Transaction could not load"
          onRetry={() => void transactionQuery.refetch()}
        />
      </Card>
    );
  }

  const canReview = isAdmin && transaction.status === 'REQUIRES_REVIEW';
  const canCheck = isAdmin && ['PENDING', 'PROCESSING'].includes(transaction.status);
  const history = [...transaction.statusHistory].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const handleApprove = async () => {
    setActionError(null);
    try {
      await approve.mutateAsync(transaction.reference);
      toast.success('Transaction approved for fulfilment');
      setApproveOpen(false);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleReject = async () => {
    setActionError(null);
    if (reason.trim().length < 10) {
      setActionError('Provide a reason of at least 10 characters.');
      return;
    }
    try {
      await reject.mutateAsync({ reference: transaction.reference, reason: reason.trim() });
      toast.success('Transaction rejected and wallet refunded where applicable');
      setRejectOpen(false);
      setReason('');
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleCheck = async () => {
    try {
      await checkStatus.mutateAsync(transaction.reference);
      toast.success('Provider status checked');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Helmet>
        <title>{transaction.reference} — QuickTopUp operations</title>
      </Helmet>

      <div className="mb-4">
        <Link
          to="/admin/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All transactions
        </Link>
      </div>

      <PageHeader
        eyebrow={`${serviceLabel(transaction.service)} transaction`}
        title={transaction.reference}
        description={`Created ${formatDateTime(transaction.createdAt)} by user ${transaction.userId ?? '—'}`}
        actions={
          <>
            {canCheck ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCheck()}
                isLoading={checkStatus.isPending}
                leftIcon={<RotateCw className="h-3.5 w-3.5" />}
              >
                Check provider
              </Button>
            ) : null}
            {canReview ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setRejectOpen(true);
                  }}
                  leftIcon={<XCircle className="h-3.5 w-3.5 text-danger" />}
                >
                  Reject & refund
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setApproveOpen(true);
                  }}
                  leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                >
                  Approve fulfilment
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {transaction.status === 'REQUIRES_REVIEW' ? (
        <Alert variant="warning" title="Held for review" className="mt-5">
          {transaction.reviewReason ?? 'This transaction needs a manual provider check before fulfilment or refund.'}
        </Alert>
      ) : null}
      {!isAdmin ? (
        <Alert variant="info" className="mt-5">
          Support access is read-only. An administrator must approve, reject, or re-check provider status.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
              <div className="flex items-center gap-4">
                <ServiceIcon service={transaction.service} size="lg" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{serviceLabel(transaction.service)}</p>
                  <p className="mt-1 font-display text-3xl font-semibold">{formatNaira(transaction.payableMinor)}</p>
                  <p className="mt-0.5 text-[11px] text-muted">Charged to wallet</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {transaction.isSandbox ? <Badge tone="warning">Sandbox</Badge> : null}
                <StatusBadge status={transaction.status} />
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <DescriptionList
                items={[
                  { label: 'User ID', value: <span className="font-mono text-xs">{transaction.userId ?? '—'}</span> },
                  { label: 'Provider', value: transaction.provider },
                  { label: 'Provider reference', value: <span className="font-mono text-xs">{transaction.providerReference ?? '—'}</span> },
                  { label: 'Provider status', value: transaction.providerStatus ?? '—' },
                  { label: 'Recipient', value: transaction.recipient.phone ?? transaction.recipient.meterNumber ?? transaction.recipient.smartcardNumber ?? '—' },
                  { label: 'Network / provider', value: transaction.recipient.network ?? transaction.recipient.disco ?? transaction.recipient.cableProvider ?? '—' },
                  { label: 'Plan', value: transaction.plan?.name ?? '—' },
                  { label: 'Payment method', value: transaction.paymentMethod },
                ]}
                columns={2}
              />
              {transaction.failureReason ? (
                <Alert variant="danger" title="Failure reason" className="mt-5">{transaction.failureReason}</Alert>
              ) : null}
              {transaction.fulfillment.token ? (
                <div className="mt-5 rounded-2xl border border-brand-500/25 bg-brand-500/10 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-800 dark:text-brand-200">
                      Prepaid token
                    </p>
                    <CopyButton value={transaction.fulfillment.token} />
                  </div>
                  <p className="mt-1.5 break-all font-mono text-lg font-semibold">{transaction.fulfillment.token}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Provider payload" description="Redacted provider response retained for investigation" />
            <div className="p-5">
              <pre className="scroll-thin max-h-96 overflow-auto rounded-2xl border border-line bg-surface p-4 text-[11px] leading-5">
                {transaction.providerPayload
                  ? JSON.stringify(transaction.providerPayload, null, 2)
                  : 'No provider payload recorded.'}
              </pre>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-subtle">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Secrets are redacted before persistence and API delivery.
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Amount breakdown" />
            <dl className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Face / bill value</dt><dd>{formatNaira(transaction.amountMinor)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Fee</dt><dd>{formatNaira(transaction.feeMinor)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Discount</dt><dd>{formatNaira(transaction.discountMinor)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-2.5"><dt className="font-semibold">Charged</dt><dd className="font-semibold">{formatNaira(transaction.payableMinor)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Provider cost</dt><dd>{formatNaira(transaction.costMinor ?? 0)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Margin</dt><dd>{formatNaira(transaction.marginMinor ?? 0)}</dd></div>
              {transaction.refundedAmountMinor ? (
                <div className="flex justify-between gap-3 text-success"><dt>Refunded</dt><dd>{formatNaira(transaction.refundedAmountMinor)}</dd></div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Status timeline" />
            <ol className="space-y-0 p-5">
              {history.map((event, index) => (
                <li key={`${event.status}-${event.at}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < history.length - 1 ? (
                    <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-line" aria-hidden="true" />
                  ) : null}
                  <span className={cn('relative z-10 mt-0.5 h-[23px] w-[23px] shrink-0 rounded-full border-2 border-raised', event.status === 'SUCCESSFUL' ? 'bg-success' : event.status === 'FAILED' || event.status === 'REFUNDED' ? 'bg-danger' : 'bg-line')} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{STATUS_LABELS[event.status] ?? event.status}</p>
                    <p className="mt-0.5 text-[10px] text-subtle">{formatDateTime(event.at)}</p>
                    {event.note ? <p className="mt-1 text-[11px] leading-5 text-muted">{event.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-2.5">
              <ClipboardCheck className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
              <p className="text-[11px] leading-5 text-muted">
                Decisions are audit-logged. Rejecting a held transaction triggers a refund to the customer's wallet through
                the ledger; never edit balances manually to compensate.
              </p>
            </div>
            <Link to="/admin/audit" className={buttonStyles('outline', 'sm', 'mt-4')}>
              Open audit log
            </Link>
          </Card>
        </div>
      </div>

      <Dialog
        open={approveOpen}
        onOpenChange={(open) => {
          setApproveOpen(open);
          if (!open) setActionError(null);
        }}
        title="Approve this transaction?"
        description="Approval sends the purchase to the provider for fulfilment. Confirm the recipient details first."
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveOpen(false)} disabled={approve.isPending}>Cancel</Button>
            <Button onClick={() => void handleApprove()} isLoading={approve.isPending}>Approve and fulfil</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
          <p>You are approving <strong>{transaction.reference}</strong> for {formatNaira(transaction.payableMinor)}.</p>
          <p className="text-xs text-muted">The wallet was already debited. If the provider fails now, the order should be rejected and refunded.</p>
        </div>
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) {
            setActionError(null);
            setReason('');
          }
        }}
        title="Reject and refund"
        description="This fails the transaction and credits the charged amount back to the customer's wallet."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>Cancel</Button>
            <Button variant="danger" onClick={() => void handleReject()} isLoading={reject.isPending}>Reject and refund</Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError ? <Alert variant="danger">{actionError}</Alert> : null}
          <Textarea
            label="Reason"
            rows={3}
            placeholder="Explain why this transaction cannot be fulfilled."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </Dialog>
    </>
  );
}
