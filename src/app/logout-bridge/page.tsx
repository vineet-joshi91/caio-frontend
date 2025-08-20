// src/app/logout-bridge/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

// This is a Server Component; it clears the cookie set on the Vercel domain.
export default function LogoutBridge() {
  // Delete the auth cookie (adjust cookie name if yours differs)
  const jar = cookies();
  try { jar.delete("token"); } catch {}

  // We also embed a tiny client script to clear localStorage on the Vercel origin
  // (in case you stored the token there as well).
  const nonce = headers().get("x-nonce") || undefined;

  // After clearing, go to /signup
  // You can change to / if you prefer a different landing inside the app.
  redirect("/signup");
}