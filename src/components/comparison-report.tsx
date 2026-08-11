import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { TribeComparison } from "@/lib/observer/aggregate";

/**
 * A tribe counts as "seen by both" only when the self/others gap is within this
 * fraction of the larger score — so agreement means genuine closeness, not merely
 * the smallest gap in an otherwise divergent profile.
 */
const AGREEMENT_PROXIMITY = 0.25;

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Shows the
 * Subject's own profile alongside the equal-weight aggregated "others" profile,
 * calls out where the two agree and where they diverge, and offers an anonymous
 * per-observer drill-down (Observer 1/2/3…). It renders only once the report is
 * unlocked (≥3 Observers); the locked state lives on the page.
 *
 * Purely presentational: it receives already-computed comparison rows and
 * per-observer scores (the scoring core runs server-side, ADR-0009) and only
 * reads client-safe tribe metadata. Native `<details>` drives the drill-down, so
 * no client JS is needed.
 */
export function ComparisonReport({
  comparison,
  perObserver,
  observerCount,
}: {
  comparison: TribeComparison[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  // Shared scale across both series so "You" and "Others" bars are directly
  // comparable within a row and across rows.
  const max = Math.max(
    0,
    ...comparison.map((row) => Math.max(row.self, row.others)),
  );

  // Most salient tribes first (by the higher of the two scores); ties keep the
  // canonical order the input arrives in (stable sort).
  const rows = [...comparison].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Agreement: both series register the tribe AND the gap is genuinely small —
  // within AGREEMENT_PROXIMITY of the larger of the two scores. The relative
  // test keeps this honest when every gap is large: nothing is labelled "seen by
  // both" just for being the least-divergent of a divergent set.
  const agreement = rows
    .filter((r) => {
      if (r.self <= 0 || r.others <= 0) return false;
      const larger = Math.max(r.self, r.others);
      return Math.abs(r.delta) <= AGREEMENT_PROXIMITY * larger;
    })
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    .slice(0, 2);

  // Blind spots: others rate it clearly higher than you do.
  const blindSpots = rows
    .filter((r) => r.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2);

  // Overclaims: you rate it clearly higher than others do.
  const overclaims = rows
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You vs. how others see you
      </h1>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own profile alongside the combined read of{" "}
        {observerCount} {observerCount === 1 ? "person" : "people"} who know you,
        weighted equally so no single voice counts for more.
      </p>

      {/* Side-by-side bars: You vs Others for every tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
            Others
          </span>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
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
                    value={row.self}
                    max={max}
                    color="var(--color-ink, #1a1a1a)"
                    name={row.name}
                  />
                  <CompareBar
                    label="Others"
                    value={row.others}
                    max={max}
                    color={accent}
                    name={row.name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where you align and where you diverge — the gap is where growth lives. */}
      <section className="mt-14 grid gap-8 border-t border-hair pt-8 sm:grid-cols-3">
        <GapColumn
          heading="Where you agree"
          empty="No shared strengths stood out yet."
          items={agreement.map((r) => ({ name: r.name, note: "seen by both" }))}
        />
        <GapColumn
          heading="Others see more"
          empty="Nothing others rated notably higher."
          items={blindSpots.map((r) => ({
            name: r.name,
            note: `+${pct(-r.delta)} vs you`,
          }))}
        />
        <GapColumn
          heading="You see more"
          empty="Nothing you rated notably higher."
          items={overclaims.map((r) => ({
            name: r.name,
            note: `+${pct(r.delta)} vs others`,
          }))}
        />
      </section>

      {/* Anonymous per-observer drill-down (Observer 1/2/3…). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each observer stays anonymous — no names, no labels, just their read.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((scores, index) => {
            const top = [...scores]
              .sort((a, b) => b.score - a.score)
              .filter((s) => s.score > 0)
              .slice(0, 3);
            return (
              <li key={index}>
                <details className="group rounded-[2px] border border-hair bg-white">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[15px] text-ink marker:content-['']">
                    <span className="font-serif text-[17px]">
                      Observer {index + 1}
                    </span>
                    <span className="text-[12px] uppercase tracking-[0.14em] text-faint transition-transform group-open:rotate-90">
                      →
                    </span>
                  </summary>
                  <div className="border-t border-hair px-4 py-3.5">
                    {top.length === 0 ? (
                      <p className="text-[14px] text-muted">
                        No clear tribe signal from this observer.
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-2.5">
                        {top.map((s) => {
                          const tribe = getTribeBySlug(s.slug);
                          const accent = accentHex(tribe?.color ?? "");
                          return (
                            <li
                              key={s.slug}
                              className="rounded-[2px] border px-3 py-1.5 text-[14px] text-ink"
                              style={{
                                borderColor: `${accent}66`,
                                backgroundColor: `${accent}14`,
                              }}
                            >
                              {s.name}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** One labelled bar within a comparison row, scaled to the shared max. */
function CompareBar({
  label,
  value,
  max,
  color,
  name,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  name: string;
}) {
  const relative = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${name} — ${label.toLowerCase()}: ${pct(value)}`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-[38px] shrink-0 text-right text-[11px] tabular-nums text-faint">
        {pct(value)}
      </span>
    </div>
  );
}

/** One column of the align/diverge summary. */
function GapColumn({
  heading,
  items,
  empty,
}: {
  heading: string;
  items: { name: string; note: string }[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
        {heading}
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.name} className="flex items-baseline justify-between gap-3">
              <span className="font-serif text-[17px] text-ink">{item.name}</span>
              <span className="text-[12px] tabular-nums text-muted">
                {item.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Format a normalized 0–1 score as a whole-number percentage. */
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
