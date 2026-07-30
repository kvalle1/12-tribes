import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  compareSelfToOthers,
  summarizeComparison,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * beside the equal-weight "others" profile, with alignment/divergence called out
 * and an anonymous per-observer drill-down.
 *
 * Server component: it recomputes the Subject's scores and aggregates the
 * Observer responses through the `server-only` scoring/aggregation cores, so the
 * word→tribe mapping never reaches the client (ADR-0009). It is rendered only
 * after the caller has confirmed the report is unlocked (≥3 responses); it
 * assumes the responses it is handed are the unlocked set.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const selfScores = score(selfWords);
  const { others, perObserver, observerCount } =
    aggregateObservers(observerResponses);

  const rows = compareSelfToOthers(selfScores, others);
  const summary = summarizeComparison(rows);

  // Order by how prominent a tribe is to either side, so the tribes that carry
  // the comparison rise to the top. Both series share one scale (the single
  // largest bar in the chart) so self and others are directly comparable.
  const displayRows = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
  const maxScore = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  const othersSeeMore = summary.largestDivergence.divergence > 0;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        The equal-weight read from{" "}
        <span className="text-ink">{observerCount}</span> anonymous observers,
        set beside your own. Each observer counts once, no matter how many words
        they picked.
      </p>

      {/* Headline: agreement + the single biggest gap. */}
      <section className="mt-10 flex flex-col gap-3 border-t border-hair pt-8">
        {summary.aligned ? (
          <p className="font-serif text-[19px] leading-snug text-ink">
            You and your observers both lead with{" "}
            <TribeName slug={summary.topSelf.slug} />.
          </p>
        ) : (
          <p className="font-serif text-[19px] leading-snug text-ink">
            You lead with <TribeName slug={summary.topSelf.slug} />; your
            observers lead with <TribeName slug={summary.topOthers.slug} />.
          </p>
        )}
        <p className="text-[15px] text-muted">
          The widest gap is <TribeName slug={summary.largestDivergence.slug} /> —
          others see it{" "}
          <span className="text-ink">{othersSeeMore ? "more" : "less"}</span>{" "}
          than you do.
        </p>
      </section>

      {/* Legend for the two series. */}
      <div className="mt-10 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Self vs others, tribe by tribe, on a shared scale. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
          {displayRows.map((row) => {
            const isDivergent = row.slug === summary.largestDivergence.slug;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{
                    color: isDivergent ? accentHex(tribeColor(row.slug)) : undefined,
                  }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`${row.name}, you`}
                    fraction={maxScore > 0 ? row.self / maxScore : 0}
                    hasScore={row.self > 0}
                    className="bg-ink"
                  />
                  <CompareBar
                    label={`${row.name}, others`}
                    fraction={maxScore > 0 ? row.others / maxScore : 0}
                    hasScore={row.others > 0}
                    className="bg-gold"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down: the spread of opinion, no identities. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — the order carries no
          meaning beyond keeping the labels stable.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((observerScores, index) => {
            const top = rankScores(observerScores)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={index}
                className="rounded-[2px] border border-hair"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] text-ink">
                    <span>Observer {index + 1}</span>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-faint transition-colors group-hover:text-ink">
                      {top.length > 0 ? top[0].name : "No clear read"}
                    </span>
                  </summary>
                  <div className="border-t border-hair px-4 py-3">
                    {top.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {top.map((t) => (
                          <li
                            key={t.slug}
                            className="rounded-[2px] border border-gold/40 bg-gold/10 px-3 py-1 text-[13px] text-ink"
                          >
                            {t.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-muted">
                        This observer&rsquo;s words didn&rsquo;t point to any
                        tribe.
                      </p>
                    )}
                  </div>
                </details>
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

/** A single scaled bar in the self/others comparison, with an accessible label. */
function CompareBar({
  label,
  fraction,
  hasScore,
  className,
}: {
  label: string;
  fraction: number;
  hasScore: boolean;
  className: string;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${className}`}
        style={{ width: `${Math.max(fraction * 100, hasScore ? 3 : 0)}%` }}
      />
    </div>
  );
}

/** The tribe's display name, colored by its accent — for inline callouts. */
function TribeName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  const name = tribe?.name ?? slug;
  return (
    <span
      className="font-semibold"
      style={{ color: accentHex(tribe?.color ?? "") }}
    >
      {name}
    </span>
  );
}

function tribeColor(slug: string): string {
  return getTribeBySlug(slug)?.color ?? "";
}
