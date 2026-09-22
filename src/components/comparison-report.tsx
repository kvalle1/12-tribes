import { score, deriveResult } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  scoreEachObserver,
} from "@/lib/observer/aggregate";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { ObserverDrilldown } from "./observer-drilldown";

/**
 * The 360 comparison report (issue #9): the Subject's own Self profile beside the
 * equal-weight aggregated "others" profile, so the gap between how they see
 * themselves and how others see them is legible — that gap is where the value of
 * the 360 lives (ADR-0003). Below the side-by-side view, an anonymous
 * per-observer drill-down lets the Subject page through each individual read.
 *
 * A server component: it imports the scoring core and the aggregation, both
 * `server-only`, and hands the client drill-down only already-computed,
 * serializable scores (ADR-0009). Render only from server components, and only
 * once at least three Observers have responded (the caller gates on that).
 */
export function ComparisonReport({
  words,
  observerResponses,
}: {
  /** The Subject's own selected words (their Self result). */
  words: string[];
  /** Each Observer's selected words, oldest first. */
  observerResponses: string[][];
}) {
  const selfScores = score(words);
  const otherScores = aggregateObservers(observerResponses);
  const perObserver = scoreEachObserver(observerResponses).map(rankScores);

  const otherBySlug = new Map(otherScores.map((s) => [s.slug, s.score]));

  // A shared scale across both profiles so the two bars in a row are directly
  // comparable and divergence is visible at a glance.
  const max = Math.max(
    ...selfScores.map((s) => s.score),
    ...otherScores.map((s) => s.score),
    0,
  );

  // Rows ordered by the stronger of the two reads, so the tribes either side
  // considers prominent float to the top.
  const rows = selfScores
    .map((s) => {
      const self = s.score;
      const other = otherBySlug.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self, other, diff: other - self };
    })
    .sort((a, b) => Math.max(b.self, b.other) - Math.max(a.self, a.other));

  const selfPrimary = deriveResult(selfScores).primary;
  const othersTop = [...otherScores].sort((a, b) => b.score - a.score)[0];
  const agree = selfPrimary.slug === othersTop.slug;

  // The clearest divergences: where others read the Subject higher or lower than
  // the Subject reads themselves. A small floor keeps noise off the highlights.
  const DIVERGENCE_FLOOR = 0.05;
  const seenMore = rows
    .filter((r) => r.diff > DIVERGENCE_FLOOR)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);
  const seenLess = rows
    .filter((r) => r.diff < -DIVERGENCE_FLOOR)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);

  const fill = (v: number) => Math.max(max > 0 ? (v / max) * 100 : 0, v > 0 ? 3 : 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.08]">
        {agree ? (
          <>
            You and your {observerResponses.length} observers agree:{" "}
            <span style={{ color: accentHex(getTribeBySlug(selfPrimary.slug)?.color ?? "") }}>
              {selfPrimary.name}
            </span>
          </>
        ) : (
          <>
            You lead with{" "}
            <span style={{ color: accentHex(getTribeBySlug(selfPrimary.slug)?.color ?? "") }}>
              {selfPrimary.name}
            </span>
            ; others see{" "}
            <span style={{ color: accentHex(getTribeBySlug(othersTop.slug)?.color ?? "") }}>
              {othersTop.name}
            </span>
          </>
        )}
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Based on {observerResponses.length} anonymous observer
        {observerResponses.length === 1 ? "" : "s"}, each counted equally
        regardless of how many words they picked.
      </p>

      {/* Side-by-side profiles. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              Others
            </span>
          </div>
        </div>

        <ul className="mt-7 flex flex-col gap-5">
          {rows.map((row) => {
            const isPrimary = row.slug === selfPrimary.slug;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{
                    color: isPrimary
                      ? accentHex(getTribeBySlug(row.slug)?.color ?? "")
                      : undefined,
                  }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-hair/50"
                    role="img"
                    aria-label={`You see ${row.name} at ${Math.round((max > 0 ? row.self / max : 0) * 100)}% of your top tribe`}
                  >
                    <div
                      className="h-full rounded-full bg-ink transition-[width]"
                      style={{ width: `${fill(row.self)}%` }}
                    />
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-hair/50"
                    role="img"
                    aria-label={`Others see ${row.name} at ${Math.round((max > 0 ? row.other / max : 0) * 100)}% of the top tribe`}
                  >
                    <div
                      className="h-full rounded-full bg-gold transition-[width]"
                      style={{ width: `${fill(row.other)}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment / divergence highlights — where the gap lives. */}
      {(seenMore.length > 0 || seenLess.length > 0) && (
        <section className="mt-14 grid gap-8 border-t border-hair pt-8 sm:grid-cols-2">
          {seenMore.length > 0 && (
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
                Others see more than you do
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {seenMore.map((r) => (
                  <li key={r.slug} className="font-serif text-[18px]">
                    {r.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {seenLess.length > 0 && (
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
                You see more than others do
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {seenLess.map((r) => (
                  <li key={r.slug} className="font-serif text-[18px]">
                    {r.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Individual reads
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
          Each observer, anonymously
        </h2>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Every observer stays anonymous — reads are numbered only, in no
          particular identity order.
        </p>
        <div className="mt-6">
          <ObserverDrilldown observers={perObserver} />
        </div>
      </section>
    </div>
  );
}
