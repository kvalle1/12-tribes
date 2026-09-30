import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  MIN_OBSERVERS,
  isReportUnlocked,
  type ObserverAggregate,
} from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Shows the
 * Subject's own profile alongside the equal-weight aggregated "others" profile,
 * highlights where the two reads align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1/2/3…).
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS} observers have
 * responded; before then it renders a clear locked state showing progress toward
 * the threshold. Observer identities never appear — the drill-down is numbered,
 * not named (ADR-0003).
 *
 * Server component: it imports the `server-only` scoring core (the word→tribe
 * mapping never reaches the client, ADR-0009), so render it only from the
 * server. All scores are computed here; nothing but finished numbers is emitted.
 */
export function ComparisonReport({
  words,
  aggregate,
}: {
  /** The Subject's own selected words (their self profile is scored from these). */
  words: string[];
  /** The equal-weight observer aggregation for this Subject. */
  aggregate: ObserverAggregate;
}) {
  if (!isReportUnlocked(aggregate.count)) {
    return <LockedReport count={aggregate.count} />;
  }

  const self = score(words);
  const { others, perObserver } = aggregate;

  const selfBy = bySlug(self);
  const othersBy = bySlug(others);

  // A shared scale across both profiles so the self and others bars are directly
  // comparable to the eye (the taller of the two anywhere fills its bar).
  const scale = Math.max(
    ...self.map((t) => t.score),
    ...others.map((t) => t.score),
    // Guard against an all-zero edge case so we never divide by zero.
    Number.EPSILON,
  );

  // Order rows by the Subject's own ranking — this is their result, read back to
  // them through others' eyes.
  const rows = rankScores(self).map((row) => ({
    slug: row.slug,
    name: row.name,
    selfScore: selfBy.get(row.slug) ?? 0,
    othersScore: othersBy.get(row.slug) ?? 0,
  }));

  const divergences = topDivergences(self, others);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile sits alongside the equal-weight average of{" "}
        {aggregate.count}{" "}
        {aggregate.count === 1 ? "observer" : "observers"}. Every observer counts
        the same, however many words they picked.
      </p>

      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <LegendSwatch className="bg-ink" label="You" />
        <LegendSwatch className="bg-gold" label="Others" />
      </div>

      <section className="mt-6 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-none"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-2">
                  <CompareBar
                    label={`You: ${pct(row.selfScore)}`}
                    fraction={row.selfScore / scale}
                    filled={row.selfScore > 0}
                    tone="ink"
                  />
                  <CompareBar
                    label={`Others: ${pct(row.othersScore)}`}
                    fraction={row.othersScore / scale}
                    filled={row.othersScore > 0}
                    tone="gold"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where the reads differ most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((d) => (
              <li key={d.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{d.name}</span>{" "}
                <span className="text-muted">
                  {d.gap > 0
                    ? `others see more strongly than you do (+${pct(d.gap)})`
                    : `others see less strongly than you do (−${pct(-d.gap)})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response, fully anonymous — no names, no order you can trace back.
          These are the top tribes each observer&rsquo;s words pointed to.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((profile, index) => (
            <ObserverDrilldown
              key={index}
              index={index}
              profile={profile}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/** The locked state shown before the observer threshold is reached. */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        responded. Keeping the bar at three makes the average meaningful and
        protects each observer&rsquo;s anonymity.
      </p>

      <div className="mt-8 max-w-[360px]">
        <div className="flex items-baseline justify-between text-[13px] text-ink">
          <span className="uppercase tracking-[0.14em] text-faint">
            Responses
          </span>
          <span className="font-serif text-[18px]">
            {count} <span className="text-faint">/ {MIN_OBSERVERS}</span>
          </span>
        </div>
        <div
          className="mt-3 flex gap-2"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS} observer responses received`}
        >
          {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
            <span
              key={i}
              className={
                i < count
                  ? "h-2.5 flex-1 rounded-full bg-gold"
                  : "h-2.5 flex-1 rounded-full bg-hair"
              }
            />
          ))}
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response to go."
            : `${remaining} more responses to go.`}
        </p>
      </div>
    </div>
  );
}

function ObserverDrilldown({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  // Show only the tribes this observer's words actually pointed to, top-first.
  const top = rankScores(profile)
    .filter((t) => t.score > 0)
    .slice(0, 5);

  return (
    <details className="group rounded-[2px] border border-hair px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] text-ink [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-[17px]">Observer {index + 1}</span>
        <span className="text-[12px] uppercase tracking-[0.14em] text-faint transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <ul className="mt-3 flex flex-col gap-2">
        {top.length === 0 ? (
          <li className="text-[14px] text-muted">
            No recognized words in this response.
          </li>
        ) : (
          top.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
              >
                <span className="text-[14px] text-ink">{row.name}</span>
                <div
                  className="h-2 overflow-hidden rounded-full bg-hair/50"
                  role="img"
                  aria-label={`${row.name}: ${pct(row.score)}`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(row.relative * 100, 3)}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
              </li>
            );
          })
        )}
      </ul>
    </details>
  );
}

function CompareBar({
  label,
  fraction,
  filled,
  tone,
}: {
  label: string;
  fraction: number;
  filled: boolean;
  tone: "ink" | "gold";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50">
        <div
          className={
            tone === "ink"
              ? "h-full rounded-full bg-ink"
              : "h-full rounded-full bg-gold"
          }
          style={{ width: `${filled ? Math.max(fraction * 100, 3) : 0}%` }}
        />
      </div>
      <span className="w-[104px] shrink-0 text-right text-[11px] uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

/** Index a score list by slug for O(1) pairing between self and others. */
function bySlug(scores: TribeScore[]): Map<string, number> {
  return new Map(scores.map((s) => [s.slug, s.score]));
}

/** A percentage string for a 0–1 score. */
function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * The tribes where the self and others reads diverge most, largest gap first.
 * Only gaps of at least 5 percentage points count as meaningful, so tiny noise
 * doesn't get framed as a difference. At most four are surfaced.
 */
function topDivergences(
  self: TribeScore[],
  others: TribeScore[],
): { slug: string; name: string; gap: number }[] {
  const selfBy = bySlug(self);
  return others
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      gap: t.score - (selfBy.get(t.slug) ?? 0),
    }))
    .filter((d) => Math.abs(d.gap) >= 0.05)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 4);
}
