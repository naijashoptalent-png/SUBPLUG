import { useQuery } from '@tanstack/react-query';
import { getData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { PublicSettings } from '@/types';

export const FALLBACK_SETTINGS: PublicSettings = {
  branding: {
    name: 'SubPlug',
    tagline: 'Top up life, simply.',
    primaryColor: '#0f766e',
    supportEmail: 'support@example.com',
    supportPhone: '+2348000000000',
  },
  support: {
    email: 'support@example.com',
    phone: '+2348000000000',
    whatsapp: '',
    hours: 'Mon–Sat, 8:00–20:00 WAT',
  },
  maintenance: {
    enabled: false,
    message: 'We are carrying out scheduled maintenance. Please check back shortly.',
  },
  referralsEnabled: true,
  environment: {
    vtuSandbox: false,
    paymentSandbox: false,
    paymentGateway: 'unconfigured',
    paymentMethods: [],
  },
};

export function usePublicSettings() {
  const query = useQuery({
    queryKey: queryKeys.publicSettings,
    queryFn: () => getData<PublicSettings>('/services/public-settings'),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    ...query,
    settings: query.data ?? FALLBACK_SETTINGS,
  };
}
