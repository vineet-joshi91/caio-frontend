"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

function getToken(): string {
  try {
    return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  } catch { return ""; }
}

export default function TrialChatPage() {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>("demo");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = getToken();
        if (t) {
          // If they’re actually Pro+/Premium/Admin, send them to the real chat
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/,"") || ""}/api/profile`, {
            headers: { Authorization: `Bearer ${t}` },
            credentials: "include",
          });
          if (res.ok) {
            const j = await res.json();
            const paid = j?.tier === "premium" || j?.tier === "admin" || j?.tier === "pro_plus";
            if (paid) { router.replace("/premium/chat"); return; }
            setTier((j?.tier as Tier) || "demo");
          }
        }
      } catch { /* ignore */ }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-white">
        <div className="opacity-70">Loading trial…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h1 className="text-xl font-semibold">Trial Chat</h1>
          <p className="mt-1 text-sm opacity-85">
            You’re previewing CAIO Chat in <b>{tier.toUpperCase()}</b> mode. Responses are limited and may be truncated.
            Upgrade to <b>Pro+</b> or <b>Premium</b> for full chat with uploads, memory, and all brains.
          </p>
          <div className="mt-2 flex gap-2">
            <a href="/payments" className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500">Upgrade</a>
            <a href="/dashboard" className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800">Back to dashboard</a>
          </div>
        </header>

        <TrialChatBox />
      </div>
    </main>
  );
}

function TrialChatBox() {
  const [messages, setMessages] = useState<{ role: "user"|"assistant"; text: string }[]>([
    { role: "assistant", text: "Hi! This is a limited trial. Ask me about your analysis and I’ll show the experience." }
  ]);
  const inputRef = useRef<HTMLTextAreaElement|null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const val = (inputRef.current?.value || "").trim();
    if (!val) return;
    inputRef.current!.value = "";
    setMessages((m) => [...m, { role: "user", text: val }]);
    setBusy(true);
    // simple canned reply so no premium backend is required
    setTimeout(() => {
      setMessages((m) => [...m, {
        role: "assistant",
        text: "This is a trial response. Premium Chat supports multi-file uploads, CXO brains, and longer answers. " +
              "Upgrade to Pro+ or Premium to unlock the full experience."
      }]);
      setBusy(false);
    }, 600);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="space-y-3 max-h-[52vh] overflow-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block rounded-xl px-3 py-2 text-sm ${
              m.role === "user" ? "bg-blue-600/20 border border-blue-500/30" : "bg-zinc-800/60 border border-zinc-700"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <textarea ref={inputRef} className="flex-1 h-20 rounded-lg bg-zinc-950/60 border border-zinc-800 p-3 text-sm" placeholder="Type a message…" />
        <button onClick={send} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60">
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </section>
  );
}
