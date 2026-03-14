import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGetCurrentUserQueryOptions, loginUser, registerUser, logoutUser } from '@workspace/api-client-react';
import type { LoginRequest, RegisterRequest, User } from '@workspace/api-client-react';
import { useLocation } from 'wouter';

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('ballotwave_token'));
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const userQuery = useQuery({
    ...getGetCurrentUserQueryOptions(),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (userQuery.isError) {
      handleLogout();
    }
  }, [userQuery.isError]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await loginUser(data);
      return res;
    },
    onSuccess: (data) => {
      localStorage.setItem('ballotwave_token', data.token);
      setToken(data.token);
      queryClient.setQueryData(getGetCurrentUserQueryOptions().queryKey, data.user);
      routeBasedOnRole(data.user.role);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const res = await registerUser(data);
      return res;
    },
    onSuccess: (data) => {
      localStorage.setItem('ballotwave_token', data.token);
      setToken(data.token);
      queryClient.setQueryData(getGetCurrentUserQueryOptions().queryKey, data.user);
      routeBasedOnRole(data.user.role);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (token) {
        try {
          await logoutUser();
        } catch (e) {
          // ignore error on logout
        }
      }
    },
    onSettled: () => {
      handleLogout();
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('ballotwave_token');
    setToken(null);
    queryClient.clear();
    setLocation('/login');
  };

  const routeBasedOnRole = (role: string) => {
    if (role === 'super_admin') setLocation('/dashboard/schools');
    else if (role === 'school_admin' || role === 'electoral_officer') setLocation('/dashboard/elections');
    else if (role === 'observer') setLocation('/dashboard/elections');
    else setLocation('/dashboard');
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading && !!token,
    isAuthenticated: !!userQuery.data,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    token
  };
}
