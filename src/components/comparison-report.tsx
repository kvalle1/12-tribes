import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  buildComparison,
  notableDivergences,
  type ComparisonRow,
} from "@/lib/observer/compare";
import {
  ObserverDrilldown,
  type DrilldownObserver,
} from "@/components/observer-drilldown";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile set beside the equal-weight "others" profile, the tribes where the two
 * views diverge, and an anonymous per-observer drill-down.
 *
 * It receives already-computed, client-safe scores — the Subject's `self`
 * profile, the aggregated `others` profile, and each observer's individual
 * profile for the drill-down — and does only presentation (joining, ranking,
 * divergence). The word→tribe mapping and the scoring/aggregation stay
 * server-side (ADR-0009); only numbers reach here. Render from a server
 * component.
 */
export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const rows = buildComparison(self, others);
  const divergences = notableDivergences(rows);

  const observers: DrilldownObserver[] = perObserver.map((profile, i) => ({
    label: `Observer ${i + 1}`,
    ranked: rankScores(profile).map((r) => ({
      slug: r.slug,
      name: r.name,
      relative: r.relative,
    })),
  }));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read · {observers.length} observers
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your own read sits beside the combined read of everyone who described
        you. Each observer counts equally, so no one voice outweighs the rest.
        The gap between the two is where growth lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full border border-ink/40 bg-ink/15" />
          Others
        </span>
      </div>

      {/* Side-by-side profile */}
      <section className="mt-8 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs. the room
        </p>
        <ul className="mt-6 flex flex-col gap-6">
          {rows.map((row) => (
            <ComparisonBars key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* Divergence highlights */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where your view and theirs diverge
        </p>
        {divergences.length === 0 ? (
          <p className="mt-4 max-w-[560px] text-[15px] text-muted">
            No big gaps — how you see yourself and how others see you line up
            closely across the tribes.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li
                key={row.slug}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px]"
              >
                <span
                  className="font-serif text-[18px]"
                  style={{ color: accentFor(row.slug) }}
                >
                  {row.name}
                </span>
                <span className="text-muted">{divergenceLabel(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Anonymous per-observer drill-down */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 mb-6 max-w-[560px] text-[15px] text-muted">
          The individual reads behind the average. Observers are shown only as
          numbers, with nothing that could identify them.
        </p>
        <ObserverDrilldown observers={observers} />
      </section>
    </div>
  );
}

function accentFor(slug: string): string {
  return accentHex(getTribeBySlug(slug)?.color ?? "");
}

/**
 * Human-readable direction of a self/others gap. The direction is scale-
 * independent and always correct; magnitude is left to the bars above, which
 * avoids a number that could visually disagree with the shared-scale bars.
 */
function divergenceLabel(row: ComparisonRow): string {
  return row.delta > 0
    ? "Others see more of this than you do"
    : "You see more of this than others do";
}

function ComparisonBars({ row }: { row: ComparisonRow }) {
  const accent = accentFor(row.slug);
  return (
    <li>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span
          className="font-serif text-[17px] leading-none"
          style={{ color: accent }}
        >
          {row.name}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Bar
          label="You"
          relative={row.selfRelative}
          color="var(--ink, #1c1b18)"
          accent={accent}
          filled
        />
        <Bar
          label="Others"
          relative={row.othersRelative}
          color={accent}
          accent={accent}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  relative,
  color,
  accent,
  filled = false,
}: {
  label: string;
  relative: number;
  color: string;
  accent: string;
  filled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[52px_1fr] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, relative > 0 ? 3 : 0)}%`,
            backgroundColor: filled ? color : accent,
            opacity: filled ? 0.9 : 0.4,
          }}
        />
      </div>
    </div>
  );
}
