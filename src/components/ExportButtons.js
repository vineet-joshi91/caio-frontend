"use client";

import React, { useState } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE &&
    process.env.NEXT_PUBLIC_API_BASE.trim().replace(/\/+$/, "")) ||
  "http://localhost:8000";

/** token helper (cookie or localStorage) */
function getToken() {
  try {
    const cookie = document.cookie || "";
    const pick = (name) => cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
    const c1 = pick("access_token");
    const c2 = pick("token");
    if (c1) return decodeURIComponent(c1);
    if (c2) return decodeURIComponent(c2);
    return localStorage.getItem("access_token") || localStorage.getItem("token");
  } catch {
    return null;
  }
}

export default function ExportButtons({ title, markdown, compact }) {
  const [busy, setBusy] = useState(null); // "pdf" | "docx" | null
  const disabled = !markdown || !!busy;

  async function doExport(kind) {
    const token = getToken();
    if (!token) {
      alert("Please log in again.");
      return;
    }
    if (!markdown || !markdown.trim()) {
      alert("Nothing to export yet.");
      return;
    }

    setBusy(kind);
    try {
      const res = await fetch(`${API_BASE}/api/export/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title || "CAIO Analysis", markdown }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `${String(kind).toUpperCase()} export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CAIO-Analysis.${kind === "pdf" ? "pdf" : "docx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const baseBtn = {
    display: "inline-block",
    borderRadius: 10,
    border: "1px solid #243044",
    background: "#0f172a",
    color: "#e5e7eb",
    fontWeight: 700,
    padding: compact ? "8px 10px" : "10px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button style={baseBtn} disabled={disabled} onClick={() => doExport("pdf")}>
        {busy === "pdf" ? "Exporting…" : "Export PDF"}
      </button>
      <button style={baseBtn} disabled={disabled} onClick={() => doExport("docx")}>
        {busy === "docx" ? "Exporting…" : "Export DOCX"}
      </button>
    </div>
  );
}
