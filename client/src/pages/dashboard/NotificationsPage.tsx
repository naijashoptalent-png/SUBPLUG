import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CheckCheck,
  Gift,
  LifeBuoy,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

const typeConfig: Record<
  NotificationItem['type'],
  { icon: typeof Bell; classes: string; label: string }
> = {
  SYSTEM: { icon: Bell, classes: 'bg-brand-500/10 text-brand-700 dark:text-brand-300', label: 'System' },
  TRANSACTION: { icon: ReceiptText, classes: 'bg-info/10 text-info', label: 'Transaction' },
  FUNDING: { icon: Wallet, classes: 'bg-success/10 text-success', label: 'Funding' },
  SECURITY: { icon: ShieldCheck, classes: 'bg-warning/10 text-warning', label: 'Security' },
  REFERRAL: { icon: Gift, classes: 'bg-purple-500/10 text-purple-700 dark:text-purple-300', label: 'Referral' },
  SUPPORT: { icon: LifeBuoy, classes: 'bg-brand-500/10 text-brand-700 dark:text-brand-300', label: 'Support' },
  REFUND: { icon: Wallet, classes: 'bg-success/10 text-success', label: 'Refund' },
};

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notificationsQuery = useNotifications(page);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const notifications = notificationsQuery.data?.notifications ?? [];
  const visible = unreadOnly ? notifications.filter((item) => !item.readAt) : notifications;
  const unread = notificationsQuery.data?.unread ?? 0;

  const openNotification = (item: NotificationItem) => {
    if (!item.readAt) void markRead.mutate(item._id);
    if (item.link) navigate(item.link);
  };

  return (
    <>
      <Helmet>
        <title>Notifications — SubPlug</title>
      </Helmet>

      <PageHeader
        eyebrow="Account"
        title="Notifications"
        description="Funding, purchase, security, and support updates for your account."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            isLoading={markAllRead.isPending}
            disabled={unread === 0}
            leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
          >
            Mark all read
          </Button>
        }
      />

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Notification filter">
          <button
            type="button"
            role="tab"
            aria-selected={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              !unreadOnly ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
            )}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={unreadOnly}
            onClick={() => setUnreadOnly(true)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              unreadOnly ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
            )}
          >
            Unread
            {unread > 0 ? <Badge tone="brand">{unread}</Badge> : null}
          </button>
        </div>
        <p className="text-xs text-muted">{unread} unread</p>
      </div>

      <Card className="mt-3 overflow-hidden">
        {notificationsQuery.isLoading && !notificationsQuery.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : notificationsQuery.isError ? (
          <ErrorState title="Notifications could not load" onRetry={() => void notificationsQuery.refetch()} />
        ) : visible.length ? (
          <>
            <ul className="divide-y divide-line">
              {visible.map((item) => {
                const config = typeConfig[item.type] ?? typeConfig.SYSTEM;
                const Icon = config.icon;
                return (
                  <li key={item._id} className={cn('relative', !item.readAt && 'bg-brand-500/[0.03]')}>
                    <button
                      type="button"
                      onClick={() => openNotification(item)}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-surface"
                    >
                      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', config.classes)}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn('text-sm', item.readAt ? 'font-medium text-ink' : 'font-semibold text-ink')}>
                            {item.title}
                          </p>
                          {!item.readAt ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label="Unread" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted">{item.body}</p>
                        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-subtle">
                          {config.label} · {formatRelative(item.createdAt)}
                        </p>
                      </div>
                      {!item.readAt ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            void markRead.mutate(item._id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              void markRead.mutate(item._id);
                            }
                          }}
                          className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-brand-700 transition hover:bg-brand-500/10 dark:text-brand-300"
                        >
                          Mark read
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination pagination={notificationsQuery.data?.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={unreadOnly ? CheckCheck : BellRing}
            title={unreadOnly ? 'You are all caught up' : 'No notifications yet'}
            description={
              unreadOnly
                ? 'There are no unread notifications on this page.'
                : 'Important account and transaction updates will appear here.'
            }
          />
        )}
      </Card>
    </>
  );
}
