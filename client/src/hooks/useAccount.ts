import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { User } from '@/types';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { fullName?: string; phone?: string }) => patchData<User>('/auth/me', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      postData<{ success: boolean; reLoginRequired: boolean }>('/auth/change-password', input),
  });
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export function useSetupTwoFactor() {
  return useMutation({
    mutationFn: () => postData<TwoFactorSetup>('/auth/2fa/setup'),
  });
}

export function useEnableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => postData<{ enabled: boolean }>('/auth/2fa/enable', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; password: string }) =>
      postData<{ enabled: boolean; reLoginRequired: boolean }>('/auth/2fa/disable', input),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.me, null);
    },
  });
}
