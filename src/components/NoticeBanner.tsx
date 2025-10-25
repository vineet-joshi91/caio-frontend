"use client";

import React from "react";

type Tone = "info" | "warn" | "limit" | "neutral";

const toneClasses: Record<Tone, string> = {
  info:
    // soft blue – capability guidance (file too big, wrong type)
    "border-blue-400/30 bg-blue-500/10 text-blue-100",
  warn:
    // amber – transient/temporary issues (timeout, backend warming)
    "border-amber-400/30 bg-amber-500/10 text-amber-100",
  limit:
    // fuchsia / upgrade – you've hit plan ceiling
    "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
  neutral:
    // gray – session expired, auth, harmless stuff
    "border-zinc-600/50 bg-zinc-800/60 text-zinc-200",
};

export default function NoticeBanner({
  tone = "warn",
  title,
  body,
  children,
}: {
  tone?: Tone;
  title: string;
  body?: React.ReactNode;
  children?: React.ReactNode; // buttons etc
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 text-sm leading-relaxed " + toneClasses[tone]
      }
    >
      <div className="font-semibold text-[14px]">{title}</div>
      {body && <div className="mt-1 text-[13px] opacity-90">{body}</div>}
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
