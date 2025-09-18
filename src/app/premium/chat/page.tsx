"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://caio-backend.onrender.com";

// tiny markdown renderer for bullets/headers only (safe & SSR friendly)
function Markdown({ text }: { text: string }) {
  // very light transform: headers + list bullets
  const html = useMemo(() => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = text.split(/\r?\n/);
    const out: string[] = [];
    for (const ln of lines) {
      if (/^#{1,6}\s/.test(ln)) {
        const level = ln.match(/^#+/)![0].length;
        out.push(`<h${level}>${esc(ln.replace(/^#{1,6}\s*/, ""))}</h${level}>`);
      } else if (/^\d+\.\s/.test(ln)) {
        // leave ordered items as plain paragraphs; we’ll group with <p>
        out.push(`<p>${esc(ln)}</p>`);
      } else if (/^\s*$/.test(ln)) {
        out.push("<br/>");
      } else {
        out.push(`<p>${esc(ln)}</p>`);
      }
    }
    return out.join("\n");
  }, [text]);
  // eslint-disable-next-line react/no-danger
  return <div className="prose prose-invert" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function PremiumChatPage() {
  const [sessions, setSessions] = useState<{ id: number; created_at?: string | null }[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // drag & files
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxFilesPerMessage = 5;

  // ----- helpers -----
  const safeFetchJson = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${t || "Request failed"}`);
    }
    return res.json();
  }, []);

  // load sessions
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await safeFetchJson(`${API_BASE}/api/chat/sessions`);
        if (!alive) return;
        const list = (data?.sessions ?? []) as any[];
        setSessions(list);
        if (!sessionId && list.length) {
          setSessionId(list[0].id);
        }
      } catch (e) {
        // don’t crash the page; just show a soft message
        console.warn("sessions load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [safeFetchJson, sessionId]);

  // ----- file attach -----
  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      setFiles((prev) => {
        const merged = [...prev, ...Array.from(e.dataTransfer.files)];
        return merged.slice(0, maxFilesPerMessage);
      });
    }
  }
  function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = Array.from(ev.target.files ?? []);
    setFiles((prev) => [...prev, ...f].slice(0, maxFilesPerMessage));
  }
  function openPicker() {
    fileInputRef.current?.click();
  }

  // ----- send -----
  const send = useCallback(async () => {
    if (sending) return;
    const message = text.trim();
    if (!message && files.length === 0) return;

    setSending(true);
    setMsgs((m) => (message ? [...m, { role: "user", content: message }] : [...m]));
    try {
      const fd = new FormData();
      if (message) fd.append("message", message);
      if (sessionId) fd.append("session_id", String(sessionId));
      files.forEach((f) => fd.append("files", f));

      const res = await fetch(`${API_BASE}/api/chat/send`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status}: ${t || "send failed"}`);
      }
      const data = await res.json();
      const assistant = data?.assistant?.content ?? "OK.";
      setSessionId(data?.session_id ?? sessionId);
      setMsgs((m) => [...m, { role: "assistant", content: assistant }]);
      setFiles([]);
      setText("");
    } catch (err: any) {
      console.error(err);
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry, I couldn't send that. Please try again." }]);
    } finally {
      setSending(false);
    }
  }, [API_BASE, files, sessionId, sending, text]);

  // ----- UI -----
  return (
    <div className="min-h-screen w-full bg-black text-white">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="text-lg font-semibold">New chat</div>
        <span className="px-2 py-1 rounded bg-zinc-800 text-xs">ADMIN</span>
      </div>

      <div className="flex">
        {/* sidebar */}
        <aside className="w-64 border-r border-zinc-800 p-3 hidden md:block">
          <button
            className="w-full mb-3 rounded bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-sm"
            onClick={() => setSessionId(null)}
          >
            + New chat
          </button>
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSessionId(s.id)}
                className={`w-full text-left px-3 py-2 rounded ${
                  sessionId === s.id ? "bg-zinc-700" : "bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                <div className="text-xs opacity-70">Session</div>
                <div className="text-sm">#{s.id}</div>
              </button>
            ))}
            {!sessions.length && <div className="text-xs opacity-60">No conversations yet.</div>}
          </div>
        </aside>

        {/* main */}
        <main className="flex-1 flex flex-col">
          {/* messages */}
          <div
            className={`flex-1 overflow-y-auto p-4 ${isDragging ? "ring-2 ring-blue-500" : ""}`}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {msgs.length === 0 && (
              <div className="text-sm opacity-70">Attach files or type a message to get started.</div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-3xl mb-6 ${m.role === "user" ? "ml-auto" : ""}`}>
                <div
                  className={`rounded px-4 py-3 ${
                    m.role === "user" ? "bg-blue-600" : "bg-zinc-900 border border-zinc-800"
                  }`}
                >
                  {m.role === "assistant" ? <Markdown text={m.content} /> : <div>{m.content}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* composer */}
          <div className="border-t border-zinc-800 p-3">
            {/* attachments */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, idx) => (
                  <span key={idx} className="text-xs bg-zinc-800 px-2 py-1 rounded">
                    {f.name}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={onPickFiles}
              />
              <button
                onClick={openPicker}
                className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-sm"
              >
                Attach
              </button>
              <input
                className="flex-1 px-3 py-2 rounded bg-zinc-900 border border-zinc-800 outline-none"
                placeholder="Type your message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                onClick={send}
                disabled={sending}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>

            <div className="mt-2 text-xs opacity-60">
              Tip: you can also drag & drop files anywhere in the chat.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
