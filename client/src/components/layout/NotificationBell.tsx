import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/States';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotifications(1, 6);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-raised text-muted transition hover:border-brand-400/50 hover:text-ink"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-x-3 top-[4.5rem] z-50 flex max-h-[calc(100dvh-5.25rem)] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[none] sm:w-[min(22rem,calc(100vw-2rem))]"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-[22rem]">
            {isLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : data?.notifications.length ? (
              <ul className="divide-y divide-line">
                {data.notifications.map((notification) => {
                  const content = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm', notification.readAt ? 'font-medium text-muted' : 'font-semibold text-ink')}>
                          {notification.title}
                        </p>
                        {!notification.readAt ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{notification.body}</p>
                      <p className="mt-1 text-[11px] text-subtle">{formatRelative(notification.createdAt)}</p>
                    </>
                  );
                  return (
                    <li key={notification._id}>
                      {notification.link ? (
                        <Link
                          to={notification.link}
                          onClick={() => {
                            if (!notification.readAt) markRead.mutate(notification._id);
                            setOpen(false);
                          }}
                          className="block px-4 py-3 transition hover:bg-surface"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!notification.readAt) markRead.mutate(notification._id);
                          }}
                          className="block w-full px-4 py-3 text-left transition hover:bg-surface"
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</p>
            )}
          </div>

          <Link
            to="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block shrink-0 border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-surface dark:text-brand-300"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
