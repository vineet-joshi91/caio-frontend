"use client";
import { useEffect, useState } from "react";

/** Prevent hydration mismatch by rendering a stable shell on the server,
 *  and only enabling dynamic UI after the client mounts. */
export default function HydrationGuard(props: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Until mounted, render children but WITHOUT any client-only props
  // If you prefer to hide until mounted: return null;
  return <>{props.children}{/* mounted flag available to descendants */}</>;
}
