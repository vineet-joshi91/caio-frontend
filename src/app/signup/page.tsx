"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");
    if(password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }
    try {
      // Backend integration here:
      // Uncomment and edit when backend is ready
      // const res = await fetch("http://localhost:8000/api/signup", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email, password }),
      // });
      // if (!res.ok) throw new Error("Signup failed");

      // For now, just pretend signup works:
      setMsg("Account created! Please login.");
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      setMsg("Signup failed. Try another email?");
    }
  };

  return (
    <div style={{maxWidth:420,margin:"60px auto",padding:32,background:"#fff",borderRadius:10,boxShadow:"0 0 18px #e9ecef"}}>
      <h1 style={{textAlign:"center",color:"#154272",marginBottom:8}}>Sign Up for CAIO</h1>
      <form onSubmit={handleSignup}>
        <label>Email</label>
        <input type="email" value={email} required onChange={e=>setEmail(e.target.value)} style={{width:"100%",padding:10,margin:"8px 0 14px 0",borderRadius:4,border:"1px solid #ddd"}}/>
        <label>Password</label>
        <input type="password" value={password} required onChange={e=>setPassword(e.target.value)} style={{width:"100%",padding:10,margin:"8px 0 14px 0",borderRadius:4,border:"1px solid #ddd"}}/>
        <label>Confirm Password</label>
        <input type="password" value={confirm} required onChange={e=>setConfirm(e.target.value)} style={{width:"100%",padding:10,margin:"8px 0 18px 0",borderRadius:4,border:"1px solid #ddd"}}/>
        <button type="submit" style={{width:"100%",padding:13,background:"#154272",color:"#fff",border:"none",borderRadius:4,fontWeight:700,marginTop:7}}>Sign Up</button>
      </form>
      {msg && <div style={{marginTop:22,textAlign:"center",color:msg.startsWith("Account")?"#13706a":"crimson"}}>{msg}</div>}
      <div style={{textAlign:"center",marginTop:18}}>
        <a href="/" style={{color:"#154272",fontWeight:600}}>Back to Login</a>
      </div>
    </div>
  );
}
