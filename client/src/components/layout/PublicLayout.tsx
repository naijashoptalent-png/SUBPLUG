import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, Mail, Phone, Clock } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { buttonStyles } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { cn } from '@/lib/utils';

const navigation = [
  { to: '/services', label: 'Services' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { settings } = usePublicSettings();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <ScrollToTop />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-raised focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lift"
      >
        Skip to content
      </a>

      {settings.maintenance.enabled ? (
        <div className="bg-warning px-4 py-2 text-center text-xs font-semibold text-black">
          {settings.maintenance.message}
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-4">
          <Link to="/" aria-label="SubPlug home" className="rounded-xl">
            <BrandMark name={settings.branding.name} className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-brand-500/10 text-brand-800 dark:text-brand-200' : 'text-muted hover:bg-surface hover:text-ink'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to={user?.role === 'CUSTOMER' ? '/dashboard' : '/admin'} className={buttonStyles('primary', 'sm')}>
                {user?.role === 'CUSTOMER' ? 'Dashboard' : 'Admin console'}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonStyles('ghost', 'sm', 'hidden sm:inline-flex')}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonStyles('primary', 'sm')}>
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Create account</span>
                </Link>
              </>
            )}
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted lg:hidden"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open ? (
          <div id="mobile-navigation" className="border-t border-line bg-raised lg:hidden">
            <nav className="container-page flex flex-col py-3" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-3 py-3 text-sm font-medium',
                      isActive ? 'bg-brand-500/10 text-brand-800 dark:text-brand-200' : 'text-muted'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {!isAuthenticated ? (
                <Link to="/login" className="rounded-xl px-3 py-3 text-sm font-medium text-muted">
                  Sign in
                </Link>
              ) : null}
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-raised">
        <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <BrandMark name={settings.branding.name} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              {settings.branding.tagline} Airtime, mobile data, electricity and cable TV paid from one secure wallet.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-subtle">Built for Nigeria</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Services</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link className="hover:text-ink" to="/dashboard/airtime">Buy airtime</Link></li>
              <li><Link className="hover:text-ink" to="/dashboard/data">Buy mobile data</Link></li>
              <li><Link className="hover:text-ink" to="/dashboard/electricity">Pay electricity</Link></li>
              <li><Link className="hover:text-ink" to="/dashboard/cable">Renew cable TV</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Company</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link className="hover:text-ink" to="/about">About SubPlug</Link></li>
              <li><Link className="hover:text-ink" to="/how-it-works">How it works</Link></li>
              <li><Link className="hover:text-ink" to="/faq">Help centre</Link></li>
              <li><Link className="hover:text-ink" to="/contact">Contact support</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Support</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-muted">
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <a href={`mailto:${settings.support.email}`} className="hover:text-ink">{settings.support.email}</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <a href={`tel:${settings.support.phone}`} className="hover:text-ink">{settings.support.phone}</a>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{settings.support.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="container-page flex flex-col gap-3 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {settings.branding.name}. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link to="/terms" className="hover:text-ink">Terms of service</Link>
              <Link to="/privacy" className="hover:text-ink">Privacy policy</Link>
              <Link to="/faq" className="hover:text-ink">Help</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SimplePageShell({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        {eyebrow ? <p className="section-eyebrow mb-4">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-base leading-7 text-muted">{description}</p> : null}
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
