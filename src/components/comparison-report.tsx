import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Puts the
 * Subject's own profile next to the equal-weight aggregate of how their
 * Observers see them, calls out where the two align and where they diverge, and
 * offers an anonymous per-observer drill-down (Observer 1 / 2 / 3, no
 * attributes). The whole report stays locked until at least three Observers have
 * responded — before then the "others" view is neither meaningful nor safely
 * anonymous.
 *
 * Server component: it imports the scoring core and the aggregation module,
 * both `server-only`, so the word→tribe mapping never reaches the client
 * (ADR-0009). Render it only from a server component.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const observerCount = observerResponses.length;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>

      {isReportUnlocked(observerCount) ? (
        <Unlocked
          selfScores={score(selfWords)}
          otherScores={aggregateObservers(observerResponses)}
          observerResponses={observerResponses}
        />
      ) : (
        <Locked observerCount={observerCount} />
      )}
    </div>
  );
}

/**
 * The locked state, shown until the third Observer responds. Communicates
 * exactly how many more responses are needed and why the wait exists, and keeps
 * the Subject's next action (share the link) close at hand.
 */
function Locked({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;

  return (
    <section className="mt-8 rounded-[2px] border border-hair bg-white/40 p-8">
      <p className="font-serif text-[22px] leading-snug text-ink">
        {observerCount === 0
          ? "No one has responded yet."
          : `${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} people have responded.`}
      </p>
      <p className="mt-3 max-w-[520px] text-[15px] text-muted">
        Your comparison unlocks once{" "}
        <span className="text-ink">{OBSERVER_UNLOCK_THRESHOLD} people</span> have
        described you — {remaining} more to go. Waiting for three keeps the
        &ldquo;others&rdquo; view meaningful and every response anonymous.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-full bg-hair/60"
            style={
              i < observerCount
                ? { backgroundColor: accentHex("gold") }
                : undefined
            }
          />
        ))}
      </div>
      <p className="sr-only">
        {observerCount} of {OBSERVER_UNLOCK_THRESHOLD} responses received.
      </p>

      <Link
        href="/assessment/result"
        className="mt-8 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Share your observer link
      </Link>
    </section>
  );
}

/**
 * The unlocked comparison: self vs aggregated others side by side, the gap
 * read out in words, and the anonymous per-observer drill-down.
 */
function Unlocked({
  selfScores,
  otherScores,
  observerResponses,
}: {
  selfScores: TribeScore[];
  otherScores: TribeScore[];
  observerResponses: string[][];
}) {
  const otherBySlug = new Map(otherScores.map((s) => [s.slug, s.score]));

  // A single shared scale across both profiles so "You" and "Others" bars are
  // directly comparable rather than each normalized to its own top tribe.
  const sharedMax = Math.max(
    ...selfScores.map((s) => s.score),
    ...otherScores.map((s) => s.score),
    0,
  );

  // Order by the Subject's own ranking so their strongest tribes lead; ties keep
  // canonical order (rankScores is a stable score-desc sort).
  const rows = rankScores(selfScores).map((self) => {
    const others = otherBySlug.get(self.slug) ?? 0;
    return { slug: self.slug, name: self.name, self: self.score, others };
  });

  const divergences = topDivergences(selfScores, otherBySlug);

  return (
    <div className="mt-8">
      <p className="max-w-[560px] text-[15px] text-muted">
        The equal-weight average of{" "}
        <span className="text-ink">{observerResponses.length} anonymous</span>{" "}
        observers, next to your own read. Each observer counts the same, however
        many words they picked.
      </p>

      {/* Legend for the two series. */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-4 rounded-full"
            style={{ backgroundColor: accentHex("gold") }}
          />
          Others
        </span>
      </div>

      {/* Side-by-side bars for all twelve tribes on a shared scale. */}
      <ul className="mt-6 flex flex-col gap-5">
        {rows.map((row) => (
          <li
            key={row.slug}
            className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
          >
            <span className="font-serif text-[17px] leading-none">
              {row.name}
            </span>
            <div className="flex flex-col gap-1.5">
              <CompareBar
                label={`You see ${row.name}`}
                value={row.self}
                max={sharedMax}
                color="var(--ink)"
              />
              <CompareBar
                label={`Others see ${row.name}`}
                value={row.others}
                max={sharedMax}
                color={accentHex("gold")}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Reading the gap — where self and others align and diverge. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others differ most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((d) => (
              <li key={d.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif text-[17px]"
                  style={{ color: accentHex(getTribeBySlug(d.slug)?.color ?? "") }}
                >
                  {d.name}
                </span>{" "}
                <span className="text-muted">
                  {d.gap > 0
                    ? "— others see more of this in you than you do."
                    : "— you lean into this more than others see."}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The spread of opinion
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each observer&rsquo;s own read, kept anonymous. No names, no
          relationships — just the shape of how each one sees you.
        </p>
        <div className="mt-6 flex flex-col gap-8">
          {observerResponses.map((words, i) => (
            <ObserverCard key={i} index={i} scores={score(words)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** A single labeled bar on a shared 0–`max` scale. */
function CompareBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)}%`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(pct, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/**
 * One anonymous observer's profile — their top few tribes as compact bars,
 * relative to their own strongest read. Labeled only "Observer N"; nothing here
 * carries an identity or attribute.
 */
function ObserverCard({ index, scores }: { index: number; scores: TribeScore[] }) {
  const top = rankScores(scores)
    .filter((t) => t.score > 0)
    .slice(0, 5);

  return (
    <div>
      <p className="text-[13px] uppercase tracking-[0.14em] text-muted">
        Observer {index + 1}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {top.map((t) => {
          const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
          return (
            <li
              key={t.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
            >
              <span className="text-[14px] text-ink">{t.name}</span>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`Observer ${index + 1} — ${t.name}: ${Math.round(t.relative * 100)}% of their top read`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(t.relative * 100, 3)}%`,
                    backgroundColor: accent,
                    opacity: 0.7,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The tribes where self and others diverge most, largest gap first. `gap` is
 * others − self on the normalized scale: positive means others see more of that
 * tribe in the Subject than the Subject sees in themselves. Only gaps of real
 * magnitude are returned, at most three.
 */
function topDivergences(
  selfScores: TribeScore[],
  otherBySlug: Map<string, number>,
): { slug: string; name: string; gap: number }[] {
  return selfScores
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      gap: (otherBySlug.get(s.slug) ?? 0) - s.score,
    }))
    .filter((d) => Math.abs(d.gap) > 0.05)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);
}
