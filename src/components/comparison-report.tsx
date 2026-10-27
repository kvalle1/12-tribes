import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  MIN_OBSERVERS,
  isUnlocked,
  type ObserverResponse,
} from "@/lib/observer/aggregate";
import { compareProfiles, type ComparisonRow } from "@/lib/observer/compare";

/**
 * The 360 comparison report (issue #9): the Subject's own profile set beside the
 * equal-weight "others" profile, with the points of alignment and divergence
 * called out and an anonymous per-observer drill-down.
 *
 * It unlocks only once at least `MIN_OBSERVERS` people have responded (ADR-0003);
 * before then it shows a clear locked state with how many reads are still needed,
 * so an early Subject can't infer an individual Observer's answer from a thin
 * aggregate.
 *
 * Server component: it imports the `server-only` scoring core and aggregation, so
 * the word→tribe mapping never reaches the client (ADR-0009). The drill-down uses
 * native `<details>` so it needs no client JavaScript.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: ObserverResponse[];
}) {
  const { observerCount, average, perObserver } =
    aggregateObservers(observerResponses);

  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read
      </p>
      <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
        How others see you
      </h2>

      {!isUnlocked(observerCount) ? (
        <LockedState observerCount={observerCount} />
      ) : (
        <Unlocked
          selfWords={selfWords}
          average={average}
          perObserver={perObserver}
          observerCount={observerCount}
        />
      )}
    </section>
  );
}

/** Pre-unlock state: how many reads are in, and how many are still needed. */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  return (
    <div className="mt-5 rounded-[2px] border border-hair bg-white/60 p-6">
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={
              i < observerCount
                ? "h-2.5 w-2.5 rounded-full bg-gold"
                : "h-2.5 w-2.5 rounded-full border border-hair bg-transparent"
            }
          />
        ))}
      </div>
      <p className="mt-4 font-serif text-[18px] text-ink">
        {observerCount === 0
          ? "No one has responded yet."
          : `${observerCount} of ${MIN_OBSERVERS} responses in.`}
      </p>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS} people respond —{" "}
        {remaining === 1
          ? "just one more read"
          : `${remaining} more reads`}{" "}
        to go. Keeping it locked until then means no single answer can be singled
        out, so your Observers stay anonymous.
      </p>
    </div>
  );
}

/** Post-unlock comparison: callouts, paired bars, and the drill-down. */
function Unlocked({
  selfWords,
  average,
  perObserver,
  observerCount,
}: {
  selfWords: string[];
  average: ReturnType<typeof aggregateObservers>["average"];
  perObserver: ReturnType<typeof aggregateObservers>["perObserver"];
  observerCount: number;
}) {
  const comparison = compareProfiles(score(selfWords), average);

  return (
    <div className="mt-5">
      <p className="max-w-[520px] text-[15px] text-muted">
        Based on {observerCount} anonymous reads. Each person&rsquo;s read is
        scored on its own and the results are averaged one-for-one, so every
        Observer counts equally — no one&rsquo;s answers are pooled together.
      </p>

      {(comparison.topAgreement || comparison.topDivergence) && (
        <div className="mt-6 flex flex-col gap-3">
          {comparison.topAgreement && (
            <Callout
              label="Where you agree"
              body={`You and your Observers both see ${comparison.topAgreement.name} strongly.`}
              slug={comparison.topAgreement.slug}
            />
          )}
          {comparison.topDivergence && (
            <Callout
              label="Where you differ"
              body={
                comparison.topDivergence.gap > 0
                  ? `Others see ${comparison.topDivergence.name} in you more than you do.`
                  : `You see ${comparison.topDivergence.name} in yourself more than others do.`
              }
              slug={comparison.topDivergence.slug}
            />
          )}
        </div>
      )}

      {/* Legend for the paired bars. */}
      <div className="mt-8 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" aria-hidden />
          Others
        </span>
      </div>

      {/* Self vs others, tribe by tribe. */}
      <ul className="mt-5 flex flex-col gap-5">
        {comparison.rows.map((row) => (
          <PairedRow key={row.slug} row={row} />
        ))}
      </ul>

      {/* Anonymous per-observer drill-down. */}
      <div className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Every response is fully anonymous — no names, nothing that ties a read
          back to a person.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((profile, i) => (
            <ObserverDetail key={i} index={i} profile={profile} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A single highlighted agreement / divergence line, tinted by the tribe accent. */
function Callout({
  label,
  body,
  slug,
}: {
  label: string;
  body: string;
  slug: string;
}) {
  const accent = accentHex(getTribeBySlug(slug)?.color ?? "");
  return (
    <div
      className="rounded-[2px] border-l-2 bg-white/60 py-3 pl-4 pr-4"
      style={{ borderColor: accent }}
    >
      <span className="text-[10px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      <p className="mt-1 text-[15px] text-ink">{body}</p>
    </div>
  );
}

/** One tribe's paired self/others bars on a shared scale. */
function PairedRow({ row }: { row: ComparisonRow }) {
  const selfPct = Math.max(row.selfRelative * 100, row.self > 0 ? 3 : 0);
  const othersPct = Math.max(row.othersRelative * 100, row.others > 0 ? 3 : 0);
  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[17px] leading-none">{row.name}</span>
        {row.divergent && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-gold">
            differs
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Bar
          pct={selfPct}
          colorVar="var(--ink)"
          label={`You see ${row.name} at ${Math.round(row.selfRelative * 100)}% of the strongest read`}
        />
        <Bar
          pct={othersPct}
          colorVar="var(--gold)"
          label={`Others see ${row.name} at ${Math.round(row.othersRelative * 100)}% of the strongest read`}
        />
      </div>
    </li>
  );
}

function Bar({
  pct,
  colorVar,
  label,
}: {
  pct: number;
  colorVar: string;
  label: string;
}) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${pct}%`, backgroundColor: colorVar }}
      />
    </div>
  );
}

/** A collapsible, anonymous single-observer profile (top tribes only). */
function ObserverDetail({
  index,
  profile,
}: {
  index: number;
  profile: ReturnType<typeof aggregateObservers>["perObserver"][number];
}) {
  const top = rankScores(profile)
    .filter((t) => t.score > 0)
    .slice(0, 3);
  return (
    <li className="rounded-[2px] border border-hair">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] text-ink">
          <span>Observer {index + 1}</span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-faint transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-hair px-4 py-4">
          {top.length === 0 ? (
            <p className="text-[14px] text-muted">
              No tribe stood out in this read.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {top.map((t) => {
                const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
                return (
                  <li
                    key={t.slug}
                    className="grid grid-cols-[110px_1fr] items-center gap-4 max-[520px]:grid-cols-[88px_1fr]"
                  >
                    <span className="font-serif text-[15px] leading-none">
                      {t.name}
                    </span>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-hair/50"
                      role="img"
                      aria-label={`${t.name}: ${Math.round(t.relative * 100)}% of this observer's top score`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(t.relative * 100, 3)}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}
