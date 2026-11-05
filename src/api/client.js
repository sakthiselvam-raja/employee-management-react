import axios from 'axios';
import { queryClient } from '../lib/queryClient';

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/** Axios instance — the login token lives in an httpOnly cookie, so send credentials. */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    // Session expired / account disabled -> drop the cached user so routes redirect to login
    if (status === 401 && !url.startsWith('/auth/')) {
      queryClient.setQueryData(['me'], null);
    }
    return Promise.reject(error);
  },
);

/** Human-friendly message from an Axios error */
export function errorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}

/** Build a URL for <img src> / <a href download> (cookie auth works for both) */
export const fileUrl = (path) => `${API_BASE}${path}`;
