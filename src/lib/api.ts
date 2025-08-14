'use client';

import axios from 'axios';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

// ---- Auth helpers -----------------------------------------------------------

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    try {
      localStorage.setItem('caio_token', token);
    } catch {
      /* ignore */
    }
  } else {
    delete api.defaults.headers.common.Authorization;
    try {
      localStorage.removeItem('caio_token');
    } catch {
      /* ignore */
    }
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('caio_token');
  } catch {
    return null;
  }
}

// ---- Types ------------------------------------------------------------------

export interface Profile {
  email: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}
