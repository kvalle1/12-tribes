import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import {
  compareProfiles,
  type ObserverAggregate,
  type ProfileComparisonRow,
} from "@/lib/observer/aggregate";
import {
  OBSERVER_UNLOCK_THRESHOLD,
  isComparisonUnlocked,
} from "@/lib/observer/constants";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregated "others" profile, with the alignments and
 * divergences called out and an anonymous per-observer drill-down.
 *
 * It renders the locked state on its own until at least
 * `OBSERVER_UNLOCK_THRESHOLD` observers have responded — below that floor the
 * aggregate is never shown, which keeps a lone observer from being singled out.
 *
 * Server component: it leans on the scoring-derived `self`/`aggregate` data and
 * on `compareProfiles`, which lives behind the `server-only` scoring core
 * (ADR-0009). Render it only from server components.
 */
export function ComparisonReport({
  self,
  aggregate,
}: {
  /** The Subject's own normalized scores, canonical order. */
  self: TribeScore[];
  /** The aggregated "others" profile + per-observer breakdown. */
  aggregate: ObserverAggregate;
}) {
  if (!isComparisonUnlocked(aggregate.observerCount)) {
    return <LockedState observerCount={aggregate.observerCount} />;
  }

  const rows = compareProfiles(self, aggregate.average);

  // A shared scale across self and others so the two bars are directly
  // comparable (the same approach the self result view takes for its ranking).
  const max = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );
  const frac = (value: number) => (max > 0 ? value / max : 0);

  // Order by the stronger of the two reads so the tribes that carry signal —
  // whether from the Subject or the others — sit at the top.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Divergences: where others see materially more or less than the Subject.
  const byDelta = [...rows].sort((a, b) => b.delta - a.delta);
  const othersSeeMore = byDelta.filter((r) => r.delta > DIVERGENCE_FLOOR);
  const youSeeMore = [...byDelta]
    .reverse()
    .filter((r) => r.delta < -DIVERGENCE_FLOOR);

  // Alignment: tribes in the top third of both reads — a shared headline.
  const topSelf = topSlugs(rows, (r) => r.self);
  const topOthers = topSlugs(rows, (r) => r.others);
  const aligned = ordered.filter(
    (r) => topSelf.has(r.slug) && topOthers.has(r.slug),
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {aggregate.observerCount} observers
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,54px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own read is set beside the combined read of your {" "}
        {aggregate.observerCount} observers. Each observer counts equally, no
        matter how many words they picked.
      </p>

      {(aligned.length > 0 ||
        othersSeeMore.length > 0 ||
        youSeeMore.length > 0) && (
        <section className="mt-12 grid gap-6 border-t border-hair pt-8 sm:grid-cols-3">
          <Highlight
            label="You agree on"
            tribes={aligned.map((r) => r.slug)}
            empty="No shared headline tribe"
          />
          <Highlight
            label="Others see more"
            tribes={othersSeeMore.map((r) => r.slug)}
            empty="Nothing stands out"
          />
          <Highlight
            label="You see more"
            tribes={youSeeMore.map((r) => r.slug)}
            empty="Nothing stands out"
          />
        </section>
      )}

      {/* Self vs. others, bar beside bar, so divergence is visible at a glance. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.16em] text-faint">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" /> You
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Others
          </span>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {ordered.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug}>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px]">{row.name}</span>
                  <DeltaTag delta={row.delta} />
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <CompareBar
                    fraction={frac(row.self)}
                    color="var(--ink)"
                    label={`You read ${row.name} at ${Math.round(row.self * 100)}%`}
                  />
                  <CompareBar
                    fraction={frac(row.others)}
                    color={accent}
                    label={`Others read ${row.name} at ${Math.round(row.others * 100)}%`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down (Observer 1/2/3, no attributes). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[560px] text-[14px] text-muted">
          Each observer&rsquo;s own read, kept anonymous. There&rsquo;s no way to
          tell who answered which.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {aggregate.perObserver.map((one, i) => (
            <li
              key={i}
              className="rounded-[2px] border border-hair px-5 py-4"
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {topTribes(one).map((s) => {
                  const tribe = getTribeBySlug(s.slug);
                  const accent = accentHex(tribe?.color ?? "");
                  return (
                    <li
                      key={s.slug}
                      className="rounded-[2px] border px-3 py-1 text-[13px]"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {s.name}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-14 border-t border-hair pt-8">
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

/** Deltas smaller than this (in normalized score) aren't worth calling out. */
const DIVERGENCE_FLOOR = 0.03;

function topSlugs(
  rows: ProfileComparisonRow[],
  by: (r: ProfileComparisonRow) => number,
): Set<string> {
  // Top third of the twelve tribes — the shared "headline" band.
  const count = Math.max(1, Math.round(rows.length / 3));
  return new Set(
    [...rows]
      .sort((a, b) => by(b) - by(a))
      .slice(0, count)
      .map((r) => r.slug),
  );
}

/** A single observer's strongest tribes, for the anonymous drill-down. */
function topTribes(scores: TribeScore[]): TribeScore[] {
  const ranked = [...scores]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, 3);
}

function Highlight({
  label,
  tribes,
  empty,
}: {
  label: string;
  tribes: string[];
  empty: string;
}) {
  const names = tribes
    .map((slug) => getTribeBySlug(slug)?.name)
    .filter((n): n is string => Boolean(n));
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </p>
      <p className="mt-2 font-serif text-[20px] leading-snug">
        {names.length > 0 ? names.join(", ") : (
          <span className="text-[15px] not-italic text-muted">{empty}</span>
        )}
      </p>
    </div>
  );
}

function DeltaTag({ delta }: { delta: number }) {
  if (Math.abs(delta) <= DIVERGENCE_FLOOR) {
    return (
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        In step
      </span>
    );
  }
  const othersMore = delta > 0;
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.14em] ${othersMore ? "text-gold" : "text-muted"}`}
    >
      {othersMore ? "Others see more" : "You see more"}
    </span>
  );
}

function CompareBar({
  fraction,
  color,
  label,
}: {
  fraction: number;
  color: string;
  label: string;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,54px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have responded — enough that no single observer can be singled out.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </p>
        <p className="mt-2 font-serif text-[40px] leading-none">
          {observerCount}
          <span className="text-[20px] text-muted">
            {" "}
            / {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </p>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison opens up."
            : `${remaining} more responses and your comparison opens up.`}
        </p>
      </div>

      <div className="mt-10">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
