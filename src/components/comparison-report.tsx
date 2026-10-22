import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import type { ComparisonRow } from "@/lib/observer/compare";

/**
 * The self-vs-others comparison report (issue #9, ADR-0003): the Subject's own
 * profile shown alongside the equal-weight aggregate of how their anonymous
 * Observers see them, tribe by tribe, with the gaps called out — and an anonymous
 * per-observer drill-down below.
 *
 * Purely presentational: it receives already-computed, canonical-order scores
 * (self + aggregated others + per-observer), so the scoring core and the
 * word→tribe mapping stay server-side (ADR-0009). Render it from a server
 * component that does the scoring.
 */
export function ComparisonReport({
  comparison,
  perObserver,
  observerCount,
}: {
  comparison: ComparisonRow[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  // Shared scale so the "You" and "Others" bars are directly comparable.
  const max = comparison.reduce(
    (m, row) => Math.max(m, row.self, row.other),
    0,
  );

  // The single biggest gap between how the Subject and their Observers see them —
  // the most useful insight in a 360 (PRD: "the gap is where the insight lives").
  const widestGap = comparison.reduce(
    (widest, row) => (row.divergence > widest.divergence ? row : widest),
    comparison[0],
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs the {observerCount} who answered
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own read is in <span className="text-ink">ink</span>; the
        equal-weight average of your {observerCount} anonymous observers is in{" "}
        <span className="text-gold">gold</span>. Each observer counts once,
        however many words they picked.
      </p>

      {widestGap && widestGap.divergence > 0 && (
        <p className="mt-6 rounded-[2px] border border-gold/40 bg-gold/10 px-4 py-3 text-[14px] text-ink">
          The widest gap is <strong className="font-semibold">{widestGap.name}</strong>
          {" — "}
          {widestGap.self > widestGap.other
            ? "you see more of it in yourself than others do."
            : "others see more of it in you than you do."}
        </p>
      )}

      {/* Paired bars — the Subject's score and the aggregated others' score. */}
      <section className="mt-12 border-t border-hair pt-8">
        <div className="mb-6 flex items-center gap-6 text-[11px] uppercase tracking-[0.14em] text-faint">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-5 rounded-full bg-ink" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-5 rounded-full bg-gold" />
            Others
          </span>
        </div>
        <ul className="flex flex-col gap-6">
          {comparison.map((row) => {
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
                  <Bar
                    label={`You on ${row.name}`}
                    value={row.self}
                    max={max}
                    colorClass="bg-ink"
                  />
                  <Bar
                    label={`Others on ${row.name}`}
                    value={row.other}
                    max={max}
                    colorClass="bg-gold"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — Observer 1 / 2 / 3, no attributes. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own top tribes, fully anonymous — no names, no
          relationships, just the spread of how individual people read you.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-5 max-[520px]:grid-cols-1">
          {perObserver.map((observer, index) => {
            const top = rankScores(observer)
              .filter((t) => t.score > 0)
              .slice(0, 4);
            return (
              <li
                key={index}
                className="rounded-[2px] border border-hair p-4"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {top.map((t) => {
                    const tribe = getTribeBySlug(t.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li key={t.slug} className="flex items-center gap-2.5">
                        <span className="w-[84px] shrink-0 font-serif text-[14px] leading-tight">
                          {t.name}
                        </span>
                        <span
                          className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
                          role="img"
                          aria-label={`${t.name}: ${Math.round(t.relative * 100)}% of this observer's top score`}
                        >
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(t.relative * 100, 4)}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** One labelled bar on the shared 0–max scale, with an accessible description. */
function Bar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
    >
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}
