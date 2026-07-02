import Link from "next/link";
import { accentHex, getTribeBySlug, tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile set beside the equal-weight "others" profile aggregated from their
 * anonymous Observers, with the alignment and divergence between the two called
 * out, plus an anonymous per-observer drill-down.
 *
 * It unlocks only once at least {@link MIN_OBSERVERS_FOR_REPORT} Observers have
 * responded — below that it shows a locked state with progress, which both keeps
 * the "others" view meaningful and preserves each Observer's anonymity. The two
 * series use two fixed colors (You / Others) rather than per-tribe accents so the
 * paired bars read as one comparison.
 *
 * Server component: it imports the scoring core and the aggregation, both
 * `server-only` (the word→tribe mapping never reaches the client, ADR-0009).
 */

const YOU_COLOR = "var(--gold)";
const OTHERS_COLOR = "var(--ink)";

/** How far apart self and others must sit (in normalized points) to be flagged. */
const DIVERGENCE_THRESHOLD = 0.08;

export function ComparisonReport({
  words,
  responses,
}: {
  words: string[];
  responses: string[][];
}) {
  const agg = aggregateObservers(responses);

  if (!agg.unlocked) {
    return <LockedState observerCount={agg.observerCount} />;
  }

  const selfBySlug = new Map(score(words).map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(agg.profile.map((s) => [s.slug, s.score]));

  const rows = tribes.map((tribe, index) => ({
    slug: tribe.slug,
    name: tribe.name,
    self: selfBySlug.get(tribe.slug) ?? 0,
    others: othersBySlug.get(tribe.slug) ?? 0,
    index,
  }));

  // Shared scale so a You bar and an Others bar of equal length mean equal score.
  const scaleMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0.0001,
  );

  // Rank by whichever view rates the tribe highest, so the tribes that matter to
  // either read rise to the top; ties keep canonical (tribe number) order.
  const ranked = [...rows].sort(
    (a, b) =>
      Math.max(b.self, b.others) - Math.max(a.self, a.others) ||
      a.index - b.index,
  );

  // Sharpest divergences in each direction, if they clear the threshold.
  const othersSeeMore = [...rows]
    .filter((r) => r.others - r.self >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => b.others - b.self - (a.others - a.self))[0];
  const youSeeMore = [...rows]
    .filter((r) => r.self - r.others >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => b.self - b.others - (a.self - a.others))[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 · {agg.observerCount}{" "}
        {agg.observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read is set beside the combined read of the people you asked.
        Each observer counts equally, however many words they picked. The gap
        between the two is where the most useful insight tends to live.
      </p>

      {/* Legend for the two series. */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: YOU_COLOR }}
            aria-hidden
          />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: OTHERS_COLOR }}
            aria-hidden
          />
          Others
        </span>
      </div>

      {/* Paired bars — self vs others, all twelve, on one shared scale. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-6">
          {ranked.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <Link
                href={`/tribes/${row.slug}`}
                className="font-serif text-[17px] leading-tight text-ink transition-colors hover:text-gold"
              >
                {row.name}
              </Link>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={`You: ${pct(row.self)} percent`}
                  fraction={row.self / scaleMax}
                  positive={row.self > 0}
                  color={YOU_COLOR}
                />
                <CompareBar
                  label={`Others: ${pct(row.others)} percent`}
                  fraction={row.others / scaleMax}
                  positive={row.others > 0}
                  color={OTHERS_COLOR}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Alignment & divergence callout. */}
      {(othersSeeMore || youSeeMore) && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and they diverge
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {othersSeeMore && (
              <p className="text-[15px] leading-relaxed text-ink">
                Others see more{" "}
                <TribeName slug={othersSeeMore.slug} name={othersSeeMore.name} />{" "}
                in you than you see in yourself.
              </p>
            )}
            {youSeeMore && (
              <p className="text-[15px] leading-relaxed text-ink">
                You lean into{" "}
                <TribeName slug={youSeeMore.slug} name={youSeeMore.name} /> more
                than the people around you do.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer&rsquo;s read
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Anonymous, in no particular order — the spread of opinion without
          anyone attached to it.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {agg.perObserver.map((observer, i) => {
            const top = rankScores(observer)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={i}
                className="rounded-[2px] border border-hair p-5"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {i + 1}
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {top.map((t) => {
                    const tribe = getTribeBySlug(t.slug);
                    return (
                      <li
                        key={t.slug}
                        className="flex items-baseline gap-2 font-serif text-[16px]"
                      >
                        <span style={{ color: accentHex(tribe?.color ?? "") }}>
                          {t.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function CompareBar({
  label,
  fraction,
  positive,
  color,
}: {
  label: string;
  fraction: number;
  positive: boolean;
  color: string;
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
          width: `${Math.max(fraction * 100, positive ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function TribeName({ slug, name }: { slug: string; name: string }) {
  const tribe = getTribeBySlug(slug);
  return (
    <Link
      href={`/tribes/${slug}`}
      className="font-serif italic transition-colors hover:opacity-80"
      style={{ color: accentHex(tribe?.color ?? "") }}
    >
      {name}
    </Link>
  );
}

/** The locked state shown before enough Observers have responded (ADR-0003). */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not enough responses yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people
        have responded. That keeps the &ldquo;others&rdquo; read meaningful and
        keeps every observer anonymous.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} observers responded`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${(observerCount / MIN_OBSERVERS_FOR_REPORT) * 100}%`,
            }}
          />
        </div>
        <span className="shrink-0 font-serif text-[18px] text-ink">
          {observerCount} / {MIN_OBSERVERS_FOR_REPORT}
        </span>
      </div>

      <p className="mt-6 text-[15px] text-muted">
        {observerCount === 0
          ? "No one has responded yet."
          : `${remaining} more ${remaining === 1 ? "response" : "responses"} to go.`}{" "}
        Share your observer link below to invite more people.
      </p>
    </div>
  );
}

/** A normalized 0–1 value as a whole-number percentage for a11y labels. */
function pct(value: number): number {
  return Math.round(value * 100);
}
