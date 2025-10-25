"use client";

import React from "react";

export default function TypingDots() {
  return (
    <div className="flex items-center gap-2 text-[13px] text-neutral-400">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-200" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-600 [animation-delay:0.3s]" />
      </div>
      <span className="text-neutral-500">Thinking…</span>
    </div>
  );
}
