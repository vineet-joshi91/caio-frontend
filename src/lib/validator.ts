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
  timeoutSec?: number;   // seconds
  numPredict?: number;   // tokens
}

// Use a dedicated env var so we can keep CAIO backend and validator separate.
const BOS_BASE =
  process.env.NEXT_PUBLIC_BOS_BASE?.trim().replace(/\/+$/, "") ||
  "https://caioinsights.com";


/**
 * Call the BOS Validator /run-ea endpoint with the new credit-gated payload.
 * Client-side only (uses fetch).
 */
export async function runEA(packet: unknown, opts: RunEAOptions): Promise<EAResponse> {
  if (!BOS_BASE) {
    throw new Error("NEXT_PUBLIC_VALIDATOR_API_BASE is not configured");
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
    headers: { "Content-Type": "application/json" },
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
  const tok =
    (typeof window !== "undefined" &&
      (localStorage.getItem("access_token") || localStorage.getItem("token"))) ||
    "";

  const res = await fetch(`${BOS_BASE}/wallet/balance?user_id=${userId}`, {
    headers: tok ? { Authorization: `Bearer ${tok}` } : {},
  });


  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Validator HTTP ${res.status}`);
  }

  return (await res.json()) as WalletBalanceResponse;
}

export function extractEAFromStdout(stdout?: string): any | null {
  if (!stdout) return null;

  // Find last JSON object in the string
  const match = stdout.match(/\{[\s\S]*\}$/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
