import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, deriveResult } from "@/lib/assessment/score";
import { aggregateObservers, scoreObservers } from "@/lib/observer/aggregate";
import {
  compareProfiles,
  comparisonScale,
  type ComparisonRow,
} from "@/lib/observer/compare";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Self profile
 * beside the equal-weight "others" profile aggregated from their anonymous
 * Observers, with the tribes where the two most align and most diverge called
 * out, plus an anonymous per-Observer drill-down.
 *
 * A server component: it reaches the `server-only` scoring core and aggregation
 * (the word→tribe mapping never crosses to the client, ADR-0009). The caller
 * gates on `isReportUnlocked` before rendering this — by the time we're here at
 * least three Observers have responded, so the average is meaningful and no
 * single Observer is identifiable.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const self = score(selfWords);
  const others = aggregateObservers(observerResponses);
  const rows = compareProfiles(self, others);
  const scale = comparisonScale(rows);

  // Highlights, drawn only from tribes either side actually surfaced.
  const scored = rows.filter((r) => r.selfScore > 0 || r.othersScore > 0);
  const blindSpot = maxBy(scored, (r) => r.gap); // others see it more than you
  const overclaim = maxBy(scored, (r) => -r.gap); // you claim it more than they do
  const aligned = maxBy(
    scored,
    (r) => Math.min(r.selfScore, r.othersScore) - Math.abs(r.gap),
  );

  const perObserver = scoreObservers(observerResponses);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {observerResponses.length} observers
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own words, beside the equal-weight average of everyone who described
        you. Each observer counts once, so no one who picked more words carries
        more weight. The gap is where growth lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Self vs others, tribe by tribe, on one shared scale. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => (
            <CompareBars key={row.slug} row={row} scale={scale} />
          ))}
        </ul>
      </section>

      {/* Where you align and where you diverge. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Alignment &amp; divergence
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Highlight
            label="You agree on"
            row={aligned}
            caption="You and your observers see this trait in you about equally."
          />
          <Highlight
            label="Others see more"
            row={blindSpot}
            caption="Your observers read this in you more than you claim it yourself."
            onlyWhenGap="positive"
          />
          <Highlight
            label="You see more"
            row={overclaim}
            caption="You claim this more than your observers see it in you."
            onlyWhenGap="negative"
          />
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — no names, no order you
          can trace back to anyone.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {perObserver.map((scores, i) => {
            const { primary, secondary } = deriveResult(scores);
            return (
              <li
                key={i}
                className="rounded-[2px] border border-hair px-4 py-3.5"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {i + 1}
                </p>
                <p className="mt-1.5 text-[15px] text-ink">
                  Sees you as{" "}
                  <TribeName slug={primary.slug} />
                  {secondary && (
                    <>
                      {" "}
                      &amp; <TribeName slug={secondary.slug} />
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
      </div>
    </div>
  );
}

/** A single tribe row: paired You / Others bars on the shared scale. */
function CompareBars({ row, scale }: { row: ComparisonRow; scale: number }) {
  const tribe = getTribeBySlug(row.slug);
  const selfPct = barWidth(row.selfScore, scale);
  const othersPct = barWidth(row.othersScore, scale);
  const gapPct = Math.round((row.othersScore - row.selfScore) * 100);

  return (
    <li className="grid grid-cols-[110px_1fr] items-center gap-4 max-[520px]:grid-cols-[84px_1fr]">
      <span className="font-serif text-[16px] leading-tight">
        {tribe?.name ?? row.slug}
      </span>
      <div className="flex flex-col gap-1.5">
        <Bar
          pct={selfPct}
          fillClass="bg-ink"
          label={`You: ${Math.round(row.selfScore * 100)}`}
        />
        <div className="flex items-center gap-3">
          <Bar
            pct={othersPct}
            fillClass="bg-gold"
            label={`Others: ${Math.round(row.othersScore * 100)}`}
          />
          {gapPct !== 0 && (
            <span
              className="w-[52px] shrink-0 text-right text-[11px] tabular-nums text-faint"
              aria-hidden
            >
              {gapPct > 0 ? `+${gapPct}` : gapPct}
            </span>
          )}
          {gapPct === 0 && <span className="w-[52px] shrink-0" aria-hidden />}
        </div>
      </div>
    </li>
  );
}

function Bar({
  pct,
  fillClass,
  label,
}: {
  pct: number;
  fillClass: string;
  label: string;
}) {
  return (
    <div
      className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] ${fillClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Highlight({
  label,
  row,
  caption,
  onlyWhenGap,
}: {
  label: string;
  row: ComparisonRow | null;
  caption: string;
  onlyWhenGap?: "positive" | "negative";
}) {
  const meaningful =
    row &&
    (onlyWhenGap === "positive"
      ? row.gap > 0.001
      : onlyWhenGap === "negative"
        ? row.gap < -0.001
        : true);
  const tribe = meaningful ? getTribeBySlug(row.slug) : undefined;

  return (
    <div className="rounded-[2px] border border-hair px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </p>
      {tribe ? (
        <>
          <p
            className="mt-2 font-serif text-[22px] font-semibold"
            style={{ color: accentHex(tribe.color) }}
          >
            {tribe.name}
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-muted">{caption}</p>
        </>
      ) : (
        <p className="mt-2 text-[14px] text-faint">Nothing stands out here yet.</p>
      )}
    </div>
  );
}

function TribeName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  if (!tribe) return <span>{slug}</span>;
  return <span style={{ color: accentHex(tribe.color) }}>{tribe.name}</span>;
}

/** Bar fill percent on the shared scale, floored so a small nonzero score shows. */
function barWidth(value: number, scale: number): number {
  if (scale <= 0) return 0;
  const pct = (value / scale) * 100;
  return value > 0 ? Math.max(pct, 3) : 0;
}

/** The element maximizing `rank`, or null for an empty list. Ties keep first seen. */
function maxBy<T>(items: readonly T[], rank: (item: T) => number): T | null {
  let best: T | null = null;
  let bestRank = -Infinity;
  for (const item of items) {
    const r = rank(item);
    if (r > bestRank) {
      best = item;
      bestRank = r;
    }
  }
  return best;
}
