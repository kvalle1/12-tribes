import Link from "next/link";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { compareProfiles } from "@/lib/observer/compare";

/**
 * The self-vs-others comparison report that closes the 360 loop (issue #9,
 * ADR-0003). It places the Subject's own profile beside the equal-weight
 * "others" profile aggregated from anonymous Observer responses, calls out where
 * the two align and where they diverge (the gap is where the useful insight
 * lives), and offers an anonymous per-observer drill-down.
 *
 * A server component: it imports the scoring core and the observer aggregation,
 * both `server-only`, so the word→tribe mapping never reaches the client. It is
 * rendered only once the report has unlocked (≥3 observers); the locked state is
 * handled by the page. `selfWords` is the Subject's saved selection and
 * `observerResponses` the raw word arrays for each anonymous Observer.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const agg = aggregateObservers(observerResponses);
  const rows = compareProfiles(score(selfWords), agg.others);

  // Divergence: where others read a tribe more strongly than the Subject does
  // (largest positive gap) and where the Subject reads it more strongly than
  // others do (largest negative gap). Only surface a gap that is actually
  // meaningful, so a near-perfect match doesn't get dressed up as a "divergence".
  const GAP_THRESHOLD = 0.12;
  const byGap = [...rows].sort((a, b) => b.gap - a.gap);
  const othersSeeMore = byGap[0];
  const youSeeMore = byGap[byGap.length - 1];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your own profile beside the combined read of{" "}
        <span className="text-ink">{agg.observerCount}</span>{" "}
        {agg.observerCount === 1 ? "observer" : "observers"}. Each observer counts
        equally, however many words they picked — so this is genuinely the group,
        not the wordiest voice among them.
      </p>

      {/* Legend for the two series drawn on every tribe row. */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" aria-hidden />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-gold" aria-hidden />
          Others
        </span>
      </div>

      {/* Side-by-side bars — every tribe, self over others, ranked by combined prominence. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <Link
                href={`/tribes/${row.slug}`}
                className="font-serif text-[17px] leading-none transition-colors hover:text-gold"
              >
                {row.name}
              </Link>
              <div className="flex flex-col gap-1.5">
                <Bar
                  fraction={row.selfRelative}
                  score={row.self}
                  colorClass="bg-ink"
                  label={`You see ${row.name}`}
                />
                <Bar
                  fraction={row.othersRelative}
                  score={row.others}
                  colorClass="bg-gold"
                  label={`Others see ${row.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Where the two views agree and where they part — the useful signal. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you align &amp; diverge
        </p>
        <ul className="mt-5 flex flex-col gap-4 text-[15px] text-muted">
          {othersSeeMore && othersSeeMore.gap >= GAP_THRESHOLD && (
            <li>
              Others see <Emph>{othersSeeMore.name}</Emph> in you more strongly
              than you do — a strength worth noticing.
            </li>
          )}
          {youSeeMore && youSeeMore.gap <= -GAP_THRESHOLD && (
            <li>
              You read <Emph>{youSeeMore.name}</Emph> in yourself more strongly
              than others do — a place your self-image runs ahead of how you land.
            </li>
          )}
          {(!othersSeeMore || othersSeeMore.gap < GAP_THRESHOLD) &&
            (!youSeeMore || youSeeMore.gap > -GAP_THRESHOLD) && (
              <li>
                Your self-read and the group&rsquo;s read line up closely across
                the twelve — there&rsquo;s no large gap between how you see
                yourself and how others see you.
              </li>
            )}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — the spread of opinion, no identities. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The individual reads
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own top tribes, shown anonymously — no names, no
          relationships, just the spread of how people read you.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {agg.perObserver.map((observerScores, index) => {
            const top = rankScores(observerScores)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={index}
                className="rounded-[2px] border border-hair p-4"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {top.map((tribe) => (
                    <li
                      key={tribe.slug}
                      className="flex items-center justify-between gap-3 text-[14px]"
                    >
                      <span className="font-serif text-[16px]">{tribe.name}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-hair/60">
                        <span
                          className="block h-full rounded-full bg-gold"
                          style={{ width: `${Math.max(tribe.relative * 100, 4)}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * One comparison bar. `fraction` is the bar-fill relative to the largest score
 * across both profiles; `score` is the raw normalized value, exposed only to the
 * accessible label as a percentage of tribe fit.
 */
function Bar({
  fraction,
  score,
  colorClass,
  label,
}: {
  fraction: number;
  score: number;
  colorClass: string;
  label: string;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(score * 100)}% fit`}
    >
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${Math.max(fraction * 100, score > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function Emph({ children }: { children: React.ReactNode }) {
  return <span className="font-serif text-[17px] text-ink">{children}</span>;
}
