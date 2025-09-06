"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Tier = "admin" | "premium" | "pro" | "demo";
type Me = { email: string; tier: Tier };
type SessionItem = { id: number; title: string; created_at: string };
type Msg = { id?: number; role: "user" | "assistant"; content: string; created_at?: string };

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
        });
        const j = await r.json();
        setMe({ email: j.email, tier: j.tier as Tier });
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }

  if (!me) {
    return <main className="p-6">Please log in.</main>;
  }

  if (!(me.tier === "admin" || me.tier === "premium")) {
    return (
      <main className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-semibold">Premium Chat</h1>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm">
              Chat is a <b>Premium</b> feature. Your current tier is <b>{me.tier}</b>.{" "}
              <Link className="underline text-blue-300 hover:text-blue-200" href="/payments">
                Upgrade to request access.
              </Link>
            </p>
          </div>
          <Link href="/dashboard" className="text-sm underline text-blue-300 hover:text-blue-200">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ⬇️ Pass isAdmin so only admins see the Admin Mode button in ChatUI
  return <ChatUI token={token} isAdmin={me.tier === "admin"} />;
}

/* ---------------- Chat UI ---------------- */

function ChatUI({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  async function loadSessions() {
    try {
      const r = await fetch(`${API_BASE}/api/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const j = (await r.json()) as SessionItem[];
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

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, busy]);

  async function send() {
    if (!input.trim() && !file) return;
    setBusy(true);

    // optimistic user bubble
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
          // refresh session list if a new one was created
          loadSessions();
        }
      }
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <aside className="md:col-span-1 space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Conversations</h2>
              <button
                onClick={() => {
                  setActive(null);
                  setMsgs([]);
                }}
                className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
              >
                New
              </button>
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-auto">
              {sessions.map((s) => {
                const isActive = active === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActive(s.id);
                      loadHistory(s.id);
                    }}
                    className={`w-full text-left px-2 py-2 rounded border ${
                      isActive
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-800 hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="text-sm truncate">{s.title || `Chat ${s.id}`}</div>
                    <div className="text-[11px] opacity-60">
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </button>
                );
              })}
              {!sessions.length && (
                <div className="text-xs opacity-60">No conversations yet.</div>
              )}
            </div>
          </div>

          {/* Only admins see this button */}
          {isAdmin && (
            <Link
              href="/admin"
              className="block text-sm px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-center"
            >
              Admin Mode
            </Link>
          )}

          <Link
            href="/dashboard"
            className="block text-sm underline text-blue-300 hover:text-blue-200"
          >
            ← Back to Dashboard
          </Link>
        </aside>

        {/* Chat window */}
        <section className="md:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 h-[75vh] flex flex-col">
            {/* Transcript */}
            <div ref={scroller} className="flex-1 overflow-auto p-4 space-y-3">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-lg px-3 py-2 border ${
                    m.role === "user"
                      ? "ml-auto bg-blue-600/20 border-blue-500/30"
                      : "bg-zinc-800/70 border-zinc-700"
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              ))}
              {!msgs.length && (
                <div className="h-full grid place-items-center text-sm opacity-70">
                  Start a conversation. You can also attach a document for context.
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-zinc-800 p-3">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message…"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                  disabled={busy || (!input.trim() && !file)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
              {file && (
                <div className="mt-2 text-xs opacity-80">Attached: {file.name}</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
