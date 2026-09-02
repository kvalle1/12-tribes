"use client";

import { useMemo, useState } from "react";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Renders the
 * Subject's own profile paired against how others see them — either the
 * equal-weight aggregate of all Observers or a single anonymous Observer picked
 * from the drill-down — and calls out where the two views align and diverge.
 *
 * Everything here is already-scored numbers (`TribeScore[]`): the Observers' raw
 * words never reach the client, so the drill-down stays anonymous — Observers
 * are only ever "Observer 1 / 2 / 3…", carrying no name, relationship, or any
 * other attribute. This component is only ever rendered once the report is
 * unlocked (≥3 Observers), so it always has a meaningful aggregate to show.
 */

/** `null` = the aggregate "others" view; a number is a per-observer index. */
type View = number | null;

export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const [view, setView] = useState<View>(null);

  const selfBySlug = useMemo(
    () => new Map(self.map((s) => [s.slug, s.score])),
    [self],
  );

  // The "others" series currently shown: the aggregate, or one Observer's own
  // profile from the drill-down.
  const otherSeries = view === null ? others : perObserver[view];
  const otherBySlug = useMemo(
    () => new Map(otherSeries.map((s) => [s.slug, s.score])),
    [otherSeries],
  );

  // A single shared scale across every series (self, aggregate, and each
  // Observer) so bar lengths stay comparable and don't jump when the view
  // switches. Normalized scores tend to be small, so scaling to the strongest
  // signal anywhere keeps the chart readable.
  const scaleMax = useMemo(() => {
    let max = 0;
    for (const series of [self, others, ...perObserver]) {
      for (const s of series) if (s.score > max) max = s.score;
    }
    return max || 1;
  }, [self, others, perObserver]);

  // Tribes ordered by how strongly the Subject expresses them, so their own
  // dominant tribes lead; the "others" bar sits alongside each for comparison.
  const rows = useMemo(
    () => [...self].sort((a, b) => b.score - a.score),
    [self],
  );

  // Where the aggregate "others" view most exceeds and most falls short of the
  // Subject's own read — the gap is where the 360 is most useful. Computed
  // against the aggregate, not the drill-down, so the callout is stable.
  const divergence = useMemo(() => {
    const deltas = self.map((s) => ({
      name: s.name,
      slug: s.slug,
      delta: (otherBySlugFor(others, s.slug) ?? 0) - s.score,
    }));
    const sorted = [...deltas].sort((a, b) => b.delta - a.delta);
    const seenMore = sorted[0];
    const seenLess = sorted[sorted.length - 1];
    return { seenMore, seenLess };
  }, [self, others]);

  return (
    <div>
      {/* View switcher: the equal-weight aggregate, plus anonymous per-observer
          drill-down. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose whose read to compare against yours">
        <ViewButton active={view === null} onClick={() => setView(null)}>
          Everyone
        </ViewButton>
        {perObserver.map((_, i) => (
          <ViewButton
            key={i}
            active={view === i}
            onClick={() => setView(i)}
          >
            Observer {i + 1}
          </ViewButton>
        ))}
      </div>

      {/* Legend for the two series. */}
      <div className="mt-6 flex items-center gap-5 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" aria-hidden />
          {view === null ? "Everyone" : `Observer ${view + 1}`}
        </span>
      </div>

      {/* Paired bars, one tribe per row. */}
      <ul className="mt-6 flex flex-col gap-5">
        {rows.map((row) => {
          const selfScore = selfBySlug.get(row.slug) ?? 0;
          const otherScore = otherBySlug.get(row.slug) ?? 0;
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-tight">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <Bar
                  label={`You: ${row.name}`}
                  fraction={selfScore / scaleMax}
                  className="bg-ink"
                />
                <Bar
                  label={`${view === null ? "Everyone" : `Observer ${view + 1}`}: ${row.name}`}
                  fraction={otherScore / scaleMax}
                  className="bg-gold"
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Alignment / divergence callout — only meaningful against the aggregate. */}
      {view !== null ? (
        <p className="mt-10 border-t border-hair pt-6 text-[13px] text-faint">
          Showing Observer {view + 1}&rsquo;s anonymous read on its own. Switch
          to <button type="button" onClick={() => setView(null)} className="underline underline-offset-2 hover:text-ink">Everyone</button> to
          see where your reads align and diverge.
        </p>
      ) : (
        divergence.seenMore &&
        divergence.seenLess && (
          <div className="mt-10 grid gap-4 border-t border-hair pt-6 sm:grid-cols-2">
            <div className="rounded-[2px] border border-hair p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Others see more of this in you
              </p>
              <p className="mt-2 font-serif text-[20px] text-ink">
                {divergence.seenMore.name}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                The room reads this tribe in you more strongly than you read it
                in yourself.
              </p>
            </div>
            <div className="rounded-[2px] border border-hair p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                You claim more than others see
              </p>
              <p className="mt-2 font-serif text-[20px] text-ink">
                {divergence.seenLess.name}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                You express this tribe more strongly than the people around you
                pick up on.
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function otherBySlugFor(series: TribeScore[], slug: string): number | undefined {
  return series.find((s) => s.slug === slug)?.score;
}

function ViewButton({
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
      className={
        "rounded-[2px] border px-3.5 py-1.5 text-[12px] tracking-[0.04em] transition-colors " +
        (active
          ? "border-ink bg-ink text-bone"
          : "border-hair text-muted hover:border-ink hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function Bar({
  label,
  fraction,
  className,
}: {
  label: string;
  fraction: number;
  className: string;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(pct)}% of the strongest signal`}
    >
      <div
        className={"h-full rounded-full transition-[width] " + className}
        style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
      />
    </div>
  );
}
