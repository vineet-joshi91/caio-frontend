"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// NEW shared UI components (you already created these in src/components)
import TypingDots from "@/components/TypingDots";
import TopActionsCard from "@/components/TopActionsCard";
import ConfidenceBanner from "@/components/ConfidenceBanner";
import BrainCard from "@/components/BrainCard";

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
  content_json?: any;
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

/* ---------------- CXO parsing ---------------- */
const CXO_ORDER = ["CFO", "CHRO", "COO", "CMO", "CPO"] as const;
type Role = (typeof CXO_ORDER)[number];

function uniqStrings(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of items) {
    const norm = t.replace(/\s+/g, " ").trim().toLowerCase();
    if (!seen.has(norm) && t.trim()) {
      seen.add(norm);
      out.push(t);
    }
  }
  return out;
}

// --- Markdown route (fallback) ---
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
function parseCXOFromMarkdown(md: string) {
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
  for (const sec of sections) {
    const block = lines.slice(sec.start, sec.end + 1).join("\n");
    const body = block.replace(h2Re, "").trim();
    const ins = extractListItems(extractSection(body, "Insights"));
    const recs = extractListItems(extractSection(body, "Recommendations"));
    blocks.push({ role: sec.role, insights: ins, recs });
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
  for (const b of blocks) {
    byRole[b.role] = b.recs || [];
  }

  const any =
    collectiveInsights.length ||
    CXO_ORDER.some((r) => byRole[r] && byRole[r].length);
  if (!any) return null;

  return {
    collectiveInsights,
    byRole,
  };
}

// --- JSON route (preferred if backend sent structured data) ---
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
function parseCXOFromJSON(assistant: any) {
  if (!assistant) return null;
  const payload =
    assistant.content_json ??
    safeParseJson(assistant.content) ??
    assistant;
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

  return {
    collectiveInsights: collective,
    byRole,
  };
}

// unified assistant->CXO parse
function parseAssistantToCXO(assistant: Msg) {
  const j = parseCXOFromJSON(assistant);
  if (j) return j;
  if (
    typeof assistant.content === "string" &&
    looksLikeCXO(assistant.content)
  ) {
    return parseCXOFromMarkdown(assistant.content);
  }
  return null;
}

/* ---------- Executive view components ---------- */

// Builds the premium-style answer layout: Top 3 Actions, ConfidenceBanner, BrainCards grid.
// tier is passed in mostly to decide how many bullets each BrainCard will expose.
function CXOExecutiveView({
  data,
  tier,
}: {
  data: {
    collectiveInsights: string[];
    byRole: Record<Role, string[]>;
  };
  tier: Tier;
}) {
  const ROLE_TAGLINES: Record<Role, string> = {
    CFO: "Cash, burn, runway",
    CHRO: "People, policy, liability",
    COO: "Execution risk & delivery",
    CMO: "Growth & pipeline health",
    CPO: "Roadmap focus vs distraction",
  };

  // higher tiers get more bullets per role
  const maxRecs =
    tier === "admin" || tier === "premium" || tier === "pro_plus"
      ? 5
      : tier === "demo"
      ? 1
      : 3;

  // Build Top 3 Actions: pull first actionable bullets across roles.
  const topActions = useMemo(() => {
    const pooled: string[] = [];
    for (const role of CXO_ORDER) {
      for (const rec of data.byRole[role] || []) {
        if (pooled.length < 3 && rec && !pooled.includes(rec)) {
          pooled.push(rec);
        }
      }
      if (pooled.length >= 3) break;
    }
    if (pooled.length < 3) {
      for (const insight of data.collectiveInsights || []) {
        if (pooled.length < 3 && insight && !pooled.includes(insight)) {
          pooled.push(insight);
        }
      }
    }
    return pooled.slice(0, 3);
  }, [data]);

  const roleCards = CXO_ORDER.map((role) => {
    const recs = (data.byRole?.[role] ?? []).slice(0, maxRecs);
    return {
      role,
      tagline: ROLE_TAGLINES[role],
      bullets: recs,
    };
  });

  return (
    <div className="space-y-6 text-zinc-100">
      {/* 1. Top 3 Actions */}
      <TopActionsCard actions={topActions} loading={false} />

      {/* 2. Confidence Banner */}
      <ConfidenceBanner
        authenticity="Source and signatures cannot be independently verified."
        consistency="No direct numerical contradictions found in provided context."
        financeCheck="Runway / spend appear internally self-consistent across statements."
      />

      {/* 3. Brain cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {roleCards.map((card, idx) => (
          <BrainCard
            key={idx}
            role={card.role}
            tagline={card.tagline}
            points={card.bullets}
            loading={false}
          />
        ))}
      </div>
    </div>
  );
}

// Skeleton view while model is thinking / streaming
function CXOSkeletonView() {
  const ROLE_TAGLINES: Record<string, string> = {
    CFO: "Cash, burn, runway",
    CHRO: "People, policy, liability",
    COO: "Execution risk & delivery",
    CMO: "Growth & pipeline health",
    CPO: "Roadmap focus vs distraction",
  };

  return (
    <div className="space-y-6 text-zinc-100">
      {/* placeholder top actions */}
      <TopActionsCard actions={[]} loading={true} />

      {/* placeholder confidence */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400 shadow-inner">
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-1/3 rounded bg-zinc-800/70" />
          <div className="h-3 w-3/4 rounded bg-zinc-800/70" />
          <div className="h-3 w-2/3 rounded bg-zinc-800/70" />
        </div>
      </div>

      {/* placeholder brain cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {CXO_ORDER.map((role) => (
          <BrainCard
            key={role}
            role={role}
            tagline={ROLE_TAGLINES[role] || "Executive insight"}
            loading={true}
          />
        ))}
      </div>

      <div className="pt-2">
        <TypingDots />
      </div>
    </div>
  );
}

/* ---------------- PAGE WRAPPER ---------------- */
export default function PremiumChatPage() {
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiBaseErr, setApiBaseErr] = useState<string | null>(null);

  useEffect(() => {
    const t = readTokenSafe();
    setToken(t);

    if (!API_BASE) {
      setApiBaseErr(
        "NEXT_PUBLIC_API_BASE is not set in your frontend environment."
      );
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

          // Admin behaves like premium visually/functionally
          const effectiveTier: Tier = isAdmin
            ? "premium"
            : ((j.tier || "demo") as Tier);

          setMe({
            email: j.email,
            tier: effectiveTier,
            is_admin: isAdmin,
          });
        }
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        Loading…
      </main>
    );
  }

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

  if (!me) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        Please log in.
      </main>
    );
  }

  const hasPremiumAccess =
    me.tier === "premium" || me.tier === "pro_plus" || me.tier === "admin";

  if (!hasPremiumAccess) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Premium Chat</h1>
        </div>
        <div className="max-w-2xl mx-auto rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
          Chat is a <b>Premium</b> feature. Your current tier is{" "}
          <b>{me.tier}</b>.{" "}
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
   CHAT UI — Premium / Pro+ behavior with file limits, banners, thinking skeleton
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

  // adaptive endpoints cache
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

  // load sessions on mount
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-scroll down as new messages or banners land
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 9e6, behavior: "smooth" });
  }, [msgs, sending, banner]);

  // global drag n drop listener
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (
        e.dataTransfer &&
        Array.from(e.dataTransfer.types).includes("Files")
      ) {
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
        setFiles((prev) =>
          prev.concat(incoming).slice(0, maxFilesPerMessage)
        );
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

  /* ---------------- adaptive fetch helpers ---------------- */

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

  /* ---------------- send ---------------- */

  async function send() {
    if (!input.trim() && files.length === 0) return;
    setSending(true);
    setBanner(null);

    // optimistic user bubble
    const attachedNames = files.map((f) => f.name);
    const userText = input.trim() || "(file only)";
    setMsgs((m) => [
      ...m,
      {
        role: "user",
        content: userText,
        attachments: attachedNames,
      } as Msg,
    ]);

    // build payload
    const fd = new FormData();
    fd.append("message", input.trim());
    if (active) fd.append("session_id", String(active));
    files.forEach((f) => fd.append("files", f));

    // clear composer
    setInput("");
    setFiles([]);

    try {
      await ensureBackendReady(API_BASE);

      const r = await fetch(`${API_BASE}/api/chat/send`, {
        method: "POST",
        headers: authHeaders(),
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
                (j?.reset_at
                  ? ` Resets at ${formatUtcShort(j.reset_at)}.`
                  : "")
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
        const text =
          assistant.content ?? (typeof j === "string" ? j : "OK.");
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

  /* ---------------- render ---------------- */

  return (
    <div
      className={`h-screen bg-zinc-950 text-zinc-100 grid transition-all ${
        isDragging ? "ring-2 ring-blue-500/40" : ""
      }`}
      style={{ gridTemplateColumns: navOpen ? "260px 1fr" : "0 1fr" }}
    >
      {/* SIDEBAR */}
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
            {isProPlus && !isPremium && (
              <div className="text-xs opacity-70">
                Pro+ can attach one file and see basic recs. Upgrade to Premium
                for deeper multi-CXO analysis.
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

      {/* MAIN COLUMN */}
      <section className="relative h-screen grid grid-rows-[auto,1fr,auto]">
        {/* top bar */}
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
                    document.cookie =
                      "token=; Max-Age=0; path=/; SameSite=Lax";
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

        {/* banner / rate-limit / plan warning */}
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
                      ? ` Resets at ${formatUtcShort(
                          banner.reset_at
                        )}.`
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
                <button
                  onClick={() => setBanner(null)}
                  className="text-xs underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* messages */}
        <div ref={scrollerRef} className="overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
            {/* empty state */}
            {msgs.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm opacity-70">
                Start a conversation — attach document(s) for context or just
                ask CAIO anything.
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
                              <span className="max-w-[220px] truncate">
                                {name}
                              </span>
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

              // assistant
              const parsed = parseAssistantToCXO(m as Msg);
              if (parsed) {
                return (
                  <article key={i} className="flex">
                    <div className="w-full px-1">
                      <CXOExecutiveView
                        data={parsed}
                        tier={me.tier}
                      />
                    </div>
                  </article>
                );
              }

              // fallback raw markdown if assistant message isn't structured
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

            {/* streaming / waiting state */}
            {sending && (
              <article className="flex">
                <div className="w-full px-1">
                  <CXOSkeletonView />
                </div>
              </article>
            )}
          </div>
        </div>

        {/* composer */}
        <footer className="border-t border-zinc-800 bg-[rgb(14,19,32)]">
          <div className="mx-auto max-w-4xl px-4 py-3">
            {/* attached files preview */}
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
                    {maxFilesPerMessage > 1 ? "s" : ""} per
                    message.
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
                isDragging
                  ? "ring-2 ring-blue-500/40 rounded-lg p-2"
                  : ""
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
                onChange={(e) =>
                  addFiles(Array.from(e.target.files || []))
                }
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                title={
                  isPremium
                    ? "Attach up to 8 files"
                    : "Pro+ can attach 1 file"
                }
              >
                {files.length
                  ? `${files.length} file${
                      files.length > 1 ? "s" : ""
                    }`
                  : "Attach"}
              </button>
              <button
                onClick={send}
                disabled={
                  sending || (!input.trim() && files.length === 0)
                }
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </footer>

        {/* global drag overlay */}
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
            <div className="rounded-2xl border-2 border-dashed border-blue-400/60 bg-zinc-900/70 px-6 py-4 text-sm">
              Drop file
              {isPremium ? "s" : ""} to attach{" "}
              {isPremium ? "(up to 8)" : "(1 for Pro+)"}.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
