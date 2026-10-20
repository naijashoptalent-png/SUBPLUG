import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RotateCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { useFunding, useVerifyFunding } from '@/hooks/useWallet';
import { formatNaira } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

export function FundingCallbackPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') ?? searchParams.get('trxref') ?? '';
  const { data: funding, isLoading, isError, refetch } = useFunding(reference || undefined);
  const verify = useVerifyFunding();
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    try {
      const result = await verify.mutateAsync(reference);
      if (result.status === 'SUCCESSFUL') toast.success('Payment confirmed and wallet credited');
      else if (result.status === 'FAILED') toast.error('The gateway reported that this payment failed');
      else toast.info('Payment is still pending. Check again shortly.');
      void refetch();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <Helmet>
        <title>Payment result — SubPlug</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="border-b border-line bg-raised">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" aria-label="SubPlug dashboard">
            <BrandMark />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {!reference ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title="No funding reference"
              description="Return to your wallet to see your funding history."
              action={<Link to="/dashboard/wallet" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">Open wallet</Link>}
            />
          </Card>
        ) : isLoading ? (
          <Card className="space-y-4 p-8">
            <Skeleton className="mx-auto h-14 w-14 rounded-full" />
            <Skeleton className="mx-auto h-6 w-48" />
            <Skeleton className="mx-auto h-10 w-36" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : isError || !funding ? (
          <Card>
            <ErrorState
              title="We could not find this funding"
              description="Check that you are signed in to the account that started the payment."
              onRetry={() => void refetch()}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="px-5 py-8 text-center sm:px-8">
              {funding.status === 'SUCCESSFUL' ? (
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                </span>
              ) : funding.status === 'FAILED' ? (
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/10 text-danger">
                  <AlertTriangle className="h-8 w-8" aria-hidden="true" />
                </span>
              ) : (
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-warning/10 text-warning">
                  <Clock3 className="h-8 w-8" aria-hidden="true" />
                </span>
              )}

              <h1 className="mt-4 text-2xl font-semibold">
                {funding.status === 'SUCCESSFUL'
                  ? 'Wallet funded'
                  : funding.status === 'FAILED'
                    ? 'Payment failed'
                    : funding.status === 'REQUIRES_REVIEW'
                      ? 'Payment under review'
                      : 'Payment pending'}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                {funding.status === 'SUCCESSFUL'
                  ? 'The payment was verified and the amount has been credited to your wallet ledger.'
                  : funding.status === 'FAILED'
                    ? 'The gateway did not confirm this payment. No wallet credit was made.'
                    : funding.status === 'REQUIRES_REVIEW'
                      ? 'The result needs a manual check before any credit is made. Support can see the funding reference.'
                      : 'We have not received a verified result yet. This can take a moment. Use the check button below.'}
              </p>

              <p className="mt-5 font-display text-3xl font-semibold tracking-tight">
                {formatNaira(funding.amountMinor, { decimals: true })}
              </p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <StatusBadge status={funding.status} />
                {funding.isSandbox ? <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Sandbox</span> : null}
              </div>

              {error ? (
                <Alert variant="danger" className="mx-auto mt-5 max-w-md text-left">
                  {error}
                </Alert>
              ) : null}

              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-surface p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Reference</span>
                  <span className="flex items-center gap-2">
                    <code className="font-mono text-[11px]">{funding.reference}</code>
                    <CopyButton value={funding.reference} />
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Gateway</span>
                  <span className="text-[11px] font-medium capitalize">{funding.gateway}</span>
                </div>
                {funding.failureReason ? (
                  <div className="mt-2 border-t border-line pt-2 text-[11px] text-danger">{funding.failureReason}</div>
                ) : null}
                {funding.reviewReason ? (
                  <div className="mt-2 border-t border-line pt-2 text-[11px] text-warning">{funding.reviewReason}</div>
                ) : null}
              </div>

              <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
                {funding.status === 'PENDING' || funding.status === 'REQUIRES_REVIEW' ? (
                  <Button
                    className="flex-1"
                    onClick={() => void handleVerify()}
                    isLoading={verify.isPending}
                    leftIcon={<RotateCw className="h-4 w-4" />}
                  >
                    Check payment status
                  </Button>
                ) : (
                  <Link
                    to={funding.status === 'SUCCESSFUL' ? '/dashboard/wallet' : '/dashboard/support'}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950"
                  >
                    {funding.status === 'SUCCESSFUL' ? 'Open wallet' : 'Contact support'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  to="/dashboard/wallet"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-ink hover:bg-surface"
                >
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Wallet history
                </Link>
              </div>

              <p className="mt-4 text-[11px] leading-5 text-subtle">
                Never treat the browser redirect alone as proof of payment. Only the status on this page reflects the
                verified gateway result.
              </p>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
