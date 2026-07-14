import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregated "others" profile, with the biggest points
 * of alignment and divergence called out, and an anonymous per-observer
 * drill-down ("Observer 1/2/3", no attributes).
 *
 * Presentational and client-safe: it takes already-computed `TribeScore[]`
 * profiles (plain slug/name/score — never the word→tribe mapping, never any
 * observer identity) and only reads client-safe tribe metadata. All scoring and
 * the equal-weight aggregation happen server-side before this renders. The
 * locked state (fewer than the required observers) is handled by the page, so
 * this component always renders an unlocked, populated report.
 */
export function ComparisonReport({
  self,
  others,
  observerProfiles,
  primarySlug,
  secondarySlug,
}: {
  self: TribeScore[];
  others: TribeScore[];
  observerProfiles: TribeScore[][];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));

  // Rows in the Subject's own ranking (self score desc; ties keep canonical
  // order), so the same order drives both columns and self and others align.
  const rows = [...self]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersBySlug.get(s.slug) ?? 0,
    }));

  // Scale every bar to the largest score in either profile so the two reads are
  // directly comparable rather than each normalized to its own max.
  const max = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0.0001,
  );

  // The sharpest gaps between how the Subject sees themselves and how others do.
  const divergences = [...rows]
    .map((r) => ({ ...r, gap: r.others - r.self }))
    .filter((r) => Math.abs(r.gap) >= 0.08)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] text-muted">
        Your own read is set beside the combined read of your{" "}
        {observerProfiles.length} observers — each counted equally, so no single
        voice outweighs another. The gap between the two columns is where the
        most useful insight lives.
      </p>

      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Self vs others, tribe by tribe. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-6">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const role =
              row.slug === primarySlug
                ? "Primary"
                : row.slug === secondarySlug
                  ? "Secondary"
                  : null;
            return (
              <li key={row.slug} className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
                <div className="flex flex-col items-start gap-0.5">
                  <span
                    className="font-serif text-[17px] leading-tight"
                    style={{ color: role ? accent : undefined }}
                  >
                    {row.name}
                  </span>
                  {role && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      {role}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <CompareBar label="You" score={row.self} max={max} tone="ink" />
                  <CompareBar label="Others" score={row.others} max={max} tone="gold" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads align and diverge most. */}
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
                  {row.gap > 0
                    ? "reads stronger to others than to you"
                    : "reads stronger to you than to others"}{" "}
                  ({row.gap > 0 ? "+" : "−"}
                  {Math.abs(Math.round(row.gap * 100))} pts)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down — Observer 1/2/3, no attributes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Per-observer detail
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s individual read, kept fully anonymous. There is
          nothing here that identifies who answered.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          {observerProfiles.map((profile, i) => (
            <details
              key={i}
              className="rounded-[2px] border border-hair px-5 py-4 [&_summary]:cursor-pointer"
            >
              <summary className="font-serif text-[17px] text-ink marker:text-faint">
                Observer {i + 1}
              </summary>
              <ul className="mt-4 flex flex-col gap-2">
                {topTribes(profile).map((row) => (
                  <li
                    key={row.slug}
                    className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
                  >
                    <span className="text-[14px] text-muted">{row.name}</span>
                    <CompareBar
                      label={row.name}
                      score={row.score}
                      max={observerMax(profile)}
                      tone="gold"
                    />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
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

/** A single labelled bar scaled against a shared max. */
function CompareBar({
  label,
  score,
  max,
  tone,
}: {
  label: string;
  score: number;
  max: number;
  tone: "ink" | "gold";
}) {
  const relative = max > 0 ? score / max : 0;
  const color = tone === "ink" ? "var(--color-ink)" : "var(--color-gold)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the strongest score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

/** The tribes an observer scored above zero, highest first (up to six). */
function topTribes(profile: TribeScore[]): TribeScore[] {
  return [...profile]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function observerMax(profile: TribeScore[]): number {
  return Math.max(...profile.map((s) => s.score), 0.0001);
}
