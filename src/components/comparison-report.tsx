import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  scoreEachObserver,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * beside the equal-weight "others" profile aggregated from Observer responses,
 * the tribes where the two views diverge most, and an anonymous per-observer
 * drill-down.
 *
 * Server component: it imports the `server-only` scoring core and aggregation,
 * so the word→tribe mapping and all scoring stay off the client (ADR-0009). It
 * takes the raw selections (`selfWords`, `observerWordLists`) and recomputes
 * everything, so what it shows can never drift from the stored responses.
 *
 * The report is gated: below `MIN_OBSERVERS` responses it renders a locked state
 * with progress, so a thin (and de-anonymizable) "others" signal is never shown.
 */
export function ComparisonReport({
  selfWords,
  observerWordLists,
}: {
  selfWords: string[];
  observerWordLists: string[][];
}) {
  const observerCount = observerWordLists.length;

  if (!isReportUnlocked(observerCount)) {
    return <LockedState observerCount={observerCount} />;
  }

  const self = score(selfWords);
  const others = aggregateObservers(observerWordLists);
  const divergence = compareProfiles(self, others);
  const perObserver = scoreEachObserver(observerWordLists);

  // Shared scale across both profiles so self and others bars are directly
  // comparable; the single tallest bar anywhere fills its track.
  const max = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    0,
  );

  // Order tribes by their strongest showing in either view, so the most salient
  // tribes lead; ties keep canonical order (the `compareProfiles` output order).
  const rows = [...divergence].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // The sharpest disagreements, largest gap first, ignoring near-ties.
  const DIVERGENCE_FLOOR = 0.08;
  const topDivergences = [...divergence]
    .filter((d) => Math.abs(d.delta) >= DIVERGENCE_FLOOR)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You vs. how others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own word-selection on the left of each tribe, and the equal-weight
        average of {observerCount} anonymous observer
        {observerCount === 1 ? "" : "s"} on the right. Every observer counts once,
        no matter how many words they chose.
      </p>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold/70" />
          Others (avg)
        </span>
      </div>

      {/* Paired self-vs-others bars for all twelve tribes. */}
      <section className="mt-6">
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
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <ComparisonBar
                    label={`You: ${pct(row.self)}`}
                    value={row.self}
                    max={max}
                    color="var(--ink)"
                    fallbackColor="#1a1a1a"
                  />
                  <ComparisonBar
                    label={`Others: ${pct(row.others)}`}
                    value={row.others}
                    max={max}
                    color={accent}
                    fallbackColor={accent}
                    muted
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you and others diverge
        </p>
        {topDivergences.length === 0 ? (
          <p className="mt-4 max-w-[560px] text-[15px] text-muted">
            Your self-view and the observer average line up closely — no tribe
            stands out as a blind spot or a hidden strength.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {topDivergences.map((d) => (
              <li key={d.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{d.name}</span>{" "}
                <span className="text-muted">
                  {d.delta > 0
                    ? `— you see more of this in yourself than others do (${pct(d.self)} vs ${pct(d.others)})`
                    : `— others see more of this in you than you claim (${pct(d.others)} vs ${pct(d.self)})`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer
        </p>
        <p className="mt-2 max-w-[560px] text-[14px] text-muted">
          Fully anonymous — observers are shown only as a number, with no name or
          relationship.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((profile, i) => {
            const top = [...profile]
              .sort((a, b) => b.score - a.score)
              .filter((s) => s.score > 0)
              .slice(0, 3);
            return (
              <details
                key={i}
                className="rounded-[2px] border border-hair px-4 py-3"
              >
                <summary className="cursor-pointer select-none text-[14px] text-ink">
                  Observer {i + 1}
                  <span className="ml-2 text-muted">
                    {top.length > 0
                      ? `· top: ${top.map((t) => t.name).join(", ")}`
                      : "· no clear tribe"}
                  </span>
                </summary>
                <ul className="mt-3 flex flex-col gap-2">
                  {top.length === 0 && (
                    <li className="text-[14px] text-muted">
                      This observer&rsquo;s words didn&rsquo;t point to any tribe.
                    </li>
                  )}
                  {top.map((t) => {
                    const tribe = getTribeBySlug(t.slug);
                    return (
                      <li
                        key={t.slug}
                        className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                      >
                        <span className="text-[15px]">{t.name}</span>
                        <ComparisonBar
                          label={`${t.name}: ${pct(t.score)}`}
                          value={t.score}
                          max={max}
                          color={accentHex(tribe?.color ?? "")}
                          fallbackColor="#b8902f"
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

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </Link>
      </div>
    </div>
  );
}

/** A single horizontal bar on the shared 0–max scale, with an accessible label. */
function ComparisonBar({
  label,
  value,
  max,
  color,
  fallbackColor,
  muted = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  fallbackColor: string;
  muted?: boolean;
}) {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color || fallbackColor,
          opacity: muted ? 0.7 : 1,
        }}
      />
    </div>
  );
}

/** The report's locked state: shown until at least `MIN_OBSERVERS` have responded. */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  const fraction = Math.min(observerCount / MIN_OBSERVERS, 1);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not enough observers yet
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        described you. So far <strong className="text-ink">{observerCount}</strong>{" "}
        {observerCount === 1 ? "person has" : "people have"} responded — just{" "}
        <strong className="text-ink">{remaining}</strong> more to go.
      </p>

      <div className="mt-8 max-w-[400px]">
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-faint">
          <span>{observerCount} of {MIN_OBSERVERS}</span>
          <span>{Math.round(fraction * 100)}%</span>
        </div>
        <div
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS} observers responded`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.max(fraction * 100, observerCount > 0 ? 4 : 0)}%` }}
          />
        </div>
      </div>

      <p className="mt-8 max-w-[560px] text-[15px] text-muted">
        Share your observer link with a few more people, then check back here.
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result and share link
        </Link>
      </div>
    </div>
  );
}

/** Format a normalized 0–1 score as a whole-number percentage. */
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
