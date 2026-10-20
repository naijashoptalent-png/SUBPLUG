import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, postData } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';
import type { User, Wallet } from '@/types';

interface SessionUser extends User {
  wallet?: Wallet;
}

interface LoginResponse {
  user?: User;
  requiresTwoFactor?: boolean;
  challengeToken?: string;
}

interface RegisterResponse {
  user: User;
  verificationRequired: boolean;
  devVerificationUrl?: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (input: { email: string; password: string }) => Promise<LoginResponse>;
  completeTwoFactor: (input: { challengeToken: string; code: string }) => Promise<User>;
  register: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    referralCode?: string;
    acceptTerms?: boolean;
  }) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<unknown>;
  setUser: (user: SessionUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<SessionUser | null> {
  try {
    return await getData<SessionUser>('/auth/me');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      postData<LoginResponse>('/auth/login', input),
  });

  const twoFactorMutation = useMutation({
    mutationFn: (input: { challengeToken: string; code: string }) =>
      postData<{ user: User }>('/auth/2fa/login', input),
  });

  const registerMutation = useMutation({
    mutationFn: (input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      confirmPassword: string;
      referralCode?: string;
      acceptTerms?: boolean;
    }) => postData<RegisterResponse>('/auth/register', input),
  });

  useEffect(() => {
    const handleExpired = () => {
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.removeQueries({ queryKey: ['wallet'] });
      queryClient.removeQueries({ queryKey: ['purchases'] });
    };
    window.addEventListener('qt:session-expired', handleExpired);
    return () => window.removeEventListener('qt:session-expired', handleExpired);
  }, [queryClient]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const result = await loginMutation.mutateAsync(input);
      if (result.user) {
        queryClient.setQueryData(queryKeys.me, result.user);
        void queryClient.invalidateQueries({ queryKey: queryKeys.me });
        void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      }
      return result;
    },
    [loginMutation, queryClient]
  );

  const completeTwoFactor = useCallback(
    async (input: { challengeToken: string; code: string }) => {
      const result = await twoFactorMutation.mutateAsync(input);
      queryClient.setQueryData(queryKeys.me, result.user);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      return result.user;
    },
    [twoFactorMutation, queryClient]
  );

  const register = useCallback(
    async (input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      confirmPassword: string;
      referralCode?: string;
      acceptTerms?: boolean;
    }) => registerMutation.mutateAsync(input),
    [registerMutation]
  );

  const logout = useCallback(async () => {
    try {
      await postData<{ success: boolean }>('/auth/logout');
    } finally {
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const user = sessionQuery.data ?? null;
    return {
      user,
      isLoading: sessionQuery.isLoading,
      isAuthenticated: Boolean(user),
      isStaff: user?.role === 'ADMIN' || user?.role === 'SUPPORT',
      isAdmin: user?.role === 'ADMIN',
      login,
      completeTwoFactor,
      register,
      logout,
      refreshUser: sessionQuery.refetch,
      setUser: (next) => queryClient.setQueryData(queryKeys.me, next),
    };
  }, [sessionQuery, login, completeTwoFactor, register, logout, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
