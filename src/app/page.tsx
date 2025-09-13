"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchWithAuth, routeForTier, type Tier } from "../lib/auth";

export default function RootRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth("/api/profile");
        if (res.ok) {
          const j: any = await res.json();
          const next = routeForTier((j?.tier as Tier) || "demo");
          if (pathname !== next) router.replace(next);
        } else {
          if (pathname !== "/login") router.replace("/login");
        }
      } catch {
        if (pathname !== "/login") router.replace("/login");
      } finally {
        setBusy(false);
      }
    })();
  }, [router, pathname]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="opacity-70">{busy ? "Redirecting…" : "Loading…"}</div>
    </main>
  );
}
