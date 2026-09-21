import type { TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { accentHex, getTribeBySlug } from "@/lib/tribes";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own tribe
 * profile shown alongside the equal-weight "others" profile, with the largest
 * gaps called out ("the gap is where growth lives") and an anonymous
 * per-observer drill-down.
 *
 * This component is presentation-only. It takes already-scored, plain-data
 * props — the `server-only` scoring core (`score`, `aggregateObservers`) runs on
 * the page and hands the results down — so the word→tribe mapping never reaches
 * the client (ADR-0009). The per-observer breakdown is deliberately anonymous:
 * observers are labelled "Observer 1/2/3…" by array position and carry no name,
 * relationship, or any other attribute.
 */
export function ComparisonReport({
  self,
  others,
  perObserver,
  observerCount,
}: {
  /** The Subject's own normalized 12-tribe scores (canonical order). */
  self: TribeScore[];
  /** The equal-weight "others" normalized 12-tribe scores (canonical order). */
  others: TribeScore[];
  /** Each observer's normalized 12-tribe vector, in order (anonymous). */
  perObserver: TribeScore[][];
  /** How many observers contributed. */
  observerCount: number;
}) {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // Draw both reads against one shared scale so the two bars are comparable.
  const sharedMax = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  // Order tribes by their combined prominence across the two reads, so the
  // tribes that matter to either the Subject or the observers surface first.
  const rows = self
    .map((s) => {
      const selfScore = s.score;
      const otherScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore,
        otherScore,
        combined: selfScore + otherScore,
        gap: otherScore - selfScore,
      };
    })
    .sort((a, b) => b.combined - a.combined);

  // The sharpest divergences: where others read you highest above your own read,
  // and where you read yourself highest above theirs. Only meaningful gaps count.
  const GAP_THRESHOLD = 0.04;
  const sortedByGap = [...rows].sort((a, b) => b.gap - a.gap);
  const seenHigher = sortedByGap[0];
  const seenLower = sortedByGap[sortedByGap.length - 1];
  const othersSeeMore =
    seenHigher && seenHigher.gap >= GAP_THRESHOLD ? seenHigher : null;
  const youSeeMore =
    seenLower && -seenLower.gap >= GAP_THRESHOLD ? seenLower : null;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own read is set beside the combined read of{" "}
        <span className="text-ink">{observerCount}</span> people who answered
        anonymously — each weighted equally, so no single voice counts for more.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-6 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug}>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px]">{row.name}</span>
                  {Math.abs(row.gap) >= GAP_THRESHOLD && (
                    <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
                      {row.gap > 0 ? "Others read higher" : "You read higher"}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    value={row.selfScore}
                    max={sharedMax}
                    solid
                  />
                  <CompareBar
                    label="Others"
                    value={row.otherScore}
                    max={sharedMax}
                    color={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge most — the growth edges. */}
      {(othersSeeMore || youSeeMore) && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where the reads differ
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {othersSeeMore && (
              <p className="text-[15px] leading-relaxed text-ink">
                Others see{" "}
                <span className="font-serif text-[17px] text-gold">
                  {othersSeeMore.name}
                </span>{" "}
                in you more than you see it in yourself — a strength worth
                trusting.
              </p>
            )}
            {youSeeMore && (
              <p className="text-[15px] leading-relaxed text-ink">
                You lean on{" "}
                <span className="font-serif text-[17px]">
                  {youSeeMore.name}
                </span>{" "}
                more than others read in you — worth noticing where it does and
                doesn&rsquo;t land.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Anonymous per-observer drill-down. Native <details> — no client JS. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads that make up the average. They&rsquo;re fully
          anonymous — there&rsquo;s no way to tell who answered which.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((vector, index) => {
            const top = rankScores(vector)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li key={index}>
                <details className="group rounded-[2px] border border-hair">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px]">
                    <span className="uppercase tracking-[0.14em] text-muted">
                      Observer {index + 1}
                    </span>
                    <span className="text-[12px] text-faint transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <div className="border-t border-hair px-4 py-4">
                    {top.length === 0 ? (
                      <p className="text-[13px] text-faint">
                        No clear tribe signal in this read.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {top.map((t) => {
                          const tribe = getTribeBySlug(t.slug);
                          const accent = accentHex(tribe?.color ?? "");
                          return (
                            <li
                              key={t.slug}
                              className="grid grid-cols-[110px_1fr] items-center gap-3"
                            >
                              <span className="font-serif text-[15px]">
                                {t.name}
                              </span>
                              <div
                                className="h-2 overflow-hidden rounded-full bg-hair/50"
                                role="img"
                                aria-label={`${t.name}: ${Math.round(t.relative * 100)}% of this observer's top read`}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(t.relative * 100, 3)}%`,
                                    backgroundColor: accent,
                                  }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
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
 * One labelled bar drawn against the report's shared scale. The "You" bar is
 * `solid` (ink); the "Others" bar takes the tribe's accent `color`.
 */
function CompareBar({
  label,
  value,
  max,
  color,
  solid = false,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  solid?: boolean;
}) {
  const fraction = max > 0 ? value / max : 0;
  const pct = Math.round(fraction * 100);
  return (
    <div className="grid grid-cols-[54px_1fr] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}% of the strongest read`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: solid ? "var(--ink)" : color,
            opacity: solid ? 0.85 : 1,
          }}
        />
      </div>
    </div>
  );
}
