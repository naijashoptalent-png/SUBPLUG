import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type {
  AirtimeQuote,
  CablePackage,
  CableProvider,
  DataPlan,
  ElectricityProvider,
  NetworkInfo,
  ServiceSummary,
} from '@/types';

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () =>
      getData<{ services: ServiceSummary[]; provider: { key: string; name: string; isSandbox: boolean } }>(
        '/services'
      ),
    staleTime: 5 * 60_000,
  });
}

export function useNetworks() {
  return useQuery({
    queryKey: queryKeys.networks,
    queryFn: () => getData<NetworkInfo[]>('/services/networks'),
    staleTime: 10 * 60_000,
  });
}

export function useDataPlans(network?: string) {
  return useQuery({
    queryKey: queryKeys.dataPlans(network),
    queryFn: () => getData<DataPlan[]>('/services/data-plans', network ? { network } : undefined),
    enabled: Boolean(network),
    staleTime: 5 * 60_000,
  });
}

export function useElectricityProviders() {
  return useQuery({
    queryKey: queryKeys.electricityProviders,
    queryFn: () =>
      getData<{ providers: ElectricityProvider[]; feeMinor: number }>('/services/electricity-providers'),
    staleTime: 5 * 60_000,
  });
}

export function useCableProviders() {
  return useQuery({
    queryKey: queryKeys.cableProviders,
    queryFn: () => getData<CableProvider[]>('/services/cable-providers'),
    staleTime: 5 * 60_000,
  });
}

export function useCablePackages(network: string) {
  return useQuery({
    queryKey: queryKeys.cablePackages(network),
    queryFn: () => getData<CablePackage[]>('/services/cable-packages', { network }),
    enabled: Boolean(network),
    staleTime: 5 * 60_000,
  });
}

export function useAirtimeQuote(network: string | undefined, amountMinor: number) {
  return useQuery({
    queryKey: queryKeys.airtimeQuote(network ?? '', amountMinor),
    queryFn: () =>
      getData<AirtimeQuote>('/services/airtime-quote', { network, amountMinor }),
    enabled: Boolean(network) && Number.isSafeInteger(amountMinor) && amountMinor >= 100,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export interface MeterValidation {
  customerName: string;
  customerAddress?: string;
  meterNumber?: string;
  disco?: string;
  meterType?: string;
  valid?: boolean;
  isValid?: boolean;
  isSandbox?: boolean;
  message?: string;
}

export function useValidateMeter() {
  return useMutation({
    mutationFn: (input: { disco: string; meterNumber: string; meterType: 'PREPAID' | 'POSTPAID' }) =>
      postData<MeterValidation>('/services/validate-meter', input),
  });
}

export function useValidateSmartcard() {
  return useMutation({
    mutationFn: (input: { cableProvider: string; smartcardNumber: string }) =>
      postData<MeterValidation>('/services/validate-smartcard', input),
  });
}
