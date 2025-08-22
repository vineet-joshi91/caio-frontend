"use client";
import { useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim())
  || "https://caio-backend.onrender.com";

export default function ContactPage() {
  const [form, setForm] = useState({ name:"", organisation:"", email:"", need:"", message:"" });
  const [ok, setOk] = useState<string| null>(null);
  const [err, setErr] = useState<string| null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setOk(null); setErr(null); setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j?.detail || `HTTP ${r.status}`);
      setOk("Thanks! We’ll get back to you within a business day.");
      setForm({ name:"", organisation:"", email:"", need:"", message:"" });
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setBusy(false); }
  }

  return (
    <main style={{minHeight:"100vh",background:"#0b0f1a",color:"#e5e7eb",display:"grid",placeItems:"start center",padding:24}}>
      <form onSubmit={submit} style={{width:"min(100%,720px)",background:"#0e1320",border:"1px solid #243044",borderRadius:12,padding:20}}>
        <h1>Contact sales / support</h1>
        <p style={{opacity:.8,marginTop:4}}>Tell us about your organisation and what you need from CAIO.</p>

        <div style={row}>
          <label style={col}><span>Name</span>
            <input required value={form.name} onChange={e=>setForm({...form, name:e.target.value})} style={input}/>
          </label>
          <label style={col}><span>Organisation</span>
            <input value={form.organisation} onChange={e=>setForm({...form, organisation:e.target.value})} style={input}/>
          </label>
        </div>

        <label style={block}><span>Email</span>
          <input required type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} style={input}/>
        </label>

        <label style={block}><span>What do you need?</span>
          <input placeholder="Team plan, custom workflows, billing help…" value={form.need} onChange={e=>setForm({...form, need:e.target.value})} style={input}/>
        </label>

        <label style={block}><span>Message</span>
          <textarea rows={5} value={form.message} onChange={e=>setForm({...form, message:e.target.value})} style={{...input, resize:"vertical"}}/>
        </label>

        {ok && <div style={okBox}>{ok}</div>}
        {err && <div style={errBox}>{err}</div>}

        <button disabled={busy} type="submit" style={btn}>{busy ? "Sending…" : "Send"}</button>
        <div style={{marginTop:10,opacity:.8,fontSize:12}}>
          Or email <a href="mailto:vineetpjoshi.71@gmail.com" style={{color:"#93c5fd"}}>vineetpjoshi.71@gmail.com</a>
        </div>
      </form>
    </main>
  );
}

const row: React.CSSProperties = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 };
const col: React.CSSProperties = { display:"grid", gap:6 };
const block: React.CSSProperties = { display:"grid", gap:6, marginTop:12 };
const input: React.CSSProperties = { padding:"10px 12px", borderRadius:10, border:"1px solid #2b3650", background:"#0f172a", color:"#e5e7eb" };
const btn: React.CSSProperties = { marginTop:14, padding:"10px 14px", borderRadius:10, border:0, background:"linear-gradient(90deg,#8B5CF6,#22D3EE,#22C55E)", color:"#fff", fontWeight:800, cursor:"pointer" };
const okBox: React.CSSProperties = { marginTop:10, padding:"8px 10px", borderRadius:8, background:"#14321c", border:"1px solid #1f6b3d", color:"#c6f6d5", fontSize:13 };
const errBox: React.CSSProperties = { marginTop:10, padding:"8px 10px", borderRadius:8, background:"#3a1f1f", border:"1px solid #5a3535", color:"#fecaca", fontSize:13 };
