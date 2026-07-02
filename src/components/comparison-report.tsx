import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/assessment/aggregate-observers";

/**
 * The 360 comparison report (issue #9): the Subject's own profile alongside the
 * equal-weight "others" profile aggregated from anonymous Observer responses,
 * with the tribes where the two views most diverge called out, and an anonymous
 * per-Observer drill-down.
 *
 * Server component: it imports the scoring core and observer aggregation, both
 * `server-only`, so the word→tribe mapping never reaches the client (ADR-0009).
 * The caller (the report page) is responsible for the ≥3-Observer unlock gate;
 * this view assumes it is only rendered once the report is unlocked.
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

  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // One row per tribe, carrying both views and their signed gap (self − others:
  // positive means the Subject sees more of this tribe in themselves than
  // Observers do). Rows lead with the tribes that score highest across either
  // view so the strongest signal is at the top.
  const rows = self
    .map((s) => {
      const selfScore = s.score;
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: selfScore,
        others: othersScore,
        gap: selfScore - othersScore,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  // Shared scale across both profiles so the two bars in a row — and every row —
  // are directly comparable.
  const scaleMax = Math.max(...rows.map((r) => Math.max(r.self, r.others)), 0);

  // The sharpest divergences, largest gap first, ignoring rounding-level noise.
  const divergences = [...rows]
    .filter((r) => Math.abs(r.gap) >= 0.05)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own profile beside the combined read from{" "}
        {observerResponses.length} people who described you. Each observer counts
        equally, so no one voice dominates. The gap between the two views is
        where the most useful insight tends to live.
      </p>

      {/* Legend for the two series drawn in every comparison row. */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Side-by-side bars, self vs aggregated others, for all twelve tribes. */}
      <section className="mt-6 border-t border-hair pt-8">
        <ul className="flex flex-col gap-6">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[17px] leading-tight">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <Bar
                  label="You"
                  fraction={scaleMax > 0 ? row.self / scaleMax : 0}
                  hasScore={row.self > 0}
                  className="bg-ink"
                  ariaLabel={`You: ${row.name}`}
                />
                <Bar
                  label="Others"
                  fraction={scaleMax > 0 ? row.others / scaleMax : 0}
                  hasScore={row.others > 0}
                  className="bg-gold"
                  ariaLabel={`Others: ${row.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Where the two views diverge — the actionable heart of the 360. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const youHigher = row.gap > 0;
              return (
                <li
                  key={row.slug}
                  className="flex items-start gap-3 text-[15px] leading-relaxed text-ink"
                >
                  <span
                    className="mt-[7px] inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <span>
                    <span className="font-serif text-[17px]">{row.name}</span>
                    {" — "}
                    {youHigher
                      ? "you see this in yourself more than others do."
                      : "others see this in you more than you do."}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down (Observer 1 / 2 / 3, no attributes). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s individual read, fully anonymous. The spread
          shows how much the people around you agree.
        </p>
        <ul className="mt-6 flex flex-col gap-7">
          {observerResponses.map((words, index) => {
            const ranked = rankScores(score(words)).filter((r) => r.score > 0);
            const top = ranked.slice(0, 3);
            return (
              <li key={index}>
                <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {top.map((r) => {
                    const tribe = getTribeBySlug(r.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li
                        key={r.slug}
                        className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                      >
                        <span className="font-serif text-[15px]">{r.name}</span>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-hair/50"
                          role="img"
                          aria-label={`Observer ${index + 1} · ${r.name}: ${Math.round(r.relative * 100)}% of their top tribe`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(r.relative * 100, 3)}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
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

/**
 * A single labelled comparison bar. `hasScore` keeps a zero-score tribe visually
 * empty (no stub fill) while a small floor keeps tiny non-zero scores visible.
 */
function Bar({
  label,
  fraction,
  hasScore,
  className,
  ariaLabel,
}: {
  label: string;
  fraction: number;
  hasScore: boolean;
  className: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${ariaLabel}: ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className={`h-full rounded-full transition-[width] ${className}`}
          style={{ width: `${hasScore ? Math.max(fraction * 100, 3) : 0}%` }}
        />
      </div>
    </div>
  );
}
