import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ObserverAggregate } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9): the Subject's own profile alongside the
 * equal-weight aggregated "others" profile, with anonymous per-observer
 * drill-down. Presentational only — it receives already-computed scores, so it
 * stays free of the `server-only` scoring core and can render inside any server
 * component that does the computing.
 *
 * Bars for the You/Others comparison share one scale (the top score across both
 * profiles) so the two reads are visually comparable rather than each normalized
 * to its own maximum.
 */
export function ComparisonReport({
  self,
  aggregate,
}: {
  self: TribeScore[];
  aggregate: ObserverAggregate;
}) {
  const others = aggregate.others;
  const byOthersSlug = new Map(others.map((s) => [s.slug, s.score]));

  // One shared scale so a You bar and an Others bar of equal length mean equal
  // scores. Guard against an all-zero profile.
  const sharedMax = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    Number.EPSILON,
  );

  // Rank by the Subject's own profile — their read is the spine the "others"
  // view is compared against.
  const rows = [...self]
    .sort((a, b) => b.score - a.score)
    .map((row) => {
      const selfScore = row.score;
      const othersScore = byOthersSlug.get(row.slug) ?? 0;
      return {
        slug: row.slug,
        name: row.name,
        selfScore,
        othersScore,
        gap: othersScore - selfScore,
      };
    });

  // The single sharpest divergence — where others' read differs most from the
  // Subject's — surfaced as the headline insight (the gap is where the value is).
  const divergence = [...rows].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  )[0];
  const hasDivergence = divergence && Math.abs(divergence.gap) > 0.001;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        You vs. how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Based on {aggregate.observerCount}{" "}
        {aggregate.observerCount === 1 ? "person" : "people"} who described you
        anonymously. Each observer is weighted equally, no matter how many words
        they picked.
      </p>

      {hasDivergence && (
        <p className="mt-6 max-w-[560px] rounded-[2px] border border-hair bg-white px-5 py-4 text-[15px] text-ink">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Biggest gap
          </span>
          <br />
          Others see{" "}
          <span className="font-serif italic text-gold">
            {divergence.gap > 0 ? "more" : "less"} {divergence.name}
          </span>{" "}
          in you than you see in yourself.
        </p>
      )}

      {/* Legend */}
      <div className="mt-10 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold/70" />
          Others
        </span>
      </div>

      {/* Side-by-side per-tribe comparison. */}
      <ul className="mt-6 flex flex-col gap-5">
        {rows.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-tight">
                {row.name}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={`You: ${pct(row.selfScore)}`}
                  fraction={row.selfScore / sharedMax}
                  color="var(--ink, #1a1a1a)"
                />
                <CompareBar
                  label={`Others: ${pct(row.othersScore)}`}
                  fraction={row.othersScore / sharedMax}
                  color={accent}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Anonymous per-observer drill-down (Observer 1 / 2 / 3, no attributes). */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[560px] text-[15px] text-muted">
          The spread of opinion behind the average. Each observer&rsquo;s top
          tribes — no names, no relationships.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-5 max-[560px]:grid-cols-1">
          {aggregate.perObserver.map((profile, i) => (
            <ObserverCard key={i} index={i} profile={profile} />
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

/** A single labelled bar on the shared You/Others scale. */
function CompareBar({
  label,
  fraction,
  color,
}: {
  label: string;
  fraction: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={label}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, fraction > 0 ? 2 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-[128px] shrink-0 text-right text-[11px] tracking-[0.04em] text-faint">
        {label}
      </span>
    </div>
  );
}

/** One anonymous observer's top tribes. */
function ObserverCard({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 0;

  return (
    <div className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {top.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li key={row.slug} className="flex items-center gap-2.5">
              <span className="w-[84px] shrink-0 font-serif text-[14px]">
                {row.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max > 0 ? (row.score / max) * 100 : 0}%`,
                    backgroundColor: accent,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Render a normalized 0–1 score as a compact whole-number index. */
function pct(score: number): string {
  return String(Math.round(score * 100));
}
