import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import { score } from "@/lib/assessment/score";
import type { AggregatedObservers } from "@/lib/assessment/aggregate-observers";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9): the Subject's own profile shown beside
 * the equal-weight "others" profile, with the gaps called out and an anonymous
 * per-observer drill-down.
 *
 * It recomputes the self profile from the stored `words` via the pure scoring
 * core (so it can never drift from the saved selection) and takes the already
 * equal-weight-aggregated "others" profile from `aggregateObservers`. A server
 * component: it imports the `server-only` scoring core, so the word→tribe
 * mapping never reaches the client (ADR-0009). Render only from server
 * components — the page gates it behind the ≥3-observer unlock.
 */

/** How many tribes each anonymous per-observer drill-down lists. */
const DRILLDOWN_ROWS = 6;
/** A gap this small or smaller counts as agreement rather than divergence. */
const GAP_EPSILON = 0.02;

const bySlug = (scores: readonly TribeScore[]) =>
  new Map(scores.map((s) => [s.slug, s.score]));

export function ComparisonReport({
  selfWords,
  primarySlug,
  secondarySlug,
  aggregate,
}: {
  selfWords: string[];
  primarySlug: string;
  secondarySlug?: string | null;
  aggregate: AggregatedObservers;
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregate.others;

  const selfBySlug = bySlug(selfScores);
  const othersBySlug = bySlug(othersScores);

  // Order the comparison by the Subject's own ranking, so it reads top-down as
  // "your tribes" with the observers' read set against each. Both profiles are
  // on the same normalized 0–1 scale, so a bar's width is its score directly —
  // the width and the percent beside it always agree.
  const selfRanked = rankScores(selfScores);

  // Divergences: where self and others disagree most, phrased by direction.
  const gaps = selfScores
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      gap: s.score - (othersBySlug.get(s.slug) ?? 0),
    }))
    .filter((g) => Math.abs(g.gap) > GAP_EPSILON)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  const topDivergences = gaps.slice(0, 2);

  // Agreement: among tribes either side rates as present, the smallest gap.
  const agreement = selfScores
    .map((s) => ({
      name: s.name,
      max: Math.max(s.score, othersBySlug.get(s.slug) ?? 0),
      gap: Math.abs(s.score - (othersBySlug.get(s.slug) ?? 0)),
    }))
    .filter((a) => a.max > 0)
    .sort((a, b) => a.gap - b.gap)[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        A 360 read · {aggregate.observerCount}{" "}
        {aggregate.observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile is set against the equal-weight average of everyone who
        answered — each observer counts once, however many words they picked. The
        gap between the two is where the most useful insight lives.
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

      {/* Self vs others, tribe by tribe, ordered by the Subject's own ranking. */}
      <section className="mt-6 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {selfRanked.map((row) => {
            const selfScore = selfBySlug.get(row.slug) ?? 0;
            const othersScore = othersBySlug.get(row.slug) ?? 0;
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const role =
              row.slug === primarySlug
                ? "Primary"
                : row.slug === secondarySlug
                  ? "Secondary"
                  : null;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: role ? accent : undefined }}
                  >
                    {row.name}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`You: ${pct(selfScore)}`}
                    value={selfScore}
                    className="bg-ink"
                  />
                  <CompareBar
                    label={`Others: ${pct(othersScore)}`}
                    value={othersScore}
                    className="bg-gold"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The gap — alignment and divergence, in plain language. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The gap
        </p>
        <ul className="mt-5 flex flex-col gap-3 text-[15px] text-ink">
          {agreement && (
            <li>
              You and your observers most agree on{" "}
              <strong className="font-semibold">{agreement.name}</strong>.
            </li>
          )}
          {topDivergences.length === 0 && (
            <li className="text-muted">
              Your read and theirs line up closely across the board.
            </li>
          )}
          {topDivergences.map((g) => (
            <li key={g.slug}>
              {g.gap > 0 ? (
                <>
                  You see more{" "}
                  <strong className="font-semibold">{g.name}</strong> in yourself
                  than others do.
                </>
              ) : (
                <>
                  Others see more{" "}
                  <strong className="font-semibold">{g.name}</strong> in you than
                  you see in yourself.
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. No identity — just Observer 1/2/3… */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every response is anonymous. Open one to see the spread of opinion
          without knowing who said what.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          {aggregate.perObserver.map((profile, index) => (
            <ObserverDrilldown
              key={index}
              label={`Observer ${index + 1}`}
              profile={profile}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function CompareBar({
  label,
  value,
  className,
}: {
  label: string;
  /** Normalized 0–1 score; the bar width is this value, so width matches the label. */
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-[width] ${className}`}
          style={{ width: `${Math.max(Math.min(value, 1) * 100, value > 0 ? 3 : 0)}%` }}
        />
      </div>
      <span className="w-[78px] shrink-0 text-right text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  );
}

function ObserverDrilldown({
  label,
  profile,
}: {
  label: string;
  profile: TribeScore[];
}) {
  const ranked = rankScores(profile).slice(0, DRILLDOWN_ROWS);
  return (
    <details className="rounded-[2px] border border-hair px-4 py-3">
      <summary className="cursor-pointer list-none text-[14px] tracking-[0.04em] text-ink marker:content-none">
        <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
          {label}
        </span>
      </summary>
      <ul className="mt-4 flex flex-col gap-2.5">
        {ranked.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
            >
              <span className="font-serif text-[15px] leading-none">
                {row.name}
              </span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top score`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(row.relative * 100, row.score > 0 ? 3 : 0)}%`,
                    backgroundColor: accent,
                    opacity: 0.7,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
