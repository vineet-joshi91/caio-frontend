"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Tier = "admin" | "premium" | "pro" | "demo";
type Me = { email: string; tier: Tier };

type SessionItem = {
  id: number;
  title?: string;
  created_at: string;
};

type Msg = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

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

export default function PremiumChatPage() {
  const [token, setToken] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = readTokenSafe();
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${t}` },
          cache: "no-store",
        });
        const j = await r.json();
        setMe({ email: j.email, tier: (j.tier || "demo") as Tier });
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">Loading…</main>;
  if (!me) return <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">Please log in.</main>;

  // Gate: only Admin + Premium
  if (!(me.tier === "admin" || me.tier === "premium")) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Premium Chat</h1>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm">
              Chat is a <b>Premium</b> feature. Your current tier is <b>{me.tier}</b>.{" "}
              <Link href="/payments" className="underline text-blue-300 hover:text-blue-200">
                Upgrade to request access
              </Link>
              .
            </p>
          </div>
          <Link href="/dashboard" className="underline text-blue-300 hover:text-blue-200 text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <ChatUI token={token} isAdmin={me.tier === "admin"} />;
}

/* =====================================================================================
   CHAT UI – fullscreen like ChatGPT (collapsible sidebar, single conversation pane)
===================================================================================== */

function ChatUI({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const [navOpen, setNavOpen] = useState<boolean>(true); // sidebar open on desktop
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const title = useMemo(() => {
    const s = sessions.find((x) => x.id === active);
    return s?.title || (active ? `Chat ${active}` : "New chat");
  }, [sessions, active]);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 9e6, behavior: "smooth" });
  }, [msgs, sending]);

  async function loadSessions() {
    try {
      const r = await fetch(`${API_BASE}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) return;
      const j: SessionItem[] = await r.json();
      setSessions(j);
      if (!active && j.length) {
        setActive(j[0].id);
        await loadHistory(j[0].id);
      }
    } catch {}
  }

  async function loadHistory(sessionId: number) {
    try {
      const r = await fetch(`${API_BASE}/api/chat/history?session_id=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) {
        setMsgs([]);
        return;
      }
      const j = await r.json();
      const items: Msg[] = (j.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));
      setMsgs(items);
    } catch {}
  }

  async function send() {
    if (!input.trim() && !file) return;
    setSending(true);

    const userText = input.trim() || "(file only)";
    setMsgs((m) => [...m, { role: "user", content: userText }]);
    const fd = new FormData();
    fd.append("message", input.trim());
    if (active) fd.append("session_id", String(active));
    if (file) fd.append("file", file);
    setInput("");
    setFile(null);

    try {
      const r = await fetch(`${API_BASE}/api/chat/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: "Sorry, I couldn't send that. Please try again." },
        ]);
      } else {
        const j = await r.json();
        if (!active) setActive(j.session_id);
        setMsgs((m) => [...m, { role: "assistant", content: j.assistant }]);
        if (!sessions.find((s) => s.id === j.session_id)) {
          loadSessions();
        }
      }
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 grid" style={{ gridTemplateColumns: navOpen ? "260px 1fr" : "0 1fr" }}>
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
                  <div className="text-[11px] opacity-60">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </button>
              );
            })}
            {!sessions.length && (
              <div className="text-xs opacity-60 px-2 py-1">No conversations yet.</div>
            )}
          </div>

          <div className="p-3 border-t border-zinc-800 space-y-2 text-sm">
            {isAdmin && (
              <Link
                href="/admin"
                className="block text-center px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500"
              >
                Admin Mode
              </Link>
            )}
            <Link href="/dashboard" className="block text-center underline text-blue-300 hover:text-blue-200">
              ← Back to Dashboard
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
            <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollerRef} className="overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
            {msgs.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm opacity-70">
                Start a conversation — attach a document for context or just ask CAIO anything.
              </div>
            )}
            {msgs.map((m, i) => (
              <article key={i} className="px-2">
                <div
                  className={`${
                    m.role === "user"
                      ? "bg-blue-600/10 border-blue-500/30"
                      : "bg-zinc-900/60 border-zinc-800"
                  } border rounded-2xl`}
                >
                  <div className="px-4 py-3">
                    <div
                      className={`${
                        m.role === "assistant" ? "prose prose-invert" : ""
                      } max-w-none text-[16px] leading-7`}
                    >
                      {m.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Composer */}
        <footer className="border-t border-zinc-800 bg-[rgb(14,19,32)]">
          <div className="mx-auto max-w-4xl px-4 py-3">
            <div className="flex items-center gap-2">
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
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
              >
                {file ? "1 file" : "Attach"}
              </button>
              <button
                onClick={send}
                disabled={sending || (!input.trim() && !file)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            {file && <div className="mt-2 text-xs opacity-80">Attached: {file.name}</div>}
          </div>
        </footer>
      </section>
    </div>
  );
}
