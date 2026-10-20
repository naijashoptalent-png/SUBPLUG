import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Banknote,
  CircleAlert,
  Percent,
  ReceiptText,
  RefreshCw,
  ServerCog,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminOverview } from '@/hooks/useAdmin';
import { formatMonthDay, formatNaira, formatNairaCompact, formatNumber, formatRelative, SERVICE_LABELS } from '@/lib/format';
import type { ServiceType } from '@/types';

const dayOptions = [7, 30, 90];

const serviceColors: Record<ServiceType, string> = {
  AIRTIME: 'bg-amber-500',
  DATA: 'bg-info',
  ELECTRICITY: 'bg-brand-500',
  CABLE: 'bg-purple-500',
};

export function AdminOverviewPage() {
  const [days, setDays] = useState(30);
  const overviewQuery = useAdminOverview(days);
  const data = overviewQuery.data;

  return (
    <>
      <Helmet>
        <title>Operations overview — QuickTopUp</title>
      </Helmet>

      <PageHeader
        eyebrow="Operations console"
        title="Overview"
        description="Live platform metrics from the transaction and ledger records. Nothing here is estimated."
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-raised p-1" role="tablist" aria-label="Reporting period">
              {dayOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={days === option}
                  onClick={() => setDays(option)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    days === option ? 'bg-brand-500/15 text-brand-800 dark:text-brand-200' : 'text-muted hover:text-ink'
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void overviewQuery.refetch()}
              isLoading={overviewQuery.isFetching}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      {overviewQuery.isError ? (
        <Card className="mt-6">
          <ErrorState title="Overview could not load" onRetry={() => void overviewQuery.refetch()} />
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Transaction volume"
          value={data ? formatNaira(data.revenue.transactionVolumeMinor) : '—'}
          icon={ReceiptText}
          loading={overviewQuery.isLoading}
          hint={`${formatNumber(data?.transactions.total)} transactions all-time`}
        />
        <StatCard
          label="Gross margin"
          value={data ? formatNaira(data.revenue.grossMarginMinor) : '—'}
          icon={TrendingUp}
          tone="success"
          loading={overviewQuery.isLoading}
          hint={`Successful volume, last ${days} days`}
        />
        <StatCard
          label="Success rate"
          value={data?.transactions.successRate === null || data?.transactions.successRate === undefined ? '—' : `${data.transactions.successRate}%`}
          icon={Percent}
          tone="info"
          loading={overviewQuery.isLoading}
          hint={`${formatNumber(data?.transactions.failed)} failed or refunded`}
        />
        <StatCard
          label="Customers"
          value={data ? formatNumber(data.users.total) : '—'}
          icon={Users}
          tone="warning"
          loading={overviewQuery.isLoading}
          hint={`${formatNumber(data?.users.new)} joined in ${days}d`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Wallet funded"
          value={data ? formatNaira(data.funding.totalMinor) : '—'}
          icon={Banknote}
          tone="success"
          loading={overviewQuery.isLoading}
          hint={`${formatNumber(data?.funding.count)} verified top-ups`}
        />
        <StatCard
          label="Open work"
          value={data ? formatNumber(data.transactions.pending) : '—'}
          icon={Activity}
          tone="warning"
          loading={overviewQuery.isLoading}
          hint="Pending, processing, or in review"
        />
        <StatCard
          label="Funding review"
          value={data ? formatNumber(data.funding.reviewCount) : '—'}
          icon={CircleAlert}
          tone="warning"
          loading={overviewQuery.isLoading}
          hint="Gateway results needing a manual check"
        />
        <StatCard
          label="Providers"
          value={data ? formatNumber(data.providers.filter((provider) => provider.health === 'HEALTHY').length) : '—'}
          icon={ServerCog}
          tone="info"
          loading={overviewQuery.isLoading}
          hint={`${formatNumber(data?.providers.length)} configured`}
        />
      </div>

      {data && (data.transactions.pending > 0 || data.funding.reviewCount > 0) ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-sm text-warning">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {data.transactions.pending} transaction{data.transactions.pending === 1 ? '' : 's'} and{' '}
              {data.funding.reviewCount} funding request{data.funding.reviewCount === 1 ? '' : 's'} need attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/transactions?status=REQUIRES_REVIEW" className={buttonStyles('outline', 'sm')}>
              Review transactions
            </Link>
            <Link to="/admin/fundings?status=REQUIRES_REVIEW" className={buttonStyles('outline', 'sm')}>
              Review fundings
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_0.5fr]">
        <Card>
          <CardHeader title="Daily volume" description={`Successful transaction value, last ${days} days`} />
          <div className="h-72 px-2 py-4 sm:px-4">
            {overviewQuery.isLoading ? (
              <div className="flex h-full items-end gap-2 px-4">
                {[35, 60, 45, 80, 55, 70, 40, 85, 65, 50].map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 animate-pulse rounded-t-lg bg-line/60"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            ) : data?.daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14a696" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#14a696" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                  <XAxis
                    dataKey="_id"
                    tickFormatter={formatMonthDay}
                    tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(value: number) => formatNairaCompact(value)}
                    tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value) => [formatNaira(Number(value)), 'Volume']}
                    labelFormatter={(label) => formatMonthDay(String(label))}
                    contentStyle={{
                      background: 'rgb(var(--raised))',
                      border: '1px solid rgb(var(--line))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'rgb(var(--ink))',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volumeMinor"
                    stroke="#14a696"
                    strokeWidth={2.5}
                    fill="url(#adminVolume)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No transaction activity"
                description={`No transactions were recorded in the last ${days} days.`}
                className="h-full py-6"
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Service mix" description="Volume by service" />
          <div className="p-5">
            {data?.services.length ? (
              <div className="space-y-4">
                {data.services.map((service) => {
                  const max = Math.max(...data.services.map((item) => item.volumeMinor), 1);
                  const percentage = Math.round((service.volumeMinor / max) * 100);
                  return (
                    <div key={service.service}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium">{SERVICE_LABELS[service.service] ?? service.service}</span>
                        <span className="text-muted">{formatNaira(service.volumeMinor)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full ${serviceColors[service.service] ?? 'bg-brand-500'}`}
                          style={{ width: `${Math.max(percentage, 4)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-subtle">
                        {formatNumber(service.count)} orders · {formatNumber(service.successful)} successful
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No service data" className="py-8" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Provider health"
            description="Last recorded health-check result"
            action={
              <Link to="/admin/providers" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                Manage
              </Link>
            }
          />
          {data?.providers.length ? (
            <ul className="divide-y divide-line">
              {data.providers.map((provider) => (
                <li key={provider.key} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted">
                    <ServerCog className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{provider.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {provider.kind} · {provider.lastCheckedAt ? formatRelative(provider.lastCheckedAt) : 'Never checked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.isSandbox ? <Badge tone="warning">Sandbox</Badge> : null}
                    <StatusBadge status={provider.health} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ServerCog}
              title="No providers recorded"
              description="Run a provider health check to populate this list."
              action={
                <Link to="/admin/providers" className={buttonStyles('outline', 'sm')}>
                  Open providers
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Transaction outcomes" description="All-time status counts" />
          <div className="p-5">
            {data ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(data.transactions.statuses).map(([status, count]) => (
                  <div key={status} className="rounded-2xl border border-line bg-surface p-3.5">
                    <StatusBadge status={status} />
                    <p className="mt-2 text-xl font-semibold">{formatNumber(count)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="text-xs font-semibold">Need the full ledger?</p>
                <p className="mt-0.5 text-[11px] text-muted">Run a wallet reconciliation for recorded vs computed balances.</p>
              </div>
              <Link to="/admin/reconciliation" className={buttonStyles('outline', 'sm')}>
                Reconcile
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
