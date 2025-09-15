import Link from "next/link";

type Tier = "demo" | "pro" | "pro_plus" | "premium" | "admin";

export default function UpsellPlacard({
  tier,
  brain,
}: {
  tier: Tier;
  brain: string;
}) {
  if (tier === "demo") {
    return (
      <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
        <p className="text-sm text-zinc-200">Unlock more for {brain}</p>
        <p className="mt-1 text-xs text-zinc-400">
          For more insights, upgrade to <span className="font-medium">Pro</span> — or if you want to chat, go for{" "}
          <span className="font-medium">Pro+</span> or <span className="font-medium">Premium</span>.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/pricing" className="px-3 py-1.5 rounded-lg border border-indigo-500 text-indigo-200">
            Upgrade
          </Link>
          <Link href="/dashboard/chat" className="px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-200">
            Try Chat
          </Link>
        </div>
      </div>
    );
  }
  if (tier === "pro") {
    return (
      <div className="mt-3 rounded-xl border border-indigo-700/40 bg-indigo-900/20 p-4">
        <p className="text-sm text-indigo-100">Chat unlock</p>
        <p className="mt-1 text-xs text-indigo-200">
          Please try the Chat feature or upgrade to <span className="font-medium">Pro+</span> or{" "}
          <span className="font-medium">Premium</span> for full chat access.
        </p>
        <div className="mt-3 flex gap-2">
          <Link href="/dashboard/chat" className="px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-100">
            Try Chat
          </Link>
          <Link href="/pricing" className="px-3 py-1.5 rounded-lg border border-indigo-500 text-indigo-100">
            Upgrade
          </Link>
        </div>
      </div>
    );
  }
  return null;
}
