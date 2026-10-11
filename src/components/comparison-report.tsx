import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9): the Subject's own Strength Profile shown
 * alongside the equal-weight "others" profile aggregated from their Observers,
 * with the tribes where self and others most diverge called out, and an
 * anonymous per-Observer drill-down.
 *
 * Both profiles are normalized 0–1 scores (the self profile from the scoring
 * core, the "others" profile from `aggregateObservers`), so the two are directly
 * comparable. Bars are drawn relative to the largest score across both profiles
 * so the paired bars stay readable. This is a presentational component over
 * plain data — it carries no scoring logic and no Observer identity (an Observer
 * is only ever "Observer N", ADR-0003).
 */

export interface ComparisonReportProps {
  /** The Subject's own normalized profile (canonical order). */
  self: readonly TribeScore[];
  /** The equal-weight aggregated "others" profile (canonical order). */
  others: readonly TribeScore[];
  /** Each Observer's own normalized profile (canonical order), for drill-down. */
  perObserver: readonly TribeScore[][];
}

interface Row {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self: positive when Observers read this tribe more strongly than you do. */
  divergence: number;
}

const accentFor = (slug: string) => accentHex(getTribeBySlug(slug)?.color ?? "");
const pct = (value: number) => `${Math.round(value * 100)}%`;

export function ComparisonReport({
  self,
  others,
  perObserver,
}: ComparisonReportProps) {
  const selfBySlug = new Map(self.map((t) => [t.slug, t.score]));
  const rows: Row[] = others.map((o) => {
    const selfScore = selfBySlug.get(o.slug) ?? 0;
    return {
      slug: o.slug,
      name: o.name,
      self: selfScore,
      others: o.score,
      divergence: o.score - selfScore,
    };
  });

  // Draw every bar relative to the largest score across both profiles so self
  // and others bars share one readable scale.
  const max = Math.max(1e-9, ...rows.map((r) => Math.max(r.self, r.others)));

  // The tribe-by-tribe list leads with the aggregated "others" ranking (the new
  // information a 360 brings); ties keep canonical order, matching the rest of
  // the app. A separate chip list shows the Subject's own ranking for reference.
  const ranked = [...rows].sort((a, b) => b.others - a.others);
  const byOwnRanking = [...rows].sort((a, b) => b.self - a.self);

  // Call out the sharpest divergences in either direction.
  const divergences = [...rows]
    .filter((r) => r.self > 0 || r.others > 0)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        You vs. how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own answers sit beside the combined read of everyone who described
        you. Each observer counts equally, so no single voice dominates. The
        gaps — where others see a tribe in you that you don&rsquo;t, or the
        reverse — are usually where the most useful insight lives.
      </p>

      {/* Where self and others diverge most. */}
      {divergences.length > 0 && (
        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others diverge most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] leading-snug">
                <span
                  className="font-serif text-[18px]"
                  style={{ color: accentFor(row.slug) }}
                >
                  {row.name}
                </span>
                <span className="text-muted">
                  {" "}
                  — {divergenceSentence(row)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Self vs aggregated others, side by side, for all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Self vs. others, tribe by tribe
        </p>
        <div className="mt-5 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <LegendSwatch solid /> You
          <LegendSwatch /> Others
        </div>
        <ul className="mt-6 flex flex-col gap-6">
          {ranked.map((row) => {
            const accent = accentFor(row.slug);
            return (
              <li key={row.slug} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: accent }}
                  >
                    {row.name}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
                    you {pct(row.self)} · others {pct(row.others)}
                  </span>
                </div>
                <PairedBars
                  self={row.self}
                  others={row.others}
                  max={max}
                  accent={accent}
                  name={row.name}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down (Observer 1 / 2 / 3 …). */}
      {perObserver.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Observer by observer
          </p>
          <p className="mt-2 max-w-[520px] text-[14px] text-muted">
            Each observer stays anonymous — no name, no relationship. Open one to
            see that observer&rsquo;s top tribes for you.
          </p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {perObserver.map((profile, index) => (
              <li key={index}>
                <ObserverDrilldown index={index} profile={profile} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The Subject's own ranking, for reference against the result page. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Your own ranking
        </p>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {byOwnRanking
            .filter((r) => r.self > 0)
            .map((row, i) => (
              <li
                key={row.slug}
                className="rounded-[2px] border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[14px] text-ink"
              >
                {i + 1}. {row.name}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function divergenceSentence(row: Row): string {
  const gap = Math.round(Math.abs(row.divergence) * 100);
  if (row.divergence > 0) {
    return `others read this ${gap}% stronger in you than you do yourself.`;
  }
  return `you read this ${gap}% stronger in yourself than others do.`;
}

function PairedBars({
  self,
  others,
  max,
  accent,
  name,
}: {
  self: number;
  others: number;
  max: number;
  accent: string;
  name: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Bar
        value={self}
        max={max}
        accent={accent}
        solid
        label={`You see ${name} at ${pct(self)} of your top tribe strength`}
      />
      <Bar
        value={others}
        max={max}
        accent={accent}
        label={`Others see ${name} at ${pct(others)} of the strongest tribe`}
      />
    </div>
  );
}

function Bar({
  value,
  max,
  accent,
  solid = false,
  label,
}: {
  value: number;
  max: number;
  accent: string;
  solid?: boolean;
  label: string;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(width, value > 0 ? 3 : 0)}%`,
          backgroundColor: accent,
          opacity: solid ? 1 : 0.45,
        }}
      />
    </div>
  );
}

function LegendSwatch({ solid = false }: { solid?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-5 rounded-full bg-ink"
      style={{ opacity: solid ? 1 : 0.4 }}
    />
  );
}

function ObserverDrilldown({
  index,
  profile,
}: {
  index: number;
  profile: readonly TribeScore[];
}) {
  const top = [...profile]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <details className="group rounded-[2px] border border-hair px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[15px]">
        <span className="font-serif">Observer {index + 1}</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-faint group-open:hidden">
          {top.length > 0 ? `top: ${top[0].name}` : "no clear signal"}
        </span>
      </summary>
      <ul className="mt-3 flex flex-wrap gap-2">
        {top.length > 0 ? (
          top.map((t) => (
            <li
              key={t.slug}
              className="rounded-[2px] px-2.5 py-1 text-[13px]"
              style={{
                backgroundColor: `${accentFor(t.slug)}1a`,
                color: accentFor(t.slug),
              }}
            >
              {t.name} · {pct(t.score)}
            </li>
          ))
        ) : (
          <li className="text-[13px] text-muted">
            This observer&rsquo;s picks didn&rsquo;t point to any tribe.
          </li>
        )}
      </ul>
    </details>
  );
}
