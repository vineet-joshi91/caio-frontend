"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
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
