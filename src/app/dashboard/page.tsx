"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  // For demo, use state (replace with real user logic after backend hookup)
  const [user, setUser] = useState({
    email: "demo@caio.ai",   // TODO: Replace with user email from login/profile API
    tier: "demo"             // "demo", "full", or "admin"
  });
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  // Handle analysis (dummy for now)
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInsights(null);

    // TODO: Replace with actual backend call (file or query)
    setTimeout(() => {
      setInsights({
        CFO: "Cash flow is strong. No major financial risks detected.",
        COO: "Ops bottleneck in Q3 resolved. All KPIs green.",
        CMO: "Marketing ROI up 12%. New segment performing well.",
        CHRO: "Attrition steady, engagement at all-time high."
      });
      setLoading(false);
    }, 1400);
  };

  // PDF download placeholder (add real logic after backend)
  const handleDownloadPDF = () => {
    alert("Download feature coming soon! Only available for Full/Admin users.");
  };

  // Logout button (demo)
  const handleLogout = () => {
    // TODO: Clear tokens/user state after backend wired
    router.push("/");
  };

  return (
    <div style={{maxWidth:600,margin:"40px auto",padding:32,background:"#fff",borderRadius:12,boxShadow:"0 0 16px #e8ecf1"}}>
      <h1 style={{textAlign:"center",color:"#154272",marginBottom:8}}>CAIO User Dashboard</h1>
      <div style={{textAlign:"center",color:"#3253a3",marginBottom:14}}>
        Welcome, <b>{user.email}</b> ({user.tier.toUpperCase()})
      </div>

      <form onSubmit={handleAnalyze} style={{marginBottom:28}}>
        <div style={{marginBottom:13}}>
          <label>Upload business document:&nbsp;</label>
          <input type="file" onChange={handleFileChange} />
        </div>
        <div style={{marginBottom:13,textAlign:"center",color:"#8f8f8f"}}>— OR —</div>
        <div style={{marginBottom:19}}>
          <label>Or enter a business query:</label>
          <textarea
            value={query}
            onChange={e=>setQuery(e.target.value)}
            style={{width:"100%",height:65,padding:10,marginTop:7,borderRadius:4,border:"1px solid #ddd",fontSize:"1.04em"}}
            placeholder="e.g., What are the biggest risks in our Q2 plan?"
          />
        </div>
        <button type="submit" style={{width:"100%",padding:12,background:"#154272",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:"1.07em"}} disabled={loading}>
          {loading ? "Analyzing..." : "Get CXO Insights"}
        </button>
      </form>

      {insights && (
        <div>
          <h2 style={{textAlign:"center",marginBottom:14,color:"#144578"}}>CXO Insights</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
            {Object.entries(insights).map(([role, rec]) => (
              <div key={role} style={{background:"#f5f8fa",padding:16,borderRadius:8,boxShadow:"0 0 4px #f0f2f5"}}>
                <b>{role}:</b>
                <div style={{marginTop:7,fontSize:"1.06em"}}>{rec}</div>
              </div>
            ))}
          </div>
          {(user.tier === "full" || user.tier === "admin") ? (
            <button onClick={handleDownloadPDF} style={{marginTop:32,width:"100%",padding:12,background:"#1ba88b",color:"#fff",border:"none",borderRadius:4,fontWeight:700,fontSize:"1.06em"}}>Download PDF Report</button>
          ) : (
            <div style={{marginTop:26,textAlign:"center",color:"#a0530e"}}>
              PDF download is <b>only</b> for Full/Admin users.<br />
              <button style={{marginTop:10,padding:"9px 23px",background:"#ffb94b",color:"#673b00",border:"none",borderRadius:5,fontWeight:600}}
                onClick={()=>alert("Upgrade to Full Version for PDF download!")}>
                Upgrade Now
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:36,textAlign:"center"}}>
        <button onClick={handleLogout} style={{padding:"9px 26px",background:"#e05541",color:"#fff",border:"none",borderRadius:5,fontWeight:600}}>Logout</button>
      </div>
    </div>
  );
}
