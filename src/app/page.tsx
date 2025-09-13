"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [hasToken, setHasToken] = useState<boolean>(false);

  useEffect(() => {
    try {
      const t =
        (typeof window !== "undefined" &&
          (localStorage.getItem("access_token") || localStorage.getItem("token"))) ||
        "";
      setHasToken(!!t);
    } catch {
      setHasToken(false);
    }
  }, []);

  return (
    <main className="min-h-screen w-full bg-black text-white flex items-start justify-center pt-20 px-4">
      <div className="max-w-3xl w-full rounded-2xl bg-neutral-900/80 p-6 shadow-xl">
        <h1 className="text-3xl font-semibold mb-4">Welcome to CAIO</h1>

        <p className="text-neutral-300 mb-6">
          {hasToken
            ? "You’re signed in. Open your dashboard to start analyzing, or go to Premium Chat if your plan allows."
            : "You’re not signed in. Log in or create an account to continue."}
        </p>

        <div className="flex flex-wrap gap-3">
          {!hasToken && (
            <>
              <a
                href="/login"
                className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 transition inline-flex items-center justify-center"
              >
                Log in
              </a>
              <a
                href="/signup"
                className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 transition inline-flex items-center justify-center"
              >
                Sign up
              </a>
            </>
          )}

          {hasToken && (
            <>
              {/* use plain anchors for bulletproof navigation */}
              <a
                href="/dashboard"
                className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 transition inline-flex items-center justify-center"
              >
                Open dashboard
              </a>
              <Link
                href="/premium/chat"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 transition inline-flex items-center justify-center"
              >
                Premium Chat
              </Link>
              <Link
                href="/payments"
                className="underline text-blue-400 hover:text-blue-300 inline-flex items-center"
              >
                Manage / Upgrade
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
