import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateProfiles } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Shown to a
 * Subject once at least three Observers have responded.
 *
 * It places the Subject's own profile beside the equal-weight aggregated
 * "others" profile so alignment and divergence read at a glance, calls out the
 * tribes where the two views diverge most, and offers a fully anonymous
 * per-Observer drill-down (Observer 1 / 2 / 3 …, no identity, no attributes).
 *
 * This is a server component: it imports the scoring core and the aggregation,
 * both `server-only`, so the word→tribe mapping never reaches the client
 * (ADR-0009). The unlock gate (≥3 Observers) is enforced by the caller — this
 * view assumes it is being rendered because the report is unlocked.
 */

/** A tribe with both the Subject's and the aggregated others' normalized score. */
interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
}

/** Divergence beneath this (in normalized score) isn't worth calling out. */
const DIVERGENCE_THRESHOLD = 0.08;

export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const self = score(selfWords);
  // Score each Observer once, then reuse those profiles for both the equal-weight
  // aggregate and the per-Observer drill-down (no second scoring pass).
  const observerProfiles = observerResponses.map((words) => score(words));
  const others = aggregateProfiles(observerProfiles);
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // Merge into one row per tribe (canonical order from `self`), then order the
  // chart by the Subject's own profile so it stays anchored to how they see
  // themselves, with the others' bar drawn alongside for contrast.
  const rows: ComparisonRow[] = self
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersBySlug.get(s.slug) ?? 0,
    }))
    .sort((a, b) => b.self - a.self);

  // Both bars share one scale so their lengths are directly comparable.
  const sharedMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  const divergences = computeDivergences(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Based on {observerResponses.length} anonymous{" "}
        {observerResponses.length === 1 ? "response" : "responses"}. Each
        observer is counted equally, so no single person&rsquo;s read outweighs
        another&rsquo;s. The gap between the two bars is where the most useful
        insight lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full border border-ink/40 bg-ink/25" />
          Others
        </span>
      </div>

      {/* Paired bars — self vs others, all twelve tribes on one shared scale. */}
      <section className="mt-6 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li key={row.slug}>
                <div className="font-serif text-[16px] leading-none">
                  {row.name}
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <CompareBar
                    label={`You: ${pct(row.self)} of ${row.name}`}
                    fraction={barFraction(row.self, sharedMax)}
                    color={accent}
                    filled
                  />
                  <CompareBar
                    label={`Others: ${pct(row.others)} of ${row.name}`}
                    fraction={barFraction(row.others, sharedMax)}
                    color={accent}
                    filled={false}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two views diverge most. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and they diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((d) => (
              <li key={d.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{d.name}</span>{" "}
                <span className="text-muted">
                  {d.othersHigher
                    ? "reads stronger to others than to you"
                    : "reads stronger to you than to others"}{" "}
                  ({d.others > d.self ? "+" : "−"}
                  {pct(Math.abs(d.others - d.self))} others vs you)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down — spread of opinion, no identities. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads behind the &ldquo;others&rdquo; average. Observers
          are listed in the order they responded and carry no name or
          relationship — only the words they chose.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {observerProfiles.map((scores, i) => (
            <ObserverDrilldown key={i} index={i + 1} scores={scores} />
          ))}
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

/** One horizontal bar, filled (You) or outlined (Others), on the shared scale. */
function CompareBar({
  label,
  fraction,
  color,
  filled,
}: {
  label: string;
  fraction: number;
  color: string;
  filled: boolean;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${fraction * 100}%`,
          backgroundColor: color,
          opacity: filled ? 1 : 0.4,
        }}
      />
    </div>
  );
}

/** Collapsible, anonymous view of a single observer's ranked profile. */
function ObserverDrilldown({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const ranked = rankScores(scores);
  const top = ranked.filter((r) => r.score > 0).slice(0, 3);

  return (
    <li>
      <details className="group rounded-[2px] border border-hair">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] text-ink">
          <span className="font-serif text-[16px]">Observer {index}</span>
          <span className="text-[12px] uppercase tracking-[0.12em] text-faint">
            {top.length > 0 ? `Top: ${top[0].name}` : "No signal"}
            <span className="ml-3 inline-block transition-transform group-open:rotate-90">
              →
            </span>
          </span>
        </summary>
        <ul className="flex flex-col gap-2.5 border-t border-hair px-4 py-4">
          {ranked.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
              >
                <span className="font-serif text-[15px] leading-none">
                  {row.name}
                </span>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-hair/50"
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
    </li>
  );
}

interface Divergence extends ComparisonRow {
  othersHigher: boolean;
}

/**
 * The tribes where the Subject's and others' views diverge most — up to one in
 * each direction (others see more / you see more), only when the gap clears a
 * threshold so noise isn't dressed up as insight.
 */
function computeDivergences(rows: ComparisonRow[]): Divergence[] {
  const withGap = rows
    .map((r) => ({ ...r, othersHigher: r.others > r.self }))
    .filter((r) => Math.abs(r.others - r.self) >= DIVERGENCE_THRESHOLD);

  const gap = (r: ComparisonRow) => Math.abs(r.others - r.self);
  const othersSeeMore = withGap
    .filter((r) => r.othersHigher)
    .sort((a, b) => gap(b) - gap(a))[0];
  const youSeeMore = withGap
    .filter((r) => !r.othersHigher)
    .sort((a, b) => gap(b) - gap(a))[0];

  return [othersSeeMore, youSeeMore].filter(Boolean) as Divergence[];
}

/** A normalized 0–1 score as a whole-number percentage. */
function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Bar fill fraction on the shared scale, with a sliver for any nonzero score. */
function barFraction(score: number, sharedMax: number): number {
  if (sharedMax <= 0) return 0;
  const raw = score / sharedMax;
  return score > 0 ? Math.max(raw, 0.03) : 0;
}
