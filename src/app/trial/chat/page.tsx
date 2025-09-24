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

/* ---------------- Token + helpers ---------------- */
function readTokenSafe(): string {
  try {
    const ls = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
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
  try { return await res.text(); } catch { return ""; }
}
async function ensureBackendReady(base: string): Promise<void> {
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(`${base}/api/ready`, { signal: controller.signal, cache: "no-store" });
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

/* ---------------- CXO parsing/rendering (self-contained) ---------------- */
const CXO_ORDER = ["CFO", "CHRO", "COO", "CMO", "CPO"] as const;
type Role = (typeof CXO_ORDER)[number];
const ROLE_FULL: Record<Role, string> = {
  CFO: "Chief Financial Officer",
  CHRO: "Chief Human Resources Officer",
  COO: "Chief Operating Officer",
  CMO: "Chief Marketing Officer",
  CPO: "Chief People Officer",
};
type CXOData = { collectiveInsights: string[]; byRole: Record<Role, string[]> };

function InlineMD({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (props) => <span {...props} /> }}>
      {text}
    </ReactMarkdown>
  );
}
function uniqStrings(items: string[]) {
  const seen = new Set<string>(), out: string[] = [];
  for (const t of items) {
    const k = t.replace(/\s+/g, " ").trim().toLowerCase();
    if (!seen.has(k) && t.trim()) { seen.add(k); out.push(t); }
  }
  return out;
}

/* ---------- Markdown parser ---------- */
const ROLE_RE = "(CFO|CHRO|COO|CMO|CPO)";
const H2_CXO_REGEX = new RegExp(`^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`, "im");
function looksLikeCXO(md: string) { return H2_CXO_REGEX.test(md); }

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
  const h2Re = new RegExp(`^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`, "i");
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

  const collectiveInsights = uniqStrings(blocks.flatMap((b) => b.insights)).slice(0, 30);
  const byRole: Record<Role, string[]> = { CFO: [], CHRO: [], COO: [], CMO: [], CPO: [] };
  for (const b of blocks) byRole[b.role] = b.recs || [];

  const any = collectiveInsights.length || CXO_ORDER.some((r) => byRole[r]?.length);
  return any ? { collectiveInsights, byRole } : null;
}

