import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { NotificationItem, Pagination } from '@/types';

export function useNotifications(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.notifications(page),
    queryFn: () =>
      getData<{ notifications: NotificationItem[]; unread: number; pagination: Pagination }>(
        '/notifications',
        { page, limit }
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postData<{ success: boolean }>(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postData<{ success: boolean }>('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
