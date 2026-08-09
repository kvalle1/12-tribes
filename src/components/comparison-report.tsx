import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";

/**
 * The self-vs-others comparison report that closes the 360 loop (issue #9,
 * ADR-0003). It puts the Subject's own Strength Profile next to the equal-weight
 * aggregate of their anonymous Observers, calls out where the two agree and
 * diverge, and offers an anonymous per-observer drill-down (Observer 1/2/3, no
 * attributes). Until at least three Observers have responded it renders a clear
 * locked state instead, so one voice can't stand in for the group.
 *
 * Server component: it imports the scoring core and the aggregator, both
 * `server-only`, so the word→tribe mapping never reaches the client (ADR-0009).
 * Render it only from server components.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const observerCount = observerResponses.length;

  if (!isReportUnlocked(observerCount)) {
    return <LockedReport observerCount={observerCount} />;
  }

  const selfScores = score(selfWords);
  const { average, perObserver } = aggregateObservers(observerResponses);

  // Merge the two profiles (both in canonical tribe order) into comparison rows.
  const rows = selfScores.map((selfScore, index) => ({
    slug: selfScore.slug,
    name: selfScore.name,
    self: selfScore.score,
    others: average[index].score,
  }));

  // A shared denominator so the "you" and "others" bars stay comparable to each
  // other: both are normalized 0–1, but scaling to the single largest bar keeps
  // the chart readable when every absolute score is small.
  const maxValue = Math.max(
    ...rows.map((row) => Math.max(row.self, row.others)),
    0,
  );

  // Anchor the ordering on the Subject's own ranking, so their top tribes lead
  // and the observers' read is read against them.
  const ranked = [...rows].sort((a, b) => b.self - a.self);

  const agreement = strongestAgreement(rows);
  const divergence = largestDivergence(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {observerCount}{" "}
        {observerCount === 1 ? "observer" : "observers"}
      </p>
      <h2 className="mt-2 font-serif text-[26px] font-semibold leading-snug">
        You, and how others see you
      </h2>
      <p className="mt-2 max-w-[540px] text-[15px] text-muted">
        Your own profile sits alongside the equal-weight average of everyone who
        described you — each observer counts the same, no matter how many words
        they picked.
      </p>

      <Legend />

      {/* Side-by-side bars: two stacked bars per tribe, your read over theirs. */}
      <section className="mt-8" aria-label="Self versus observers, per tribe">
        <ul className="flex flex-col gap-5">
          {ranked.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`${row.name}, you`}
                    value={row.self}
                    max={maxValue}
                    accent={accent}
                    opacity={1}
                  />
                  <CompareBar
                    label={`${row.name}, observers`}
                    value={row.others}
                    max={maxValue}
                    accent={accent}
                    opacity={0.4}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads meet and where they part. */}
      <section className="mt-12 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
        {agreement && (
          <div className="rounded-[2px] border border-hair p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Strongest agreement
            </p>
            <p className="mt-2 font-serif text-[20px]">{agreement.name}</p>
            <p className="mt-1 text-[14px] text-muted">
              You and your observers both read {agreement.name} strongly.
            </p>
          </div>
        )}
        {divergence && (
          <div className="rounded-[2px] border border-hair p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Biggest divergence
            </p>
            <p className="mt-2 font-serif text-[20px]">{divergence.name}</p>
            <p className="mt-1 text-[14px] text-muted">
              Others see {divergence.name} in you{" "}
              {divergence.others > divergence.self ? "more" : "less"} than you do.
            </p>
          </div>
        )}
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How each observer read you
        </p>
        <p className="mt-2 max-w-[540px] text-[14px] text-muted">
          Each response is fully anonymous — shown only as Observer 1, 2, 3, with
          no name or relationship attached.
        </p>
        <ul className="mt-6 flex flex-col gap-6">
          {perObserver.map((profile, index) => (
            <ObserverDrilldown
              key={index}
              index={index}
              profile={profile}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Legend distinguishing the "you" bar from the "observers" bar. */
function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full bg-ink/40" aria-hidden />
        Observers (average)
      </span>
    </div>
  );
}

/** A single normalized bar, filled relative to the shared `max`. */
function CompareBar({
  label,
  value,
  max,
  accent,
  opacity,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
  opacity: number;
}) {
  const relative = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)}%`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(relative * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: accent,
          opacity,
        }}
      />
    </div>
  );
}

/** One anonymous observer's top tribes, as a compact ranked strip. */
function ObserverDrilldown({
  index,
  profile,
}: {
  index: number;
  profile: { slug: string; name: string; score: number }[];
}) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((t) => t.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 0;

  return (
    <li>
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </p>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">
          No tribes surfaced from this response.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {top.map((tribe) => {
            const accent = accentHex(getTribeBySlug(tribe.slug)?.color ?? "");
            return (
              <li
                key={tribe.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[15px] leading-tight">
                  {tribe.name}
                </span>
                <CompareBar
                  label={`Observer ${index + 1}, ${tribe.name}`}
                  value={tribe.score}
                  max={max}
                  accent={accent}
                  opacity={0.7}
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/** The locked state shown before enough observers have responded. */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  return (
    <div className="rounded-[2px] border border-dashed border-hair p-6">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
        {observerCount === 0
          ? "No observer responses yet"
          : `${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} responses in`}
      </h2>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Your comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have responded — {remaining} more to go. Averaging three or more reads
        keeps any single observer from standing in for the whole group.
      </p>

      {/* A small progress row so the count is legible at a glance. */}
      <div
        className="mt-5 flex gap-2"
        role="img"
        aria-label={`${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} observer responses received`}
      >
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
          <span
            key={i}
            className={
              i < observerCount
                ? "h-2.5 flex-1 rounded-full bg-gold"
                : "h-2.5 flex-1 rounded-full bg-hair/60"
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The tribe where self and observers agree most strongly — the highest shared
 * floor `min(self, others)`, so both reads have to be high for it to win. Returns
 * `null` when there is no shared signal at all.
 */
function strongestAgreement(
  rows: { name: string; self: number; others: number }[],
) {
  let best: { name: string; self: number; others: number } | null = null;
  for (const row of rows) {
    const floor = Math.min(row.self, row.others);
    if (floor > 0 && (!best || floor > Math.min(best.self, best.others))) {
      best = row;
    }
  }
  return best;
}

/**
 * The tribe with the largest gap between the two reads — where observers most
 * disagree with the Subject's self-read, in either direction. Returns `null`
 * when the two profiles are identical.
 */
function largestDivergence(
  rows: { name: string; self: number; others: number }[],
) {
  let worst: { name: string; self: number; others: number } | null = null;
  for (const row of rows) {
    const gap = Math.abs(row.self - row.others);
    if (gap > 0 && (!worst || gap > Math.abs(worst.self - worst.others))) {
      worst = row;
    }
  }
  return worst;
}
