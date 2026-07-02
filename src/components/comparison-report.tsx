import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Self
 * Assessment profile shown alongside the equal-weight aggregated "others"
 * profile, with the largest agreements and divergences called out, and an
 * anonymous per-Observer drill-down (Observer 1/2/3).
 *
 * Server component: it imports the scoring core (`server-only`), so the
 * word→tribe mapping never reaches the client (ADR-0009). Render only from a
 * server component. The caller is responsible for the unlock gate (≥3
 * Observers); this component assumes it has enough responses to show.
 */

/** A tribe with the Subject's own score and the aggregated "others" score. */
interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self, in normalized units (positive ⇒ others see it more). */
  delta: number;
}

/**
 * A divergence is "notable" when the gap between the two reads is at least this
 * fraction of the larger of the two profiles' peak scores — enough to be worth
 * pointing at rather than chart noise.
 */
const NOTABLE_DELTA = 0.15;

export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const selfScores = score(selfWords);
  const others = aggregateObservers(observerResponses);

  const selfBySlug = new Map(selfScores.map((s) => [s.slug, s.score]));
  const rows: ComparisonRow[] = others.scores.map((o) => {
    const self = selfBySlug.get(o.slug) ?? 0;
    return { slug: o.slug, name: o.name, self, others: o.score, delta: o.score - self };
  });

  // A shared scale so the "You" and "Others" bars are directly comparable.
  const scaleMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    Number.EPSILON,
  );

  // Ranked by the Subject's own profile, so their result leads and the "others"
  // read is shown against it.
  const ranked = [...rows].sort((a, b) => b.self - a.self);

  const divergences = [...rows]
    .filter((r) => Math.abs(r.delta) >= NOTABLE_DELTA * scaleMax)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.03]">
        You vs. the room
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        How you described yourself, next to how{" "}
        <span className="text-ink">{others.observerCount}</span> people who know
        you described you — each counted equally, no matter how many words they
        picked. The gaps are where the most useful insight lives.
      </p>

      <ComparisonLegend />

      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Side by side
        </p>
        <ul className="mt-6 flex flex-col gap-6">
          {ranked.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li key={row.slug} className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <SeriesBar
                    label="You"
                    value={row.self}
                    scaleMax={scaleMax}
                    color="var(--ink)"
                  />
                  <SeriesBar
                    label="Others"
                    value={row.others}
                    scaleMax={scaleMax}
                    color="var(--gold)"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you and the room diverge
        </p>
        {divergences.length === 0 ? (
          <p className="mt-4 max-w-[520px] text-[15px] text-muted">
            No large gaps — how you see yourself and how others see you line up
            closely across the twelve tribes.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
              const othersSeeMore = row.delta > 0;
              return (
                <li key={row.slug} className="flex items-baseline gap-3 text-[15px]">
                  <span
                    className="font-serif text-[17px]"
                    style={{ color: accent }}
                  >
                    {row.name}
                  </span>
                  <span className="text-muted">
                    {othersSeeMore
                      ? "others see this in you more than you do"
                      : "you claim this more than others see it"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PerObserverDrilldown perObserver={others.perObserver} />

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

function ComparisonLegend() {
  return (
    <div className="mt-6 flex flex-wrap gap-5 text-[12px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: "var(--ink)" }} />
        You
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: "var(--gold)" }} />
        Others
      </span>
    </div>
  );
}

function SeriesBar({
  label,
  value,
  scaleMax,
  color,
}: {
  label: string;
  value: number;
  scaleMax: number;
  color: string;
}) {
  const fraction = scaleMax > 0 ? value / scaleMax : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the peak score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Anonymous per-Observer drill-down. Each Observer is shown only as "Observer N"
 * with their top few tribes — no name, no relationship, nothing that could
 * identify them (ADR-0003). The index is presentation order, not identity.
 */
function PerObserverDrilldown({ perObserver }: { perObserver: TribeScore[][] }) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Observer by observer
      </p>
      <p className="mt-2 max-w-[520px] text-[14px] text-muted">
        Each response, anonymously. You can see the spread of opinion without
        knowing who said what.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {perObserver.map((observer, i) => {
          const top = [...observer]
            .sort((a, b) => b.score - a.score)
            .filter((t) => t.score > 0)
            .slice(0, 3);
          return (
            <details
              key={i}
              className="rounded-[2px] border border-hair px-5 py-4 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-3 text-[15px]">
                <span className="font-serif text-[17px]">Observer {i + 1}</span>
                <span className="text-[13px] text-muted">
                  {top.length > 0
                    ? `Leads with ${top[0].name}`
                    : "No strong lead"}
                </span>
              </summary>
              <ul className="mt-4 flex flex-wrap gap-2.5">
                {top.length === 0 ? (
                  <li className="text-[14px] text-muted">No tribes scored.</li>
                ) : (
                  top.map((t) => {
                    const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
                    return (
                      <li
                        key={t.slug}
                        className="rounded-[2px] border px-3.5 py-1.5 text-[14px]"
                        style={{ borderColor: accent, color: "var(--ink)" }}
                      >
                        {t.name}
                      </li>
                    );
                  })
                )}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
