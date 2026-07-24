import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregate";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * A self↔others gap smaller than this (on the normalized 0–1 scale) is treated
 * as agreement — too slight to surface as a divergence worth the Subject's
 * attention.
 */
const DIVERGENCE_THRESHOLD = 0.01;

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile aggregated from anonymous Observer
 * responses, with the sharpest alignments and divergences called out and an
 * anonymous per-Observer drill-down.
 *
 * A server component: it imports the scoring core and the aggregation module,
 * both `server-only`, so the word→tribe mapping never reaches the client
 * (ADR-0009). The caller is responsible for the ≥3 unlock gate — this view
 * assumes it is only rendered once the report is unlocked.
 */
export function ComparisonReport({
  selfWords,
  observerWords,
}: {
  selfWords: string[];
  observerWords: string[][];
}) {
  const self = score(selfWords);
  const { observerCount, others, perObserver } = aggregateObservers(observerWords);

  // Both profiles are on the same normalized 0–1 scale, so a single shared scale
  // keeps the self and others bars directly comparable.
  const scaleMax = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    // Guard against an all-zero degenerate case so we never divide by zero.
    Number.EPSILON,
  );

  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // Rank the rows by the Subject's own profile so the report reads from their
  // strongest tribe down — the order they already know from their result.
  const rows = [...self]
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const otherScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: s.score,
        others: otherScore,
        gap: otherScore - s.score,
      };
    });

  // The sharpest divergences — where the "others" view most disagrees with the
  // self view, in either direction. This gap is where the 360's value lives.
  const divergences = [...rows]
    .filter((r) => Math.abs(r.gap) > DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Below is your own profile beside the combined read from{" "}
        <span className="text-ink">{observerCount}</span> people, each weighted
        equally. The places the two disagree are where the most useful insight
        tends to live.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-ink/50 bg-ink/25" />
          Others
        </span>
      </div>

      {/* Divergences — the headline of the report. */}
      {divergences.length > 0 && (
        <section className="mt-10 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others diverge most
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {divergences.map((row) => {
              const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
              const othersHigher = row.gap > 0;
              return (
                <li key={row.slug} className="flex items-baseline gap-3">
                  <span
                    className="font-serif text-[18px]"
                    style={{ color: accent }}
                  >
                    {row.name}
                  </span>
                  <span className="text-[14px] text-muted">
                    {othersHigher
                      ? "others see this in you more than you do"
                      : "you claim this more than others see it"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          All twelve, side by side
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[16px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`${row.name}, you`}
                    fraction={row.self / scaleMax}
                    hasScore={row.self > 0}
                    color={accent}
                    variant="self"
                  />
                  <CompareBar
                    label={`${row.name}, others`}
                    fraction={row.others / scaleMax}
                    hasScore={row.others > 0}
                    color={accent}
                    variant="others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The spread of opinion, one column per person. No names, no
          relationships — just each read&rsquo;s top tribes.
        </p>
        <ol className="mt-6 flex flex-col gap-5">
          {perObserver.map((profile, index) => (
            <li key={index} className="border-l-2 border-hair pl-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {index + 1}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {topTribes(profile).map((t) => {
                  const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
                  return (
                    <li
                      key={t.slug}
                      className="rounded-[2px] border px-3 py-1 text-[13px]"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {t.name}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * A single comparison bar. `self` renders solid; `others` renders as a lighter
 * outlined fill — so the two lines for a tribe are distinguishable without
 * relying on color alone. A tribe that scored keeps a sliver of width even when
 * tiny, so a real-but-small score never reads as zero.
 */
function CompareBar({
  label,
  fraction,
  hasScore,
  color,
  variant,
}: {
  label: string;
  fraction: number;
  hasScore: boolean;
  color: string;
  variant: "self" | "others";
}) {
  const width = hasScore ? Math.max(fraction * 100, 3) : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${width}%`,
          backgroundColor: variant === "self" ? color : `${color}40`,
          border: variant === "others" ? `1px solid ${color}` : undefined,
        }}
      />
    </div>
  );
}

/** An observer's most-expressed tribes, for the anonymous drill-down. */
function topTribes(profile: TribeScore[]): TribeScore[] {
  const ranked = [...profile]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, 3);
}
