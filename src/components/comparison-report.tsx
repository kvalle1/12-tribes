import { accentHex, getTribeBySlug, tribes } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "how others see you" profile, with the tribes where
 * the two reads most diverge called out, plus an anonymous per-observer
 * drill-down (Observer 1/2/3…).
 *
 * The report unlocks only once at least `OBSERVER_UNLOCK_THRESHOLD` Observers
 * have responded; before then it shows a clear locked state with the progress so
 * far. Both the self and the "others" scores come from the same normalized
 * scoring core (ADR-0001/0002), so their bars are directly comparable.
 *
 * Server component: it imports the scoring core and the aggregator, both
 * `server-only` (the word→tribe mapping never reaches the client, ADR-0009).
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const agg = aggregateObservers(observerResponses);

  if (!agg.unlocked) {
    return <LockedState observerCount={agg.observerCount} />;
  }

  const selfScores = score(selfWords);
  // Both profiles are in canonical (tribe `number`) order, so index i lines up.
  const rows = tribes.map((tribe, i) => ({
    slug: tribe.slug,
    name: tribe.name,
    self: selfScores[i].score,
    others: agg.others[i].score,
    gap: agg.others[i].score - selfScores[i].score,
  }));

  const sharedMax = Math.max(0, ...rows.flatMap((r) => [r.self, r.others]));

  // Display order: the tribes that stand out in either read come first.
  const displayed = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Divergences: where the two reads disagree most. A gap counts as meaningful
  // only when it's a sizeable fraction of the chart's scale.
  const divergences = [...rows]
    .filter((r) => sharedMax > 0 && Math.abs(r.gap) >= 0.18 * sharedMax)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Based on {agg.observerCount} anonymous{" "}
        {agg.observerCount === 1 ? "response" : "responses"}. Each observer&rsquo;s
        read is scored on its own and averaged with equal weight, so no single
        voice counts for more than another.
      </p>

      <Legend />

      {/* Side-by-side bars — you vs. others, on one shared scale. */}
      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The twelve, compared
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {displayed.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
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
                    label="You"
                    fraction={sharedMax > 0 ? row.self / sharedMax : 0}
                    hasScore={row.self > 0}
                    accent={accent}
                    variant="self"
                  />
                  <CompareBar
                    label="Others"
                    fraction={sharedMax > 0 ? row.others / sharedMax : 0}
                    hasScore={row.others > 0}
                    accent={accent}
                    variant="others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge — the gap is where growth lives. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where your reads diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li
                key={row.slug}
                className="flex items-start gap-3 text-[15px] leading-relaxed text-ink"
              >
                <span
                  aria-hidden
                  className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: accentHex(
                      getTribeBySlug(row.slug)?.color ?? "",
                    ),
                  }}
                />
                <span>
                  {row.gap > 0 ? (
                    <>
                      Others see more <strong>{row.name}</strong> in you than you
                      see in yourself.
                    </>
                  ) : (
                    <>
                      You see more <strong>{row.name}</strong> in yourself than
                      others do.
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. No identity, only an index. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own top tribes, fully anonymous — there&rsquo;s no
          way to tell who said what.
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {agg.perObserver.map((observer, index) => {
            const top = [...observer]
              .filter((s) => s.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);
            return (
              <li key={index} className="flex flex-col gap-2">
                <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </span>
                <ul className="flex flex-wrap gap-2">
                  {top.map((tribeScore) => (
                    <li
                      key={tribeScore.slug}
                      className="rounded-[2px] border px-3 py-1.5 text-[14px] text-ink"
                      style={{
                        borderColor: `${accentHex(
                          getTribeBySlug(tribeScore.slug)?.color ?? "",
                        )}66`,
                      }}
                    >
                      {tribeScore.name}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** The chart legend distinguishing the "you" bar from the "others" bar. */
function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-5 text-[12px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-2">
        <span
          className="h-2.5 w-6 rounded-full border border-ink/40 bg-ink/20"
          aria-hidden
        />
        How others see you
      </span>
    </div>
  );
}

/** One comparison bar — the "you" variant is solid, "others" is an outline. */
function CompareBar({
  label,
  fraction,
  hasScore,
  accent,
  variant,
}: {
  label: string;
  fraction: number;
  hasScore: boolean;
  accent: string;
  variant: "self" | "others";
}) {
  const width = `${Math.max(fraction * 100, hasScore ? 3 : 0)}%`;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[52px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the strongest read`}
      >
        <div
          className="h-full rounded-full"
          style={
            variant === "self"
              ? { width, backgroundColor: accent }
              : {
                  width,
                  backgroundColor: `${accent}40`,
                  boxShadow: `inset 0 0 0 1px ${accent}`,
                }
          }
        />
      </div>
    </div>
  );
}

/** Shown until at least `OBSERVER_UNLOCK_THRESHOLD` observers have responded. */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        The comparison opens once at least {OBSERVER_UNLOCK_THRESHOLD} people have
        responded — enough for a meaningful average and to keep every
        observer&rsquo;s answer anonymous.
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] leading-none text-ink">
            {observerCount}
          </span>
          <span className="text-[15px] text-muted">
            of {OBSERVER_UNLOCK_THRESHOLD} responses in
          </span>
        </div>
        <div
          className="mt-4 h-2.5 w-full max-w-[320px] overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${(observerCount / OBSERVER_UNLOCK_THRESHOLD) * 100}%`,
            }}
          />
        </div>
        <p className="mt-5 max-w-[520px] text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison unlocks."
            : `Share your link with ${remaining} more people to unlock it.`}
        </p>
      </div>
    </div>
  );
}
