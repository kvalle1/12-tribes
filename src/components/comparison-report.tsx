import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  scoreObserverSelections,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregate";
import { compareProfiles, topDivergences } from "@/lib/assessment/comparison";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * beside the equal-weight aggregated "others" profile, the tribes where the two
 * reads diverge most, and an anonymous per-observer drill-down.
 *
 * The report stays **locked until at least `MIN_OBSERVERS` responses exist** —
 * below the floor the average isn't meaningful and individual anonymity is
 * weaker, so only progress toward the floor is shown. This is a server component
 * (it imports the `server-only` scoring core); render it only from the server.
 */
export function ComparisonReport({
  words,
  observerSelections,
}: {
  words: string[];
  observerSelections: string[][];
}) {
  const count = observerSelections.length;

  if (count < MIN_OBSERVERS) {
    return <LockedReport count={count} />;
  }

  const self = score(words);
  const others = aggregateObservers(observerSelections);
  const rows = compareProfiles(self, others);
  const divergences = topDivergences(rows, 3);
  const perObserver = scoreObserverSelections(observerSelections).map((p) =>
    rankScores(p),
  );

  // A shared scale across both profiles so "you" and "others" bars are directly
  // comparable per tribe — divergence is meaningful only on one common axis.
  const sharedMax = Math.max(
    0,
    ...rows.flatMap((r) => [r.self, r.others]),
  );
  const fill = (value: number) =>
    sharedMax > 0 ? Math.max((value / sharedMax) * 100, value > 0 ? 3 : 0) : 0;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs others · {count} observers
      </p>
      <h2 className="mt-2 font-serif text-[28px] font-semibold leading-tight">
        How others see you
      </h2>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Your own read sits beside the equal-weight average of{" "}
        {count} anonymous observers — each observer counts the same, no matter
        how many words they picked. The gap is where growth lives.
      </p>

      {/* Self vs others, per tribe, ordered by your own strongest tribes. */}
      <section className="mt-10 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <LegendSwatch label="You" opacity={1} />
          <LegendSwatch label="Others" opacity={0.4} />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[110px_1fr] items-center gap-4 max-[520px]:grid-cols-[84px_1fr]"
              >
                <span className="font-serif text-[16px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <Bar
                    caption="You"
                    percent={fill(row.self)}
                    accent={accent}
                    opacity={1}
                    ariaLabel={`${row.name}, your read: ${Math.round(fill(row.self))}% of the strongest read`}
                  />
                  <Bar
                    caption="Others"
                    percent={fill(row.others)}
                    accent={accent}
                    opacity={0.4}
                    ariaLabel={`${row.name}, observers' read: ${Math.round(fill(row.others))}% of the strongest read`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge most — the actionable heart of the 360. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where the reads diverge most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const strongerToOthers = row.delta > 0;
              return (
                <li
                  key={row.slug}
                  className="flex items-baseline justify-between gap-4 text-[15px]"
                >
                  <span className="font-serif text-[17px]">{row.name}</span>
                  <span className="text-muted">
                    {strongerToOthers
                      ? "Others see this more strongly than you do"
                      : "You see this more strongly than others do"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down — Observer 1 / 2 / 3, no identity. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — no names, no order
          you can trace back to a person.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {perObserver.map((ranked, i) => (
            <div key={i} className="rounded-[2px] border border-hair p-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {ranked.slice(0, 4).map((tribeScore) => {
                  const tribe = getTribeBySlug(tribeScore.slug);
                  const accent = accentHex(tribe?.color ?? "");
                  return (
                    <li
                      key={tribeScore.slug}
                      className="grid grid-cols-[84px_1fr] items-center gap-3"
                    >
                      <span className="font-serif text-[14px]">
                        {tribeScore.name}
                      </span>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-hair/50"
                        role="img"
                        aria-label={`${tribeScore.name}: ${Math.round(tribeScore.relative * 100)}% of this observer's top read`}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(tribeScore.relative * 100, tribeScore.score > 0 ? 4 : 0)}%`,
                            backgroundColor: accent,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A single scaled bar with a small caption for the self-vs-others rows. */
function Bar({
  caption,
  percent,
  accent,
  opacity,
  ariaLabel,
}: {
  caption: string;
  percent: number;
  accent: string;
  opacity: number;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {caption}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${percent}%`, backgroundColor: accent, opacity }}
        />
      </div>
    </div>
  );
}

function LegendSwatch({ label, opacity }: { label: string; opacity: number }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2.5 w-6 rounded-full bg-ink"
        style={{ opacity }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/**
 * The pre-unlock state: the report is hidden until at least `MIN_OBSERVERS`
 * observers have responded, with a clear progress readout so the Subject knows
 * how many more reads they need.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h2 className="mt-2 font-serif text-[28px] font-semibold leading-tight">
        {count === 0
          ? "No observer reads yet"
          : `${count} of ${MIN_OBSERVERS} observers in`}
      </h2>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Your comparison report unlocks once{" "}
        <span className="text-ink">at least {MIN_OBSERVERS} people</span> have
        anonymously described you. That floor keeps the &ldquo;others&rdquo;
        average meaningful and protects each observer&rsquo;s anonymity.
        {remaining > 0 && (
          <>
            {" "}
            {remaining} more {remaining === 1 ? "read" : "reads"} to go — share
            your link with a few more people.
          </>
        )}
      </p>

      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < count ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
