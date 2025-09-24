"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Tier = "admin" | "premium" | "pro_plus" | "pro" | "demo";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
function getToken(): string {
  try { return localStorage.getItem("access_token") || localStorage.getItem("token") || ""; } catch { return ""; }
}

/* ---- Shared CXO helpers (same as premium, shortened) ---- */
const ROLES = ["CFO","CHRO","COO","CMO","CPO"] as const;
type Role = (typeof ROLES)[number];
type CXOData = { collectiveInsights: string[]; byRole: Record<Role, string[]> };
function InlineMD({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (p)=> <span {...p}/> }}>{text}</ReactMarkdown>;
}
function uniq(a:string[]){const s=new Set<string>(),o:string[]=[];for(const t of a){const k=t.replace(/\s+/g," ").trim().toLowerCase();if(!s.has(k)&&t.trim()){s.add(k);o.push(t)}}return o}
const ROLE_RE="(CFO|CHRO|COO|CMO|CPO)";
const H2 = new RegExp(`^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`,"im");
function parseMD(md:string):CXOData|null{
  if(!H2.test(md)) return null;
  const lines=md.split("\n"), h2=new RegExp(`^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$`,"i");
  const sections:{role:Role;start:number;end:number}[]=[];
  for(let i=0;i<lines.length;i++){const m=lines[i].match(h2);if(m){const role=(m[1]||"").toUpperCase() as Role;let j=i+1;for(;j<lines.length;j++)if(h2.test(lines[j]))break;sections.push({role,start:i,end:j-1});i=j-1;}}
  const list=(t?:string)=>!t?[]:t.replace(/^[\s\S]*?(?=^\s*(?:\d+[.)]|[-*•])\s)/m,"").split(/\n(?=\s*(?:\d+[.)]|[-*•])\s)/g).map(p=>p.replace(/^\s*(?:\d+[.)]|[-*•])\s+/,"").trim()).filter(Boolean);
  const sec=(b:string,l:string)=>{const re=new RegExp(`^###\\s*${l}\\s*$([\\s\\S]*?)(?=^###\\s*\\w+|^##\\s+${ROLE_RE}(?:\\s*\\([^)]*\\))?\\s*$|\\Z)`,"im");const m=b.match(re);return m?(m[1]||"").trim():""};
  const blocks = sections.map(s=>{const b=lines.slice(s.start,s.end+1).join("\n").replace(h2,"").trim();return {role:s.role,ins:list(sec(b,"Insights")),recs:list(sec(b,"Recommendations"))}});
  const top=uniq(blocks.flatMap(b=>b.ins)).slice(0,30);
  const byRole:Record<Role,string[]>={CFO:[],CHRO:[],COO:[],CMO:[],CPO:[]}; for(const b of blocks) byRole[b.role]=b.recs||[];
  const any=top.length||ROLES.some(r=>byRole[r]?.length);
  return any?{collectiveInsights:top,byRole}:null;
}
function parseJSON(a:any):CXOData|null{
  const payload=a?.content_json ?? (typeof a?.content==="string"&&(/^\s*[{[]/.test(a.content))?JSON.parse(a.content):null) ?? a;
  if(!payload||typeof payload!=="object") return null;
  const comb=payload?.combined, agg=comb?.aggregate ?? {};
  const top = payload?.collective_insights ?? agg.collective ?? agg.collective_insights ?? [];
  const cand = payload?.recommendations_by_role ?? payload?.cxo_recommendations ?? agg.recommendations_by_role ?? {};
  const byRole:Record<Role,string[]>={CFO:[],CHRO:[],COO:[],CMO:[],CPO:[]}; let any=false;
  ROLES.forEach(r=>{const arr=(cand?.[r]??[]).filter(Boolean);byRole[r]=arr; if(arr.length) any=true;});
  if(!any && !top.length) return null;
  return {collectiveInsights:top, byRole};
}
function parseAssistant(assistant:any):CXOData|null{
  try{const j=parseJSON(assistant); if(j) return j;}catch{}
  if (typeof assistant?.content==="string") return parseMD(assistant.content);
  return null;
}

function Card({title,children}:{title:string;children:any}) {
  return <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
    <div className="font-semibold mb-2">{title}</div>{children}
  </div>;
}
function CXOMessage({data}:{data:CXOData}) {
  return (
    <div className="space-y-6">
      {data.collectiveInsights?.length>0 && (
        <Card title="Insights">
          <ul className="list-disc pl-6 space-y-1">
            {data.collectiveInsights.map((t,i)=><li key={i}><InlineMD text={t}/></li>)}
          </ul>
        </Card>
      )}
      {ROLES.map(r=>(
        <Card key={r} title={`${r}`}>
          {(data.byRole[r]||[]).length?(
            <ul className="list-disc pl-6 space-y-1">
              {data.byRole[r].map((t,i)=><li key={i}><InlineMD text={t}/></li>)}
            </ul>
          ):<div className="text-neutral-400 text-sm">No actionable data found.</div>}
        </Card>
      ))}
    </div>
  );
}

export default function TrialChatPage() {
  const router = useRouter();
  const [tier, setTier] = useState<Tier>("demo");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = getToken();
        if (t && API_BASE) {
          const res = await fetch(`${API_BASE.replace(/\/+$/,"")}/api/profile`, {
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
      } catch {}
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <main className="min-h-screen grid place-items-center bg-black text-white"><div className="opacity-70">Loading trial…</div></main>;

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
  const [messages, setMessages] = useState<{ role: "user"|"assistant"; text?: string; assistant?: any }[]>([
    { role: "assistant", text: "Hi! This is a limited trial. Ask me anything and I’ll show the experience." }
  ]);
  const inputRef = useRef<HTMLTextAreaElement|null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const val = (inputRef.current?.value || "").trim();
    if (!val) return;
    inputRef.current!.value = "";
    setMessages((m) => [...m, { role: "user", text: val }]);
    setBusy(true);

    // If your trial is wired to backend, call it here. Otherwise, canned JSON:
    const canned = {
      combined: {
        aggregate: {
          collective: ["Sample collective insight."],
          recommendations_by_role: {
            CFO: ["Add weekly variance deck", "Tighten working capital"],
            CHRO: ["Run 9-box review"],
            COO: ["Stand up ops dashboard"],
            CMO: ["Audit CAC/LTV by channel"],
            CPO: ["Define outcomes and product bets"],
          }
        }
      }
    };

    setTimeout(() => {
      setMessages((m)=>[...m, { role:"assistant", assistant: { content_json: canned } }]);
      setBusy(false);
    }, 450);
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="space-y-3 max-h-[52vh] overflow-auto pr-1">
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="text-right">
                <div className="inline-block rounded-xl px-3 py-2 text-sm bg-blue-600/20 border border-blue-500/30">
                  {m.text}
                </div>
              </div>
            );
          }
          // try to parse CXO first
          const data = parseAssistant(m.assistant ?? { content: m.text ?? "" });
          if (data) {
            return <CXOMessage key={i} data={data} />;
          }
          return (
            <div key={i}>
              <div className="inline-block rounded-xl px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700">
                {m.text}
              </div>
            </div>
          );
        })}
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
