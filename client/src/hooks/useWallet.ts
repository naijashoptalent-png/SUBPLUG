import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { Funding, FundingInit, LedgerEntry, Pagination, WalletOverview } from '@/types';

export function useWallet() {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => getData<WalletOverview>('/wallet'),
    staleTime: 15_000,
  });
}

export function useLedger(params: {
  page: number;
  limit?: number;
  type?: string;
  direction?: 'CREDIT' | 'DEBIT';
}) {
  return useQuery({
    queryKey: queryKeys.ledger(params),
    queryFn: () =>
      getData<{ entries: LedgerEntry[]; pagination: Pagination }>('/wallet/ledger', {
        page: params.page,
        limit: params.limit ?? 20,
        ...(params.type ? { type: params.type } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
      }),
    placeholderData: keepPreviousData,
  });
}

export function useFundings(page: number, limit = 10) {
  return useQuery({
    queryKey: queryKeys.fundings(page),
    queryFn: () =>
      getData<{ fundings: Funding[]; pagination: Pagination }>('/wallet/fundings', { page, limit }),
    placeholderData: keepPreviousData,
  });
}

export function useFunding(reference: string | undefined) {
  return useQuery({
    queryKey: queryKeys.funding(reference ?? ''),
    queryFn: () => getData<Funding>(`/wallet/funding/${reference}`),
    enabled: Boolean(reference),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' ? 4000 : false;
    },
  });
}

export function useInitializeFunding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountMinor: number; idempotencyKey: string; gateway?: string }) =>
      postData<FundingInit>(
        '/wallet/fund',
        { amountMinor: input.amountMinor, ...(input.gateway ? { gateway: input.gateway } : {}) },
        {
          'Idempotency-Key': input.idempotencyKey,
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'fundings'] });
    },
  });
}

export function useVerifyFunding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) =>
      postData<{ status: string; reference: string; alreadyProcessed?: boolean; message?: string }>(
        `/wallet/funding/${reference}/verify`
      ),
    onSuccess: (_data, reference) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.funding(reference) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'fundings'] });
    },
  });
}

export function useSimulateFunding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reference: string; outcome: 'success' | 'failed' }) =>
      postData<{ status: string; reference: string; amountMinor?: number; alreadyProcessed?: boolean }>(
        `/wallet/funding/${input.reference}/simulate`,
        { outcome: input.outcome }
      ),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.funding(input.reference) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'fundings'] });
    },
  });
}
