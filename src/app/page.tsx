"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    let dest = "/login";
    try {
      const token =
        (typeof window !== "undefined" && (localStorage.getItem("access_token") || localStorage.getItem("token"))) ||
        "";
      dest = token ? "/dashboard" : "/login";

      // Try client-side navigation first
      router.replace(dest);

      // Hard fallback in case Router is unhappy
      const id = setTimeout(() => {
        if (window.location.pathname !== dest) {
          window.location.href = dest;
        }
      }, 400);
      return () => clearTimeout(id);
    } catch {
      window.location.href = "/login";
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white grid place-items-center">
      <span className="opacity-70">Redirecting…</span>
    </main>
  );
}
