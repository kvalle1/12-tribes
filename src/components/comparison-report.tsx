import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import type { ObserverAggregate } from "@/lib/assessment/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, so the gap between how you see
 * yourself and how others see you is visible at a glance — "the gap is where
 * growth lives."
 *
 * Server component: it imports the `server-only` scoring core to score the
 * Subject's own words, and passes only plain tribe scores down to the (client)
 * drill-down. The word→tribe mapping never reaches the client.
 *
 * Callers gate on `aggregate.unlocked`; this view assumes it is rendered only
 * once the report has unlocked (≥3 Observers), and draws both profiles on one
 * shared scale so a longer self bar genuinely means a higher score than a
 * shorter others bar (and vice versa).
 */
export function ComparisonReport({
  selfWords,
  primarySlug,
  aggregate,
}: {
  selfWords: string[];
  primarySlug: string;
  aggregate: ObserverAggregate;
}) {
  const self = score(selfWords);
  const others = aggregate.others;

  // A single shared denominator so the "you" and "others" bars are directly
  // comparable — the taller bar is genuinely the higher score.
  const sharedMax = Math.max(
    ...self.map((t) => t.score),
    ...others.map((t) => t.score),
    0,
  );

  const byOwnSlug = new Map(others.map((t) => [t.slug, t]));

  // One row per tribe, ordered by the Subject's own view (their strongest first)
  // so the report is anchored on how they see themselves.
  const rows = [...self]
    .sort((a, b) => b.score - a.score)
    .map((selfTribe) => {
      const othersTribe = byOwnSlug.get(selfTribe.slug)!;
      return {
        slug: selfTribe.slug,
        name: selfTribe.name,
        self: selfTribe.score,
        others: othersTribe.score,
        gap: Math.abs(selfTribe.score - othersTribe.score),
      };
    });

  // The two or three tribes where self and others diverge most — the useful part.
  const divergences = [...rows]
    .filter((r) => r.self > 0 || r.others > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  const primary = getTribeBySlug(primarySlug);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        You, and how{" "}
        <span className="text-gold">{aggregate.observerCount}</span> others
        see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] text-muted">
        Each person who weighed in was scored on their own, then averaged with
        equal weight — so no single voice counts for more. Where the two bars
        agree, your self-image is confirmed. Where they diverge is where the
        most useful insight lives.
      </p>

      <Legend />

      {/* Self vs others, all twelve tribes, on one shared scale. */}
      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs others · all twelve
        </p>
        <ul className="mt-6 flex flex-col gap-6">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            const isPrimary = row.slug === primarySlug;
            return (
              <li key={row.slug}>
                <div className="flex items-baseline justify-between">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: isPrimary ? accent : undefined }}
                  >
                    {row.name}
                    {isPrimary && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-faint">
                        Your primary
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    value={row.self}
                    max={sharedMax}
                    accent={accent}
                    solid
                  />
                  <CompareBar
                    label="Others"
                    value={row.others}
                    max={sharedMax}
                    accent={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two views diverge most. */}
      {divergences.length > 0 && divergences[0].gap > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others see you differently
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const seesMore = row.others > row.self;
              return (
                <li
                  key={row.slug}
                  className="flex flex-wrap items-baseline gap-x-2 text-[15px]"
                >
                  <span className="font-serif text-[17px]">{row.name}</span>
                  <span className="text-muted">
                    {seesMore
                      ? "others read this in you more strongly than you do"
                      : "you claim this more than others see it"}
                    .
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down (Observer 1/2/3, no attributes). */}
      <ObserverDrilldown perObserver={aggregate.perObserver} />

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
        {primary && (
          <Link
            href={`/tribes/${primary.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full {primary.name} profile
          </Link>
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex items-center gap-6 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full bg-ink/70" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-2">
        <span
          className="h-2.5 w-6 rounded-full border border-ink/40"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

/**
 * A single labelled bar drawn on the report's shared 0..`max` scale. The "You"
 * bar is filled solid in the tribe accent; the "Others" bar is a lighter,
 * outlined fill so the two read as distinct at a glance.
 */
function CompareBar({
  label,
  value,
  max,
  accent,
  solid = false,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
  solid?: boolean;
}) {
  const fraction = max > 0 ? value / max : 0;
  const width = `${Math.max(fraction * 100, value > 0 ? 2 : 0)}%`;
  return (
    <div className="grid grid-cols-[54px_1fr] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/40"
        role="img"
        aria-label={`${label}: ${Math.round(fraction * 100)}% of the strongest score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width,
            backgroundColor: solid ? accent : `${accent}55`,
            border: solid ? undefined : `1px solid ${accent}`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Fully anonymous per-observer drill-down. Each Observer is shown only as
 * "Observer N" with the tribes they read most strongly — no name, no
 * relationship, nothing linking a read back to a person (ADR-0003). Uses a
 * native `<details>` so no client JavaScript is needed.
 */
function ObserverDrilldown({
  perObserver,
}: {
  perObserver: ObserverAggregate["perObserver"];
}) {
  if (perObserver.length === 0) return null;

  return (
    <section className="mt-14 border-t border-hair pt-8">
      <details className="group">
        <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.2em] text-faint transition-colors hover:text-ink">
          <span className="group-open:hidden">
            Show the individual reads ({perObserver.length})
          </span>
          <span className="hidden group-open:inline">
            Hide the individual reads
          </span>
        </summary>
        <p className="mt-3 max-w-[520px] text-[14px] text-muted">
          Each read below is anonymous — shown only as a number, in no
          particular order, with nothing that identifies who gave it.
        </p>
        <ul className="mt-6 flex flex-col gap-6">
          {perObserver.map((observer) => (
            <li key={observer.index}>
              <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
                Observer {observer.index}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {topTribes(observer.scores).map((tribe) => {
                  const accent = accentHex(
                    getTribeBySlug(tribe.slug)?.color ?? "",
                  );
                  return (
                    <li
                      key={tribe.slug}
                      className="rounded-[2px] border px-3 py-1 text-[13px]"
                      style={{
                        borderColor: `${accent}66`,
                        backgroundColor: `${accent}12`,
                      }}
                    >
                      {tribe.name}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** The tribes an Observer read most strongly (their top scorers, ties kept). */
function topTribes(scores: TribeScore[]): TribeScore[] {
  const ranked = [...scores]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, 4);
}