/* ---------- JSON parser ---------- */
function safeParseJson(s: unknown) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try { return JSON.parse(t); } catch { return null; }
}
function parseCXOFromJSON(assistant: any): CXOData | null {
  if (!assistant) return null;
  const payload = assistant.content_json ?? safeParseJson(assistant.content) ?? assistant;
  if (!payload || typeof payload !== "object") return null;

  const combined = payload?.combined;
  const agg = combined?.aggregate ?? {};
  const collective =
    payload?.collective_insights ?? agg.collective ?? agg.collective_insights ?? [];

  const byRoleCand =
    payload?.recommendations_by_role ??
    payload?.cxo_recommendations ??
    agg.recommendations_by_role ??
    {};

  const byRole: Record<Role, string[]> = { CFO: [], CHRO: [], COO: [], CMO: [], CPO: [] };
  let any = false;
  for (const r of CXO_ORDER) {
    const arr = (byRoleCand?.[r] ?? []).filter(Boolean);
    byRole[r] = arr;
    if (arr.length) any = true;
  }
  if (!any && !collective.length) return null;
  return { collectiveInsights: collective, byRole };
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

/* ---------- Renderer ---------- */
function CXOMessageFromData({ data, tier }: { data: CXOData; tier: Tier }) {
  const maxRecs =
    tier === "admin" || tier === "premium" || tier === "pro_plus" ? 5 : tier === "demo" ? 1 : 3;
  const top = (data.collectiveInsights ?? []).slice(0, 30);

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
          <div className="mt-2 text-sm opacity-70">No material evidence in the provided context.</div>
        )}
      </section>

      {CXO_ORDER.map((role) => {
        const full = ROLE_FULL[role] || role;
        const recs = (data.byRole?.[role] ?? []).slice(0, maxRecs);
        return (
          <section key={role} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <span>👤</span> <span>{role} ({full})</span>
            </h3>
            <div className="mt-3 text-sm font-semibold opacity-90 flex items-center gap-2">
              <span>✅</span> <span>Recommendations</span>
            </div>
            {recs.length ? (
              <ul className="mt-2 list-disc pl-6 space-y-1">
                {recs.map((it, i) => (
                  <li key={i} className="leading-7">
                    <InlineMD text={it} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm opacity-70">No actionable data found.</div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function TrialChatPage() {
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
      setMe({ email: "", tier: "demo" });
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/profile`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!r.ok) {
          setMe({ email: "", tier: "demo" });
        } else {
          const j = await r.json();
          setMe({ email: j.email, tier: (j.tier || "demo") as Tier, is_admin: !!j.is_admin });
        }
      } catch {
        setMe({ email: "", tier: "demo" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">Loading…</main>;
  if (apiBaseErr) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Trial Chat</h1>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm text-red-300">{apiBaseErr}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ChatUI
      token={token}
      me={me || { email: "", tier: "demo" }}
    />
  );
}

/* =====================================================================================
   CHAT UI — Trial: single-file attachment (1) and no admin routing
===================================================================================== */

function ChatUI({ token, me }: { token: string; me: Me }) {
  const [navOpen, setNavOpen] = useState<boolean>(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const maxFilesPerMessage = 1; // Trial: 1 file

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
        setFiles(incoming.slice(0, maxFilesPerMessage));
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
    setFiles(incoming.slice(0, maxFilesPerMessage));
  }
  function removeFile() {
    setFiles([]);
  }

  /* ---------------- Sessions / History with adaptive methods ---------------- */

  const endpointCache = useRef<{ sessions: "" | "GET_qs" | "POST_json"; history: "" | "GET_qs" | "POST_json" }>({
    sessions: "",
    history: "",
  });

  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem("trial_chat_ep_cache") || "{}");
      if (j.sessions) endpointCache.current.sessions = j.sessions;
      if (j.history) endpointCache.current.history = j.history;
    } catch {}
  }, []);
  function persistCache() {
    try {
      localStorage.setItem("trial_chat_ep_cache", JSON.stringify(endpointCache.current));
    } catch {}
  }

  async function adaptiveFetchListSessions() {
    if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE is not set.");
    // prefer cached
    if (endpointCache.current.sessions === "GET_qs") {
      const r = await fetch(`${API_BASE}/api/chat/sessions`, { method: "GET", headers: authHeaders(), cache: "no-store" });
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
      r = await fetch(`${API_BASE}/api/chat/sessions`, { method: "GET", headers: authHeaders(), cache: "no-store" });
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
      const r = await fetch(`${API_BASE}/api/chat/history?session_id=${sessionId}`, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      });
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
    let r = await fetch(`${API_BASE}/api/chat/history?session_id=${sessionId}`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
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
      const list: SessionItem[] = Array.isArray(j) ? j : (j.sessions || []);
      setSessions(list);
      if (!active && list.length) {
        setActive(list[0].id);
        await loadHistory(list[0].id);
      }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `Couldn’t load sessions.\n\n${e?.message || e}` } as Msg]);
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
      setMsgs((m) => [...m, { role: "assistant", content: `Couldn’t load history.\n\n${e?.message || e}` } as Msg]);
    }
  }

  /* ---------------- Send (Trial) ---------------- */
  async function send() {
    if (!input.trim() && files.length === 0) return;
    setSending(true);
    setBanner(null);

    const attachedNames = files.map((f) => f.name);
    const userText = input.trim() || "(file only)";
    setMsgs((m) => [...m, { role: "user", content: userText, attachments: attachedNames } as Msg]);

    const fd = new FormData();
    fd.append("message", input.trim());
    if (active) fd.append("session_id", String(active));
    if (files[0]) fd.append("files", files[0]); // Trial: single file

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
        try { j = await r.json(); } catch {}
        setBanner({
          title: j?.title || "Daily chat limit reached",
          message:
            j?.message ||
            (typeof j?.used === "number" && typeof j?.limit === "number"
              ? `You've used ${j.used}/${j.limit} messages today.`
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
          r.status === 413 ? "File too large for trial."
          : r.status === 415 ? "Unsupported file type."
          : "The server couldn’t process the request.";
        setMsgs((m) => [...m, { role: "assistant", content: `${friendly}\n\n**Error ${r.status}:** ${body || "(no details)"}` } as Msg]);
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
      setMsgs((m) => [...m, { role: "assistant", content: `Network error. Please try again.\n\n${String(err?.message || err)}` } as Msg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={`h-screen bg-zinc-950 text-zinc-100 grid transition-all ${isDragging ? "ring-2 ring-blue-500/40" : ""}`}
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
                    isActive ? "border-blue-500 bg-blue-500/10" : "border-zinc-800 hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="text-[13px] truncate">{s.title || `Chat ${s.id}`}</div>
                  <div className="text-[11px] opacity-60">{new Date(s.created_at).toLocaleString()}</div>
                </button>
              );
            })}
            {!sessions.length && <div className="text-xs opacity-60 px-2 py-1">No conversations yet.</div>}
          </div>

          <div className="p-3 border-t border-zinc-800 space-y-2 text-sm">
            <div className="text-xs opacity-70">
              Trial accounts have limited messages and 1 file per message.
            </div>
            <Link href="/payments" className="block text-center px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500">
              Upgrade for more
            </Link>
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
                () => sessions.find((x) => x.id === active)?.title || (active ? `Chat ${active}` : "New chat"),
                [sessions, active]
              )}
            </h1>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700">TRIAL</span>
              <Link href="/login" className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm">
                Log out
              </Link>
            </div>
          </div>
        </header>

        {/* Banner (limits / 429) */}
        {banner && (
          <div className="mx-auto max-w-3xl px-4 pt-4">
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
              <div className="font-semibold">{banner.title || "Daily chat limit reached"}</div>
              <div className="text-sm mt-1">
                {banner.message ||
                  `You've used ${banner.used ?? "—"}/${banner.limit ?? "—"} messages today.`}
              </div>
              <div className="mt-2 flex gap-2">
                <a href="/payments" className="rounded-md bg-amber-600 px-3 py-1 text-white hover:bg-amber-500">
                  Upgrade
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
                Welcome to Trial Chat — attach a file or ask a question to get started.
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
                        <div className="px-4 py-3 whitespace-pre-wrap text-[16px] leading-7">{m.content}</div>
                      </div>
                    </div>
                  </article>
                );
              }

              const data = parseAssistantToCXO(m as Msg);
              if (data) {
                return (
                  <article key={i} className="flex">
                    <div className="w-full px-1">
                      <CXOMessageFromData data={data} tier="demo" />
                    </div>
                  </article>
                );
              }

              return (
                <article key={i} className="flex">
                  <div className="w-full px-1">
                    <div className="prose prose-invert max-w-none text-[16px] leading-7">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
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
                      onClick={() => removeFile()}
                      className="rounded bg-zinc-700/60 hover:bg-zinc-600 px-1"
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {files.length >= maxFilesPerMessage && (
                  <span className="text-[11px] opacity-70">Max 1 file for trial.</span>
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
              className={`flex items-center gap-2 ${isDragging ? "ring-2 ring-blue-500/40 rounded-lg p-2" : ""}`}
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
                multiple={false}
                className="hidden"
                onChange={(e) => addFiles(Array.from(e.target.files || []))}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                title="Attach 1 file"
              >
                {files.length ? "1 file" : "Attach"}
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
              Drop file to attach (max 1).
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
