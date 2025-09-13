"use client";

import { useRouter } from "next/navigation";
import { clearToken, getApiBase } from "../lib/auth";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${getApiBase()}/api/logout`, { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors
    } finally {
      clearToken();
      router.push("/");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 transition text-white"
    >
      Log out
    </button>
  );
}
