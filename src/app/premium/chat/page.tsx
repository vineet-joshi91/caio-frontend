"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ---------------- Config ---------------- */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").trim();

/* ---------------- Types ---------------- */
type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";
type Me = { email: string; tier: Tier; is_admin?: boolean };

type SessionItem = { id: number; title?: string; created_at: string };

type Msg = {
  id?: number | string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  attachments?: string[];
  content_json?: any; // passthrough from backend if present
};

type LimitBanner = {
  title?: string;
  message?: string;
  plan?: string;
  used?: number;
  limit?: number;
  reset_at?: string;
} | null;

/* ---------------- Token + network helpers ---------------- */
function readTokenSafe(): string {
  try {
    const ls =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    if (ls) return ls;
    const m = document.cookie.match(/(?:^|;)\s*token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}
function authHeaders(extra?: HeadersInit): HeadersInit {
  const t = readTokenSafe();
  return t ? { ...(extra || {}), Authorization: `Bearer ${t}` } : (extra || {});
}
async function fetchText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
async function ensureBackendReady(base: string): Promise<void> {
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(`${base}/api/ready`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error(`ready ${r.status}`);
  } catch {
    clearTimeout(timeout);
    for (let i = 0; i < 3; i++) {
      await new Promise((res) => setTimeout(res, 1000 + i * 800));
      try {
        const r2 = await fetch(`${base}/api/ready`, { cache: "no-store" });
        if (r2.ok) return;
      } catch {}
    }
    throw new Error("backend not ready");
  }
}

/* ---------------- CXO parsing/rendering ---------------- */
const CXO_ORDER = ["CFO", "CHRO", "COO", "CMO", "CPO"] as const;
const ROLE_FULL: Record<string, string> = {
  CFO: "Chief Financial Officer",
  CHRO: "Chief Human Resources Officer",
  COO: "Chief Operating Officer",
  CMO: "Chief Marketing Officer",
  CPO: "Chief People Officer",
};
type Role = (typeof CXO_ORDER)[number];
type RoleDetails = { summary?: string; recommendations?: string[]; raw?: string };
type CXOData = {
  collectiveInsights: string[];
  byRole: Record<Role, string[]>;
  detailsByRole?: Record<Role, RoleDetails>;
};

function InlineMD({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{ p: (props) => <span {...props} /> }}
    >
      {text}
    </ReactMarkdown>
  );
}
function uniqStrings(items: string[]) {
  const seen = new Set<string>(),
    out: string[] = [];
  for (const t of items) {
    const k = t.replace(/\s+/g, " ").trim().toLowerCase();
    if (!seen.has(k) && t.trim()) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

/* ---------- Markdown parser ---------- */
const ROLE_RE = "(CFO|CHRO|COO|CMO|CPO)";
const H2_CXO_REGEX = new RegExp(
  `^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`,
  "im"
);
function looksLikeCXO(md: string) {
  return H2_CXO_REGEX.test(md);
}
function extractSection(body: string, label: string) {
  const re = new RegExp(
    `^###\\s*${label}\\s*$([\\s\\S]*?)(?=^###\\s*\\w+|^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$|\\Z)`,
    "im"
  );
  const m = body.match(re);
  return m ? (m[1] || "").trim() : "";
}
function extractListItems(text?: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m, "");
  return cleaned
    .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g)
    .map((p) => p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
}
function parseCXOFromMarkdown(md: string): CXOData | null {
  const lines = md.split("\n");
  const sections: { role: Role; start: number; end: number }[] = [];
  const h2Re = new RegExp(
    `^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`,
    "i"
  );
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(h2Re);
    if (m) {
      const role = (m[1] || "").toUpperCase() as Role;
      let j = i + 1;
      for (; j < lines.length; j++) if (h2Re.test(lines[j])) break;
      sections.push({ role, start: i, end: j - 1 });
      i = j - 1;
    }
  }
  if (!sections.length) return null;

  const blocks: { role: Role; insights: string[]; recs: string[] }[] = [];
  for (const s of sections) {
    const block = lines.slice(s.start, s.end + 1).join("\n");
    const body = block.replace(h2Re, "").trim();
    const ins = extractListItems(extractSection(body, "Insights"));
    const recs = extractListItems(extractSection(body, "Recommendations"));
    blocks.push({ role: s.role, insights: ins, recs });
  }

  const collectiveInsights = uniqStrings(
    blocks.flatMap((b) => b.insights)
  ).slice(0, 30);
  const byRole: Record<Role, string[]> = {
    CFO: [],
    CHRO: [],
    COO: [],
    CMO: [],
    CPO: [],
  };
  for (const b of blocks) byRole[b.role] = b.recs || [];

  const any =
    collectiveInsights.length || CXO_ORDER.some((r) => byRole[r]?.length);
  return any ? { collectiveInsights, byRole } : null;
}

/* ---------- JSON parser ---------- */
function safeParseJson(s: unknown) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
function parseCXOFromJSON(assistant: any): CXOData | null {
  if (!assistant) return null;
  const payload = assistant.content_json ?? safeParseJson(assistant.content) ?? assistant;
  if (!payload || typeof payload !== "object") return null;

  const combined = (payload as any)?.combined;
  const agg = combined?.aggregate ?? {};
  const collective =
    (payload as any)?.collective_insights ??
    agg.collective ??
    agg.collective_insights ??
    [];

  const byRoleCand =
    (payload as any)?.recommendations_by_role ??
    (payload as any)?.cxo_recommendations ??
    agg.recommendations_by_role ??
    {};

  const byRole: Record<Role, string[]> = {
    CFO: [],
    CHRO: [],
    COO: [],
    CMO: [],
    CPO: [],
  };
  let any = false;
  for (const r of CXO_ORDER) {
    const arr = (byRoleCand?.[r] ?? []).filter(Boolean);
    byRole[r] = arr;
    if (arr.length) any = true;
  }
  if (!any && !collective.length) return null;

  // details_by_role (partial; promote to defined only if present)
  const detailsCand = combined?.details_by_role ?? {};
  const detailsByRoleBuild: Partial<Record<Role, RoleDetails>> = {};
  for (const r of CXO_ORDER) {
    const x = detailsCand?.[r];
    if (x) {
      detailsByRoleBuild[r] = {
        summary: typeof x.summary === "string" ? x.summary : undefined,
        recommendations: Array.isArray(x.recommendations)
          ? x.recommendations.filter(Boolean)
          : undefined,
        raw: typeof x.raw === "string" ? x.raw : undefined,
      };
    }
  }
  const detailsOut =
    Object.keys(detailsByRoleBuild).length > 0
      ? (detailsByRoleBuild as Record<Role, RoleDetails>)
      : undefined;

  return { collectiveInsights: collective, byRole, detailsByRole: detailsOut };
}

/* ---------- Unified parse ---------- */
function parseAssistantToCXO(assistant: Msg): CXOData | null {
  const j = parseCXOFromJSON(assistant);
  if (j) return j;
  if (typeof assistant.content === "string" && looksLikeCXO(assistant.content)) {
    return parseCXOFromMarkdown(assistant.content);
  }
  return null;
}

/* ---------- helpers for recs dedupe ---------- */
function norm(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
function difference(a: string[], b: string[]) {
  const setB = new Set(b.map(norm));
  return a.filter((x) => !setB.has(norm(x)));
}

/* ---------- Role Details UI ---------- */
function RoleCard({
  role,
  full,
  bullets,
  details,
  canSeeDetails,
}: {
  role: Role;
  full: string;
  bullets: string[];             // summary/top list
  details?: RoleDetails;         // full set from backend if available
  canSeeDetails: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Build effective details (fallback to bullets if BE sent nothing)
  const eff: RoleDetails = {
    summary: details?.summary,
    recommendations:
      details?.recommendations && details.recommendations.length
        ? details.recommendations
        : bullets,
    raw: details?.raw,
  };

  // Only show items that are NOT already in the top summary list
  const extraRecs = difference(eff.recommendations || [], bullets);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <span>👤</span> <span>{role} ({full})</span>
        </h3>

        {canSeeDetails && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-1.5 rounded-xl text-sm border border-zinc-700 hover:bg-zinc-800"
            aria-expanded={open}
          >
            {open ? "Hide details" : "View details"}
          </button>
        )}
      </div>

      <div className="mt-3 text-sm font-semibold opacity-90 flex items-center gap-2">
        <span>✅</span> <span>Recommendations</span>
      </div>
      {bullets.length ? (
        <ul className="mt-2 list-disc pl-6 space-y-1">
          {bullets.map((it, i) => (
            <li key={i} className="leading-7">
              <InlineMD text={it} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-sm opacity-70">No actionable data found.</div>
      )}

      {canSeeDetails && open && (
        <div className="mt-4 rounded-xl bg-black/40 border border-zinc-800 p-4 space-y-3">
          {eff.summary ? (
            <>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Summary</p>
              <p className="leading-relaxed">{eff.summary}</p>
            </>
          ) : (
            <p className="text-sm opacity-70">No summary provided for this role.</p>
          )}

          {extraRecs.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-wide text-zinc-400">
                Additional recommendations
              </p>
              <ul className="list-disc pl-6 space-y-1">
                {extraRecs.map((r, i) => (
                  <li key={i} className="leading-7">
                    <InlineMD text={r} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs opacity-60">
              No additional recommendations beyond the summary list.
            </p>
          )}

          {eff.raw ? (
            <>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Model rationale (raw)</p>
              <pre className="whitespace-pre-wrap text-sm bg-black/30 p-3 rounded-lg border border-zinc-800 max-h-64 overflow-auto">
                {eff.raw}
              </pre>
            </>
          ) : (
            <p className="text-xs opacity-60">No raw rationale provided.</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Renderer (uses RoleCard for Premium/Admin) ---------- */
function CXOMessageFromData({
  data,
  tier,
}: {
  data: CXOData;
  tier: Tier;
}) {
  const maxRecs =
    tier === "admin" || tier === "premium" || tier === "pro_plus"
      ? 5
      : tier === "demo"
      ? 1
      : 3;
  const top = (data.collectiveInsights ?? []).slice(0, 30);
  const canSeeDetails = tier === "admin" || tier === "premium";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <span>🔎</span> <span>Insights</span>
        </h3>
        {top.length ? (
          <ol className="mt-3 list-decimal pl-6 space-y-1">
            {top.map((it, i) => (
              <li key={i} className="leading-7">
                <InlineMD text={it} />
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-2 text-sm opacity-70">
            No material evidence in the provided context.
          </div>
        )}
      </section>

      {/* Pro+ upsell banner */}
      {tier === "pro_plus" && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
          <div className="font-semibold">
            Detailed CXO Analysis is a Premium feature
          </div>
          <div className="text-sm mt-1">
            Upgrade to Premium to view per-role summaries, raw model rationale, and JSON exports.
          </div>
          <div className="mt-2">
            <a
              href="/payments"
              className="inline-block px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500"
            >
              Upgrade to Premium
            </a>
          </div>
        </div>
      )}

      {CXO_ORDER.map((role) => {
        const full = ROLE_FULL[role] || role;

        const fullRecs = data.byRole?.[role] ?? [];
        const mainRecs = fullRecs.slice(
          0,
          tier === "admin" || tier === "premium" || tier === "pro_plus" ? 5
            : tier === "demo" ? 1 : 3
        );

        // If BE didn’t send details_by_role, synthesize details from the full list
        const details = data.detailsByRole?.[role] ?? { recommendations: fullRecs };

        return (
          <RoleCard
            key={role}
            role={role}
            full={full}
            bullets={mainRecs}
            details={details}       // details may contain more than bullets
            canSeeDetails={canSeeDetails}
          />
        );
      })}
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function PremiumChatPage() {
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiBaseErr, setApiBaseErr] = useState<string | null>(null);

  useEffect(() => {
    const t = readTokenSafe();
    setToken(t);
    if (!API_BASE) {
      setApiBaseErr("NEXT_PUBLIC_API_BASE is not set in your frontend environment.");
      setLoading(false);
      return;
    }
    if (!t) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/profile`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (r.status === 401) {
          setMe(null);
        } else {
          const j = await r.json();
          const isAdmin = !!j.is_admin;
          const effectiveTier: Tier = isAdmin
            ? "premium"
            : ((j.tier || "demo") as Tier);
          setMe({ email: j.email, tier: effectiveTier, is_admin: isAdmin });
        }
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        Loading…
      </main>
    );

  if (apiBaseErr) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Premium Chat</h1>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm text-red-300">{apiBaseErr}</p>
          </div>
        </div>
      </main>
    );
  }
  if (!me)
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        Please log in.
      </main>
    );

  const hasPremiumAccess =
    me.tier === "premium" || me.tier === "pro_plus" || me.tier === "admin";
  if (!hasPremiumAccess) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Premium Chat</h1>
        </div>
        <div className="max-w-2xl mx-auto rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          Chat is a <b>Premium</b> feature. Your current tier is <b>{me.tier}</b>.{" "}
          <Link
            href="/payments"
            className="underline text-blue-300 hover:text-blue-200"
          >
            Upgrade to request access
          </Link>
          .
        </div>
      </main>
    );
  }

  return (
    <ChatUI
      token={token}
      me={me}
      isAdmin={!!me.is_admin || me.tier === "admin"}
      isProPlus={me.tier === "pro_plus"}
      isPremium={me.tier === "premium" || me.tier === "admin"}
    />
  );
}

/* =====================================================================================
   CHAT UI — multi-file for Premium/Admin, single-file for Pro+, with limit placard
===================================================================================== */

function ChatUI({
  token,
  me,
  isAdmin,
  isProPlus,
  isPremium,
}: {
  token: string;
  me: Me;
  isAdmin: boolean;
  isProPlus: boolean;
  isPremium: boolean;
}) {
  const [navOpen, setNavOpen] = useState<boolean>(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const maxFilesPerMessage = isPremium ? 8 : 1;

  const [isDragging, setIsDragging] = useState(false);
  const [banner, setBanner] = useState<LimitBanner>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 9e6, behavior: "smooth" });
  }, [msgs, sending, banner]);

  // Global dropzone
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsDragging(true);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        setIsDragging(false);
        const incoming = Array.from(e.dataTransfer.files);
        setFiles((prev) => prev.concat(incoming).slice(0, maxFilesPerMessage));
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragleave", onDragLeave);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragleave", onDragLeave);
    };
  }, [maxFilesPerMessage]);

  function addFiles(incoming: File[]) {
    setFiles((prev) => [...prev, ...incoming].slice(0, maxFilesPerMessage));
  }
  function removeFile(idx: number) {
    setFiles((prev) => {
      const copy = prev.slice();
      copy.splice(idx, 1);
      return copy;
    });
  }

  /* ---------------- Sessions / History with adaptive methods (avoid 405) ---------------- */

  const endpointCache = useRef<{
    sessions: "" | "GET_qs" | "POST_json";
    history: "" | "GET_qs" | "POST_json";
  }>({
    sessions: "",
    history: "",
  });

  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem("chat_ep_cache") || "{}");
      if (j.sessions) endpointCache.current.sessions = j.sessions;
      if (j.history) endpointCache.current.history = j.history;
    } catch {}
  }, []);
  function persistCache() {
    try {
      localStorage.setItem(
        "chat_ep_cache",
        JSON.stringify(endpointCache.current)
      );
    } catch {}
  }

  async function adaptiveFetchListSessions() {
    if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
    // prefer cached
    if (endpointCache.current.sessions === "GET_qs") {
      const r = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) return r;
    } else if (endpointCache.current.sessions === "POST_json") {
      const r = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
        cache: "no-store",
      });
      if (r.ok) return r;
    }
    // discover
    let r = await fetch(`${API_BASE}/api/chat/sessions`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (r.ok) {
      endpointCache.current.sessions = "POST_json";
      persistCache();
      return r;
    }
    if (r.status === 405) {
      r = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });
      if (r.ok) {
        endpointCache.current.sessions = "GET_qs";
        persistCache();
        return r;
      }
    }
    return r;
  }

  async function adaptiveFetchHistory(sessionId: number) {
    if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
    if (endpointCache.current.history === "GET_qs") {
      const r = await fetch(
        `${API_BASE}/api/chat/history?session_id=${sessionId}`,
        {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }
      );
      if (r.ok) return r;
    } else if (endpointCache.current.history === "POST_json") {
      const r = await fetch(`${API_BASE}/api/chat/history`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ session_id: sessionId }),
        cache: "no-store",
      });
      if (r.ok) return r;
    }
    // discover
    let r = await fetch(
      `${API_BASE}/api/chat/history?session_id=${sessionId}`,
      {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      }
    );
    if (r.ok) {
      endpointCache.current.history = "GET_qs";
      persistCache();
      return r;
    }
    if (r.status === 405) {
      r = await fetch(`${API_BASE}/api/chat/history`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ session_id: sessionId }),
        cache: "no-store",
      });
      if (r.ok) {
        endpointCache.current.history = "POST_json";
        persistCache();
        return r;
      }
    }
    return r;
  }

  async function loadSessions() {
    try {
      await ensureBackendReady(API_BASE);
      const r = await adaptiveFetchListSessions();
      if (!r.ok) throw new Error(`${r.status}: ${await fetchText(r)}`);
      const j = await r.json();
      const list: SessionItem[] = Array.isArray(j) ? j : j.sessions || [];
      setSessions(list);
      if (!active && list.length) {
        setActive(list[0].id);
        await loadHistory(list[0].id);
      }
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Couldn’t load sessions.\n\n${e?.message || e}`,
        } as Msg,
      ]);
    }
  }

  async function loadHistory(sessionId: number) {
    try {
      await ensureBackendReady(API_BASE);
      const r = await adaptiveFetchHistory(sessionId);
      if (!r.ok) throw new Error(`${r.status}: ${await fetchText(r)}`);
      const j = await r.json();
      const items: Msg[] = (j.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        content_json: m.content_json,
      }));
      setMsgs(items);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Couldn’t load history.\n\n${e?.message || e}`,
        } as Msg,
      ]);
    }
  }

  /* ---------------- Send ---------------- */
  async function send() {
    if (!input.trim() && files.length === 0) return;
    setSending(true);
    setBanner(null);

    const attachedNames = files.map((f) => f.name);
    const userText = input.trim() || "(file only)";

    setMsgs((m) => [
      ...m,
      { role: "user", content: userText, attachments: attachedNames } as Msg,
    ]);

    const fd = new FormData();
    fd.append("message", input.trim());
    if (active) fd.append("session_id", String(active));
    files.forEach((f) => fd.append("files", f));

    setInput("");
    setFiles([]);

    try {
      await ensureBackendReady(API_BASE);

      const r = await fetch(`${API_BASE}/api/chat/send`, {
        method: "POST",
        headers: authHeaders(), // Authorization only
        body: fd,
      });

      if (r.status === 429) {
        let j: any = {};
        try {
          j = await r.json();
        } catch {}
        setBanner({
          title: j?.title || "Daily chat limit reached",
          message:
            j?.message ||
            (typeof j?.used === "number" && typeof j?.limit === "number"
              ? `You've used ${j.used}/${j.limit} messages today.` +
                (j?.reset_at ? ` Resets at ${formatUtcShort(j.reset_at)}.` : "")
              : "You've hit your daily chat limit."),
          plan: j?.plan,
          used: j?.used,
          limit: j?.limit,
          reset_at: j?.reset_at,
        });
        return;
      }

      if (!r.ok) {
        const body = await fetchText(r);
        const friendly =
          r.status === 413
            ? "File too large for your plan."
            : r.status === 415
            ? "Unsupported file type."
            : r.status === 403
            ? "Pro+ can attach one file per message. Upgrade to Premium for multiple attachments."
            : "The server couldn’t process the request.";
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: `${friendly}\n\n**Error ${r.status}:** ${
              body || "(no details)"
            }`,
          } as Msg,
        ]);
      } else {
        const j = await r.json();
        if (!active && j?.session_id) setActive(j.session_id);

        const assistant = j?.assistant ?? {};
        const text = assistant.content ?? (typeof j === "string" ? j : "OK.");
        const msg: Msg = {
          id: assistant.id ?? crypto.randomUUID(),
          role: "assistant",
          content: text,
          content_json: assistant.content_json,
        };
        setMsgs((m) => [...m, msg]);

        if (j?.session_id && !sessions.find((s) => s.id === j.session_id)) {
          loadSessions();
        }
      }
    } catch (err: any) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Network error. Please try again.\n\n${
            String(err?.message || err)
          }`,
        } as Msg,
      ]);
    } finally {
      setSending(false);
    }
  }

  function formatUtcShort(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm} UTC`;
    } catch {
      return "";
    }
  }

  return (
    <div
      className={`h-screen bg-zinc-950 text-zinc-100 grid transition-all ${
        isDragging ? "ring-2 ring-blue-500/40" : ""
      }`}
      style={{ gridTemplateColumns: navOpen ? "260px 1fr" : "0 1fr" }}
    >
      {/* Sidebar */}
      <aside
        className={`border-r border-zinc-800 bg-[rgb(14,19,32)] overflow-hidden transition-[width] duration-150 ${
          navOpen ? "w-[260px]" : "w-0"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="px-3 py-3 border-b border-zinc-800 flex items-center gap-2">
            <button
              className="px-2 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700"
              onClick={() => {
                setActive(null);
                setMsgs([]);
              }}
            >
              + New chat
            </button>
          </div>

          <div className="flex-1 overflow-auto px-2 py-2 space-y-1">
            {sessions.map((s) => {
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s.id);
                    loadHistory(s.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    isActive
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-800 hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="text-[13px] truncate">
                    {s.title || `Chat ${s.id}`}
                  </div>
                  <div className="text-[11px] opacity-60">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </button>
              );
            })}
            {!sessions.length && (
              <div className="text-xs opacity-60 px-2 py-1">
                No conversations yet.
              </div>
            )}
          </div>

          <div className="p-3 border-t border-zinc-800 space-y-2 text-sm">
            {isProPlus && (
              <div className="text-xs opacity-70">
                Pro+ can attach one file and see basic recs. Upgrade to Premium
                for detailed CXO analysis.
              </div>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="block text-center px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500"
              >
                Admin Mode
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Conversation column */}
      <section className="relative h-screen grid grid-rows-[auto,1fr,auto]">
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
            >
              {navOpen ? "Hide" : "Show"} sidebar
            </button>
            <h1 className="text-base md:text-lg font-semibold truncate">
              {useMemo(
                () =>
                  sessions.find((x) => x.id === active)?.title ||
                  (active ? `Chat ${active}` : "New chat"),
                [sessions, active]
              )}
            </h1>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                {(me.tier || "demo").toUpperCase()}
              </span>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("token");
                    document.cookie = "token=; Max-Age=0; path=/; SameSite=Lax";
                  } catch {}
                  window.location.href = "/login";
                }}
                className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
                title="Log out"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {/* Banner (Pro+ daily limit) */}
        {banner && (
          <div className="mx-auto max-w-3xl px-4 pt-4">
            <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 text-fuchsia-100">
              <div className="font-semibold">
                {banner.title || "Daily chat limit reached"}
              </div>
              <div className="text-sm mt-1">
                {banner.message ||
                  `You've used ${banner.used ?? "—"}/${
                    banner.limit ?? "—"
                  } messages today.${
                    banner.reset_at
                      ? ` Resets at ${formatUtcShort(banner.reset_at)}.`
                      : ""
                  }`}
              </div>
              <div className="mt-2 flex gap-2">
                <a
                  href="/payments"
                  className="rounded-md bg-fuchsia-600 px-3 py-1 text-white hover:bg-fuchsia-500"
                >
                  Upgrade to Premium
                </a>
                <button onClick={() => setBanner(null)} className="text-xs underline">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollerRef} className="overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
            {msgs.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm opacity-70">
                Start a conversation — attach document(s) for context or just ask CAIO anything.
              </div>
            )}

            {msgs.map((m, i) => {
              const isUser = m.role === "user";
              if (isUser) {
                return (
                  <article key={i} className="flex">
                    <div className="ml-auto max-w-[75%]">
                      {!!m.attachments?.length && (
                        <div className="mb-2 flex flex-wrap gap-2 justify-end">
                          {m.attachments.map((name, idx) => (
                            <span
                              key={`${name}-${idx}`}
                              className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 border border-blue-700/50 px-2 py-1 text-xs"
                            >
                              <span className="max-w-[220px] truncate">{name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="bg-blue-600/15 text-blue-100 border border-blue-500/30 rounded-2xl">
                        <div className="px-4 py-3 whitespace-pre-wrap text-[16px] leading-7">
                          {m.content}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }

              // Unified render — try JSON/markdown parser first
              const data = parseAssistantToCXO(m as Msg);
              if (data) {
                return (
                  <article key={i} className="flex">
                    <div className="w-full px-1">
                      <CXOMessageFromData data={data} tier={me.tier} />
                    </div>
                  </article>
                );
              }

              // Fallback: render raw markdown/text so the user always sees something
              return (
                <article key={i} className="flex">
                  <div className="w-full px-1">
                    <div className="prose prose-invert max-w-none text-[16px] leading-7">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Composer */}
        <footer className="border-t border-zinc-800 bg-[rgb(14,19,32)]">
          <div className="mx-auto max-w-4xl px-4 py-3">
            {!!files.length && (
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {files.map((f, idx) => (
                  <span
                    key={`${f.name}-${idx}`}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-800 border border-zinc-700 px-2 py-1"
                  >
                    <span className="max-w-[220px] truncate">{f.name}</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="rounded bg-zinc-700/60 hover:bg-zinc-600 px-1"
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {files.length >= maxFilesPerMessage && (
                  <span className="text-[11px] opacity-70">
                    Max {maxFilesPerMessage} file
                    {maxFilesPerMessage > 1 ? "s" : ""} per message.
                  </span>
                )}
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                addFiles(Array.from(e.dataTransfer.files || []));
              }}
              className={`flex items-center gap-2 ${
                isDragging ? "ring-2 ring-blue-500/40 rounded-lg p-2" : ""
              }`}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                placeholder="Type your message…"
                className="flex-1 resize-none px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-[16px] leading-6"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <input
                ref={fileRef}
                type="file"
                multiple={isPremium}
                className="hidden"
                onChange={(e) => addFiles(Array.from(e.target.files || []))}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                title={
                  isPremium ? "Attach up to 8 files" : "Pro+ can attach 1 file"
                }
              >
                {files.length
                  ? `${files.length} file${files.length > 1 ? "s" : ""}`
                  : "Attach"}
              </button>
              <button
                onClick={send}
                disabled={sending || (!input.trim() && files.length === 0)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </footer>

        {isDragging && (
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
            <div className="rounded-2xl border-2 border-dashed border-blue-400/60 bg-zinc-900/70 px-6 py-4 text-sm">
              Drop file{isPremium ? "s" : ""} to attach {isPremium ? "(up to 8)" : "(1 for Pro+)"}.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
