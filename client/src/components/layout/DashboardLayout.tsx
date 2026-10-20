import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Gift,
  History,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Phone,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tv,
  Wallet as WalletIcon,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { SandboxBadge } from '@/components/ui/SandboxNotice';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const buyItems: NavItem[] = [
  { to: '/dashboard/airtime', label: 'Buy airtime', icon: Phone },
  { to: '/dashboard/data', label: 'Buy data', icon: Wifi },
  { to: '/dashboard/electricity', label: 'Electricity', icon: Zap },
  { to: '/dashboard/cable', label: 'Cable TV', icon: Tv },
];

const mainItems: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/wallet', label: 'Wallet', icon: WalletIcon },
  { to: '/dashboard/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/dashboard/referrals', label: 'Referrals', icon: Gift },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
];

const accountItems: NavItem[] = [
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function usePageTitle(pathname: string) {
  const allItems = [...mainItems, ...buyItems, ...accountItems];
  if (pathname.includes('/transactions/')) return 'Transaction details';
  if (pathname.includes('/support/')) return 'Support ticket';
  return allItems.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))?.label ?? 'Dashboard';
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isStaff } = useAuth();
  const { data: wallet } = useWallet();
  const balance = wallet?.wallet.balanceMinor;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/dashboard" onClick={onNavigate} aria-label="SubPlug dashboard">
          <BrandMark />
        </Link>
      </div>

      <div className="px-4 pb-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-4 text-white shadow-glow dark:from-brand-600 dark:via-brand-700 dark:to-brand-900">
          <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full border border-white/15" aria-hidden="true" />
          <div className="absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-white/5" aria-hidden="true" />
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">Wallet balance</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {balance === undefined ? '₦—' : formatNaira(balance)}
          </p>
          <Link
            to="/dashboard/wallet"
            onClick={onNavigate}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Fund wallet
          </Link>
        </div>
      </div>

      <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Dashboard navigation">
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Overview</p>
        {mainItems.map((item) => (
          <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}

        <p className="px-3 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Buy & pay</p>
        {buyItems.map((item) => (
          <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}

        <p className="px-3 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Account</p>
        {accountItems.map((item) => (
          <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}

        {isStaff ? (
          <Link
            to={user?.role === 'ADMIN' ? '/admin' : '/admin/transactions'}
            onClick={onNavigate}
            className="mt-3 flex items-center gap-2.5 rounded-xl border border-brand-500/20 bg-brand-500/10 px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-500/15 dark:text-brand-200"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {user?.role === 'ADMIN' ? 'Admin console' : 'Operations'}
            <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </nav>

      <div className="border-t border-line px-4 py-3">
        <Link
          to="/contact"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs text-muted transition hover:text-ink"
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
          Help centre
          <ChevronRight className="ml-auto h-3 w-3" aria-hidden="true" />
        </Link>
        <div className="mt-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <Avatar name={user?.fullName ?? 'User'} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{user?.fullName}</p>
            <p className="truncate text-[11px] text-subtle">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
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
}

const mobileItems = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/dashboard/wallet', label: 'Wallet', icon: WalletIcon },
  { to: '/dashboard/airtime', label: 'Buy', icon: Plus },
  { to: '/dashboard/transactions', label: 'History', icon: History },
  { to: '/dashboard/settings', label: 'Account', icon: Settings },
];

export function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const title = usePageTitle(location.pathname);
  const { data: wallet } = useWallet();

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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-raised focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lift"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-raised lg:block">
        <SidebarContent />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
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
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
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

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{title}</p>
              <p className="hidden text-[11px] text-muted sm:block">SubPlug account</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <SandboxBadge className="hidden sm:inline-flex" />
              <Link
                to="/dashboard/wallet"
                className="hidden items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand-400/50 sm:inline-flex"
                aria-label="Wallet balance, open wallet"
              >
                <WalletIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                {wallet ? formatNaira(wallet.wallet.balanceMinor) : '₦—'}
              </Link>
              <Link
                to="/dashboard/wallet"
                className="hidden h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-xs font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400 md:inline-flex"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Fund
              </Link>
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-raised/95 backdrop-blur-xl lg:hidden"
        aria-label="Mobile dashboard navigation"
      >
        <div className="grid grid-cols-5">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition',
                    isActive ? 'text-brand-700 dark:text-brand-300' : 'text-subtle'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid h-7 w-10 place-items-center rounded-lg transition',
                        isActive && 'bg-brand-500/10'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
