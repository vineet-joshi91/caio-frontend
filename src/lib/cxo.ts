// src/lib/cxo.ts
export type Role = "CFO" | "CHRO" | "COO" | "CMO" | "CPO";
export type CXOData = { collectiveInsights: string[]; byRole: Record<Role, string[]> };

const ROLES: Role[] = ["CFO", "CHRO", "COO", "CMO", "CPO"];

/* ---------- JSON path ---------- */
function tryParseJSON(s?: unknown): any | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try { return JSON.parse(t); } catch { return null; }
}

export function parseFromJSON(assistant: any): CXOData | null {
  const payload =
    assistant?.content_json ??
    tryParseJSON(assistant?.content) ??
    assistant;

  if (!payload || typeof payload !== "object") return null;

  const combined = payload?.combined;
  const agg = combined?.aggregate ?? {};
  const collective =
    payload?.collective_insights ??
    agg.collective ??
    agg.collective_insights ??
    [];

  const byRoleCand =
    payload?.recommendations_by_role ??
    payload?.cxo_recommendations ??
    agg.recommendations_by_role ??
    {};

  const byRole: Record<Role, string[]> = { CFO: [], CHRO: [], COO: [], CMO: [], CPO: [] };
  let any = false;
  for (const r of ROLES) {
    const arr = (byRoleCand?.[r] ?? []).filter(Boolean);
    byRole[r] = arr;
    if (arr.length) any = true;
  }
  if (!any && !collective.length) return null;
  return { collectiveInsights: collective, byRole };
}

/* ---------- Markdown path ---------- */
const ROLE_RE = "(CFO|CHRO|COO|CMO|CPO)";
const H2 = new RegExp(`^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`, "im");
function section(body: string, label: string, roleHeaderRe: RegExp) {
  const re = new RegExp(
    `^###\\s*${label}\\s*$([\\s\\S]*?)(?=^###\\s*\\w+|${roleHeaderRe.source}|\\Z)`,
    "im"
  );
  const m = body.match(re);
  return m ? (m[1] || "").trim() : "";
}
function listify(text?: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m, "");
  return cleaned
    .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g)
    .map((p) => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
}
function uniq(a: string[]) {
  const seen = new Set<string>(), out: string[] = [];
  for (const t of a) {
    const k = t.replace(/\s+/g, " ").trim().toLowerCase();
    if (!seen.has(k) && t.trim()) { seen.add(k); out.push(t); }
  }
  return out;
}

export function parseFromMarkdown(md?: string): CXOData | null {
  if (typeof md !== "string" || !H2.test(md)) return null;

  const lines = md.split("\n");
  const roleH2 = new RegExp(`^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`, "i");

  const blocks: { role: Role; body: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(roleH2);
    if (!m) continue;
    const role = (m[1] || "").toUpperCase() as Role;
    let j = i + 1;
    for (; j < lines.length; j++) if (roleH2.test(lines[j])) break;
    const body = lines.slice(i + 1, j).join("\n");
    blocks.push({ role, body });
    i = j - 1;
  }
  if (!blocks.length) return null;

  const top: string[] = [];
  const byRole: Record<Role, string[]> = { CFO: [], CHRO: [], COO: [], CMO: [], CPO: [] };

  for (const b of blocks) {
    const ins = listify(section(b.body, "Insights", roleH2));
    top.push(...ins);
    const recs = listify(section(b.body, "Recommendations", roleH2));
    byRole[b.role] = recs;
  }

  const collectiveInsights = uniq(top).slice(0, 30);
  const any = collectiveInsights.length || ROLES.some((r) => byRole[r]?.length);
  return any ? { collectiveInsights, byRole } : null;
}

/* ---------- Unified ---------- */
export function parseAssistantPayload(assistant: any): CXOData | null {
  return parseFromJSON(assistant) ?? parseFromMarkdown(assistant?.content) ?? null;
}

/* ---------- Simple Card ---------- */
export const ROLE_FULL: Record<Role, string> = {
  CFO: "Chief Financial Officer",
  CHRO: "Chief Human Resources Officer",
  COO: "Chief Operating Officer",
  CMO: "Chief Marketing Officer",
  CPO: "Chief People Officer",
};
