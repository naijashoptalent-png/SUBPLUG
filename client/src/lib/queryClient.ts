import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = error instanceof ApiError ? error.status : 500;
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  me: ['auth', 'me'] as const,
  publicSettings: ['public-settings'] as const,
  services: ['services'] as const,
  networks: ['services', 'networks'] as const,
  dataPlans: (network?: string) => ['services', 'data-plans', network ?? 'all'] as const,
  electricityProviders: ['services', 'electricity-providers'] as const,
  cableProviders: ['services', 'cable-providers'] as const,
  cablePackages: (network: string) => ['services', 'cable-packages', network] as const,
  airtimeQuote: (network: string, amountMinor: number) => ['services', 'airtime-quote', network, amountMinor] as const,
  wallet: ['wallet'] as const,
  ledger: (params: Record<string, unknown>) => ['wallet', 'ledger', params] as const,
  fundings: (page: number) => ['wallet', 'fundings', page] as const,
  funding: (reference: string) => ['wallet', 'funding', reference] as const,
  summary: ['purchases', 'summary'] as const,
  purchases: (params: Record<string, unknown>) => ['purchases', params] as const,
  purchase: (reference: string) => ['purchases', 'detail', reference] as const,
  notifications: (page: number) => ['notifications', page] as const,
  referrals: ['referrals'] as const,
  tickets: (page: number) => ['support', 'tickets', page] as const,
  ticket: (id: string) => ['support', 'ticket', id] as const,
  adminOverview: (days: number) => ['admin', 'overview', days] as const,
  adminUsers: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
  adminUser: (id: string) => ['admin', 'user', id] as const,
  adminTransactions: (params: Record<string, unknown>) => ['admin', 'transactions', params] as const,
  adminTransaction: (reference: string) => ['admin', 'transaction', reference] as const,
  adminFundings: (params: Record<string, unknown>) => ['admin', 'fundings', params] as const,
  adminPlans: (params: Record<string, unknown>) => ['admin', 'plans', params] as const,
  adminProviders: ['admin', 'providers'] as const,
  adminSettings: ['admin', 'settings'] as const,
  adminAudit: (params: Record<string, unknown>) => ['admin', 'audit', params] as const,
  adminTickets: (params: Record<string, unknown>) => ['admin', 'tickets', params] as const,
  adminTicket: (id: string) => ['admin', 'ticket', id] as const,
};
