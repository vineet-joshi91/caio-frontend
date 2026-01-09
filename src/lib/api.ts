"use client";

import axios from "axios";
import type { RunEAResponse } from "@/types/caio";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

// ---- Auth helpers -----------------------------------------------------------

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    try {
      localStorage.setItem("caio_token", token);
    } catch {
      /* ignore */
    }
  } else {
    delete api.defaults.headers.common.Authorization;
    try {
      localStorage.removeItem("caio_token");
    } catch {
      /* ignore */
    }
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem("caio_token");
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

// ---- BOS / EA runner --------------------------------------------------------

/**
 * Call the CAIO BOS / EA backend endpoint.
 * Expects FastAPI to expose POST /run-ea with shape:
 *   { packet: {...}, overrides: {...} | null }
 */
export async function runEA(
  packet: any,
  overrides?: any
): Promise<RunEAResponse> {
  const base = API_BASE.trim();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE is not configured");
  }

  const res = await api.post<RunEAResponse>(
    "/run-ea",
    {
      packet,
      overrides: overrides ?? null,
    },
    {
      headers: {
        "x-caio-key": process.env.NEXT_PUBLIC_CAIO_PUBLIC_KEY ?? "",
      },
    }
  );

  return res.data;
}
