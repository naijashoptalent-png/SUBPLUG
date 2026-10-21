import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, patchData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type {
  AdminOverview,
  AdminPlan,
  AdminPlanRaw,
  AdminUser,
  AdminUserDetail,
  AuditLog,
  Funding,
  Pagination,
  ProviderInfo,
  ProviderRouteSwitchResult,
  ProviderServiceRoute,
  ReconciliationResult,
  ServiceRouteKey,
  SupportTicket,
  SwitchableProviderKey,
  SystemSettings,
  Transaction,
} from '@/types';

export interface AdminTableParams {
  [key: string]: unknown;
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  service?: string;
  network?: string;
  action?: string;
  actorId?: string;
  entityType?: string;
  userId?: string;
  provider?: string;
  from?: string;
  to?: string;
}

function compact(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
  );
}

export function useAdminOverview(days = 30) {
  return useQuery({
    queryKey: queryKeys.adminOverview(days),
    queryFn: () => getData<AdminOverview>('/admin/overview', { days }),
    staleTime: 30_000,
  });
}

export function useAdminUsers(params: AdminTableParams) {
  return useQuery({
    queryKey: queryKeys.adminUsers(params),
    queryFn: () =>
      getData<{ users: AdminUser[]; pagination: Pagination }>(
        '/admin/users',
        compact({ ...params, limit: params.limit ?? 20 })
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminUser(id ?? ''),
    queryFn: () => getData<AdminUserDetail>(`/admin/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useAdminTransactions(params: AdminTableParams) {
  return useQuery({
    queryKey: queryKeys.adminTransactions(params),
    queryFn: () =>
      getData<{ transactions: Transaction[]; pagination: Pagination }>(
        '/admin/transactions',
        compact({ ...params, limit: params.limit ?? 20 })
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTransaction(reference: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminTransaction(reference ?? ''),
    queryFn: () => getData<Transaction>(`/admin/transactions/${reference}`),
    enabled: Boolean(reference),
  });
}

export function useAdminFundings(params: AdminTableParams) {
  return useQuery({
    queryKey: queryKeys.adminFundings(params),
    queryFn: () =>
      getData<{ fundings: Funding[]; pagination: Pagination }>(
        '/admin/fundings',
        compact({ ...params, limit: params.limit ?? 20 })
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPlans(params: AdminTableParams & { service?: string }) {
  return useQuery({
    queryKey: queryKeys.adminPlans(params),
    queryFn: async () => {
      const data = await getData<{ plans: AdminPlanRaw[]; total: number }>(
        '/admin/plans',
        compact({ ...params, limit: params.limit ?? 20 })
      );
      return { plans: data.plans.map((plan) => ({ ...plan, id: plan._id })), total: data.total };
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminProviders() {
  return useQuery({
    queryKey: queryKeys.adminProviders,
    queryFn: () =>
      getData<{
        providers: ProviderInfo[];
        activeVtu: { key: string; name: string; isSandbox: boolean };
        configuredVtu: Array<{ key: string; name: string; isSandbox: boolean; configured: boolean }>;
        routes: Partial<Record<ServiceRouteKey, string>>;
        serviceRoutes: ProviderServiceRoute[];
        payment: { key: string; isSandbox: boolean; configured: boolean };
      }>('/admin/providers'),
  });
}

export function useSwitchProviderRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { service: 'AIRTIME' | 'DATA'; provider: SwitchableProviderKey }) =>
      postData<ProviderRouteSwitchResult>('/admin/providers/routing', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: queryKeys.adminSettings,
    queryFn: () => getData<SystemSettings>('/admin/settings'),
  });
}

export function useAdminAuditLogs(params: AdminTableParams) {
  return useQuery({
    queryKey: queryKeys.adminAudit(params),
    queryFn: () =>
      getData<{ logs: AuditLog[]; pagination: Pagination }>(
        '/admin/audit-logs',
        compact({ ...params, limit: params.limit ?? 20 })
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTickets(params: AdminTableParams) {
  return useQuery({
    queryKey: queryKeys.adminTickets(params),
    queryFn: () =>
      getData<{ tickets: SupportTicket[]; pagination: Pagination }>(
        '/admin/support/tickets',
        compact({ ...params, limit: params.limit ?? 20 })
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTicket(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminTicket(id ?? ''),
    queryFn: () => getData<SupportTicket>(`/admin/support/tickets/${id}`),
    enabled: Boolean(id),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'ACTIVE' | 'SUSPENDED'; reason: string }) =>
      patchData<{ id: string; status: string }>(`/admin/users/${input.id}/status`, {
        status: input.status,
        reason: input.reason,
      }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(input.id) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useAdjustWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      amountMinor: number;
      direction: 'CREDIT' | 'DEBIT';
      reason: string;
      idempotencyKey: string;
    }) => postData('/admin/wallet/adjust', input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(input.userId) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useApproveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => postData<Transaction>(`/admin/transactions/${reference}/approve`),
    onSuccess: (_data, reference) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminTransaction(reference) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'transactions'] });
    },
  });
}

export function useRejectTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reference: string; reason: string }) =>
      postData<Transaction>(`/admin/transactions/${input.reference}/reject`, { reason: input.reason }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminTransaction(input.reference) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'transactions'] });
    },
  });
}

export function useCheckTransactionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) =>
      postData<Transaction>(`/admin/transactions/${reference}/check-status`),
    onSuccess: (_data, reference) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminTransaction(reference) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'transactions'] });
    },
  });
}

export function useRecheckFunding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) => postData(`/admin/fundings/${reference}/recheck`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'fundings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useSyncCatalogue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postData<{ counts: Record<string, number>; syncedAt: string }>('/admin/plans/sync'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; enabled?: boolean; sellingPriceMinor?: number; name?: string }) => {
      const { id, ...body } = input;
      return patchData<AdminPlan>(`/admin/plans/${id}`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useCheckProviders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      postData<Array<{ provider: string; kind: string; healthy: boolean; message?: string }>>(
        '/admin/providers/check'
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useSaveSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: Record<string, unknown>; confirm?: string }) =>
      patchData(`/admin/settings`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicSettings });
    },
  });
}

export function useReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getData<ReconciliationResult>('/admin/reconciliation'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders });
    },
  });
}

export function useReplyTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      body: string;
      status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    }) =>
      postData<SupportTicket>(`/admin/support/tickets/${input.id}/reply`, {
        body: input.body,
        ...(input.status ? { status: input.status } : {}),
      }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminTicket(input.id) });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
    },
  });
}
