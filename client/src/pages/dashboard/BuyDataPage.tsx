import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/Badge';
import { SandboxNotice } from '@/components/ui/SandboxNotice';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { CopyButton } from '@/components/ui/CopyButton';
import { FormError } from '@/components/ui/FormError';
import { useDataPlans } from '@/hooks/useCatalogue';
import { usePurchaseData } from '@/hooks/usePurchases';
import { useWallet } from '@/hooks/useWallet';
import { dataFormSchema, type DataForm } from '@/lib/schemas';
import { formatNaira } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { newIdempotencyKey } from '@/lib/utils';
import type { Transaction } from '@/types';

const networks = [
  { code: 'MTN', label: 'MTN', accent: 'text-amber-600 dark:text-amber-400' },
  { code: 'AIRTEL', label: 'Airtel', accent: 'text-red-600 dark:text-red-400' },
  { code: 'GLO', label: 'Glo', accent: 'text-green-700 dark:text-green-400' },
  { code: '9MOBILE', label: '9mobile', accent: 'text-emerald-700 dark:text-emerald-400' },
] as const;

export function BuyDataPage() {
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const idempotencyKey = useRef(newIdempotencyKey('data'));
  const walletQuery = useWallet();
  const purchase = usePurchaseData();

  const form = useForm<DataForm>({
    resolver: zodResolver(dataFormSchema),
    defaultValues: { network: 'MTN', phone: '', providerPlanId: '' },
  });
  const network = form.watch('network');
  const phone = form.watch('phone');
  const selectedPlanId = form.watch('providerPlanId');
  const plansQuery = useDataPlans(network);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const selectedPlan = plans.find((plan) => plan.providerPlanId === selectedPlanId);
  const categories = useMemo(() => {
    const rank = ['STANDARD', 'CORPORATE', 'GIFTING', 'COUPON', 'SHARE', 'OTHER'];
    const grouped = new Map<string, { code: string; label: string; count: number }>();
    for (const plan of plans) {
      const existing = grouped.get(plan.category);
      if (existing) existing.count += 1;
      else grouped.set(plan.category, { code: plan.category, label: plan.categoryLabel, count: 1 });
    }
    return [...grouped.values()].sort((a, b) => {
      const aRank = rank.indexOf(a.code);
      const bRank = rank.indexOf(b.code);
      return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
    });
  }, [plans]);
  const filteredPlans = useMemo(
    () => (activeCategory === 'ALL' ? plans : plans.filter((plan) => plan.category === activeCategory)),
    [plans, activeCategory]
  );

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey('data');
  }, [network, phone, selectedPlanId]);

  useEffect(() => {
    if (activeCategory !== 'ALL' && !categories.some((category) => category.code === activeCategory)) {
      setActiveCategory('ALL');
    }
  }, [categories, activeCategory]);

  const changeNetwork = (code: DataForm['network']) => {
    setActiveCategory('ALL');
    form.setValue('network', code, { shouldValidate: true });
    form.setValue('providerPlanId', '');
  };

  const changeCategory = (code: string) => {
    setActiveCategory(code);
    if (selectedPlanId) form.setValue('providerPlanId', '', { shouldValidate: false });
  };

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    if (!selectedPlan) {
      form.setError('providerPlanId', { message: 'Choose a data plan' });
      return;
    }
    try {
      const transaction = await purchase.mutateAsync({
        network: values.network,
        phone: values.phone,
        providerPlanId: values.providerPlanId,
        idempotencyKey: idempotencyKey.current,
      });
      setReceipt(transaction);
      toast.success(transaction.duplicate ? 'This purchase was already processed' : 'Data purchase submitted');
      form.reset({ network: values.network, phone: values.phone, providerPlanId: '' });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <>
      <Helmet>
        <title>Buy data — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Buy & pay"
        title="Buy mobile data"
        description="Pick a network and bundle. Prices shown are the exact amount debited from your wallet."
        actions={
          <Link to="/dashboard/transactions" className={buttonStyles('outline', 'sm')}>
            History
          </Link>
        }
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <ServiceIcon service="DATA" />
              <div>
                <h2 className="text-base font-semibold">Choose a bundle</h2>
                <p className="text-xs text-muted">Plans are loaded from the live catalogue and grouped by type.</p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 sm:p-6" noValidate>
            <SandboxNotice />
            {error ? <Alert variant="danger">{error}</Alert> : null}

            <div>
              <p className="label">Network</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Mobile network">
                {networks.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    role="radio"
                    aria-checked={network === item.code}
                    onClick={() => changeNetwork(item.code)}
                    className={`rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition ${
                      network === item.code
                        ? 'border-brand-500 bg-brand-500/10 text-brand-800 ring-2 ring-brand-500/10 dark:text-brand-200'
                        : 'border-line bg-surface text-muted hover:border-brand-400/50 hover:text-ink'
                    }`}
                  >
                    <span className={item.accent}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0801 234 5678"
              error={form.formState.errors.phone?.message}
              {...form.register('phone')}
            />

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="label mb-0">Data plans</p>
                {filteredPlans.length > 0 ? <p className="text-[11px] text-subtle">{filteredPlans.length} plans</p> : null}
              </div>

              {categories.length > 1 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Plan type">
                  <button
                    type="button"
                    aria-pressed={activeCategory === 'ALL'}
                    onClick={() => changeCategory('ALL')}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      activeCategory === 'ALL'
                        ? 'border-brand-500 bg-brand-500/10 text-brand-800 dark:text-brand-200'
                        : 'border-line bg-surface text-muted hover:border-brand-400/50 hover:text-ink'
                    }`}
                  >
                    All
                    <span className="ml-1 text-[10px] opacity-70">{plans.length}</span>
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.code}
                      type="button"
                      aria-pressed={activeCategory === category.code}
                      onClick={() => changeCategory(category.code)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        activeCategory === category.code
                          ? 'border-brand-500 bg-brand-500/10 text-brand-800 dark:text-brand-200'
                          : 'border-line bg-surface text-muted hover:border-brand-400/50 hover:text-ink'
                      }`}
                    >
                      {category.label}
                      <span className="ml-1 text-[10px] opacity-70">{category.count}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {plansQuery.isLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              ) : plansQuery.isError ? (
                <ErrorState
                  title="Plans could not load"
                  description="Check your connection and try again."
                  onRetry={() => void plansQuery.refetch()}
                  className="py-8"
                />
              ) : plans.length === 0 ? (
                <EmptyState
                  icon={Wifi}
                  title="No plans available"
                  description="This network has no enabled plans right now. Try another network or contact support."
                  className="py-8"
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Data plan">
                  {filteredPlans.map((plan) => {
                    const selected = plan.providerPlanId === selectedPlanId;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          form.setValue('providerPlanId', plan.providerPlanId, { shouldValidate: true })
                        }
                        className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/10'
                            : 'border-line bg-surface hover:border-brand-400/50'
                        }`}
                      >
                        <span className="text-sm font-semibold text-ink">{plan.name}</span>
                        <span className="mt-1 text-[11px] text-muted">
                          {[plan.validity, activeCategory === 'ALL' ? plan.categoryLabel : ''].filter(Boolean).join(' · ') ||
                            'Data bundle'}
                        </span>
                        <span className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-base font-semibold text-brand-800 dark:text-brand-200">
                            {formatNaira(plan.priceMinor)}
                          </span>
                          {plan.isSandbox ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-warning">Sandbox</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {form.formState.errors.providerPlanId ? (
                <FormError>{form.formState.errors.providerPlanId.message}</FormError>
              ) : null}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">Total to pay</span>
                <span className="text-lg font-semibold text-brand-800 dark:text-brand-200">
                  {selectedPlan ? formatNaira(selectedPlan.priceMinor) : '—'}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-subtle">
                <span>Wallet balance</span>
                <span>{walletQuery.data ? formatNaira(walletQuery.data.wallet.balanceMinor) : '—'}</span>
              </div>
            </div>

            <div className="flex justify-end border-t border-line pt-4">
              <Button
                type="submit"
                size="lg"
                isLoading={purchase.isPending}
                disabled={!selectedPlan}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Pay and buy data
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">How delivery works</h2>
            <p className="mt-2 text-xs leading-6 text-muted">
              The bundle is sent to the phone number you enter. If the provider returns a pending result, the transaction
              page will refresh automatically until a final status is known.
            </p>
            <p className="mt-3 text-xs leading-6 text-muted">
              Data bundles are non-refundable once delivered. If delivery fails, the wallet debit is refunded through a
              separate ledger entry.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Prefer airtime?</p>
            <p className="mt-2 text-sm text-muted">Airtime can be sent in any amount from ₦50.</p>
            <Link to="/dashboard/airtime" className={buttonStyles('outline', 'sm', 'mt-4')}>
              Buy airtime
            </Link>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
        title={receipt?.status === 'SUCCESSFUL' ? 'Data delivered' : 'Purchase submitted'}
        description="The server is the source of truth for delivery status."
        footer={
          <>
            <Link to="/dashboard/data" className={buttonStyles('outline')}>
              Buy another bundle
            </Link>
            {receipt ? (
              <Link to={`/dashboard/transactions/${receipt.reference}`} className={buttonStyles('primary')}>
                View transaction
              </Link>
            ) : null}
          </>
        }
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{receipt.plan?.name ?? 'Data bundle'}</p>
                  <p className="text-xs text-muted">{receipt.recipient.phone}</p>
                </div>
              </div>
              <StatusBadge status={receipt.status} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Paid</dt>
                <dd className="font-semibold">{formatNaira(receipt.payableMinor)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reference</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-xs">{receipt.reference}</span>
                  <CopyButton value={receipt.reference} label="" />
                </dd>
              </div>
            </dl>
            {receipt.duplicate ? (
              <Alert variant="info">This was an idempotent retry; you were not charged twice.</Alert>
            ) : null}
            {receipt.status === 'PENDING' || receipt.status === 'PROCESSING' ? (
              <Alert variant="warning">
                The provider has not confirmed delivery yet. We will update this transaction as soon as a result arrives.
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
