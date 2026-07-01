"use client";

import { useMemo, useState } from "react";
import type { TribeScore } from "@/lib/assessment/score";
import { cn } from "@/lib/utils";

/**
 * The self-vs-others comparison for the 360 report (issue #9). Renders the
 * Subject's own profile beside the equal-weight "others" profile as paired bars,
 * calls out where the two most align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1/2/3…) that swaps the "others" column for a
 * single Observer's read.
 *
 * It is a client component so the drill-down can toggle without a round-trip,
 * and it receives only finished numbers — the scoring core and word→tribe
 * mapping stay on the server (ADR-0009). The `import type` above is erased at
 * build time, so no server-only code is pulled into the client bundle. Observers
 * carry nothing but a 1-based label index: the drill-down is anonymous by
 * construction (ADR-0003).
 */

interface ObserverProfile {
  index: number;
  scores: TribeScore[];
}

export function ReportComparison({
  self,
  others,
  observers,
  accentBySlug,
}: {
  self: TribeScore[];
  others: TribeScore[];
  observers: ObserverProfile[];
  accentBySlug: Record<string, string>;
}) {
  // `null` ⇒ the aggregate "others"; a number ⇒ that Observer's own profile.
  const [drillTo, setDrillTo] = useState<number | null>(null);

  const selfBySlug = useMemo(
    () => new Map(self.map((s) => [s.slug, s.score])),
    [self],
  );
  const othersBySlug = useMemo(
    () => new Map(others.map((s) => [s.slug, s.score])),
    [others],
  );

  // The "others" column currently shown: the aggregate, or one Observer's read.
  const shownOthers = useMemo(() => {
    if (drillTo === null) return others;
    return observers.find((o) => o.index === drillTo)?.scores ?? others;
  }, [drillTo, others, observers]);
  const shownBySlug = useMemo(
    () => new Map(shownOthers.map((s) => [s.slug, s.score])),
    [shownOthers],
  );

  // Fixed row order: most-prominent tribes first, by self + aggregate others, so
  // rows don't reshuffle when drilling into an individual Observer.
  const order = useMemo(
    () =>
      [...self]
        .map((s) => ({
          slug: s.slug,
          name: s.name,
          rank: s.score + (othersBySlug.get(s.slug) ?? 0),
        }))
        .sort((a, b) => b.rank - a.rank),
    [self, othersBySlug],
  );

  // Scale both bars against the tallest bar currently on screen, so the two
  // series stay directly comparable and the chart stays readable.
  const scale = useMemo(() => {
    const max = Math.max(
      0,
      ...self.map((s) => s.score),
      ...shownOthers.map((s) => s.score),
    );
    return max > 0 ? max : 1;
  }, [self, shownOthers]);

  // Alignment / divergence always describe the aggregate, not a drilled Observer.
  const divergence = useMemo(() => {
    const rows = self.map((s) => ({
      name: s.name,
      delta: (othersBySlug.get(s.slug) ?? 0) - s.score,
    }));
    const seesMore = [...rows].sort((a, b) => b.delta - a.delta)[0];
    const seesLess = [...rows].sort((a, b) => a.delta - b.delta)[0];
    const aligned = [...rows].sort(
      (a, b) => Math.abs(a.delta) - Math.abs(b.delta),
    )[0];
    return { seesMore, seesLess, aligned };
  }, [self, othersBySlug]);

  const MEANINGFUL = 0.05;

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-gold" />
          {drillTo === null ? "Others (average)" : `Observer ${drillTo}`}
        </span>
      </div>

      {/* Paired bars, one row per tribe. */}
      <ul className="mt-7 flex flex-col gap-5">
        {order.map((row) => {
          const selfScore = selfBySlug.get(row.slug) ?? 0;
          const otherScore = shownBySlug.get(row.slug) ?? 0;
          const accent = accentBySlug[row.slug] ?? "#a68a4d";
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="flex items-baseline gap-2 font-serif text-[17px] leading-tight">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <Bar
                  label={`You: ${pct(selfScore)}`}
                  fraction={selfScore / scale}
                  color="var(--color-ink)"
                />
                <Bar
                  label={`${drillTo === null ? "Others" : `Observer ${drillTo}`}: ${pct(otherScore)}`}
                  fraction={otherScore / scale}
                  color="var(--color-gold)"
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Where self and others align / diverge (always the aggregate). */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you align &amp; diverge
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-[15px] text-ink">
          <li>
            You and those who know you are closest on{" "}
            <strong className="font-semibold">
              {divergence.aligned.name}
            </strong>
            .
          </li>
          {divergence.seesMore.delta > MEANINGFUL && (
            <li>
              Others see more{" "}
              <strong className="font-semibold">
                {divergence.seesMore.name}
              </strong>{" "}
              in you than you claim.
            </li>
          )}
          {divergence.seesLess.delta < -MEANINGFUL && (
            <li>
              You lean into{" "}
              <strong className="font-semibold">
                {divergence.seesLess.name}
              </strong>{" "}
              more than others see.
            </li>
          )}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Drill into the spread
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each responder is anonymous. Compare their individual reads to see how
          much opinion varies.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <DrillButton
            active={drillTo === null}
            onClick={() => setDrillTo(null)}
          >
            Average
          </DrillButton>
          {observers.map((o) => (
            <DrillButton
              key={o.index}
              active={drillTo === o.index}
              onClick={() => setDrillTo(o.index)}
            >
              Observer {o.index}
            </DrillButton>
          ))}
        </div>
      </section>
    </div>
  );
}

function Bar({
  label,
  fraction,
  color,
}: {
  label: string;
  fraction: number;
  color: string;
}) {
  const width = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

function DrillButton({
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
        "rounded-[2px] border px-4 py-2 text-[13px] tracking-[0.04em] transition-colors",
        active
          ? "border-ink bg-ink text-bone"
          : "border-hair text-ink hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Normalized 0–1 score as a whole-number percentage for labels. */
function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}
