import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  scoreEachObserver,
} from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile shown beside the equal-weight "others" profile aggregated from their
 * anonymous Observers, plus a divergence callout and an anonymous per-observer
 * drill-down.
 *
 * This is a server component — it imports the `server-only` scoring core and the
 * equal-weight aggregation, so the word→tribe mapping never reaches the client
 * (ADR-0009). Render it only from a server component. It expects the caller to
 * have already gated on `isReportUnlocked` (the page renders the locked state
 * itself); here it assumes at least the minimum number of Observers responded.
 *
 * `observerResponses` must be in a stable order (oldest-first) so the "Observer
 * N" labels stay consistent across loads. Every response is anonymous — only the
 * words are passed in, never who submitted them.
 */
export function ComparisonReport({
  words,
  observerResponses,
}: {
  words: string[];
  observerResponses: string[][];
}) {
  const self = score(words);
  const others = aggregateObservers(observerResponses);
  const perObserver = scoreEachObserver(observerResponses);
  const divergences = compareProfiles(self, others);

  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));
  // A shared scale across both profiles so "You" and "Others" bars are directly
  // comparable; the tallest bar in either profile fills its track.
  const max = Math.max(
    ...self.map((t) => t.score),
    ...others.map((t) => t.score),
    0.0001,
  );

  // Sort so the tribes either side reads most strongly float to the top.
  const rows = self
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      self: t.score,
      others: othersBySlug.get(t.slug) ?? 0,
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  // The widest gaps worth calling out — only tribes where at least one side
  // registers a real reading, so we don't headline a 0-vs-0 non-signal.
  const topDivergences = divergences
    .filter((d) => d.self > 0 || d.others > 0)
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own profile beside the aggregated read from{" "}
        {observerResponses.length} anonymous{" "}
        {observerResponses.length === 1 ? "observer" : "observers"}. Each observer
        counts equally, regardless of how many words they picked, so no single
        voice dominates.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink/30" />
          Others
        </span>
      </div>

      {/* Dual bars — you vs others, all twelve tribes on one shared scale. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-none">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <ProfileBar
                    label="You"
                    fraction={row.self / max}
                    hasSignal={row.self > 0}
                    accent={accent}
                    opacity={1}
                  />
                  <ProfileBar
                    label="Others"
                    fraction={row.others / max}
                    hasSignal={row.others > 0}
                    accent={accent}
                    opacity={0.4}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where you and your observers diverge most. */}
      {topDivergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {topDivergences.map((d) => (
              <li key={d.slug} className="text-[15px] leading-relaxed text-ink">
                <span className="font-serif text-[17px]">{d.name}</span>
                <span className="text-muted">
                  {" — "}
                  {d.delta > 0
                    ? "you read this in yourself more strongly than others do"
                    : d.delta < 0
                      ? "others see this in you more strongly than you do"
                      : "you and others are closely aligned here"}
                  .
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down — Observer 1/2/3, no attributes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s individual read, kept fully anonymous. Only the
          spread of opinion is shown — never who said what.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((profile, index) => {
            const top = [...profile]
              .sort((a, b) => b.score - a.score)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li key={index}>
                <details className="group rounded-[2px] border border-hair bg-white/50 px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] text-ink">
                    <span className="uppercase tracking-[0.14em] text-muted">
                      Observer {index + 1}
                    </span>
                    <span className="text-[13px] text-faint group-open:hidden">
                      {top.length > 0 ? top[0].name : "no clear read"}
                    </span>
                  </summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {top.length === 0 && (
                      <li className="text-[14px] text-faint">
                        No tribe scored for this observer.
                      </li>
                    )}
                    {top.map((t) => {
                      const tribe = getTribeBySlug(t.slug);
                      const accent = accentHex(tribe?.color ?? "");
                      const localMax = top[0].score || 1;
                      return (
                        <li
                          key={t.slug}
                          className="grid grid-cols-[100px_1fr] items-center gap-3"
                        >
                          <span className="text-[14px]">{t.name}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-hair/50">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max((t.score / localMax) * 100, 4)}%`,
                                backgroundColor: accent,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * A single labelled profile bar. Draws a hairline "empty" marker when a tribe
 * has no signal on that side, so a zero reads as an intentional zero rather than
 * a missing bar.
 */
function ProfileBar({
  label,
  fraction,
  hasSignal,
  accent,
  opacity,
}: {
  label: string;
  fraction: number;
  hasSignal: boolean;
  accent: string;
  opacity: number;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/40"
      role="img"
      aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${hasSignal ? Math.max(fraction * 100, 3) : 0}%`,
          backgroundColor: accent,
          opacity,
        }}
      />
    </div>
  );
}
