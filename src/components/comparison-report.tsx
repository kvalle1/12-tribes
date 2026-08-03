import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ComparisonRow } from "@/lib/observer/aggregate";

/**
 * The self-vs-others comparison report (issue #9) — the view that closes the 360
 * loop (ADR-0003). It renders three things from already-computed, server-side
 * data:
 *
 *  - the Subject's own profile beside the equal-weight aggregated "others"
 *    profile, tribe by tribe, on a shared scale so alignment and divergence read
 *    directly off the bar lengths;
 *  - the tribes where the two reads diverge most, with the direction of the gap;
 *  - an anonymous per-observer drill-down (Observer 1/2/3…), each shown only as
 *    their top tribes and carrying no identifying information.
 *
 * Presentational and client-safe: it takes plain numbers (no scoring, no
 * `server-only` imports), so the page computes the profiles server-side and this
 * view only draws them. The colour for each tribe comes from `accentHex`, the
 * single source of truth in `tribes.ts`.
 */
export function ComparisonReport({
  rows,
  perObserver,
}: {
  rows: ComparisonRow[];
  perObserver: TribeScore[][];
}) {
  // Shared scale across both profiles, so a bar's length means the same thing
  // whether it's "you" or "others" — the whole point of a comparison.
  const scaleMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  // Order by the stronger of the two reads so the tribes that matter sit on top.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // The sharpest gaps between how you and others see you, largest first.
  const divergences = [...rows]
    .filter((r) => r.self > 0 || r.others > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your own read is on top of each pair; the equal-weight average of your{" "}
        {perObserver.length} observers is below it. Every observer counts once,
        no matter how many words they chose — the gap is where growth lives.
      </p>

      {/* Side-by-side bars: the Subject's profile vs. the aggregated others. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.16em] text-faint">
          <LegendSwatch className="bg-ink" label="You" />
          <LegendSwatch className="bg-gold" label="Others" />
        </div>
        <ul className="mt-7 flex flex-col gap-5">
          {ordered.map((row) => {
            const accent = tribeAccent(row.slug);
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
                  <ProfileBar
                    label={`You: ${pct(row.self)} for ${row.name}`}
                    value={row.self}
                    scaleMax={scaleMax}
                    color="var(--color-ink, #1a1a1a)"
                  />
                  <ProfileBar
                    label={`Others: ${pct(row.others)} for ${row.name}`}
                    value={row.others}
                    scaleMax={scaleMax}
                    color="var(--color-gold, #a9842f)"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge most — the actionable heart of the report. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where others see you differently
          </p>
          <ul className="mt-6 flex flex-col gap-4">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif text-[17px]"
                  style={{ color: tribeAccent(row.slug) }}
                >
                  {row.name}
                </span>
                <span className="ml-2 text-muted">
                  {divergenceSentence(row)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down: Observer 1/2/3…, no identity. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response, fully anonymous — no names, no relationships. Only the
          tribes each observer leaned toward.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {perObserver.map((table, i) => (
            <li
              key={i}
              className="grid grid-cols-[120px_1fr] items-baseline gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="text-[12px] uppercase tracking-[0.14em] text-faint">
                Observer {i + 1}
              </span>
              <ul className="flex flex-wrap gap-2">
                {topTribes(table).map((t) => (
                  <li
                    key={t.slug}
                    className="rounded-[2px] border px-3 py-1 text-[13px] text-ink"
                    style={{
                      borderColor: `${tribeAccent(t.slug)}66`,
                    }}
                  >
                    {t.name}
                  </li>
                ))}
                {topTribes(table).length === 0 && (
                  <li className="text-[13px] text-faint">No clear lean</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ProfileBar({
  label,
  value,
  scaleMax,
  color,
}: {
  label: string;
  value: number;
  scaleMax: number;
  color: string;
}) {
  const fraction = scaleMax > 0 ? value / scaleMax : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
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
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

/** The tribe's accent hex, via the `tribes.ts` source of truth (client-safe). */
function tribeAccent(slug: string): string {
  return accentHex(getTribeBySlug(slug)?.color ?? "");
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** A tribe's top scorers for the drill-down: score-bearing tribes, top three. */
function topTribes(table: TribeScore[]): TribeScore[] {
  return [...table]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Human sentence describing a divergence's direction and size, viewer-oriented. */
function divergenceSentence(row: ComparisonRow): string {
  const magnitude = pct(Math.abs(row.delta));
  if (row.delta > 0) {
    return `Others see ${magnitude} more of this in you than you do.`;
  }
  return `You claim ${magnitude} more of this than others see in you.`;
}
