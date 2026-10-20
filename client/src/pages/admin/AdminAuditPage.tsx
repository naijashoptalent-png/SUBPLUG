import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { RotateCcw, ScrollText, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAdminAuditLogs } from '@/hooks/useAdmin';
import { formatDateTime } from '@/lib/format';

const commonActions = [
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'WALLET_ADJUSTED',
  'FUNDING_RECHECKED',
  'PROVIDER_HEALTH_CHECKED',
  'CATALOGUE_SYNCED',
  'PLAN_UPDATED',
  'SYSTEM_SETTING_UPDATED',
  'MAINTENANCE_MODE_ENABLED',
  'WALLET_RECONCILIATION_RUN',
  'SUPPORT_TICKET_REPLIED',
];

function toIsoStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toIsoEnd(date: string) {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}

function actionTone(action: string) {
  if (action.includes('SUSPENDED') || action.includes('FAILED')) return 'danger' as const;
  if (action.includes('ENABLED') || action.includes('MAINTENANCE')) return 'warning' as const;
  if (action.includes('REACTIVATED') || action.includes('APPROVED')) return 'success' as const;
  return 'neutral' as const;
}

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const auditQuery = useAdminAuditLogs({
    page,
    limit: 20,
    ...(action.trim() ? { action: action.trim().toUpperCase() } : {}),
    ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
    ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
    ...(from ? { from: toIsoStart(from) } : {}),
    ...(to ? { to: toIsoEnd(to) } : {}),
  });

  const hasFilters = Boolean(action || entityType || actorId || from || to);

  const reset = () => {
    setPage(1);
    setAction('');
    setEntityType('');
    setActorId('');
    setFrom('');
    setTo('');
  };

  return (
    <>
      <Helmet>
        <title>Audit logs — QuickTopUp operations</title>
      </Helmet>

      <PageHeader
        eyebrow="Platform"
        title="Audit logs"
        description="An append-only record of sensitive staff actions: account status, wallet adjustments, review decisions, provider checks, catalogue changes, and settings."
      />

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.1fr_0.8fr_0.9fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Filter by action"
                list="audit-actions"
                placeholder="Action e.g. WALLET_ADJUSTED"
                className="field py-2.5 pl-10 text-sm"
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
              />
              <datalist id="audit-actions">
                {commonActions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <input
              aria-label="Filter by entity type"
              placeholder="Entity type e.g. Wallet"
              className="field py-2.5 text-sm"
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
            />
            <input
              aria-label="Filter by actor ID"
              placeholder="Actor user ID"
              className="field py-2.5 font-mono text-[11px]"
              value={actorId}
              onChange={(event) => {
                setActorId(event.target.value);
                setPage(1);
              }}
            />
            <input
              type="date"
              aria-label="From date"
              className="field py-2.5 text-sm"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
            <input
              type="date"
              aria-label="To date"
              className="field py-2.5 text-sm"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
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

        {auditQuery.isLoading && !auditQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : auditQuery.isError ? (
          <ErrorState title="Audit logs could not load" onRetry={() => void auditQuery.refetch()} />
        ) : auditQuery.data?.logs.length ? (
          <>
            <div className="table-wrap">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">IP</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditQuery.data.logs.map((log) => (
                    <tr key={log._id} className="align-top">
                      <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(log.createdAt)}</td>
                      <td>
                        <p className="text-xs font-semibold text-ink">{log.actorName ?? 'System'}</p>
                        <p className="mt-0.5 text-[10px] text-subtle">
                          {log.actorRole ?? '—'} · <span className="font-mono">{log.actorId ?? '—'}</span>
                        </p>
                      </td>
                      <td>
                        <Badge tone={actionTone(log.action)}>
                          <span className="font-mono text-[10px]">{log.action}</span>
                        </Badge>
                      </td>
                      <td>
                        <p className="text-xs text-ink">{log.entityType ?? '—'}</p>
                        {log.entityId ? (
                          <p className="mt-0.5 max-w-[180px] truncate font-mono text-[10px] text-subtle">{log.entityId}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap font-mono text-[10px] text-muted">{log.ip ?? '—'}</td>
                      <td className="max-w-[280px]">
                        {log.metadata && Object.keys(log.metadata).length ? (
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300">
                              View metadata
                            </summary>
                            <pre className="scroll-thin mt-2 max-h-56 overflow-auto rounded-xl border border-line bg-surface p-3 text-[10px] leading-5">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-[11px] text-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={auditQuery.data.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={ScrollText}
            title={hasFilters ? 'No audit records match' : 'No audit records yet'}
            description={
              hasFilters
                ? 'Try a different action, entity type, actor, or date range.'
                : 'Sensitive staff actions will appear here as they happen.'
            }
          />
        )}
      </Card>

      <p className="mt-4 text-[11px] text-subtle">
        Audit entries are append-only. Metadata may contain financially sensitive references; share only with authorised
        staff.
      </p>
    </>
  );
}
