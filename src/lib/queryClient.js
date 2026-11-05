import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        const status = error?.response?.status;
        if (status && status < 500) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});
