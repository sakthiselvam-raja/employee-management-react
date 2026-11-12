import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';

/** The logged-in user (null when logged out). Cached under ['me']. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err?.response?.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useLogin(role) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => (role === 'ADMIN' ? authApi.adminLogin(body) : authApi.userLogin(body)),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(['me'], user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      const role = qc.getQueryData(['me'])?.role;
      qc.clear();
      qc.setQueryData(['me'], null);
      navigate(role === 'ADMIN' ? '/admin/login' : '/emp-portal/login', { replace: true });
    },
  });
}