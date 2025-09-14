"use client";

import { useMemo } from "react";

export default function AnalyzeResult({
  summary,
  tier,
  onUpgrade,
}: {
  summary: string;
  tier: "demo" | "pro" | "premium" | "admin";
  onUpgrade?: () => void;
}) {
  const sections = useMemo(() => splitByCxo(summary), [summary]);
  const isLocked = tier === "demo" || tier === "pro";

  const roleOrder = ["CFO", "CHRO", "COO", "CMO", "CPO"] as const;

  return (
    <div className="space-y-6">
      {!!sections.collective && (
        <Accordion title="Collective Insights (Top 5)" defaultOpen>
          <MarkdownBlock markdown={sections.collective} />
        </Accordion>
      )}
      {!!sections.reco && (
        <Accordion title="Recommendations" defaultOpen>
          <MarkdownBlock markdown={sections.reco} />
        </Accordion>
      )}

      {roleOrder.map((role) => {
        const content = sections.cxo[role];
        if (!content) return null;
        return (
          <Accordion key={role} title={`${role} Insights`} defaultOpen={false}>
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

  const isCollective = (s: string) =>
    /^#{1,6}\s*collective insights\b/i.test(s) || /^\*\*?\s*collective insights/i.test(s);
  const isReco = (s: string) =>
    /^#{1,6}\s*recommendations\b/i.test(s) || /^\*\*?\s*recommendations/i.test(s);

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

  // ✅ Fallback: if CHRO is empty but CFO has content, copy CFO → CHRO
  if (!out.cxo.CHRO && out.cxo.CFO) {
    out.cxo.CHRO = out.cxo.CFO;
  }

  if (!out.collective && !out.reco && Object.values(out.cxo).every((v) => !v)) {
    out.collective = text.trim();
  }
  return out;
}

/* --------- tiny UI bits --------- */

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
    <details className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4" open={defaultOpen}>
      <summary className="cursor-pointer select-none text-sm font-semibold opacity-90">{title}</summary>
      <div className="prose prose-invert mt-3 max-w-none text-sm leading-6">{children}</div>
    </details>
  );
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  return <pre className="whitespace-pre-wrap break-words">{markdown}</pre>;
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
    <div className="mt-4 rounded-md border border-indigo-500/40 bg-indigo-500/10 p-3 text-[13px]">
      <div className="mb-1 font-semibold">Unlock more for {role}</div>
      <div className="opacity-90">{message}</div>
      <div className="mt-2 flex gap-2">
        <a
          href="/payments"
          className="rounded-md bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500"
          onClick={(e) => {
            if (onUpgrade) {
              e.preventDefault();
              onUpgrade();
            }
          }}
        >
          Upgrade
        </a>
        {/* fixed link */}
        <a
          href="/premium/chat"
          className="rounded-md border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
        >
          Try Chat
        </a>
      </div>
    </div>
  );
}
