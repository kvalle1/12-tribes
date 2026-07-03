import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ProfileComparison } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9): the Subject's own profile shown against
 * the equal-weight aggregated "others" profile, a "where you diverge" callout,
 * and an anonymous per-observer drill-down (Observer 1 / 2 / 3 …).
 *
 * Purely presentational — it renders already-computed scores and never touches
 * the scoring core or the word→tribe mapping, so it stays client-safe. The
 * `/assessment/report` server page does the scoring (via the `server-only`
 * aggregation) and hands the results down as plain data.
 */

/** How many diverging tribes to surface in the callout. */
const DIVERGENCE_CALLOUT_COUNT = 3;
/** Only mention a divergence when the gap is at least this wide (0–1 scale). */
const DIVERGENCE_MIN = 0.05;

export function ComparisonReport({
  comparisons,
  perObserver,
}: {
  comparisons: ProfileComparison[];
  perObserver: TribeScore[][];
}) {
  // A single shared scale across both profiles so the paired bars are directly
  // comparable — the tallest bar in either view fills its track.
  const maxScore = Math.max(
    0,
    ...comparisons.map((c) => Math.max(c.self, c.others)),
  );
  const fill = (value: number) => (maxScore > 0 ? (value / maxScore) * 100 : 0);

  // Rank by the more prominent of the two readings so the tribes that matter in
  // either view rise to the top.
  const ranked = [...comparisons].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  const divergences = [...comparisons]
    .filter((c) => Math.abs(c.divergence) >= DIVERGENCE_MIN)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, DIVERGENCE_CALLOUT_COUNT);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,54px)] font-semibold leading-[1.05]">
        You vs. how others see you
      </h1>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own answers against the combined read from{" "}
        {perObserver.length}{" "}
        {perObserver.length === 1 ? "person" : "people"} who described you. Each
        person counts equally, however many words they picked.
      </p>

      <Legend />

      {/* Paired self/others bars for all twelve tribes on one shared scale. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {ranked.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px] leading-none">
                    {row.name}
                  </span>
                  <DivergenceTag divergence={row.divergence} />
                </div>
                <PairedBar
                  label="You"
                  value={row.self}
                  fill={fill(row.self)}
                  accent={accent}
                  solid
                />
                <PairedBar
                  label="Others"
                  value={row.others}
                  fill={fill(row.others)}
                  accent={accent}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-muted">
                <span className="font-medium text-ink">{row.name}</span>
                {row.divergence > 0
                  ? " — you read this in yourself more strongly than others do."
                  : " — others read this in you more strongly than you do."}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down: Observer 1 / 2 / 3, no attributes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every observer stays anonymous — no name, no relationship. Here is the
          top of each individual read.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {perObserver.map((profile, index) => (
            <ObserverDetail
              key={index}
              index={index}
              profile={profile}
            />
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

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full bg-ink" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-2">
        <span
          className="h-2.5 w-6 rounded-full border border-ink/40 bg-ink/25"
          aria-hidden
        />
        Others
      </span>
    </div>
  );
}

function PairedBar({
  label,
  value,
  fill,
  accent,
  solid = false,
}: {
  label: string;
  value: number;
  fill: number;
  accent: string;
  solid?: boolean;
}) {
  return (
    <div className="grid grid-cols-[60px_1fr] items-center gap-3 max-[520px]:grid-cols-[52px_1fr]">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(value * 100)}%`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fill, value > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.45,
          }}
        />
      </div>
    </div>
  );
}

function DivergenceTag({ divergence }: { divergence: number }) {
  if (Math.abs(divergence) < DIVERGENCE_MIN) {
    return (
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        Aligned
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
      {divergence > 0 ? "You +" : "Others +"}
      {Math.round(Math.abs(divergence) * 100)}
    </span>
  );
}

function ObserverDetail({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((t) => t.score > 0)
    .slice(0, 3);

  return (
    <li className="rounded-[2px] border border-hair">
      <details>
        <summary className="cursor-pointer list-none px-4 py-3 text-[14px] text-ink [&::-webkit-details-marker]:hidden">
          Observer {index + 1}
        </summary>
        <div className="border-t border-hair px-4 py-3">
          {top.length === 0 ? (
            <p className="text-[14px] text-muted">No clear read.</p>
          ) : (
            <ul className="flex flex-wrap gap-2.5">
              {top.map((t) => {
                const tribe = getTribeBySlug(t.slug);
                const accent = accentHex(tribe?.color ?? "");
                return (
                  <li
                    key={t.slug}
                    className="rounded-[2px] border px-3 py-1 text-[13px] text-ink"
                    style={{ borderColor: accent }}
                  >
                    {t.name}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}
