import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, LifeBuoy } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page not found — QuickTopUp</title>
      </Helmet>
      <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
        <div className="max-w-lg text-center">
          <p className="font-display text-[6rem] font-bold leading-none tracking-tighter text-brand-500/20 dark:text-brand-300/20">404</p>
          <span className="mx-auto mt-2 grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <Compass className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">This page is not on the map</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            The link may be outdated or the page may have moved. Your wallet and transactions are safe — head back to the
            dashboard or get help.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to="/" className={buttonStyles('primary', 'md')} >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back home
            </Link>
            <Link to="/dashboard" className={buttonStyles('outline', 'md')}>
              Go to dashboard
            </Link>
            <Link to="/contact" className={buttonStyles('ghost', 'md')}>
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Support
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
