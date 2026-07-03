import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { ProfileComparison } from "@/lib/assessment/aggregateObservers";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9): the Subject's own read set beside the
 * equal-weight aggregate of how their Observers see them, plus an anonymous
 * per-observer drill-down.
 *
 * It is purely presentational — every score is computed on the server (the
 * `server-only` scoring core and aggregation never reach the client) and passed
 * in as plain data. `getTribeBySlug`/`accentHex` are the client-safe display
 * helpers from `tribes.ts`.
 *
 * Bars for both profiles share one scale (the largest score across either read)
 * so "self" and "others" are visually comparable at a glance, and the largest
 * divergences are called out so the gap — where the useful insight lives — is
 * easy to find.
 */
export function ComparisonReport({
  comparison,
  observers,
  primarySlug,
}: {
  /** Per-tribe self-vs-others rows, already sorted strongest-first. */
  comparison: ProfileComparison[];
  /** One normalized profile per Observer, in stable order (Observer 1, 2, …). */
  observers: TribeScore[][];
  /** The Subject's own Primary slug, highlighted in the list. */
  primarySlug: string;
}) {
  const scale = Math.max(
    ...comparison.flatMap((row) => [row.self, row.others]),
    0,
  );

  // The sharpest gaps between the two reads, largest first — the tribes where
  // self and others disagree most. Only surface gaps that are actually material.
  const divergences = [...comparison]
    .filter((row) => Math.abs(row.divergence) >= 0.08)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,54px)] font-semibold leading-[1.05]">
        You, and how {observers.length} others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Each bar pairs your own read (solid) with the equal-weight average of
        your Observers (outlined). Every Observer counts the same, no matter how
        many words they picked.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full border border-ink/60 bg-transparent" />
          Others
        </span>
      </div>

      {/* Paired self/others bars, all twelve tribes on a shared scale. */}
      <section className="mt-8">
        <ul className="flex flex-col gap-5">
          {comparison.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
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
                      <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.14em] text-faint">
                        Your primary
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Bar
                    fraction={scale > 0 ? row.self / scale : 0}
                    color={accent}
                    filled
                    label={`You see ${row.name} at ${pct(row.self)}`}
                  />
                  <Bar
                    fraction={scale > 0 ? row.others / scale : 0}
                    color={accent}
                    filled={false}
                    label={`Others see ${row.name} at ${pct(row.others)}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge most. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and others diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{row.name}</span>{" "}
                <span className="text-muted">
                  {row.divergence > 0
                    ? `— you read this higher in yourself than others do (${pct(row.self)} vs ${pct(row.others)}).`
                    : `— others read this in you more than you do (${pct(row.others)} vs ${pct(row.self)}).`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down (Observer 1/2/3 — no attributes). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each Observer&rsquo;s individual read, fully anonymous. There is no
          name, relationship, or any other detail attached to a response.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          {observers.map((profile, index) => (
            <details
              key={index}
              className="rounded-[2px] border border-hair bg-white/40 px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-[15px] font-medium text-ink marker:content-none">
                <span className="font-serif text-[17px]">
                  Observer {index + 1}
                </span>
                <span className="ml-3 text-[13px] text-muted">
                  reads you as{" "}
                  {topTribes(profile, 2)
                    .map((t) => t.name)
                    .join(" · ")}
                </span>
              </summary>
              <ul className="mt-4 flex flex-col gap-2">
                {topTribes(profile, 5).map((t) => {
                  const tribe = getTribeBySlug(t.slug);
                  const accent = accentHex(tribe?.color ?? "");
                  const max = topTribes(profile, 1)[0]?.score ?? 0;
                  return (
                    <li
                      key={t.slug}
                      className="grid grid-cols-[110px_1fr] items-center gap-3"
                    >
                      <span className="text-[14px] text-ink">{t.name}</span>
                      <Bar
                        fraction={max > 0 ? t.score / max : 0}
                        color={accent}
                        filled
                        label={`Observer ${index + 1} reads ${t.name} at ${pct(t.score)}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A single bar; `filled` draws the Subject's read, outlined draws others'. */
function Bar({
  fraction,
  color,
  filled,
  label,
}: {
  fraction: number;
  color: string;
  filled: boolean;
  label: string;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/40"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
          backgroundColor: filled ? color : "transparent",
          border: filled ? undefined : `1.5px solid ${color}`,
          opacity: filled ? 1 : 0.85,
        }}
      />
    </div>
  );
}

/** The n highest-scoring tribes in a profile, ties keeping canonical order. */
function topTribes(profile: TribeScore[], n: number): TribeScore[] {
  return [...profile]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

const pct = (score: number) => `${Math.round(score * 100)}%`;
