// frontend/src/lib/validator.ts
// Simple wrapper around the CAIO BOS Validator FastAPI endpoints.

export type UIBlock = {
  executive_summary?: string;
  summary?: string;
  confidence?: number;
  _meta?: {
    model?: string;
    engine?: string;
    confidence?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

// Minimal shape of what /run-ea returns.
export type EAResponse = {
  ui: UIBlock;
  per_brain?: Record<string, unknown>;
};

export type PlanTier = "standard" | "premium" | "enterprise" | "demo" | "pro";

export interface RunEAOptions {
  userId: number;
  planTier: PlanTier;
  model?: string;
  timeoutSec?: number;
  numPredict?: number;
}

const BOS_BASE =
  process.env.NEXT_PUBLIC_BOS_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";

/**
 * Internal helper to safely get JWT token on client
 */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    "";

  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Call the BOS Validator /run-ea endpoint with credit-gated payload.
 */
export async function runEA(packet: unknown, opts: RunEAOptions): Promise<EAResponse> {
  if (!BOS_BASE) {
    throw new Error("NEXT_PUBLIC_BOS_BASE is not configured");
  }

  const body = {
    packet,
    user_id: opts.userId,
    plan_tier: opts.planTier,
    model: opts.model ?? undefined,
    timeout_sec: opts.timeoutSec ?? 300,
    num_predict: opts.numPredict ?? 512,
  };

  const res = await fetch(`${BOS_BASE}/run-ea`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),   // ✅ attach JWT here
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Validator HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }

  return (await res.json()) as EAResponse;
}

export interface WalletBalanceResponse {
  user_id: number;
  balance_credits: number;
}

export async function fetchWalletBalance(userId: number): Promise<WalletBalanceResponse> {
  const res = await fetch(`${BOS_BASE}/wallet/balance?user_id=${userId}`, {
    headers: {
      ...getAuthHeaders(),   // ✅ consistent JWT handling
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Validator HTTP ${res.status}`);
  }

  return (await res.json()) as WalletBalanceResponse;
}

export function extractEAFromStdout(stdout?: string): any | null {
  if (!stdout) return null;

  const match = stdout.match(/\{[\s\S]*\}$/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
