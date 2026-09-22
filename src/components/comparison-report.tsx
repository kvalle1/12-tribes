"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProfileBars, ReportTribe } from "@/lib/observer/report";

/**
 * The 360 comparison report (issue #9): the Subject's own read alongside how
 * their Observers see them, tribe-for-tribe in the Subject's own ranking order
 * so alignment and divergence are easy to spot. A selector switches the "others"
 * side between the equal-weight aggregate of everyone and any single Observer,
 * fully anonymously (Observer 1, 2, …). All scoring happened on the server; this
 * view only draws the finished bar fractions it was handed.
 */

/** A tribe whose self/other bars diverge by at least this much is highlighted. */
const DIVERGENCE_THRESHOLD = 0.33;

export function ComparisonReport({
  order,
  self,
  aggregate,
  perObserver,
}: {
  order: ReportTribe[];
  self: ProfileBars;
  aggregate: ProfileBars;
  perObserver: ProfileBars[];
}) {
  // "others" side: -1 = the aggregate of everyone, else a single Observer index.
  const [selected, setSelected] = useState<number>(-1);
  const others = selected === -1 ? aggregate : perObserver[selected];

  return (
    <div>
      {/* Drill-down selector: the aggregate, or any one anonymous Observer. */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Whose read to compare against"
      >
        <SelectorButton
          active={selected === -1}
          onClick={() => setSelected(-1)}
        >
          All observers
        </SelectorButton>
        {perObserver.map((observer, i) => (
          <SelectorButton
            key={observer.label}
            active={selected === i}
            onClick={() => setSelected(i)}
          >
            {`Observer ${i + 1}`}
          </SelectorButton>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-faint">
        <LegendSwatch className="bg-ink" /> {self.label}
        <LegendSwatch className="bg-gold" /> {others.label}
      </div>

      <ul className="mt-6 flex flex-col gap-5">
        {order.map((tribe) => {
          const selfValue = self.relativeBySlug[tribe.slug] ?? 0;
          const otherValue = others.relativeBySlug[tribe.slug] ?? 0;
          const diverges =
            Math.abs(otherValue - selfValue) >= DIVERGENCE_THRESHOLD;
          const seenStronger = otherValue > selfValue;

          return (
            <li
              key={tribe.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span
                className="font-serif text-[17px] leading-tight"
                style={{ color: diverges ? tribe.accent : undefined }}
              >
                {tribe.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={self.label}
                  value={selfValue}
                  className="bg-ink"
                />
                <CompareBar
                  label={others.label}
                  value={otherValue}
                  className="bg-gold"
                />
                {diverges && (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    {seenStronger
                      ? "Others see this stronger"
                      : "Others see this weaker"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SelectorButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[2px] border px-3.5 py-1.5 text-[12px] tracking-[0.06em] transition-colors",
        active
          ? "border-ink bg-ink text-bone"
          : "border-hair text-muted hover:border-ink hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function CompareBar({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", className)}
          style={{ width: `${Math.max(value * 100, value > 0 ? 3 : 0)}%` }}
        />
      </div>
      <span className="w-[34px] shrink-0 text-right text-[11px] tabular-nums text-faint">
        {pct}%
      </span>
    </div>
  );
}

function LegendSwatch({ className }: { className: string }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", className)}
      aria-hidden
    />
  );
}
