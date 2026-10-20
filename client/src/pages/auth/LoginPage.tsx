import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Input, PasswordInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginForm } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/errors';

interface LocationState {
  email?: string;
  message?: string;
}

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state ?? {}) as LocationState;
  const [error, setError] = useState<string | null>(null);
  const redirect = safeRedirect(searchParams.get('redirect'));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state.email ?? '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    try {
      const result = await login(values);
      if (result.requiresTwoFactor && result.challengeToken) {
        navigate('/two-factor', {
          state: { challengeToken: result.challengeToken, redirect },
          replace: true,
        });
        return;
      }
      toast.success('Welcome back');
      const role = result.user?.role;
      navigate(redirect ?? (role === 'CUSTOMER' ? '/dashboard' : '/admin'), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>Sign in — QuickTopUp</title>
        <meta name="description" content="Sign in to your QuickTopUp wallet to buy airtime, data, electricity and cable TV." />
      </Helmet>

      <div className="mb-8">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">Sign in to continue to your wallet and recent transactions.</p>
      </div>

      {state.message ? (
        <Alert variant="success" className="mb-5">
          {state.message}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" title="Could not sign you in" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to QuickTopUp?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Create an account
        </Link>
      </p>

      <p className="mt-8 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-center text-[11px] leading-5 text-subtle">
        Access is protected by rate limiting and account lockout. Never share your password or one-time codes with anyone.
      </p>
    </div>
  );
}
