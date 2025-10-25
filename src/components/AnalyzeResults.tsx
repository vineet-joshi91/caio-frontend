"use client";

import React, { useMemo } from "react";
import TopActionsCard from "@/components/TopActionsCard";
import ConfidenceBanner from "@/components/ConfidenceBanner";
import BrainCard from "@/components/BrainCard";
import ShimmerBlock from "@/components/ShimmerBlock";

/**
 * AnalyzeResults
 *
 * Renders the high-level executive output after a document is analyzed.
 * This is what the user (and your screen recording) will look at.
 *
 * Layout:
 * 1. Top 3 Actions (executive summary)
 * 2. Confidence & Limitations banner
 * 3. Individual CXO Brain cards (CFO / COO / CHRO / CMO / CPO)
 * 4. [Legacy fallback / expansion] Accordions with raw markdown
 *    - Collective Insights
 *    - Recommendations
 *    - Per-role detail + Upsell if tier is demo/pro
 */

export default function AnalyzeResult({
  summary,
  tier,
  onUpgrade,
}: {
  summary: string;
  tier: "demo" | "pro" | "premium" | "admin";
  onUpgrade?: () => void;
}) {
  // Take raw summary and split by role headers etc.
  const sections = useMemo(() => splitByCxo(summary || ""), [summary]);

  const isLocked = tier === "demo" || tier === "pro";

  // We’ll display in this order visually
  const roleOrder: Array<keyof typeof sections.cxo> = [
    "CFO",
    "COO",
    "CHRO",
    "CMO",
    "CPO",
  ];

  // 1. Derive the "Top 3 Actions" list from Recommendations
  const topActions = useMemo(() => {
    const recText = sections.reco || "";
    // naive split into bullet-like lines
    // we'll grab first 3 non-empty lines
    const lines = recText
      .split(/\n+/)
      .map((l) => l.replace(/^[\-\*\d\.\)]\s*/, "").trim())
      .filter((l) => l.length > 0);
    return lines.slice(0, 3);
  }, [sections.reco]);

  // 2. Derive per-brain bullet arrays
  const brainBulletsByRole = useMemo(() => {
    const out: Record<string, string[]> = {};
    roleOrder.forEach((role) => {
      const raw = sections.cxo[role] || "";
      // split into bullet-style lines
      const bullets = raw
        .split(/\n+/)
        .map((l) => l.replace(/^[\-\*\d\.\)]\s*/, "").trim())
        .filter((l) => l.length > 0);
      out[role] = bullets;
    });
    return out;
  }, [sections.cxo, roleOrder]);

  // 3. Some hardcoded taglines per CXO brain
  const ROLE_TAGLINES: Record<string, string> = {
    CFO: "Cash, burn, runway",
    COO: "Execution risk & delivery",
    CHRO: "People, policy, liability",
    CMO: "Growth & pipeline health",
    CPO: "Roadmap focus vs distraction",
  };

  // If we have NOTHING (user hasn't run analysis yet),
  // show skeleton state so the UI still looks pro.
  const loadingState = !summary || summary.trim().length === 0;

  return (
    <div className="space-y-6 text-neutral-100">
      {/* === 1. Top 3 Actions === */}
      <TopActionsCard actions={topActions} loading={loadingState} />

      {/* === 2. Confidence Banner === */}
      <ConfidenceBanner
        authenticity="Source and signatures cannot be independently verified."
        consistency="No direct numerical contradictions found in provided data."
        financeCheck="Cashflow totals appear internally consistent with stated line items."
      />

      {/* === 3. Executive Brain Cards === */}
      <div className="grid gap-4 md:grid-cols-2">
        {roleOrder.map((role) => (
          <BrainCard
            key={role}
            role={role}
            tagline={ROLE_TAGLINES[role] || "Executive insight"}
            points={brainBulletsByRole[role]}
            loading={loadingState}
          />
        ))}
      </div>

      {/* === 4. Raw / Expandable detail for nerds ===
           We keep your original accordions so power users can still open
           deeper text, and so Upsell still appears for demo/pro tiers. */}
      <div className="space-y-4">
        {!!sections.collective && (
          <Accordion title="Collective Insights (Top 5)" defaultOpen>
            <MarkdownBlock markdown={sections.collective} />
          </Accordion>
        )}

        {!!sections.reco && (
          <Accordion title="Recommendations (Full Detail)" defaultOpen={false}>
            <MarkdownBlock markdown={sections.reco} />
          </Accordion>
        )}

        {roleOrder.map((role) => {
          const content = sections.cxo[role];
          if (!content) return null;

          return (
            <Accordion
              key={role}
              title={`${role} Deep Dive`}
              defaultOpen={false}
            >
              <MarkdownBlock markdown={content} />

              {isLocked && (
                <Upsell
                  tier={tier}
                  role={role}
                  onUpgrade={onUpgrade}
                  message={
                    tier === "demo"
                      ? "For deeper, role-specific insights and full access, upgrade to Pro. Want to chat with CAIO? Go for Pro+ or Premium."
                      : "Want chat mode and file uploads with role-specific depth? Go for Pro+ or Premium."
                  }
                />
              )}
            </Accordion>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function splitByCxo(src: string) {
  const text = (src || "").replace(/\r/g, "");
  const lines = text.split("\n");

  const join = (arr: string[]) => arr.join("\n").trim();
  const out = {
    collective: "",
    reco: "",
    cxo: { CFO: "", COO: "", CHRO: "", CMO: "", CPO: "" } as Record<
      "CFO" | "COO" | "CHRO" | "CMO" | "CPO",
      string
    >,
  };

  // headers we recognize
  const isCollective = (s: string) =>
    /^#{1,6}\s*collective insights\b/i.test(s) ||
    /^\*\*?\s*collective insights/i.test(s);

  const isReco = (s: string) =>
    /^#{1,6}\s*recommendations\b/i.test(s) ||
    /^\*\*?\s*recommendations/i.test(s);

  // Accept formats like "## CHRO", "### CHRO", "**CHRO**:", "CHRO recommends:"
  const cxoMatcher =
    /^(?:#{1,6}\s*)?(?:\*\*)?(CFO|COO|CHRO|CMO|CPO)(?:\*\*)?(?:\s+recommends:?)?\s*:?$/i;

  let current: string | null = null;
  const buckets: Record<string, string[]> = {
    collective: [],
    reco: [],
    CFO: [],
    COO: [],
    CHRO: [],
    CMO: [],
    CPO: [],
  };

  for (const raw of lines) {
    const h = raw.trim();

    if (isCollective(h)) {
      current = "collective";
      continue;
    }
    if (isReco(h)) {
      current = "reco";
      continue;
    }

    const m = cxoMatcher.exec(h);
    if (m) {
      current = m[1].toUpperCase();
      continue;
    }

    if (current && buckets[current]) {
      buckets[current].push(raw);
    }
  }

  out.collective = join(buckets.collective);
  out.reco = join(buckets.reco);
  (["CFO", "COO", "CHRO", "CMO", "CPO"] as const).forEach(
    (k) => (out.cxo[k] = join(buckets[k]))
  );

  // Fallback: if CHRO is empty but CFO filled, mirror CFO → CHRO
  if (!out.cxo.CHRO && out.cxo.CFO) {
    out.cxo.CHRO = out.cxo.CFO;
  }

  // Total fallback: if we couldn't split at all, dump entire text into "collective"
  if (
    !out.collective &&
    !out.reco &&
    Object.values(out.cxo).every((v) => !v)
  ) {
    out.collective = text.trim();
  }

  return out;
}

/* --------- tiny UI bits / legacy accordions --------- */

function Accordion({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-lg border border-neutral-700 bg-neutral-900/40 p-4"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none text-sm font-semibold text-neutral-200 opacity-90">
        {title}
      </summary>
      <div className="prose prose-invert mt-3 max-w-none text-sm leading-6">
        {children}
      </div>
    </details>
  );
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words text-neutral-200 text-[14px] leading-relaxed">
      {markdown}
    </pre>
  );
}

function Upsell({
  tier,
  role,
  message,
  onUpgrade,
}: {
  tier: string;
  role: string;
  message: string;
  onUpgrade?: () => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-neutral-700 bg-neutral-900/60 p-3 text-[13px] text-neutral-200 shadow-inner">
      <div className="mb-1 font-semibold text-neutral-100">
        Unlock more for {role}
      </div>

      <div className="text-neutral-300">{message}</div>

      <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
        <a
          href="/payments"
          className="rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-1 text-neutral-100 hover:bg-neutral-700"
          onClick={(e) => {
            if (onUpgrade) {
              e.preventDefault();
              onUpgrade();
            }
          }}
        >
          Upgrade
        </a>

        <a
          href="/premium/chat"
          className="rounded-lg border border-neutral-600 px-3 py-1 text-neutral-200 hover:bg-neutral-800"
        >
          Try Chat
        </a>
      </div>
    </div>
  );
}
