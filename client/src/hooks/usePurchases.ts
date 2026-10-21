import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { DashboardSummary, Pagination, Transaction } from '@/types';

export interface PurchaseFilters {
  [key: string]: unknown;
  page: number;
  limit?: number;
  service?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.summary,
    queryFn: () => getData<DashboardSummary>('/purchases/summary'),
    staleTime: 30_000,
  });
}

export function usePurchases(filters: PurchaseFilters) {
  return useQuery({
    queryKey: queryKeys.purchases(filters),
    queryFn: () =>
      getData<{ transactions: Transaction[]; pagination: Pagination }>('/purchases', {
        page: filters.page,
        limit: filters.limit ?? 20,
        ...(filters.service ? { service: filters.service } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      }),
    placeholderData: keepPreviousData,
  });
}

export function usePurchase(reference: string | undefined) {
  return useQuery({
    queryKey: queryKeys.purchase(reference ?? ''),
    queryFn: () => getData<Transaction>(`/purchases/${reference}`),
    enabled: Boolean(reference),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 5000 : false;
    },
  });
}

interface PurchaseInput {
  idempotencyKey: string;
}

export function usePurchaseAirtime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseInput & { network: string; phone: string; amountMinor: number }) =>
      postData<Transaction>(
        '/purchases/airtime',
        { network: input.network, phone: input.phone, amountMinor: input.amountMinor },
        { 'Idempotency-Key': input.idempotencyKey }
      ),
    onSuccess: () => invalidatePurchaseData(queryClient),
  });
}

export function usePurchaseData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseInput & { network: string; phone: string; providerPlanId: string }) =>
      postData<Transaction>(
        '/purchases/data',
        { network: input.network, phone: input.phone, providerPlanId: input.providerPlanId },
        { 'Idempotency-Key': input.idempotencyKey }
      ),
    onSuccess: () => invalidatePurchaseData(queryClient),
  });
}

export function usePurchaseElectricity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: PurchaseInput & {
        disco: string;
        meterNumber: string;
        meterType: 'PREPAID' | 'POSTPAID';
        amountMinor: number;
      }
    ) =>
      postData<Transaction>(
        '/purchases/electricity',
        {
          disco: input.disco,
          meterNumber: input.meterNumber,
          meterType: input.meterType,
          amountMinor: input.amountMinor,
        },
        { 'Idempotency-Key': input.idempotencyKey }
      ),
    onSuccess: () => invalidatePurchaseData(queryClient),
  });
}

export function usePurchaseCable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseInput & { cableProvider: string; smartcardNumber: string; providerPlanId: string }) =>
      postData<Transaction>(
        '/purchases/cable',
        {
          cableProvider: input.cableProvider,
          smartcardNumber: input.smartcardNumber,
          providerPlanId: input.providerPlanId,
        },
        { 'Idempotency-Key': input.idempotencyKey }
      ),
    onSuccess: () => invalidatePurchaseData(queryClient),
  });
}

function invalidatePurchaseData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
  void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
  void queryClient.invalidateQueries({ queryKey: ['purchases'] });
  void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.referrals });
}
