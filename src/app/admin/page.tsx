"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Dummy user data until backend is connected
const dummyUsers = [
  { email: "vineetpjoshi.71@gmail.com", tier: "admin", lastLogin: "2024-07-29", status: "Active" },
  { email: "fulluser@client.com", tier: "full", lastLogin: "2024-07-30", status: "Active" },
  { email: "demo@demo.com", tier: "demo", lastLogin: "2024-07-28", status: "Inactive" },
];

export default function AdminDashboard() {
  const router = useRouter();
  // For demo, use your real email as admin (connect to backend/profile later)
  const [user, setUser] = useState({ email: "vineetpjoshi.71@gmail.com", tier: "admin" });

  // For real app, fetch users from backend API
  const [users, setUsers] = useState(dummyUsers);

  useEffect(() => {
    // TODO: Replace with backend API fetch, and check admin session
    // fetch('/api/admin/users')...
  }, []);

  // Simple logout
  const handleLogout = () => {
    router.push("/");
  };

  return (
    <div style={{maxWidth:800,margin:"40px auto",padding:32,background:"#fff",borderRadius:12,boxShadow:"0 0 16px #e8ecf1"}}>
      <h1 style={{textAlign:"center",color:"#154272",marginBottom:8}}>Admin Dashboard</h1>
      <div style={{textAlign:"center",color:"#3253a3",marginBottom:16}}>
        Welcome, <b>{user.email}</b> (ADMIN)
      </div>

      <h2 style={{fontSize:"1.18em",margin:"25px 0 14px 0",color:"#235393"}}>Registered Users & Leads</h2>
      <table style={{width:"100%",borderCollapse:"collapse",background:"#f6f9fc"}}>
        <thead>
          <tr>
            <th style={{border:"1px solid #e3e7ee",padding:"9px"}}>Email</th>
            <th style={{border:"1px solid #e3e7ee",padding:"9px"}}>Tier</th>
            <th style={{border:"1px solid #e3e7ee",padding:"9px"}}>Last Login</th>
            <th style={{border:"1px solid #e3e7ee",padding:"9px"}}>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={i}>
              <td style={{border:"1px solid #e3e7ee",padding:"9px"}}>{u.email}</td>
              <td style={{border:"1px solid #e3e7ee",padding:"9px"}}>{u.tier.toUpperCase()}</td>
              <td style={{border:"1px solid #e3e7ee",padding:"9px"}}>{u.lastLogin}</td>
              <td style={{border:"1px solid #e3e7ee",padding:"9px"}}>{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{marginTop:40,textAlign:"center"}}>
        <button onClick={handleLogout} style={{padding:"9px 26px",background:"#e05541",color:"#fff",border:"none",borderRadius:5,fontWeight:600}}>Logout</button>
      </div>
    </div>
  );
}
