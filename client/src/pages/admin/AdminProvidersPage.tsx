import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Activity,
  ArrowLeftRight,
  CircleAlert,
  CreditCard,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminProviders, useCheckProviders, useSwitchProviderRoute } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, formatRelative } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import type { ProviderRouteOption, ProviderServiceRoute } from '@/types';

interface CheckResult {
  provider: string;
  kind: string;
  healthy: boolean;
  message?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  AIRTIME: 'Airtime',
  DATA: 'Mobile data',
  ELECTRICITY: 'Electricity',
  CABLE: 'Cable TV',
};

function providerName(key: string) {
  if (key === 'sme') return 'SME API';
  if (key === 'maskawasub') return 'MaskawaSub';
  return key;
}

export function AdminProvidersPage() {
  const { isAdmin } = useAuth();
  const providersQuery = useAdminProviders();
  const checkProviders = useCheckProviders();
  const switchRoute = useSwitchProviderRoute();
  const [results, setResults] = useState<CheckResult[]>([]);
  const [pendingSwitch, setPendingSwitch] = useState<{
    route: ProviderServiceRoute;
    option: ProviderRouteOption;
  } | null>(null);

  const data = providersQuery.data;

  const confirmSwitch = async () => {
    if (!pendingSwitch) return;
    const { route, option } = pendingSwitch;
    if (route.service !== 'AIRTIME' && route.service !== 'DATA') return;
    try {
      const response = await switchRoute.mutateAsync({ service: route.service, provider: option.key });
      const syncedPlans = response.sync?.counts.dataPlans;
      toast.success(
        response.changed
          ? `${ROUTE_LABELS[response.service]} switched to ${option.name}${
              response.purchasable ? '' : ' — live purchases are blocked'
            }${syncedPlans ? `; ${syncedPlans} data plans synced` : ''}.`
          : `${ROUTE_LABELS[response.service]} already uses ${option.name}.`
      );
      setPendingSwitch(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const runCheck = async () => {
    try {
      const response = await checkProviders.mutateAsync();
      setResults(response);
      const healthy = response.filter((item) => item.healthy).length;
      toast.success(`${healthy} of ${response.length} provider checks are healthy`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <Helmet>
        <title>Providers &amp; health — SubPlug operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Platform"
        title="Providers & health"
        description="Connected VTU and payment adapters, sandbox state, and the last recorded connectivity result."
        actions={
          isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runCheck()}
              isLoading={checkProviders.isPending}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Run health check
            </Button>
          ) : undefined
        }
      />

      {data?.activeVtu.isSandbox && data?.payment.isSandbox ? (
        <Alert variant="warning" title="Sandbox providers are active" className="mt-5">
          Purchases and wallet funding are simulated. No real airtime, data, electricity, cable service or money is
          delivered. Switch both providers to live credentials before accepting real customers.
        </Alert>
      ) : data?.activeVtu.isSandbox ? (
        <Alert variant="warning" title="Sandbox VTU provider is active" className="mt-5">
          Purchases are simulated and no real airtime, data, electricity or cable service is delivered. Wallet funding
          follows the payment gateway configured below.
        </Alert>
      ) : data?.payment.isSandbox ? (
        <Alert variant="warning" title="Sandbox wallet funding is active" className="mt-5">
          Wallet top-ups are simulated and do not move real money. Purchases made from an existing wallet balance are
          sent to the live VTU provider and can deliver real services.
        </Alert>
      ) : null}

      {!isAdmin ? (
        <Alert variant="info" className="mt-5">
          Support access is read-only. An administrator can run a health check and change provider configuration.
        </Alert>
      ) : null}

      {providersQuery.isError ? (
        <Card className="mt-5">
          <ErrorState title="Providers could not load" onRetry={() => void providersQuery.refetch()} />
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Primary VTU adapter" description="Default adapter; each service can be routed to a different provider" />
          <div className="p-5">
            {providersQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : data ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                      <Wifi className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{data.activeVtu.name}</p>
                      <p className="font-mono text-[10px] text-subtle">{data.activeVtu.key}</p>
                    </div>
                  </div>
                  {data.activeVtu.isSandbox ? <Badge tone="warning">Sandbox</Badge> : <Badge tone="success">Live</Badge>}
                </div>
                <DescriptionList
                  className="mt-5"
                  columns={1}
                  items={[
                    { label: 'Adapter key', value: <span className="font-mono text-xs">{data.activeVtu.key}</span> },
                    { label: 'Environment', value: data.activeVtu.isSandbox ? 'Sandbox — simulated fulfilment' : 'Live — real fulfilment' },
                    {
                      label: 'Service routes',
                      value: (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(data.routes).map(([service, key]) => (
                            <Badge key={service} tone="neutral">
                              {service}: {key}
                            </Badge>
                          ))}
                        </div>
                      ),
                    },
                    {
                      label: 'Configured adapters',
                      value: (
                        <div className="flex flex-wrap gap-1.5">
                          {data.configuredVtu.map((provider) => (
                            <Badge key={provider.key} tone={provider.configured ? 'brand' : 'danger'}>
                              {provider.name}
                            </Badge>
                          ))}
                        </div>
                      ),
                    },
                  ]}
                />
              </>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment gateway" description="Used for wallet funding only" />
          <div className="p-5">
            {providersQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : data ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-info/10 text-info">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold capitalize">{data.payment.key}</p>
                      <p className="text-[10px] text-subtle">
                        {data.payment.configured ? 'Credentials loaded' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!data.payment.configured ? <Badge tone="danger">Unconfigured</Badge> : null}
                    {data.payment.isSandbox ? <Badge tone="warning">Sandbox</Badge> : null}
                  </div>
                </div>
                <DescriptionList
                  className="mt-5"
                  columns={1}
                  items={[
                    { label: 'Gateway key', value: <span className="font-mono text-xs">{data.payment.key}</span> },
                    {
                      label: 'Mode',
                      value: data.payment.configured
                        ? data.payment.isSandbox
                          ? 'Sandbox — no real money moves'
                          : 'Live — real funding only'
                        : 'Funding is disabled until credentials are set.',
                    },
                    { label: 'Webhook', value: 'Signature-verified before any credit is applied.' },
                  ]}
                />
              </>
            ) : null}
          </div>
        </Card>
      </div>

      {data ? (
        <Card className="mt-5">
          <CardHeader
            title="Service routing"
            description="Airtime and mobile data can switch between the two live adapters. Cable and electricity are fixed to MaskawaSub."
          />
          <div className="divide-y divide-line">
            {data.serviceRoutes.map((route) => (
              <div key={route.service} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-muted">
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold">{ROUTE_LABELS[route.service] ?? route.service}</p>
                      <Badge tone={route.purchasable ? 'success' : 'warning'}>
                        {route.purchasable ? 'Live' : 'Blocked'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {route.toggleable
                        ? `Current: ${providerName(route.current)}. Switching syncs the selected catalogue.`
                        : 'Fixed to MaskawaSub. There is no SME fallback for this service.'}
                    </p>
                  </div>
                </div>

                {route.toggleable ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {route.options.map((option) => (
                      <Button
                        key={option.key}
                        size="sm"
                        variant={option.key === route.current ? 'secondary' : 'outline'}
                        disabled={option.key === route.current || !option.configured}
                        onClick={() => setPendingSwitch({ route, option })}
                        title={option.reason}
                      >
                        {option.name}
                        {option.key === route.current ? ' · current' : ''}
                      </Button>
                    ))}
                    {route.options.some((option) => !option.purchasable) ? (
                      <span className="text-[10px] font-medium text-warning">Live blocked until certified</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">MaskawaSub only</Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-3.5 text-[11px] text-subtle">
            A switch selects the provider before the next debit; it never retries a submitted order on the other provider. A
            data switch imports the selected provider&apos;s plans and disables the previous provider&apos;s plans. Education PINs,
            airtime-to-cash and recharge-card PINs are not implemented yet; when added they will be MaskawaSub-only.
          </div>
        </Card>
      ) : null}

      {results.length ? (
        <Card className="mt-5">
          <CardHeader title="Latest health-check results" description="Recorded from the most recent run in this session" />
          <ul className="divide-y divide-line">
            {results.map((result) => (
              <li key={`${result.kind}-${result.provider}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className={result.healthy ? 'text-success' : 'text-danger'}>
                  {result.healthy ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <CircleAlert className="h-4 w-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{result.provider}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{result.message ?? (result.healthy ? 'Healthy' : 'Check failed')}</p>
                </div>
                <Badge tone={result.healthy ? 'success' : 'danger'}>{result.kind}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="Recorded providers"
          description="Health state is updated by the latest check; it is not inferred or estimated."
        />
        {providersQuery.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : data?.providers.length ? (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Adapter</th>
                  <th scope="col">Health</th>
                  <th scope="col">Enabled</th>
                  <th scope="col">Last checked</th>
                  <th scope="col">Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.providers.map((provider) => (
                  <tr key={provider.key}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-muted">
                          <ServerCog className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold">{provider.name}</p>
                          <p className="font-mono text-[10px] text-subtle">{provider.key}</p>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={provider.kind === 'VTU' ? 'brand' : 'info'}>{provider.kind}</Badge></td>
                    <td className="text-xs text-muted">{provider.adapter ?? '—'}</td>
                    <td><StatusBadge status={provider.health} /></td>
                    <td><Badge tone={provider.enabled ? 'success' : 'neutral'}>{provider.enabled ? 'Yes' : 'No'}</Badge></td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {provider.lastCheckedAt ? formatRelative(provider.lastCheckedAt) : 'Never'}
                    </td>
                    <td className="text-xs text-muted">{provider.errorCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No providers recorded"
            description="Run a health check to record the connected adapters."
            action={
              isAdmin ? (
                <Button size="sm" onClick={() => void runCheck()} isLoading={checkProviders.isPending}>
                  Run health check
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      {data?.providers.some((provider) => provider.lastError) ? (
        <Card className="mt-5">
          <CardHeader title="Latest provider errors" description="Truncated messages for operations triage" />
          <ul className="divide-y divide-line">
            {data.providers
              .filter((provider) => provider.lastError)
              .map((provider) => (
                <li key={provider.key} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{provider.name}</p>
                    <p className="text-[10px] text-subtle">
                      {provider.lastCheckedAt ? formatDateTime(provider.lastCheckedAt) : 'Unknown time'}
                    </p>
                  </div>
                  <p className="mt-1 break-words font-mono text-[11px] text-danger">{provider.lastError}</p>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <Dialog
        open={Boolean(pendingSwitch)}
        onOpenChange={(open) => {
          if (!open && !switchRoute.isPending) setPendingSwitch(null);
        }}
        title={
          pendingSwitch
            ? `Switch ${ROUTE_LABELS[pendingSwitch.route.service] ?? pendingSwitch.route.service} to ${pendingSwitch.option.name}?`
            : 'Switch provider'
        }
        description="The new route applies before the next order. Existing transactions are never moved or retried."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingSwitch(null)} disabled={switchRoute.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmSwitch()}
              isLoading={switchRoute.isPending}
              leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />}
            >
              {pendingSwitch?.route.service === 'DATA' ? 'Switch & sync' : 'Switch network'}
            </Button>
          </>
        }
      >
        {pendingSwitch ? (
          <div className="space-y-3 text-sm text-muted">
            {!pendingSwitch.option.purchasable ? (
              <Alert variant="warning" title="Live purchases are blocked">
                {pendingSwitch.option.reason ??
                  `${pendingSwitch.option.name} is not certified for live ${pendingSwitch.route.service.toLowerCase()} purchases.`}{' '}
                The catalogue can still be synced, but customers will not see this service until it is certified.
              </Alert>
            ) : (
              <Alert variant="info" title="Live route">
                Customers will be able to buy {ROUTE_LABELS[pendingSwitch.route.service] ?? pendingSwitch.route.service} through{' '}
                {pendingSwitch.option.name} after this switch.
              </Alert>
            )}
            <p>
              {pendingSwitch.route.service === 'DATA'
                ? `The ${pendingSwitch.option.name} data catalogue will be imported. Plans from ${providerName(
                    pendingSwitch.route.current
                  )} will be disabled for new orders.`
                : `Airtime will use ${pendingSwitch.option.name}'s network list. No catalogue import is needed for airtime.`}
            </p>
            <p>
              Provider cost and selling prices are recalculated by the normal catalogue rules. Any empty or failed target
              response leaves the current route unchanged.
            </p>
          </div>
        ) : null}
      </Dialog>

      <p className="mt-4 text-[11px] text-subtle">
        Provider health checks do not place orders. A healthy result only confirms the adapter responded to its status
        endpoint.
      </p>
    </>
  );
}
