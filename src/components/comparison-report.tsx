import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  scoreEachObserver,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * against the equal-weight aggregate of how their Observers see them, so they
 * can read where the two views align and — more usefully — where they diverge.
 *
 * A server component, like `ResultView`: it imports the `server-only` scoring
 * and aggregation cores (the word→tribe mapping never reaches the client,
 * ADR-0009), so render it only from a server component. It takes the raw stored
 * inputs — the Subject's own selected `words` and the anonymous Observer word
 * lists (oldest-first) — and recomputes everything, so the report can never
 * drift from what was saved.
 *
 * Below `MIN_OBSERVERS` responses the report is locked: individual Observers
 * could otherwise be singled out from the drill-down, and a one- or two-person
 * "others" view isn't meaningful. The locked state shows honest progress toward
 * the threshold instead.
 */
export function ComparisonReport({
  words,
  observerWordLists,
}: {
  words: string[];
  observerWordLists: string[][];
}) {
  const observerCount = observerWordLists.length;

  if (!isReportUnlocked(observerCount)) {
    return <LockedReport observerCount={observerCount} />;
  }

  const self = score(words);
  const others = aggregateObservers(observerWordLists);
  const comparison = compareProfiles(self, others);

  // Shared scale across both series so "you" and "others" bars are directly
  // comparable tribe-to-tribe. Order by whichever view reads the tribe most
  // strongly, so the prominent tribes — and the divergences — float to the top.
  const max = Math.max(...comparison.map((c) => Math.max(c.self, c.others)), 0);
  const rows = [...comparison].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // The sharpest disagreements, surfaced as the report's headline insight.
  const divergences = [...comparison]
    .filter((c) => Math.abs(c.divergence) > 0)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How your read compares
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile alongside the equal-weight average of{" "}
        {observerCount} anonymous {observerCount === 1 ? "observer" : "observers"}
        . Each observer counts the same, however many words they picked.
      </p>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink/30" />
          Others
        </span>
      </div>

      {divergences.length > 0 && (
        <section className="mt-10 rounded-[3px] border border-hair bg-gold/5 p-6">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge most
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {divergences.map((c) => {
              const phrase =
                c.divergence > 0
                  ? "you see this in yourself more strongly"
                  : "others see this in you more strongly";
              const accent = accentHex(getTribeBySlug(c.slug)?.color ?? "");
              return (
                <li key={c.slug} className="text-[15px] text-ink">
                  <span
                    className="font-serif text-[17px]"
                    style={{ color: accent }}
                  >
                    {c.name}
                  </span>{" "}
                  <span className="text-muted">
                    — {phrase} ({Math.round(Math.abs(c.divergence) * 100)} pt gap)
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Paired bars — all twelve tribes on a shared scale. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The twelve, you vs. others
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((c) => {
            const accent = accentHex(getTribeBySlug(c.slug)?.color ?? "");
            return (
              <li
                key={c.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: accent }}
                >
                  {c.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <PairBar
                    label="You"
                    value={c.self}
                    max={max}
                    color={accent}
                    strong
                  />
                  <PairBar
                    label="Others"
                    value={c.others}
                    max={max}
                    color={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <ObserverDrilldown observerWordLists={observerWordLists} />

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

/** A single labelled bar within a tribe's you/others pair, on the shared scale. */
function PairBar({
  label,
  value,
  max,
  color,
  strong = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  strong?: boolean;
}) {
  const relative = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(relative * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: strong ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Per-observer drill-down. Each Observer is scored on their own (the same
 * equal-weight unit the aggregate is built from) and shown as "Observer N" with
 * their top tribes — no name, no relationship, no words, nothing that could
 * identify who answered (ADR-0003). Native `<details>` keeps it disclosure-only
 * with no client JS.
 */
function ObserverDrilldown({
  observerWordLists,
}: {
  observerWordLists: string[][];
}) {
  const perObserver = scoreEachObserver(observerWordLists);

  return (
    <section className="mt-12 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Observer by observer
      </p>
      <p className="mt-2 max-w-[520px] text-[14px] text-muted">
        Each observer&rsquo;s read on its own — anonymous, no attributes. Use it
        to see the spread of opinion without identifying anyone.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        {perObserver.map((table, i) => {
          const top = rankScores(table)
            .filter((t) => t.score > 0)
            .slice(0, 5);
          return (
            <details
              key={i}
              className="rounded-[3px] border border-hair px-5 py-3.5"
            >
              <summary className="cursor-pointer text-[14px] tracking-[0.04em] text-ink">
                Observer {i + 1}
              </summary>
              <ul className="mt-4 flex flex-col gap-2.5">
                {top.map((t) => {
                  const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
                  return (
                    <li
                      key={t.slug}
                      className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                    >
                      <span
                        className="text-[14px]"
                        style={{ color: accent }}
                      >
                        {t.name}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
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
            </details>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The locked state shown until at least `MIN_OBSERVERS` have responded. It
 * reveals no scores — just honest progress toward the threshold — so the report
 * can't be peeked at with too few (identifiable) responses.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  const pct = Math.round((observerCount / MIN_OBSERVERS) * 100);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Comparison report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        A few more responses to go
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        answered — enough for a meaningful &ldquo;others&rdquo; view that keeps
        every observer anonymous. So far{" "}
        <strong className="font-semibold text-ink">
          {observerCount} of {MIN_OBSERVERS}
        </strong>{" "}
        {observerCount === 1 ? "person has" : "people have"} responded
        {remaining > 0 && (
          <>
            {" "}
            — {remaining} more to go
          </>
        )}
        .
      </p>

      <div className="mt-8 max-w-[420px]">
        <div className="h-2.5 overflow-hidden rounded-full bg-hair/50">
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.max(pct, observerCount > 0 ? 6 : 0)}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-faint">
          {observerCount} of {MIN_OBSERVERS} responses
        </p>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result — get your share link
        </Link>
      </div>
    </div>
  );
}
