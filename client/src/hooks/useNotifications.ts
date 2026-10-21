import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { NotificationItem, Pagination } from '@/types';

type NotificationsResponse = {
  notifications: NotificationItem[];
  unread: number;
  pagination: Pagination;
};

export function useNotifications(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.notifications(page, limit),
    queryFn: () =>
      getData<NotificationsResponse>(
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueriesData<NotificationsResponse>({ queryKey: ['notifications'] });

      queryClient.setQueriesData<NotificationsResponse>({ queryKey: ['notifications'] }, (current) => {
        if (!current) return current;
        let markedUnread = false;
        const notifications = current.notifications.map((notification) => {
          if (notification._id !== id || notification.readAt) return notification;
          markedUnread = true;
          return { ...notification, readAt: new Date().toISOString() };
        });
        return { ...current, notifications, unread: markedUnread ? Math.max(0, current.unread - 1) : current.unread };
      });

      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postData<{ success: boolean }>('/notifications/read-all'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueriesData<NotificationsResponse>({ queryKey: ['notifications'] });

      queryClient.setQueriesData<NotificationsResponse>({ queryKey: ['notifications'] }, (current) =>
        current
          ? {
              ...current,
              unread: 0,
              notifications: current.notifications.map((notification) =>
                notification.readAt ? notification : { ...notification, readAt: new Date().toISOString() }
              ),
            }
          : current
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
