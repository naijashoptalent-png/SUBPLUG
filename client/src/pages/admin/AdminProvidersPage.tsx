import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Activity,
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
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminProviders, useCheckProviders } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime, formatRelative } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

interface CheckResult {
  provider: string;
  kind: string;
  healthy: boolean;
  message?: string;
}

export function AdminProvidersPage() {
  const { isAdmin } = useAuth();
  const providersQuery = useAdminProviders();
  const checkProviders = useCheckProviders();
  const [results, setResults] = useState<CheckResult[]>([]);

  const data = providersQuery.data;

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

      {data?.activeVtu.isSandbox || data?.payment.isSandbox ? (
        <Alert variant="warning" title="Sandbox providers are active" className="mt-5">
          Orders are simulated and no real airtime, data, electricity, or cable service is delivered. Sandbox funding does
          not move real money. Switch provider credentials before accepting live customers.
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
          <CardHeader title="Active VTU adapter" description="The adapter used for every purchase" />
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
                    { label: 'Order routing', value: 'All purchases use this adapter.' },
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

      <p className="mt-4 text-[11px] text-subtle">
        Provider health checks do not place orders. A healthy result only confirms the adapter responded to its status
        endpoint.
      </p>
    </>
  );
}
