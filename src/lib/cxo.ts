// src/lib/cxo.ts
export type Role = "CFO" | "CHRO" | "COO" | "CMO" | "CPO";
export type CXOData = {
  collectiveInsights: string[];
  byRole: Record<Role, string[]>;
};

const ROLES: Role[] = ["CFO", "CHRO", "COO", "CMO", "CPO"];

// ---------- JSON path ----------
export function parseFromJSON(obj: any): CXOData | null {
  if (!obj) return null;

  // Prefer assistant.content_json if present
  const payload = obj.content_json ?? (safeParse(obj.content) ?? obj);

  // Look for our v2 shape OR aggregator shape
  const v2 = payload?.render_version === "v2";
  const combined = payload?.combined;
  const agg = combined?.aggregate ?? {};

  const collective =
    (v2 ? payload.collective_insights : payload?.collective_insights) ??
    agg.collective ??
    agg.collective_insights ??
    [];

  const byRoleCandidate =
    (v2 ? payload.recommendations_by_role : payload?.recommendations_by_role) ??
    (payload?.cxo_recommendations ?? agg.recommendations_by_role) ??
    {};

  const byRole: Record<Role, string[]> = {
    CFO: [],
    CHRO: [],
    COO: [],
    CMO: [],
    CPO: [],
  };

  let hasAny = false;
  for (const r of ROLES) {
    const arr = (byRoleCandidate?.[r] ?? []).filter(Boolean);
    byRole[r] = arr;
    if (arr.length) hasAny = true;
  }

  if (!hasAny && !collective?.length) return null;
  return { collectiveInsights: collective ?? [], byRole };
}

function safeParse(s: unknown) {
  if (typeof s !== "string") return null;
  const txt = s.trim();
  if (!txt.startsWith("{") && !txt.startsWith("[")) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

// ---------- Markdown path ----------
export function parseFromMarkdown(md: string): CXOData | null {
  if (typeof md !== "string" || !md.trim()) return null;

  // Split by role blocks `## ROLE`
  const roleBlocks = md.split(/\n(?=##\s+(CFO|CHRO|COO|CMO|CPO)\s*$)/im);
  // If nothing matched, bail
  if (roleBlocks.length <= 1) return null;

  const byRole: Record<Role, string[]> = { CFO: [], CHRO: [], COO: [], CMO: [], CPO: [] };
  const collectedInsights: string[] = [];

  for (let i = 1; i < roleBlocks.length; i++) {
    const chunk = roleBlocks[i];
    // First line after split is the header: "## CFO"
    const headerMatch = chunk.match(/^##\s+(CFO|CHRO|COO|CMO|CPO)\s*$/im);
    const role = (headerMatch?.[1]?.toUpperCase() ?? "") as Role;
    if (!ROLES.includes(role)) continue;

    // Look for "### Insights" block
    const insights = extractListAfter(chunk, /###\s+Insights\s*$/im);
    // FE aggregates role insights into top Insights box
    collectedInsights.push(...insights);

    // Look for "### Recommendations" block
    const recs = extractListAfter(chunk, /###\s+Recommendations\s*$/im);
    byRole[role] = recs;
  }

  const hasAnyRec = ROLES.some((r) => (byRole[r] ?? []).length > 0);
  const hasAnyInsight = collectedInsights.length > 0;

  if (!hasAnyRec && !hasAnyInsight) return null;
  return { collectiveInsights: collectedInsights, byRole };
}

function extractListAfter(text: string, headingRe: RegExp): string[] {
  const parts = text.split(headingRe);
  if (parts.length < 2) return [];
  // take everything after the heading
  const body = parts[1] ?? "";
  // Capture bullets: "1. ..." "1) ..." "- ..." "* ..." "• ..."
  const items = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+[\.\)]\s+.+|^[-*•]\s+.+/.test(l))
    .map((l) => l.replace(/^\d+[\.\)]\s+|^[-*•]\s+/, "").trim())
    .filter(Boolean);
  return items;
}

// ---------- unified ----------
export function parseAssistantPayload(assistant: any): CXOData | null {
  // Try JSON first (newer BE), then Markdown
  const j = parseFromJSON(assistant);
  if (j) return j;
  const m = typeof assistant?.content === "string" ? parseFromMarkdown(assistant.content) : null;
  return m;
}
