import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ObserverAggregate } from "@/lib/assessment/aggregateObservers";
import {
  compareProfiles,
  largestDivergences,
  type ComparisonRow,
} from "@/lib/assessment/comparison";

/**
 * The 360 self-vs-others comparison report (issue #9). Shows the Subject's own
 * normalized profile alongside the equal-weight aggregated "others" profile,
 * tribe by tribe on a shared scale so the two reads are directly comparable;
 * calls out where they diverge most ("the gap is where the most useful insight
 * lives"); and offers an anonymous per-Observer drill-down (Observer 1 / 2 / 3)
 * that never attaches any identity.
 *
 * Presentational and client-safe: it takes already-computed score tables in and
 * draws from them, so it imports no scoring/server-only code of its own.
 */
export function ComparisonView({
  selfScores,
  others,
}: {
  selfScores: TribeScore[];
  others: ObserverAggregate;
}) {
  const rows = compareProfiles(selfScores, others.scores);
  // One shared scale across both series so the "you" and "others" bars are
  // comparable; fall back to 1 so an all-zero profile doesn't divide by zero.
  const max = Math.max(
    1e-9,
    ...rows.map((r) => Math.max(r.self, r.others)),
  );
  const ranked = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );
  const divergences = largestDivergences(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {others.observerCount}{" "}
        {others.observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        You, and how the room sees you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile sits beside the equal-weight average of everyone who
        answered — each observer counts the same, however many words they picked.
        Where the two part ways is where the most useful insight lives.
      </p>

      {/* Where self and others diverge most — the headline of the report. */}
      {divergences.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and the room differ most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px]">
                <span
                  className="font-serif text-[18px]"
                  style={{ color: accentColor(row.slug) }}
                >
                  {row.name}
                </span>{" "}
                <span className="text-muted">
                  — {describeDivergence(row)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Side-by-side bars for all twelve tribes, strongest first. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs. the room, tribe by tribe
        </p>
        <div className="mt-4 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <LegendSwatch className="bg-ink" label="You" />
          <LegendSwatch className="bg-gold" label="Others" />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {ranked.map((row) => (
            <li key={row.slug} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span
                  className="font-serif text-[17px] leading-none"
                  style={{ color: accentColor(row.slug) }}
                >
                  {row.name}
                </span>
                <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
                  you {pct(row.self)} · others {pct(row.others)}
                </span>
              </div>
              <PairedBar
                self={row.self / max}
                others={row.others / max}
                hasSelf={row.self > 0}
                hasOthers={row.others > 0}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own top tribes, kept fully anonymous — no names,
          no relationships, just the spread of opinion.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {others.perObserver.map((table, i) => (
            <li
              key={i}
              className="rounded-[2px] border border-hair p-5"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {topTribes(table).map((t) => (
                  <li
                    key={t.slug}
                    className="flex items-center justify-between text-[14px]"
                  >
                    <span
                      className="font-serif text-[15px]"
                      style={{ color: accentColor(t.slug) }}
                    >
                      {t.name}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
                      {pct(t.score)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

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

function PairedBar({
  self,
  others,
  hasSelf,
  hasOthers,
}: {
  self: number;
  others: number;
  hasSelf: boolean;
  hasOthers: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`You: ${Math.round(self * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full bg-ink transition-[width]"
          style={{ width: `${hasSelf ? Math.max(self * 100, 3) : 0}%` }}
        />
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`Others: ${Math.round(others * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full bg-gold transition-[width]"
          style={{ width: `${hasOthers ? Math.max(others * 100, 3) : 0}%` }}
        />
      </div>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} aria-hidden />
      {label}
    </span>
  );
}

/** A tribe's accent hex, falling back to brass for an unknown slug. */
function accentColor(slug: string): string {
  return accentHex(getTribeBySlug(slug)?.color ?? "");
}

/** The top-scoring tribes in an observer's own profile (drops zeros). */
function topTribes(table: TribeScore[], limit = 3): TribeScore[] {
  return [...table]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** A tribe's normalized 0–1 score as a whole-number percentage. */
function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Plain-language framing of a single tribe's self-vs-others gap. */
function describeDivergence(row: ComparisonRow): string {
  const points = Math.round(row.divergence * 100);
  return row.delta > 0
    ? `others see this in you more strongly than you do (+${points} pts)`
    : `you see this in yourself more strongly than others do (+${points} pts)`;
}
