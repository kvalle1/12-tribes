import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ObserverProfile } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003) — the unlocked
 * state, shown once at least three Observers have responded.
 *
 * It sets the Subject's own Self Assessment profile beside the equal-weight
 * "others" profile aggregated from the Observers, so alignment and divergence
 * read at a glance, and lists each Observer's own profile anonymously (Observer
 * 1, 2, 3, …) for drill-down. Purely presentational: it takes already-computed
 * scores as props (the scoring core stays server-side), so no word→tribe mapping
 * reaches the client.
 *
 * The two profiles are drawn as two consistent series — "You" and "Others" — so
 * the comparison reads at a glance; the per-tribe accent palette (used on the
 * single-profile result view) would only muddy a two-series chart.
 */

/** "You" series colour (brass) — consistent across every row. */
const YOU_COLOR = "var(--gold)";
/** "Others" series colour (muted) — consistent across every row. */
const OTHERS_COLOR = "var(--muted)";

export function ComparisonReport({
  selfScores,
  others,
  observers,
}: {
  selfScores: TribeScore[];
  others: TribeScore[];
  observers: ObserverProfile[];
}) {
  const rows = buildRows(selfScores, others);
  // Shared scale across both profiles so the "You" and "Others" bars are
  // directly comparable, while still filling the chart.
  const max = Math.max(...rows.flatMap((r) => [r.self, r.others]), 0);

  // Ranked by self score (the Subject's own ordering), so "others" reads against
  // how the Subject sees themselves.
  const ranked = [...rows].sort((a, b) => b.self - a.self);

  // The sharpest divergences: where others' read differs most from the self-view.
  const divergences = rows
    .map((r) => ({ ...r, gap: r.others - r.self }))
    .filter((r) => Math.abs(r.gap) > 0.001)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Legend swatch={YOU_COLOR} label="You" />
        <Legend swatch={OTHERS_COLOR} label="Others" />
      </div>

      {/* Self vs others, tribe by tribe. */}
      <section className="mt-8">
        <ul className="flex flex-col gap-5">
          {ranked.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[17px] leading-tight">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <ScoreBar label="You" value={row.self} max={max} color={YOU_COLOR} />
                <ScoreBar
                  label="Others"
                  value={row.others}
                  max={max}
                  color={OTHERS_COLOR}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Where the two views pull apart. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const seenMore = row.gap > 0;
              return (
                <li key={row.slug} className="text-[15px] text-muted">
                  <span
                    className="font-serif"
                    style={{ color: accentHex(tribe?.color ?? "") }}
                  >
                    {row.name}
                  </span>{" "}
                  — others see {seenMore ? "more" : "less"} of this in you than
                  you do.
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads behind the aggregate. No names, no relationships —
          only the words each person picked.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-7 max-[520px]:grid-cols-1">
          {observers.map((observer) => (
            <ObserverCard key={observer.index} observer={observer} />
          ))}
        </ul>
      </section>
    </div>
  );
}

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
}

/** Merge the self and others profiles into one row per tribe, canonical order. */
function buildRows(
  selfScores: TribeScore[],
  others: TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  return selfScores.map((s) => ({
    slug: s.slug,
    name: s.name,
    self: s.score,
    others: othersBySlug.get(s.slug) ?? 0,
  }));
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const fill = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(value * 100)}%`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fill * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

/** One anonymous Observer's top tribes. */
function ObserverCard({ observer }: { observer: ObserverProfile }) {
  const top = [...observer.scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 0;

  return (
    <li>
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {observer.index}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {top.length === 0 ? (
          <li className="text-[14px] text-muted">No clear read.</li>
        ) : (
          top.map((s) => {
            const tribe = getTribeBySlug(s.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={s.slug}
                className="grid grid-cols-[84px_1fr] items-center gap-2.5"
              >
                <span className="font-serif text-[15px]">{s.name}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-hair/50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((max > 0 ? s.score / max : 0) * 100, 4)}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
              </li>
            );
          })
        )}
      </ul>
    </li>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-faint">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: swatch }}
        aria-hidden
      />
      {label}
    </span>
  );
}
