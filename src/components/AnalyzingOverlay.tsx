"use client";

import React, { useEffect, useState } from "react";

const brainSteps = [
  { role: "CFO Brain", text: "Checking burn rate, cash runway, pricing exposure…" },
  { role: "COO Brain", text: "Scanning operational bottlenecks and delivery risks…" },
  { role: "CHRO Brain", text: "Reviewing policy gaps and liability triggers…" },
  { role: "CMO Brain", text: "Assessing positioning, pipeline health, and GTM levers…" },
  { role: "CPO Brain", text: "Stress-testing roadmap focus vs distraction work…" },
  { role: "CAIO", text: "Assembling board-ready next actions for you…" },
];

export default function AnalyzingOverlay({ active }: { active: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const it = setInterval(() => {
      setIdx((i) => (i + 1) % brainSteps.length);
    }, 1500);
    return () => clearInterval(it);
  }, [active]);

  if (!active) return null;

  const step = brainSteps[idx];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900/80 p-6 text-neutral-100 shadow-xl">
        <div className="flex items-start gap-3">
          {/* Animated dots avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 shadow-inner">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-200" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-600 [animation-delay:0.3s]" />
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1">
            <div className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
              Analyzing your file…
            </div>

            <div className="mt-1 text-lg font-semibold text-neutral-100">
              {step.role}
            </div>

            <div className="mt-1 text-sm text-neutral-300 leading-relaxed">
              {step.text}
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full w-1/3 animate-[ping_1.5s_ease-in-out_infinite] rounded-full bg-neutral-300" />
            </div>

            {/* Footer note */}
            <div className="mt-3 text-[11px] text-neutral-500 leading-snug">
              CAIO is running multiple executive lenses in parallel
              (Finance • Ops • People • Growth • Product)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
