import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Gift,
  Phone,
  Plus,
  ReceiptText,
  Tv,
  Wallet as WalletIcon,
  Wifi,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardSummary } from '@/hooks/usePurchases';
import { formatMonthDay, formatNaira, formatNairaCompact, formatRelative } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, buttonStyles } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { SandboxNotice } from '@/components/ui/SandboxNotice';
import { useOpenWalletFunding } from '@/components/wallet/WalletFundingContext';

const quickActions = [
  { to: '/dashboard/airtime', label: 'Airtime', copy: 'Top up a phone', icon: Phone, classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { to: '/dashboard/data', label: 'Data', copy: 'Buy a bundle', icon: Wifi, classes: 'bg-info/10 text-info' },
  { to: '/dashboard/electricity', label: 'Electricity', copy: 'Pay a meter', icon: Zap, classes: 'bg-brand-500/10 text-brand-700 dark:text-brand-300' },
  { to: '/dashboard/cable', label: 'Cable TV', copy: 'Renew a package', icon: Tv, classes: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
];

export function OverviewPage() {
  const { user } = useAuth();
  const summaryQuery = useDashboardSummary();
  const openWalletFunding = useOpenWalletFunding();
  const summary = summaryQuery.data;
  const monthlySpendMinor = summary?.monthlyActivity.reduce((total, day) => total + day.amountMinor, 0) ?? 0;

  const firstName = user?.fullName.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <Helmet>
        <title>Dashboard — SubPlug</title>
      </Helmet>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{greeting}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Hello, {firstName}.</h1>
          <p className="text-sm text-muted">Here’s your wallet and what happened recently.</p>
        </div>

        <SandboxNotice />

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="balance-card relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-glow sm:p-7">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" aria-hidden="true" />
            <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-brand-400/10 blur-2xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
                    <WalletIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Wallet balance</p>
                </div>
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  {summary?.wallet.currency ?? 'NGN'}
                </span>
              </div>

              {summaryQuery.isLoading ? (
                <div className="mt-6 h-11 w-48 animate-pulse rounded-xl bg-white/10" />
              ) : (
                <p className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-[2.8rem]">
                  {formatNaira(summary?.wallet.balanceMinor ?? 0)}
                </p>
              )}
              <p className="mt-1 text-xs text-white/55">
                {summary?.wallet.status === 'ACTIVE' ? 'Available to spend' : `Wallet status: ${summary?.wallet.status ?? '—'}`}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  onClick={openWalletFunding}
                  className="bg-white text-brand-900 hover:bg-white/90"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Fund wallet
                </Button>
                <Link
                  to="/dashboard/wallet"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View history
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">30-day spend</p>
                  <p className="mt-1 text-sm font-semibold text-white/90">
                    {summaryQuery.isLoading ? '—' : formatNaira(monthlySpendMinor)}
                  </p>
                  <p className="text-[10px] text-white/40">Successful purchases</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Service mode</p>
                  <p className="mt-1 text-sm font-semibold text-white/90">
                    {summary?.provider.isSandbox ? 'Test mode' : 'Live'}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {summary?.provider.isSandbox ? 'Simulated delivery' : 'Real delivery'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <div className="card flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Successful</p>
                <p className="mt-2 text-2xl font-semibold">{summaryQuery.isLoading ? '—' : summary?.statusCounts.successful ?? 0}</p>
                <p className="mt-0.5 text-xs text-muted">Completed purchases</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success">
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="card flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">In progress</p>
                <p className="mt-2 text-2xl font-semibold">{summaryQuery.isLoading ? '—' : summary?.statusCounts.pending ?? 0}</p>
                <p className="mt-0.5 text-xs text-muted">Pending or in review</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/10 text-warning">
                <Banknote className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>

        {summaryQuery.isError ? (
          <Card>
            <ErrorState
              title="Your dashboard could not load"
              description="We could not reach the API. Try refreshing."
              onRetry={() => void summaryQuery.refetch()}
            />
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group card card-hover flex flex-col items-start p-4"
            >
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${action.classes}`}>
                <action.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold">{action.label}</p>
              <p className="mt-0.5 text-[11px] text-muted">{action.copy}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                Start
                <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader
              title="Activity, last 30 days"
              description="Successful purchase value by day"
              action={
                <Link to="/dashboard/transactions" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  View all
                </Link>
              }
            />
            <div className="h-60 px-2 py-4 sm:px-4">
              {summaryQuery.isLoading ? (
                <div className="flex h-full items-end gap-2 px-4">
                  {[40, 65, 35, 80, 55, 70, 45, 90].map((height, index) => (
                    <Skeleton key={index} className="flex-1" style={{ height: `${height}%` } as React.CSSProperties} />
                  ))}
                </div>
              ) : summary?.monthlyActivity.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.monthlyActivity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#78ad1d" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#78ad1d" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                    <XAxis
                      dataKey="date"
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
                      width={62}
                    />
                    <Tooltip
                      formatter={(value) => [formatNaira(Number(value)), 'Spent']}
                      labelFormatter={(label) => `Date: ${label}`}
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
                      dataKey="amountMinor"
                      stroke="#78ad1d"
                      strokeWidth={2.5}
                      fill="url(#spendGradient)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--raised))' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={ReceiptText}
                  title="No spending yet"
                  description="Your chart will fill up after your first successful purchase."
                  className="h-full py-6"
                  action={
                    <Link to="/dashboard/airtime" className={buttonStyles('outline', 'sm')}>
                      Make a purchase
                    </Link>
                  }
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent transactions"
              description="Latest five orders"
              action={
                <Link to="/dashboard/transactions" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  All
                </Link>
              }
            />
            {summaryQuery.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : summary?.recentTransactions.length ? (
              <ul className="divide-y divide-line">
                {summary.recentTransactions.map((transaction) => (
                  <li key={transaction.reference}>
                    <Link
                      to={`/dashboard/transactions/${transaction.reference}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface"
                    >
                      <ServiceIcon service={transaction.service} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">
                          {transaction.plan?.name ??
                            transaction.recipient.network ??
                            transaction.recipient.disco ??
                            transaction.service}
                        </p>
                        <p className="mt-0.5 text-[10px] text-subtle">{formatRelative(transaction.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">{formatNaira(transaction.payableMinor)}</p>
                        <StatusBadge status={transaction.status} className="mt-1" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No transactions yet"
                description="Buy airtime or data to see it here."
                action={
                  <div className="flex gap-2">
                    <Link to="/dashboard/airtime" className={buttonStyles('primary', 'sm')}>
                      Buy airtime
                    </Link>
                    <Link to="/dashboard/data" className={buttonStyles('outline', 'sm')}>
                      Buy data
                    </Link>
                  </div>
                }
              />
            )}
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Gift className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Refer a friend</p>
                <p className="mt-0.5 text-xs text-muted">Share your code and earn after a qualifying purchase.</p>
              </div>
            </div>
            <Link to="/dashboard/referrals" className={buttonStyles('outline', 'sm')}>
              Referrals
            </Link>
          </div>

          <div className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Need a hand?</p>
                <p className="mt-0.5 text-xs text-muted">Open a ticket with a transaction reference.</p>
              </div>
            </div>
            <Link to="/dashboard/support" className={buttonStyles('outline', 'sm')}>
              Support
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
