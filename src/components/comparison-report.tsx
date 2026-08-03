import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/ranking";

/**
 * The 360 self-vs-others comparison (issue #9, ADR-0003). Purely presentational:
 * every score is computed server-side (the word→tribe mapping stays off the
 * client, ADR-0009) and passed in as plain numbers, so this component imports no
 * scoring or server-only code.
 *
 * The main chart puts the Subject's own profile beside the equal-weight "others"
 * profile on a shared scale, so where the two readings align and diverge is read
 * directly from the bar lengths. Below it, an anonymous per-Observer drill-down
 * (Observer 1/2/3 …) shows the spread of opinion without identifying anyone.
 */

/** One tribe row of the comparison, with both readings on a shared 0–1 scale. */
export interface ComparisonRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /** The Subject's score as a fraction of the shared max across both readings. */
  selfRel: number;
  /** The "others" score as a fraction of the shared max across both readings. */
  othersRel: number;
}

/** An anonymous Observer's own ranked reading, for the drill-down. */
export interface ObserverProfile {
  /** Stable anonymous label, e.g. "Observer 2". */
  label: string;
  /** This Observer's tribes ranked highest-first (relative to their own top). */
  bars: RankedTribe[];
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function ComparisonReport({
  rows,
  observerCount,
  observers,
}: {
  rows: ComparisonRow[];
  observerCount: number;
  observers: ObserverProfile[];
}) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        You, and how {observerCount} others see you
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your own reading is on the left of each tribe; the anonymous
        equal-weight average of your {observerCount} Observers is on the right.
        Where the two bars match, you and the people around you agree — where
        they part is where the most useful insight tends to live.
      </p>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink/45" />
          Others
        </span>
      </div>

      {/* Side-by-side bars, all twelve tribes on a shared scale. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-6">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const gap = row.self - row.others;
            const divergence = describeDivergence(gap);
            return (
              <li key={row.slug}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[17px] leading-none text-ink">
                    {row.name}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
                    {divergence}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <Bar
                    relative={row.selfRel}
                    score={row.self}
                    color={accent}
                    label={`You see ${row.name} at ${pct(row.self)}`}
                    who="You"
                  />
                  <Bar
                    relative={row.othersRel}
                    score={row.others}
                    color="var(--ink)"
                    muted
                    label={`Others see ${row.name} at ${pct(row.others)}`}
                    who="Others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each Observer&rsquo;s own reading, kept anonymous. No names, no
          relationships — just the spread of how {observerCount} people who know
          you answered.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {observers.map((observer) => (
            <li key={observer.label}>
              <details className="group rounded-[2px] border border-hair bg-white/50">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] text-ink [&::-webkit-details-marker]:hidden">
                  <span className="uppercase tracking-[0.12em] text-[12px] text-muted">
                    {observer.label}
                  </span>
                  <span className="text-[12px] text-faint transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <div className="border-t border-hair px-4 py-4">
                  <ul className="flex flex-col gap-2.5">
                    {observer.bars.slice(0, 5).map((bar) => {
                      const tribe = getTribeBySlug(bar.slug);
                      const accent = accentHex(tribe?.color ?? "");
                      return (
                        <li
                          key={bar.slug}
                          className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                        >
                          <span className="font-serif text-[15px] leading-none text-ink">
                            {bar.name}
                          </span>
                          <Bar
                            relative={bar.relative}
                            score={bar.score}
                            color={accent}
                            label={`${observer.label} · ${bar.name}: ${pct(bar.relative)} of their top`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Actions. */}
      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <a
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </a>
      </div>
    </div>
  );
}

function Bar({
  relative,
  score,
  color,
  muted = false,
  label,
  who,
}: {
  relative: number;
  score: number;
  color: string;
  muted?: boolean;
  label: string;
  who?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {who && (
        <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
          {who}
        </span>
      )}
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: muted ? 0.45 : 0.9,
          }}
        />
      </div>
      <span className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-faint">
        {pct(score)}
      </span>
    </div>
  );
}

/**
 * A short, human label for how far a tribe's self reading sits from the others
 * reading. The threshold keeps small, noisy gaps from being called out.
 */
function describeDivergence(gap: number): string {
  const magnitude = Math.abs(gap);
  if (magnitude < 0.08) return "Aligned";
  return gap > 0 ? "You see it more" : "Others see it more";
}
