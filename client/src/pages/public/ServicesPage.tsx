import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Info, LayoutGrid, Phone, Tv, Wifi, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useCableProviders,
  useDataPlans,
  useElectricityProviders,
  useNetworks,
  useServices,
} from '@/hooks/useCatalogue';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { Skeleton, ErrorState } from '@/components/ui/States';
import { formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ServicesPage() {
  const { isAuthenticated, user } = useAuth();
  const servicesQuery = useServices();
  const networksQuery = useNetworks();
  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const plansQuery = useDataPlans(selectedNetwork);
  const electricityQuery = useElectricityProviders();
  const cableQuery = useCableProviders();

  const dashboard = user?.role === 'CUSTOMER' ? '/dashboard' : '/admin';
  const ctaHref = isAuthenticated ? dashboard : '/register';
  const networks = networksQuery.data ?? [];
  const electricityFee = electricityQuery.data?.feeMinor ?? 0;

  return (
    <>
      <Helmet>
        <title>Services & live prices — QuickTopUp</title>
        <meta
          name="description"
          content="Explore QuickTopUp services: airtime, mobile data bundles, electricity payments and cable TV renewals with live catalogue prices."
        />
      </Helmet>

      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10 grid-lines opacity-60" aria-hidden="true" />
        <div className="container-page py-14 sm:py-20">
          <div className="max-w-3xl">
            <span className="section-eyebrow">
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              Services & catalogue
            </span>
            <h1 className="mt-5 text-4xl font-semibold sm:text-5xl">Everything you top up, in one place.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              Browse the live provider catalogue below. Prices are shown in Naira before you confirm; the final amount is
              always displayed again at checkout.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link to={ctaHref} className={buttonStyles('primary', 'md')}>
                {isAuthenticated ? 'Open dashboard' : 'Create an account'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/faq" className={buttonStyles('outline', 'md')}>
                Read service FAQs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20">
        {servicesQuery.isError ? (
          <ErrorState
            title="The catalogue could not load"
            description="The provider catalogue is temporarily unavailable. Please try again shortly."
            onRetry={() => void servicesQuery.refetch()}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(servicesQuery.data?.services ?? []).map((service) => {
              const icon =
                service.key === 'AIRTIME' ? Phone : service.key === 'DATA' ? Wifi : service.key === 'ELECTRICITY' ? Zap : Tv;
              const Icon = icon;
              return (
                <Card key={service.key} className="flex flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold">{service.name}</h2>
                        <p className="text-xs text-muted">{service.enabled ? 'Available' : 'Unavailable right now'}</p>
                      </div>
                    </div>
                    <Badge tone={service.enabled ? 'success' : 'warning'}>{service.enabled ? 'Live' : 'Paused'}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted">{service.description}</p>

                  {service.networks?.length ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {service.networks.map((network) => (
                        <span key={network.code} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
                          {network.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {service.providers?.length ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {service.providers.slice(0, 8).map((provider) => (
                        <span key={provider.code} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-muted">
                          {provider.name}
                        </span>
                      ))}
                      {service.providers.length > 8 ? (
                        <span className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-muted">
                          +{service.providers.length - 8} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                    <p className="text-xs text-subtle">
                      {service.key === 'DATA' && service.planCount ? `${service.planCount} plans in catalogue` : null}
                      {service.key === 'ELECTRICITY' && service.providers ? `${service.providers.length} discos` : null}
                      {service.key === 'CABLE' && service.providers ? `${service.providers.length} cable networks` : null}
                      {service.key === 'AIRTIME' ? 'Discount applied at checkout' : null}
                    </p>
                    <Link
                      to={isAuthenticated ? `/dashboard/${service.key.toLowerCase()}` : `/register?next=${service.key.toLowerCase()}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {isAuthenticated ? 'Buy now' : 'Get started'}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-y border-line bg-raised">
        <div className="container-page py-14 sm:py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="section-eyebrow">Live data plans</span>
              <h2 className="mt-4 text-3xl font-semibold">Compare bundles by network.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                Prices come directly from the configured catalogue. Selecting a plan at checkout locks the price shown
                for that order.
              </p>
            </div>
            <Link to={ctaHref} className={buttonStyles('outline', 'sm')}>
              Buy data
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(networks.length ? networks : [{ code: 'MTN', name: 'MTN' }]).map((network) => (
              <button
                key={network.code}
                type="button"
                onClick={() => setSelectedNetwork(network.code)}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition',
                  selectedNetwork === network.code
                    ? 'border-brand-600 bg-brand-700 text-white dark:border-brand-400 dark:bg-brand-500 dark:text-brand-950'
                    : 'border-line bg-raised text-muted hover:border-brand-400/50 hover:text-ink'
                )}
                aria-pressed={selectedNetwork === network.code}
              >
                {network.name}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {plansQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : plansQuery.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plansQuery.data.slice(0, 9).map((plan) => (
                  <div key={plan.id} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{plan.dataVolume ?? plan.name}</p>
                      <p className="text-sm font-bold text-brand-700 dark:text-brand-300">{formatNaira(plan.priceMinor)}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted">{plan.name}</p>
                    <p className="mt-3 text-[11px] text-subtle">{plan.validity ?? 'Validity from provider'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-sm text-muted">
                No plans are listed for this network right now. Please check back or contact support.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="container-page grid gap-8 py-14 sm:py-20 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Electricity providers</h2>
              <p className="text-xs text-muted">Prepaid and postpaid meters</p>
            </div>
          </div>
          {electricityQuery.isLoading ? (
            <div className="mt-5 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : electricityQuery.data?.providers.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {electricityQuery.data.providers.map((provider) => (
                <span key={provider.code} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted">
                  {provider.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted">Provider list is temporarily unavailable.</p>
          )}
          <p className="mt-5 flex items-start gap-1.5 text-[11px] leading-5 text-subtle">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            {electricityFee > 0
              ? `A service fee of ${formatNaira(electricityFee)} applies to electricity payments.`
              : 'No platform service fee is currently added to electricity payments.'}{' '}
            Meter numbers are validated before payment.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Tv className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Cable TV networks</h2>
              <p className="text-xs text-muted">Packages from the live provider catalogue</p>
            </div>
          </div>
          {cableQuery.isLoading ? (
            <div className="mt-5 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : cableQuery.data?.length ? (
            <div className="mt-5 space-y-2">
              {cableQuery.data.map((provider) => (
                <div key={provider.code} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5">
                  <span className="text-sm font-medium">{provider.name}</span>
                  <Badge tone="neutral">Packages at checkout</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted">Cable providers are temporarily unavailable.</p>
          )}
          <ul className="mt-5 space-y-1.5">
            {['Smartcard number validated before payment', 'Customer name shown on the receipt', 'Failed orders refunded to wallet'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-[11px] text-muted">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="container-page pb-16 sm:pb-24">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-line bg-raised p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Not sure which option fits?</h2>
            <p className="mt-1 text-sm text-muted">Support can help with plans, meters and failed orders.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/contact" className={buttonStyles('primary', 'md')}>
              Contact support
            </Link>
            <Link to="/faq" className={buttonStyles('outline', 'md')}>
              Browse FAQs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
