import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers, scoreObservers } from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Renders the
 * Subject's own normalized profile alongside the equal-weight "others" profile
 * aggregated from anonymous Observer responses, surfaces where the two reads
 * agree and diverge, and offers an anonymous per-observer drill-down.
 *
 * A server component: it imports the scoring core and aggregation, both
 * `server-only` (the word→tribe mapping never reaches the client, ADR-0009).
 * Render only from server components. The caller is responsible for the ≥3
 * Observer unlock gate; this view assumes it has enough responses to show.
 */

/** A per-tribe pairing of the Subject's own score against the "others" average. */
interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self: positive means Observers see more of this tribe than you do. */
  delta: number;
}

/**
 * A divergence is "notable" once the two reads differ by at least this much of
 * the normalized 0–1 scale. Below it the gap is noise, not signal.
 */
const DIVERGENCE_THRESHOLD = 0.1;

export function ComparisonReport({
  selfWords,
  observerWordSets,
}: {
  selfWords: string[];
  observerWordSets: string[][];
}) {
  const selfScores = score(selfWords);
  const otherScores = aggregateObservers(observerWordSets);
  const perObserver = scoreObservers(observerWordSets);

  const bySlug = (scores: TribeScore[], slug: string) =>
    scores.find((s) => s.slug === slug)?.score ?? 0;

  const rows: ComparisonRow[] = selfScores.map((s) => {
    const others = bySlug(otherScores, s.slug);
    return { slug: s.slug, name: s.name, self: s.score, others, delta: others - s.score };
  });

  // Scale both profiles against one shared maximum so bar length is directly
  // comparable between your read and theirs.
  const max = Math.max(1e-9, ...rows.map((r) => Math.max(r.self, r.others)));

  // Order the chart by the Subject's own ranking (ties keep canonical order,
  // since `selfScores` is already canonical and sort is stable).
  const ranked = [...rows].sort((a, b) => b.self - a.self);

  const selfTop = ranked[0];
  const othersTop = [...rows].sort((a, b) => b.others - a.others)[0];

  const divergences = [...rows]
    .filter((r) => Math.abs(r.delta) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Your read, and theirs
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] text-muted">
        The &ldquo;others&rdquo; profile is the equal-weight average of{" "}
        {perObserver.length} anonymous {perObserver.length === 1 ? "read" : "reads"} —
        each one counts the same, no matter how many words they chose. The gap
        between the two is where the most honest growth lives.
      </p>

      {/* Headline: who you lead with vs who they see most. */}
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <HeadlineCard label="You lead with" slug={selfTop.slug} name={selfTop.name} />
        <HeadlineCard label="They see most" slug={othersTop.slug} name={othersTop.name} />
      </section>

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-16 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Self vs. others
          </p>
          <p className="flex gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40 bg-ink/25" />
              Others
            </span>
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {ranked.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: row.slug === selfTop.slug ? accent : undefined }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`You: ${pct(row.self)}% — ${row.name}`}
                    fill={row.self / max}
                    hasScore={row.self > 0}
                    color={accent}
                    opacity={1}
                  />
                  <CompareBar
                    label={`Others: ${pct(row.others)}% — ${row.name}`}
                    fill={row.others / max}
                    hasScore={row.others > 0}
                    color={accent}
                    opacity={0.4}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge most. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where your read and theirs diverge
        </p>
        {divergences.length === 0 ? (
          <p className="mt-4 max-w-[520px] text-[15px] text-muted">
            Your read and theirs line up closely — no tribe stands out as seen
            very differently.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{row.name}</span>
                <span className="text-muted">
                  {" "}
                  — others see{" "}
                  <span className="text-ink">
                    {row.delta > 0 ? "more" : "less"}
                  </span>{" "}
                  of this than you do ({row.delta > 0 ? "+" : "−"}
                  {pct(Math.abs(row.delta))} points).
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Anonymous per-observer drill-down (Observer 1 / 2 / 3…). */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each read, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Observers are fully anonymous — labeled only by number, with nothing
          tying a read back to who gave it.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {perObserver.map((profile, i) => (
            <ObserverDrilldown
              key={i}
              index={i}
              profile={profile}
              max={max}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Percentage of the normalized 0–1 scale, rounded for display. */
function pct(score: number): number {
  return Math.round(score * 100);
}

function HeadlineCard({
  label,
  slug,
  name,
}: {
  label: string;
  slug: string;
  name: string;
}) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div className="mt-2 font-serif text-[26px] font-semibold" style={{ color: accent }}>
        {name}
      </div>
    </div>
  );
}

function CompareBar({
  label,
  fill,
  hasScore,
  color,
  opacity,
}: {
  label: string;
  fill: number;
  hasScore: boolean;
  color: string;
  opacity: number;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(fill * 100, hasScore ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

function ObserverDrilldown({
  index,
  profile,
  max,
}: {
  index: number;
  profile: TribeScore[];
  max: number;
}) {
  const top = [...profile]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <li>
      <details className="group rounded-[2px] border border-hair">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-[14px] [&::-webkit-details-marker]:hidden">
          <span className="uppercase tracking-[0.14em] text-muted">
            Observer {index + 1}
          </span>
          <span className="text-[12px] text-faint transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-hair px-5 py-4">
          {top.length === 0 ? (
            <p className="text-[14px] text-muted">
              This read matched no scoring words.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {top.map((s) => {
                const tribe = getTribeBySlug(s.slug);
                const accent = accentHex(tribe?.color ?? "");
                return (
                  <li
                    key={s.slug}
                    className="grid grid-cols-[110px_1fr] items-center gap-3"
                  >
                    <span className="font-serif text-[15px]">{s.name}</span>
                    <CompareBar
                      label={`${s.name}: ${pct(s.score)}%`}
                      fill={s.score / max}
                      hasScore={s.score > 0}
                      color={accent}
                      opacity={0.8}
                    />
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
