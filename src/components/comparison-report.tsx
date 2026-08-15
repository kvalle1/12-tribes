import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS_TO_UNLOCK,
  type ObserverAggregate,
} from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003): the Subject's
 * own Self Assessment profile laid beside the equal-weight "others" profile,
 * with the gaps called out and an anonymous per-Observer drill-down.
 *
 * The report is gated: until at least {@link MIN_OBSERVERS_TO_UNLOCK} Observers
 * have responded it renders a locked state (a bare response count, no scores),
 * both because a two-or-fewer average isn't meaningful and because it could make
 * an individual Observer identifiable. The unlock decision itself is the pure
 * core's (`aggregate.unlocked`); this component only reflects it.
 *
 * Server component: it recomputes the Subject's profile from their saved `words`
 * via the `server-only` scoring core, exactly as the result view does, so the
 * two profiles are on the same normalized scale and nothing about the word→tribe
 * mapping reaches the client (ADR-0009).
 */
export function ComparisonReport({
  words,
  aggregate,
}: {
  words: string[];
  aggregate: ObserverAggregate;
}) {
  if (!aggregate.unlocked) {
    return <LockedReport observerCount={aggregate.observerCount} />;
  }

  const self = score(words);
  const rows = buildComparisonRows(self, aggregate.others);
  const divergence = mostDivergent(rows);
  const agreement = strongestAgreement(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        You vs the {aggregate.observerCount} who described you
      </p>
      <h2 className="mt-2 font-serif text-[26px] font-semibold leading-snug">
        How others see you
      </h2>
      <p className="mt-2 max-w-[540px] text-[15px] text-muted">
        Each Observer&rsquo;s read is scored on its own and counted equally, so
        no single voice outweighs the rest. The gap between the two bars is where
        the most useful insight lives.
      </p>

      {(divergence || agreement) && (
        <div className="mt-6 flex flex-col gap-2 rounded-[2px] border border-hair bg-white/50 p-5">
          {agreement && (
            <p className="text-[14px] text-ink">
              <span className="text-faint">Strongest agreement · </span>
              You and your Observers both read{" "}
              <span className="font-medium">{agreement.name}</span> as a top
              strength.
            </p>
          )}
          {divergence && (
            <p className="text-[14px] text-ink">
              <span className="text-faint">Biggest gap · </span>
              {divergence.othersScore > divergence.selfScore ? (
                <>
                  Others see more{" "}
                  <span className="font-medium">{divergence.name}</span> in you
                  than you claim for yourself.
                </>
              ) : (
                <>
                  You read yourself as more{" "}
                  <span className="font-medium">{divergence.name}</span> than
                  your Observers do.
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* Paired bars — You and Others on one shared scale, per tribe. */}
      <ul className="mt-8 flex flex-col gap-5">
        {rows.map((row) => {
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
                  fill={row.selfRelative}
                  hasScore={row.selfScore > 0}
                  accent={accent}
                  solid
                />
                <CompareBar
                  label="Others"
                  fill={row.othersRelative}
                  hasScore={row.othersScore > 0}
                  accent={accent}
                  solid={false}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Anonymous per-Observer drill-down — Observer 1/2/3, no attributes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[540px] text-[15px] text-muted">
          The spread of opinion behind the average. Each Observer is anonymous —
          no name, no relationship — so you see the range without knowing who
          said what.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {aggregate.perObserver.map((observer) => {
            const top = [...observer.scores]
              .sort((a, b) => b.score - a.score)
              .filter((s) => s.score > 0)
              .slice(0, 3);
            return (
              <details
                key={observer.index}
                className="rounded-[2px] border border-hair bg-white/40 px-5 py-4"
              >
                <summary className="cursor-pointer list-none text-[15px] text-ink">
                  <span className="font-serif text-[17px]">
                    Observer {observer.index}
                  </span>
                  {top.length > 0 && (
                    <span className="text-muted">
                      {" "}
                      · read you as{" "}
                      {top.map((s, i) => (
                        <span key={s.slug}>
                          {i > 0 && ", "}
                          {s.name}
                        </span>
                      ))}
                    </span>
                  )}
                </summary>
                <ul className="mt-4 flex flex-col gap-2">
                  {rankForDisplay(observer.scores).map((s) => {
                    const accent = accentHex(
                      getTribeBySlug(s.slug)?.color ?? "",
                    );
                    return (
                      <li
                        key={s.slug}
                        className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                      >
                        <span className="text-[13px] text-muted">{s.name}</span>
                        <CompareBar
                          label={s.name}
                          fill={s.relative}
                          hasScore={s.score > 0}
                          accent={accent}
                          solid
                          hideLabel
                        />
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** A single labelled bar drawn to a shared 0–1 fill fraction. */
function CompareBar({
  label,
  fill,
  hasScore,
  accent,
  solid,
  hideLabel = false,
}: {
  label: string;
  fill: number;
  hasScore: boolean;
  accent: string;
  solid: boolean;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {!hideLabel && (
        <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
          {label}
        </span>
      )}
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(fill * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fill * 100, hasScore ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

/** The locked state shown until enough Observers have responded. */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = Math.max(MIN_OBSERVERS_TO_UNLOCK - observerCount, 0);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h2 className="mt-2 font-serif text-[26px] font-semibold leading-snug">
        {observerCount === 0
          ? "No one has weighed in yet"
          : `${observerCount} of ${MIN_OBSERVERS_TO_UNLOCK} responses in`}
      </h2>
      <p className="mt-2 max-w-[540px] text-[15px] text-muted">
        Your comparison report unlocks once{" "}
        <span className="font-medium text-ink">
          {MIN_OBSERVERS_TO_UNLOCK} Observers
        </span>{" "}
        have described you — enough for the average to mean something and for
        every Observer to stay anonymous.{" "}
        {remaining === 1
          ? "One more response and it opens."
          : `${remaining} more to go.`}
      </p>

      <div
        className="mt-6 flex gap-2"
        role="img"
        aria-label={`${observerCount} of ${MIN_OBSERVERS_TO_UNLOCK} Observers responded`}
      >
        {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < observerCount ? "bg-gold" : "bg-hair/60"
            }`}
          />
        ))}
      </div>

      <Link
        href="/assessment/result"
        className="mt-8 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Share your observer link
      </Link>
    </div>
  );
}

interface ComparisonRow {
  slug: string;
  name: string;
  selfScore: number;
  othersScore: number;
  selfRelative: number;
  othersRelative: number;
}

/**
 * Pair the Subject's scores with the "others" scores per tribe, ranked by their
 * combined salience so the tribes either side reads strongly float to the top.
 * Both bars share one scale (the largest single score across both profiles), so
 * a longer bar always means a higher score regardless of which side it's on.
 */
function buildComparisonRows(
  self: TribeScore[],
  others: TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  const max = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  return self
    .map((s) => {
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore: s.score,
        othersScore,
        selfRelative: max > 0 ? s.score / max : 0,
        othersRelative: max > 0 ? othersScore / max : 0,
      };
    })
    .sort((a, b) => b.selfScore + b.othersScore - (a.selfScore + a.othersScore));
}

/** The tribe with the widest self↔others gap (the report's headline divergence). */
function mostDivergent(rows: ComparisonRow[]): ComparisonRow | null {
  let best: ComparisonRow | null = null;
  let bestGap = 0;
  for (const row of rows) {
    const gap = Math.abs(row.selfScore - row.othersScore);
    if (gap > bestGap) {
      bestGap = gap;
      best = row;
    }
  }
  return bestGap > 0 ? best : null;
}

/** The tribe both sides read most strongly (highest shared floor). */
function strongestAgreement(rows: ComparisonRow[]): ComparisonRow | null {
  let best: ComparisonRow | null = null;
  let bestFloor = 0;
  for (const row of rows) {
    const floor = Math.min(row.selfScore, row.othersScore);
    if (floor > bestFloor) {
      bestFloor = floor;
      best = row;
    }
  }
  return best;
}

/** Rank a single profile highest-first with a top-relative fill for its bars. */
function rankForDisplay(scores: TribeScore[]) {
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;
  return ranked.map((s) => ({
    ...s,
    relative: max > 0 ? s.score / max : 0,
  }));
}
