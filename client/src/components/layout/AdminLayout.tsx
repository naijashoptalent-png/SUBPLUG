import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Menu,
  ReceiptText,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  adminOnly?: boolean;
}

const operationsItems: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/admin/fundings', label: 'Wallet fundings', icon: Banknote },
  { to: '/admin/support', label: 'Support', icon: ClipboardList },
];

const platformItems: AdminNavItem[] = [
  { to: '/admin/plans', label: 'Catalogue & pricing', icon: BookOpenCheck },
  { to: '/admin/providers', label: 'Providers & health', icon: ServerCog },
  { to: '/admin/audit', label: 'Audit logs', icon: ScrollText, adminOnly: true },
  { to: '/admin/settings', label: 'System settings', icon: Settings, adminOnly: true },
];

function pageTitle(pathname: string) {
  const items = [...operationsItems, ...platformItems];
  if (pathname.includes('/users/')) return 'User details';
  if (pathname.includes('/transactions/')) return 'Transaction details';
  if (pathname.includes('/support/')) return 'Support ticket';
  return items.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))?.label ?? 'Admin';
}

function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isAdmin } = useAuth();

  const renderItem = (item: AdminNavItem) => {
    if (item.adminOnly && !isAdmin) return null;
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
            isActive
              ? 'bg-brand-500/10 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
              : 'text-muted hover:bg-surface hover:text-ink'
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-600 dark:text-brand-300' : 'text-subtle')} aria-hidden="true" />
            {item.label}
            {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" /> : null}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <Link to="/admin" onClick={onNavigate} aria-label="SubPlug operations">
          <BrandMark />
        </Link>
      </div>

      <div className="mx-4 mb-4 rounded-2xl border border-line bg-surface/70 p-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink">Operations console</p>
            <p className="text-[10px] uppercase tracking-wider text-subtle">{isAdmin ? 'Administrator' : 'Support agent'}</p>
          </div>
        </div>
      </div>

      <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin navigation">
        <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Operations</p>
        {operationsItems.map(renderItem)}
        <p className="px-3 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Platform</p>
        {platformItems.map(renderItem)}
      </nav>

      <div className="border-t border-line p-4">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs text-muted transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to customer app
        </Link>
        <div className="mt-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <Avatar name={user?.fullName ?? 'Staff'} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{user?.fullName}</p>
            <p className="truncate text-[11px] text-subtle">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { isAdmin } = useAuth();
  const title = pageTitle(location.pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-raised lg:block">
        <AdminSidebarContent />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 w-[84%] max-w-xs border-r border-line bg-raised shadow-lift">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <AdminSidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-raised text-muted lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden items-center gap-1 rounded-full border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 sm:inline-flex">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{title}</p>
                <p className="hidden text-[11px] text-muted sm:block">SubPlug operations</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge tone="neutral" className="hidden md:inline-flex">
                <Activity className="h-3 w-3" aria-hidden="true" />
                Live data
              </Badge>
              <Link
                to="/admin/reconciliation"
                className="hidden h-9 items-center gap-1.5 rounded-xl border border-line bg-raised px-3 text-xs font-semibold text-muted transition hover:border-brand-400/50 hover:text-ink md:inline-flex"
              >
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Reconcile
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
