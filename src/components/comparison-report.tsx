import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import type { ObserversAggregate } from "@/lib/assessment/aggregate-observers";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Shows the
 * Subject's own profile beside the equal-weight "others" profile, calls out
 * where the two views diverge, and offers an anonymous per-observer drill-down.
 *
 * Both series are the pure scoring core's normalized 0–1 tribe scores, so they
 * sit on the same scale and can be drawn on a shared axis — the gap between a
 * "You" bar and an "Others" bar *is* the insight. Server component: it imports
 * the `server-only` scoring core, so the word→tribe mapping never reaches the
 * client (ADR-0009). Render it only from server components.
 *
 * This renders only once the report is unlocked (≥3 observers, PRD story 23);
 * the locked state is handled by the caller.
 */
export function ComparisonReport({
  selfWords,
  aggregate,
}: {
  selfWords: string[];
  aggregate: ObserversAggregate;
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregate.average;

  const othersBySlug = new Map(othersScores.map((s) => [s.slug, s.score]));

  // One row per tribe, ordered by the Subject's own ranking (the anchor), ties
  // keeping canonical order. Both series share a single scale so the bars are
  // directly comparable.
  const rows = selfScores
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      accent: accentHex(getTribeBySlug(s.slug)?.color ?? ""),
      self: s.score,
      others: othersBySlug.get(s.slug) ?? 0,
    }))
    .sort((a, b) => b.self - a.self);

  const scaleMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    Number.EPSILON,
  );

  // Where the two views diverge most — the gap that's worth a conversation.
  const divergences = [...rows]
    .map((r) => ({ ...r, delta: r.others - r.self }))
    .filter((r) => Math.abs(r.delta) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Based on {aggregate.observerCount} anonymous{" "}
        {aggregate.observerCount === 1 ? "response" : "responses"}. Each observer
        is weighted equally, so no single voice dominates.
      </p>

      {/* Side-by-side bars: the Subject's own view vs the aggregated others. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Self vs others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <LegendSwatch label="You" filled />
            <LegendSwatch label="Others" />
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[17px] leading-none">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label="You"
                  value={row.self}
                  scaleMax={scaleMax}
                  accent={row.accent}
                  tribeName={row.name}
                  filled
                />
                <CompareBar
                  label="Others"
                  value={row.others}
                  scaleMax={scaleMax}
                  accent={row.accent}
                  tribeName={row.name}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Alignment / divergence callout. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where the views meet — and part
        </p>
        {divergences.length === 0 ? (
          <p className="mt-4 max-w-[560px] text-[15px] text-muted">
            Your own read and the others&rsquo; read line up closely across the
            board — no tribe stands out as a place where they see you
            differently.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif text-[17px]"
                  style={{ color: row.accent }}
                >
                  {row.name}
                </span>{" "}
                <span className="text-muted">
                  {row.delta > 0
                    ? "— others see this in you more strongly than you do"
                    : "— you claim this more strongly than others see it"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[560px] text-[14px] text-muted">
          Each observer&rsquo;s own read, kept anonymous. No names, no
          relationships — just the spread of opinion.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {aggregate.perObserver.map((observer) => {
            const top = rankScores(observer.scores)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <details
                key={observer.index}
                className="rounded-[2px] border border-hair bg-white/40 px-5 py-4"
              >
                <summary className="cursor-pointer list-none text-[14px] tracking-[0.04em] text-ink marker:content-none">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
                    Observer {observer.index}
                  </span>
                  {top.length > 0 && (
                    <span className="ml-3 text-muted">
                      reads you as{" "}
                      <span
                        className="font-serif text-[16px]"
                        style={{
                          color: accentHex(
                            getTribeBySlug(top[0].slug)?.color ?? "",
                          ),
                        }}
                      >
                        {top[0].name}
                      </span>
                    </span>
                  )}
                </summary>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {top.map((tribe) => {
                    const accent = accentHex(
                      getTribeBySlug(tribe.slug)?.color ?? "",
                    );
                    return (
                      <li
                        key={tribe.slug}
                        className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                      >
                        <span className="text-[14px] text-ink">
                          {tribe.name}
                        </span>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-hair/50"
                          role="img"
                          aria-label={`${tribe.name}: ${Math.round(tribe.relative * 100)}% of this observer's top score`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(tribe.relative * 100, 3)}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
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

/**
 * How far apart the self and others normalized scores must be for a tribe to be
 * called out as a divergence. A small absolute gap on the shared 0–1 scale.
 */
const DIVERGENCE_THRESHOLD = 0.08;

function CompareBar({
  label,
  value,
  scaleMax,
  accent,
  tribeName,
  filled = false,
}: {
  label: string;
  value: number;
  scaleMax: number;
  accent: string;
  tribeName: string;
  filled?: boolean;
}) {
  const fraction = scaleMax > 0 ? value / scaleMax : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[44px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${tribeName}, ${label}: ${Math.round(fraction * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: filled ? 1 : 0.45,
          }}
        />
      </div>
    </div>
  );
}

function LegendSwatch({ label, filled = false }: { label: string; filled?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full bg-ink"
        style={{ opacity: filled ? 1 : 0.4 }}
      />
      {label}
    </span>
  );
}
