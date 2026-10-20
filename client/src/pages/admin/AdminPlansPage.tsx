import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { BookOpenCheck, Pencil, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Pagination } from '@/components/ui/Pagination';
import { Switch } from '@/components/ui/Switch';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminPlans, useSyncCatalogue, useUpdatePlan } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { formatNaira, formatRelative, parseNairaToMinor, SERVICE_LABELS } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import type { AdminPlan, Pagination as PaginationMeta } from '@/types';

const PAGE_SIZE = 20;

const serviceOptions = Object.entries(SERVICE_LABELS) as Array<[keyof typeof SERVICE_LABELS, string]>;

export function AdminPlansPage() {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [service, setService] = useState('');
  const [network, setNetwork] = useState('');
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const plansQuery = useAdminPlans({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(service ? { service } : {}),
    ...(network.trim() ? { network: network.trim() } : {}),
  });
  const updatePlan = useUpdatePlan();
  const syncCatalogue = useSyncCatalogue();

  const total = plansQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagination: PaginationMeta = {
    page,
    limit: PAGE_SIZE,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };

  const hasFilters = Boolean(search || service || network);

  const reset = () => {
    setPage(1);
    setSearch('');
    setService('');
    setNetwork('');
  };

  const openEdit = (plan: AdminPlan) => {
    setEditing(plan);
    setEditName(plan.name);
    setEditPrice((plan.sellingPriceMinor / 100).toString());
    setEditEnabled(plan.enabled);
    setEditError(null);
  };

  const submitEdit = async () => {
    if (!editing) return;
    setEditError(null);
    const name = editName.trim();
    if (name.length < 2) {
      setEditError('Plan name must be at least 2 characters.');
      return;
    }
    const priceMinor = parseNairaToMinor(editPrice);
    if (priceMinor === null || priceMinor <= 0) {
      setEditError('Enter a valid selling price in Naira.');
      return;
    }
    if (priceMinor < editing.costMinor) {
      setEditError(`Selling price cannot be below the provider cost of ${formatNaira(editing.costMinor)}.`);
      return;
    }
    try {
      await updatePlan.mutateAsync({
        id: editing.id,
        name,
        sellingPriceMinor: priceMinor,
        enabled: editEnabled,
      });
      toast.success(`${name} updated`);
      setEditing(null);
    } catch (error) {
      setEditError(getErrorMessage(error));
    }
  };

  const runSync = async () => {
    try {
      const result = await syncCatalogue.mutateAsync();
      const counts = Object.entries(result.counts)
        .map(([key, value]) => `${value} ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
        .join(', ');
      toast.success(counts ? `Catalogue synced: ${counts}` : 'Catalogue synced');
      setSyncOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <Helmet>
        <title>Catalogue &amp; pricing — QuickTopUp operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Platform"
        title="Catalogue & pricing"
        description="Provider plans, your selling prices, and availability. Disabling a plan hides it from customers without touching existing transactions."
        actions={
          isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncOpen(true)}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Sync catalogue
            </Button>
          ) : undefined
        }
      />

      {!isAdmin ? (
        <Alert variant="info" className="mt-5">
          Support access is read-only. An administrator must sync the catalogue or change plan pricing.
        </Alert>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search plans"
                placeholder="Search plan name"
                className="field py-2.5 pl-10 text-sm"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="field py-2.5 text-sm"
              aria-label="Filter by service"
              value={service}
              onChange={(event) => {
                setService(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All services</option>
              {serviceOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label="Filter by network"
              placeholder="Network e.g. MTN"
              className="field py-2.5 text-sm"
              value={network}
              onChange={(event) => {
                setNetwork(event.target.value);
                setPage(1);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!hasFilters}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              className="h-[42px]"
            >
              Reset
            </Button>
          </div>
        </div>

        {plansQuery.isLoading && !plansQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : plansQuery.isError ? (
          <ErrorState title="Catalogue could not load" onRetry={() => void plansQuery.refetch()} />
        ) : plansQuery.data?.plans.length ? (
          <>
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">Service</th>
                    <th scope="col">Network</th>
                    <th scope="col">Provider cost</th>
                    <th scope="col">Selling price</th>
                    <th scope="col">Margin</th>
                    <th scope="col">Status</th>
                    <th scope="col">Synced</th>
                    <th scope="col"><span className="sr-only">Edit</span></th>
                  </tr>
                </thead>
                <tbody>
                  {plansQuery.data.plans.map((plan) => {
                    const marginMinor = plan.sellingPriceMinor - plan.costMinor;
                    const kind = typeof plan.metadata?.kind === 'string' ? plan.metadata.kind : null;
                    return (
                      <tr key={plan.id}>
                        <td>
                          <p className="max-w-[240px] truncate text-xs font-semibold text-ink">{plan.name}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-subtle">
                            <span className="max-w-[180px] truncate">{plan.providerPlanId}</span>
                            {kind ? <Badge tone="neutral">{kind.replace(/_/g, ' ')}</Badge> : null}
                          </p>
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">{SERVICE_LABELS[plan.service] ?? plan.service}</td>
                        <td className="whitespace-nowrap text-xs text-muted">{plan.network ?? '—'}</td>
                        <td className="whitespace-nowrap text-xs">{formatNaira(plan.costMinor)}</td>
                        <td className="whitespace-nowrap text-xs font-semibold">{formatNaira(plan.sellingPriceMinor)}</td>
                        <td className={`whitespace-nowrap text-xs font-medium ${marginMinor < 0 ? 'text-danger' : 'text-success'}`}>
                          {formatNaira(marginMinor)}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={plan.enabled ? 'success' : 'neutral'}>
                              {plan.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                            {plan.isSandbox ? <Badge tone="warning">Sandbox</Badge> : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">
                          {plan.syncedAt ? formatRelative(plan.syncedAt) : '—'}
                        </td>
                        <td className="text-right">
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(plan)}
                              leftIcon={<Pencil className="h-3.5 w-3.5" />}
                            >
                              Edit
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={BookOpenCheck}
            title={hasFilters ? 'No plans match' : 'No catalogue plans'}
            description={
              hasFilters
                ? 'Try a different service, network, or search term.'
                : 'Run a catalogue sync to import plans from the connected provider.'
            }
            action={
              isAdmin && !hasFilters ? (
                <Button size="sm" onClick={() => setSyncOpen(true)} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
                  Sync catalogue
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      <p className="mt-4 text-[11px] text-subtle">
        {total.toLocaleString('en-NG')} catalogue record{total === 1 ? '' : 's'} matched. Selling price cannot be set below
        provider cost. Price and availability changes are audited.
      </p>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : 'Edit plan'}
        description="Changes apply to new purchases. Existing transactions keep the price that was charged."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={updatePlan.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void submitEdit()} isLoading={updatePlan.isPending}>
              Save plan
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-4">
            {editError ? <Alert variant="danger">{editError}</Alert> : null}
            <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 text-xs sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Service</p>
                <p className="mt-1 font-medium">{SERVICE_LABELS[editing.service] ?? editing.service}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Network</p>
                <p className="mt-1 font-medium">{editing.network ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Provider cost</p>
                <p className="mt-1 font-medium">{formatNaira(editing.costMinor)}</p>
              </div>
            </div>
            <Input
              label="Plan name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              maxLength={150}
            />
            <MoneyInput
              label="Selling price"
              value={editPrice}
              onChange={setEditPrice}
              hint={`Must be at least the provider cost of ${formatNaira(editing.costMinor)}.`}
            />
            <div className="rounded-2xl border border-line p-4">
              <Switch
                id="plan-enabled"
                label="Available to customers"
                description="Disabled plans stay in the catalogue but cannot be purchased."
                checked={editEnabled}
                onCheckedChange={setEditEnabled}
              />
            </div>
            <p className="font-mono text-[10px] text-subtle">Plan ID: {editing.id}</p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={syncOpen}
        onOpenChange={(open) => {
          if (!syncCatalogue.isPending) setSyncOpen(open);
        }}
        title="Sync the provider catalogue?"
        description="This imports the latest provider plans and prices, and refreshes network and package records."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSyncOpen(false)} disabled={syncCatalogue.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => void runSync()}
              isLoading={syncCatalogue.isPending}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Sync now
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-muted">
          <p>
            Provider cost changes are always imported. Manual selling prices are preserved when
            &ldquo;preserve manual plan pricing&rdquo; is enabled in system settings.
          </p>
          <Alert variant="info">
            A sync is additive and updates existing records by provider plan ID. It does not delete transaction history.
          </Alert>
        </div>
      </Dialog>
    </>
  );
}
