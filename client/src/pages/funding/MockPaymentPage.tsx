import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, CheckCircle2, FlaskConical, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { CopyButton } from '@/components/ui/CopyButton';
import { useFunding, useSimulateFunding } from '@/hooks/useWallet';
import { formatNaira } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

export function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') ?? '';
  const navigate = useNavigate();
  const { data: funding, isLoading, isError, refetch } = useFunding(reference || undefined);
  const simulate = useSimulateFunding();
  const [error, setError] = useState<string | null>(null);

  const handleOutcome = async (outcome: 'success' | 'failed') => {
    setError(null);
    try {
      await simulate.mutateAsync({ reference, outcome });
      toast.success(outcome === 'success' ? 'Sandbox payment approved' : 'Sandbox payment failed');
      navigate(`/wallet/funding/callback?reference=${encodeURIComponent(reference)}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <Helmet>
        <title>Sandbox checkout — SubPlug</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="border-b border-line bg-raised">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/dashboard/wallet" aria-label="Back to wallet">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <Badge tone="warning">
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              Sandbox gateway
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-5">
          <Link to="/dashboard/wallet" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to wallet
          </Link>
        </div>

        <Alert variant="warning" title="This is a test checkout" className="mb-5">
          No real money is moved. This page exists only because the platform is configured with the sandbox payment
          gateway. Approving or failing the test updates a real ledger entry inside this development environment only.
        </Alert>

        {!reference ? (
          <Card>
            <EmptyState
              title="Missing payment reference"
              description="Open this page from a wallet funding request."
              action={
                <Link to="/dashboard/wallet" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  Return to wallet
                </Link>
              }
            />
          </Card>
        ) : isLoading ? (
          <Card className="space-y-4 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : isError || !funding ? (
          <Card>
            <ErrorState
              title="Funding request not found"
              description="The reference is invalid or belongs to another account."
              onRetry={() => void refetch()}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/10 text-warning">
                  <FlaskConical className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sandbox payment gateway</p>
                  <p className="text-[11px] text-muted">Test mode · no real charge</p>
                </div>
              </div>
              <StatusBadge status={funding.status} />
            </div>

            <div className="px-5 py-7 text-center sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">Amount to pay</p>
              <p className="mt-2 font-display text-4xl font-semibold tracking-tight">{formatNaira(funding.amountMinor, { decimals: true })}</p>
              <p className="mt-1 text-xs text-muted">Wallet funding · {funding.gateway} gateway</p>

              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-line bg-surface px-4 py-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Reference</span>
                  <span className="flex items-center gap-2">
                    <code className="font-mono text-[11px] text-ink">{funding.reference}</code>
                    <CopyButton value={funding.reference} label="Copy" />
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Mode</span>
                  <span className="text-[11px] font-semibold text-warning">Sandbox</span>
                </div>
              </div>

              {error ? (
                <Alert variant="danger" className="mx-auto mt-5 max-w-sm text-left">
                  {error}
                </Alert>
              ) : null}

              {funding.status === 'PENDING' ? (
                <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
                  <Button
                    size="lg"
                    onClick={() => void handleOutcome('success')}
                    isLoading={simulate.isPending}
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    Approve test payment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleOutcome('failed')}
                    disabled={simulate.isPending}
                    leftIcon={<XCircle className="h-4 w-4 text-danger" />}
                  >
                    Simulate failed payment
                  </Button>
                </div>
              ) : funding.status === 'SUCCESSFUL' ? (
                <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-success/25 bg-success/10 p-4">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-success">This test payment was approved</p>
                  <Link
                    to={`/wallet/funding/callback?reference=${encodeURIComponent(reference)}`}
                    className="mt-2 inline-block text-xs font-semibold text-success underline underline-offset-4"
                  >
                    View payment result
                  </Link>
                </div>
              ) : funding.status === 'FAILED' ? (
                <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-danger/25 bg-danger/10 p-4">
                  <XCircle className="mx-auto h-6 w-6 text-danger" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-danger">This test payment was marked failed</p>
                  <p className="mt-1 text-xs text-muted">No wallet credit was made.</p>
                </div>
              ) : (
                <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-line bg-surface p-4">
                  <p className="text-sm font-semibold">This funding is in review</p>
                  <p className="mt-1 text-xs text-muted">Contact support with the reference above.</p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-subtle">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                The sandbox still runs the real verification path before crediting.
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
