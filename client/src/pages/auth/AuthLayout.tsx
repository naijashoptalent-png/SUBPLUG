import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Wallet } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { usePublicSettings } from '@/hooks/usePublicSettings';

const points = [
  'One wallet for airtime, data, electricity and cable TV',
  'Integer-kobo ledger with an auditable record of every movement',
  'Provider-confirmed results — never a fake success screen',
];

export function AuthLayout() {
  const { settings } = usePublicSettings();

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-950 px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-60" aria-hidden="true">
          <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" aria-label="QuickTopUp home" className="text-white [&_span]:text-white">
            <BrandMark name={settings.branding.name} />
          </Link>
          <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
            Secure account
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Top up life, simply</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight">
            Your everyday bills, handled from one wallet.
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-white/70">
            Fund once, then pay for the things that keep your day moving. Every transaction is recorded with a
            provider-verified outcome.
          </p>
          <ul className="mt-8 space-y-3.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <ShieldCheck className="h-5 w-5 text-brand-300" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold">Verified webhooks</p>
            <p className="mt-0.5 text-[11px] leading-5 text-white/60">Wallet credits happen only after signature validation.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <Wallet className="h-5 w-5 text-brand-300" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold">Integer kobo</p>
            <p className="mt-0.5 text-[11px] leading-5 text-white/60">No floating-point rounding on money. Ever.</p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <span className="lg:hidden">
              <BrandMark name={settings.branding.name} showName={false} />
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
        <footer className="px-4 py-5 text-center text-xs text-subtle sm:px-8">
          Need help?{' '}
          <a className="font-medium text-muted hover:text-ink" href={`mailto:${settings.support.email}`}>
            {settings.support.email}
          </a>
        </footer>
      </div>
    </div>
  );
}
