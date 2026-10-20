import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { Pagination, SupportTicket } from '@/types';

export function useTickets(page = 1) {
  return useQuery({
    queryKey: queryKeys.tickets(page),
    queryFn: () =>
      getData<{ tickets: SupportTicket[]; pagination: Pagination }>('/support/tickets', { page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ticket(id ?? ''),
    queryFn: () => getData<SupportTicket>(`/support/tickets/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'OPEN' || status === 'IN_PROGRESS' ? 20_000 : false;
    },
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      subject: string;
      category: 'TRANSACTION_DISPUTE' | 'WALLET' | 'ACCOUNT' | 'OTHER';
      message: string;
      transactionReference?: string;
    }) => postData<SupportTicket>('/support/tickets', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
  });
}

export function useAddTicketMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; body: string }) =>
      postData<SupportTicket>(`/support/tickets/${input.ticketId}/messages`, { body: input.body }),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(input.ticketId) });
      void queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
  });
}
