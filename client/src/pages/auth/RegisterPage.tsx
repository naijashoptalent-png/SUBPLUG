import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox, Input, PasswordInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/hooks/useAuth';
import { registerSchema, type RegisterForm } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const passwordChecks = [
  { label: '10+ characters', test: (value: string) => value.length >= 10 },
  { label: 'Upper & lowercase', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'A number', test: (value: string) => /\d/.test(value) },
  { label: 'A symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      referralCode: '',
      acceptTerms: false,
    },
  });

  const password = watch('password');
  const referralFromLink = searchParams.get('ref');

  useEffect(() => {
    if (referralFromLink) setValue('referralCode', referralFromLink.toUpperCase());
  }, [referralFromLink, setValue]);

  const onSubmit = async (values: RegisterForm) => {
    setError(null);
    try {
      await registerUser({
        ...values,
        referralCode: values.referralCode || undefined,
      });
      toast.success('Account created');
      navigate('/login', {
        replace: true,
        state: {
          email: values.email,
          message: 'Account created. Sign in to fund your wallet and start using SubPlug.',
        },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>Create your account — SubPlug</title>
        <meta name="description" content="Create a SubPlug account to fund your wallet and pay for airtime, data, electricity and cable TV." />
      </Helmet>

      <div className="mb-7">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">One wallet for airtime, data, electricity and cable TV.</p>
      </div>

      {error ? (
        <Alert variant="danger" title="Could not create your account" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Ada Okafor"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Phone number"
          type="tel"
          autoComplete="tel"
          placeholder="0803 123 4567"
          error={errors.phone?.message}
          hint="Nigerian mobile number. Used for receipts and account security."
          {...register('phone')}
        />
        <div>
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {passwordChecks.map((check) => {
              const passed = check.test(password ?? '');
              return (
                <span
                  key={check.label}
                  className={cn('inline-flex items-center gap-1.5 text-[11px]', passed ? 'text-success' : 'text-subtle')}
                >
                  <span
                    className={cn(
                      'grid h-3.5 w-3.5 place-items-center rounded-full border',
                      passed ? 'border-success bg-success/10' : 'border-line'
                    )}
                  >
                    {passed ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
                  </span>
                  {check.label}
                </span>
              );
            })}
          </div>
        </div>
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Input
          label="Referral code (optional)"
          placeholder="e.g. ADA123"
          error={errors.referralCode?.message}
          {...register('referralCode')}
        />
        <Checkbox
          label={
            <>
              I agree to the{' '}
              <Link to="/terms" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                terms of service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                privacy policy
              </Link>
              .
            </>
          }
          error={errors.acceptTerms?.message}
          {...register('acceptTerms')}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
