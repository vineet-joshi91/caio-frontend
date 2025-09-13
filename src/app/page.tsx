"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  email: string;
  role?: string;
  plan?: string;
  demo?: boolean;
};

function getApiBase() {
  const env = process.env.NEXT_PUBLIC_API_BASE || "";
  return env.replace(/\/+$/, ""); // trim trailing slash
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            email: data?.email ?? "",
            role: data?.role ?? "User",
            plan: data?.plan ?? "Demo",
            demo: !!data?.demo,
          });
        } else {
          // invalid/expired token
          localStorage.removeItem("access_token");
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <main className="min-h-screen w-full bg-black text-white flex items-start justify-center pt-20 px-4">
      <div className="max-w-3xl w-full rounded-2xl bg-neutral-900/80 p-6 shadow-xl">
        <h1 className="text-3xl font-semibold mb-2">Welcome to CAIO</h1>

        {loading ? (
          <p className="text-neutral-400">Checking your session…</p>
        ) : profile ? (
          <>
            <p className="text-neutral-300 mb-4">
              Logged in as <span className="font-semibold">{profile.email}</span> •{" "}
              {profile.role ?? "User"} • {profile.plan ?? "Demo"}
            </p>

            <div className="flex gap-3">
              <Link href="/payments" className="underline text-blue-400 hover:text-blue-300">
                Upgrade to Pro
              </Link>

              <Link href="/dashboard">
                <button
                  className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 transition"
                  aria-label="Open dashboard"
                >
                  Open dashboard
                </button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-neutral-300 mb-4">
              You are not logged in. Please{" "}
              <Link href="/login" className="underline text-blue-400 hover:text-blue-300">
                log in
              </Link>{" "}
              or{" "}
              <Link href="/signup" className="underline text-blue-400 hover:text-blue-300">
                create an account
              </Link>
              .
            </p>

            <div className="flex gap-3">
              <Link href="/login">
                <button className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 transition">
                  Log in
                </button>
              </Link>
              <Link href="/signup">
                <button className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 transition">
                  Sign up
                </button>
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
