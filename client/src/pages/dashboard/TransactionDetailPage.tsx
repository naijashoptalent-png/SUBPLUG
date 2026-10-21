import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  FileWarning,
  LifeBuoy,
  Printer,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { CopyButton } from '@/components/ui/CopyButton';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { ServiceIcon, serviceLabel } from '@/components/ui/ServiceIcon';
import { usePurchase } from '@/hooks/usePurchases';
import {
  formatDateTime,
  formatNaira,
  SERVICE_LABELS,
  STATUS_LABELS,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TransactionStatus } from '@/types';

const statusIcon: Partial<Record<TransactionStatus, typeof CheckCircle2>> = {
  SUCCESSFUL: CheckCircle2,
  FAILED: XCircle,
  REQUIRES_REVIEW: FileWarning,
};

export function TransactionDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const purchaseQuery = usePurchase(reference);
  const transaction = purchaseQuery.data;

  if (purchaseQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-48" />
        <Card className="space-y-4 p-6">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (purchaseQuery.isError || !transaction) {
    return (
      <Card>
        <ErrorState
          title="Transaction not found"
          description="This reference does not belong to your account or no longer exists."
          onRetry={() => void purchaseQuery.refetch()}
        />
        <div className="flex justify-center pb-8">
          <Link to="/dashboard/transactions" className={buttonStyles('outline')}>
            Back to transactions
          </Link>
        </div>
      </Card>
    );
  }

  const history = [...transaction.statusHistory].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const recipientItems = [
    ...(transaction.recipient.phone
      ? [{ label: 'Phone number', value: transaction.recipient.phone }]
      : []),
    ...(transaction.recipient.network ? [{ label: 'Network', value: transaction.recipient.network }] : []),
    ...(transaction.recipient.disco ? [{ label: 'Distribution company', value: transaction.recipient.disco }] : []),
    ...(transaction.recipient.meterNumber
      ? [{ label: 'Meter number', value: transaction.recipient.meterNumber }]
      : []),
    ...(transaction.recipient.meterType ? [{ label: 'Meter type', value: transaction.recipient.meterType }] : []),
    ...(transaction.recipient.cableProvider
      ? [{ label: 'Cable provider', value: transaction.recipient.cableProvider }]
      : []),
    ...(transaction.recipient.smartcardNumber
      ? [{ label: 'Smartcard number', value: transaction.recipient.smartcardNumber }]
      : []),
    ...(transaction.fulfillment.customerName
      ? [{ label: 'Customer name', value: transaction.fulfillment.customerName }]
      : []),
  ];

  return (
    <>
      <Helmet>
        <title>{transaction.reference} — SubPlug</title>
      </Helmet>

      <div className="mb-4">
        <Link
          to="/dashboard/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to transactions
        </Link>
      </div>

      <PageHeader
        eyebrow="Transaction receipt"
        title={SERVICE_LABELS[transaction.service]}
        description={`Reference ${transaction.reference}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void purchaseQuery.refetch()}
              isLoading={purchaseQuery.isFetching}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="h-3.5 w-3.5" />}
            >
              Print
            </Button>
          </>
        }
      />

      {transaction.duplicate ? (
        <Alert variant="info" className="mt-5">
          This transaction was returned from an idempotent retry. Only one wallet debit was made.
        </Alert>
      ) : null}
      {transaction.heldForReview || transaction.status === 'REQUIRES_REVIEW' ? (
        <Alert variant="warning" title="This transaction is in review" className="mt-5">
          {transaction.reviewReason ??
            'The provider returned an uncertain result. An administrator will review it before finalising.'}
        </Alert>
      ) : null}
      {transaction.status === 'FAILED' && transaction.refundedAt ? (
        <Alert variant="info" title="Refunded to wallet" className="mt-5">
          {formatNaira(transaction.refundedAmountMinor ?? transaction.payableMinor)} was credited back through a separate
          ledger entry on {formatDateTime(transaction.refundedAt)}.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
              <div className="flex items-center gap-4">
                <ServiceIcon service={transaction.service} size="lg" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                    {serviceLabel(transaction.service)}
                  </p>
                  <p className="mt-1 font-display text-3xl font-semibold tracking-tight">
                    {formatNaira(transaction.payableMinor)}
                  </p>
                </div>
              </div>
              <StatusBadge status={transaction.status} />
            </div>

            <div className="p-5 sm:p-6">
              <DescriptionList
                items={[
                  { label: 'Reference', value: <span className="font-mono text-xs">{transaction.reference}</span> },
                  { label: 'Date', value: formatDateTime(transaction.createdAt) },
                  { label: 'Payment method', value: transaction.paymentMethod },
                  ...recipientItems,
                ]}
                columns={2}
              />

              {transaction.plan ? (
                <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Plan</p>
                  <p className="mt-1 text-sm font-semibold">{transaction.plan.name ?? transaction.plan.code}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[transaction.plan.dataVolume, transaction.plan.validity].filter(Boolean).join(' · ') ||
                      'Package details'}
                  </p>
                </div>
              ) : null}

              {transaction.fulfillment.token ? (
                <div className="mt-5 rounded-2xl border border-brand-500/25 bg-brand-500/10 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-800 dark:text-brand-200">
                        Prepaid token
                      </p>
                      {transaction.fulfillment.units ? (
                        <p className="mt-0.5 text-xs text-muted">{transaction.fulfillment.units} units</p>
                      ) : null}
                    </div>
                    <CopyButton value={transaction.fulfillment.token} />
                  </div>
                  <p className="mt-2 break-all font-mono text-lg font-semibold text-brand-950 dark:text-brand-100">
                    {transaction.fulfillment.token}
                  </p>
                  {transaction.isSandbox ? (
                    <p className="mt-1 text-[11px] font-medium text-warning">Sandbox token — not valid on a real meter.</p>
                  ) : null}
                </div>
              ) : null}

              {transaction.failureReason ? (
                <Alert variant="danger" title="Failure reason" className="mt-5">
                  {transaction.failureReason}
                </Alert>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Amount breakdown" description="All amounts are stored as integer kobo" />
            <dl className="space-y-2.5 p-5 text-sm sm:p-6">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Face value / bill amount</dt>
                <dd className="font-medium">{formatNaira(transaction.amountMinor)}</dd>
              </div>
              {transaction.feeMinor > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Service fee</dt>
                  <dd className="font-medium">{formatNaira(transaction.feeMinor)}</dd>
                </div>
              ) : null}
              {transaction.discountMinor > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Discount</dt>
                  <dd className="font-medium text-success">− {formatNaira(transaction.discountMinor)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-t border-line pt-2.5">
                <dt className="font-semibold">Total charged</dt>
                <dd className="font-semibold">{formatNaira(transaction.payableMinor)}</dd>
              </div>
              {transaction.refundedAmountMinor ? (
                <div className="flex justify-between gap-3 text-success">
                  <dt>Refunded</dt>
                  <dd className="font-semibold">{formatNaira(transaction.refundedAmountMinor)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Status timeline" description="Every state change is recorded" />
            <ol className="space-y-0 p-5 sm:p-6">
              {history.map((event, index) => {
                const Icon = statusIcon[event.status] ?? (index === history.length - 1 ? Clock3 : CheckCircle2);
                const isLast = index === history.length - 1;
                return (
                  <li key={`${event.status}-${event.at}`} className="relative flex gap-3 pb-5 last:pb-0">
                    {!isLast ? (
                      <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-px bg-line" aria-hidden="true" />
                    ) : null}
                    <span
                      className={cn(
                        'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border',
                        event.status === 'SUCCESSFUL'
                          ? 'border-success/25 bg-success/10 text-success'
                          : event.status === 'FAILED'
                            ? 'border-danger/25 bg-danger/10 text-danger'
                            : 'border-line bg-surface text-muted'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs font-semibold text-ink">{STATUS_LABELS[event.status] ?? event.status}</p>
                      <p className="mt-0.5 text-[11px] text-subtle">{formatDateTime(event.at)}</p>
                      {event.note ? <p className="mt-1 text-[11px] leading-5 text-muted">{event.note}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Delivery status" description="Useful for support investigations" />
            <div className="space-y-3 p-5 text-xs sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Order status</span>
                <span className="font-medium text-ink">{STATUS_LABELS[transaction.status] ?? transaction.status}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Environment</span>
                <Badge tone={transaction.isSandbox ? 'warning' : 'success'}>
                  {transaction.isSandbox ? 'Sandbox' : 'Live'}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <LifeBuoy className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
              Something wrong?
            </p>
            <p className="mt-1.5 text-xs leading-6 text-muted">
              Open a ticket and include this reference. Do not send your password or card details.
            </p>
            <Link
              to={`/dashboard/support?reference=${encodeURIComponent(transaction.reference)}`}
              className={buttonStyles('outline', 'sm', 'mt-4')}
            >
              Contact support
            </Link>
          </Card>
        </div>
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-[11px] text-subtle">
        <Copy className="h-3 w-3" aria-hidden="true" />
        This page shows the server&apos;s record. It does not prove delivery by itself; the fulfilment status is shown
        separately.
      </p>
    </>
  );
}
