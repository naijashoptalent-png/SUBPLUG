import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-transparent p-1 pr-2 transition hover:border-line hover:bg-raised',
          open && 'border-line bg-raised'
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <Avatar name={user.fullName} />
        {!compact ? (
          <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink sm:block">{user.fullName.split(' ')[0]}</span>
        ) : null}
        <ChevronDown className={cn('h-3.5 w-3.5 text-subtle transition', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-raised shadow-lift"
          role="menu"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
              {user.role === 'CUSTOMER' ? 'Customer' : user.role === 'ADMIN' ? 'Administrator' : 'Support'}
            </span>
          </div>
          <div className="p-1.5">
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-ink"
              role="menuitem"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              to="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-ink"
              role="menuitem"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Account settings
            </Link>
            <Link
              to="/dashboard/settings"
              state={{ tab: 'security' }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-ink"
              role="menuitem"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Security & 2FA
            </Link>
            {isStaff ? (
              <Link
                to={user.role === 'ADMIN' ? '/admin' : '/admin/transactions'}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-ink"
                role="menuitem"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {user.role === 'ADMIN' ? 'Admin console' : 'Operations'}
              </Link>
            ) : null}
          </div>
          <div className="border-t border-line p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-danger transition hover:bg-danger/10"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
