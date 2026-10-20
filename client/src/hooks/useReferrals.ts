import { useQuery } from '@tanstack/react-query';
import { getData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { ReferralSummary } from '@/types';

export function useReferrals() {
  return useQuery({
    queryKey: queryKeys.referrals,
    queryFn: () => getData<ReferralSummary>('/referrals'),
  });
}
