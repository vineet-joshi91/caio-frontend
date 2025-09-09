"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim()) ||
  "https://caio-backend.onrender.com";

type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";
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

  // Gate: Admin + Premium + Pro+
  if (!(me.tier === "admin" || me.tier === "premium" || me.tier === "pro_plus")) {
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
        </div>
      </main>
    );
  }

  return (
    <ChatUI
      token={token}
      isAdmin={me.tier === "admin"}
      isProPlus={me.tier === "pro_plus"}
      isPremium={me.tier === "premium" || me.tier === "admin"}
    />
  );
}

/* =====================================================================================
   CHAT UI — cosmetic polish + multi-file (Premium/Admin), single-file (Pro+)
===================================================================================== */

function ChatUI({
  token,
  isAdmin,
  isProPlus,
  isPremium,
}: {
  token: string;
  isAdmin: boolean;
  isProPlus: boolean;
  isPremium: boolean; // premium OR admin
}) {
  const [navOpen, setNavOpen] = useState<boolean>(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Multiple files
  const [files, setFiles] = useState<File[]>([]);
  const maxFilesPerMessage = isPremium ? 8 : 1;

  // Drag & drop state (global + composer)
  const [isDragging, setIsDragging] = useState(false);

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

  // ---------------- Global dropzone: drop anywhere to attach ----------------
  useEffect(() => {
    function onDragOver(e: DragEvent) {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsDragging(true);
      }
    }
    function onDrop(e: DragEvent) {
      if (e.dataTransfer && e.dataTransfer.files?.length) {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files);
        addFiles(dropped);
      }
    }
    function onDragLeave(e: DragEvent) {
      e.preventDefault();
      setIsDragging(false);
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragleave", onDragLeave);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragleave", onDragLeave);
    };
  }, [files, isPremium]);

  function addFiles(incoming: File[]) {
    const merged = [...files, ...incoming];
    const clipped = merged.slice(0, maxFilesPerMessage);
    setFiles(clipped);
  }
  function removeFile(idx: number) {
    const copy = files.slice();
    copy.splice(idx, 1);
    setFiles(copy);
  }

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
    if (!input.trim() && files.length === 0) return;
    setSending(true);

    const userText = input.trim() || "(file only)";
    setMsgs((m) => [...m, { role: "user", content: userText }]);

    const fd = new FormData();
    fd.append("message", input.trim());
    if (active) fd.append("session_id", String(active));
    files.forEach((f) => fd.append("files", f)); // multiple (or single for Pro+)

    setInput("");
    setFiles([]);

    try {
      const r = await fetch(`${API_BASE}/api/chat/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        const msg =
          r.status === 429
            ? "You've hit your daily message limit. Upgrade to Premium for unlimited."
            : r.status === 403
            ? "Pro+ can attach one file per message. Upgrade to Premium for multiple attachments."
            : "Sorry, I couldn't send that. Please try again.";
        setMsgs((m) => [...m, { role: "assistant", content: msg + (txt ? `\n\n${txt}` : "") }]);
      } else {
        const j = await r.json();
        if (!active) setActive(j.session_id);
        setMsgs((m) => [...m, { role: "assistant", content: j.assistant }]);
        if (!sessions.find((s) => s.id === j.session_id)) {
          loadSessions();
        }
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setSending(false);
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
            {isProPlus && (
              <div className="text-xs opacity-70">
                Pro+ has daily message limits and one file per message. Upgrade to Premium for multiple attachments.
              </div>
            )}
            {isAdmin && (
              <Link href="/admin" className="block text-center px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500">
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
            <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>
          </div>
        </header>

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
                // Right-aligned bubble, ~75% width
                return (
                  <article key={i} className="flex">
                    <div className="ml-auto max-w-[75%]">
                      <div className="bg-blue-600/15 text-blue-100 border border-blue-500/30 rounded-2xl">
                        <div className="px-4 py-3 whitespace-pre-wrap text-[16px] leading-7">
                          {m.content}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }
              // Assistant: full-width, no border, nicer rhythm
              return (
                <article key={i} className="flex">
                  <div className="w-full">
                    <div className="px-1">
                      <div className="prose prose-invert max-w-none text-[16px] leading-7">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
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
            {/* Attached files list — now ABOVE the input */}
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
                    Max {maxFilesPerMessage} file{maxFilesPerMessage > 1 ? "s" : ""} per message.
                  </span>
                )}
              </div>
            )}

            {/* Row with input + buttons; also accepts local DnD */}
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
                const dropped = Array.from(e.dataTransfer.files || []);
                addFiles(dropped);
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
                multiple={isPremium} // Premium/Admin can pick multiple
                className="hidden"
                onChange={(e) => addFiles(Array.from(e.target.files || []))}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm"
                title={isPremium ? "Attach up to 8 files" : "Pro+ can attach 1 file"}
              >
                {files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Attach"}
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

        {/* Global drop overlay hint */}
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
            <div className="rounded-2xl border-2 border-dashed border-blue-400/60 bg-zinc-900/70 px-6 py-4 text-sm">
              Drop file{isPremium ? "s" : ""} to attach {isPremium ? "(up to 8)" : "(1 for Pro+)"}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
