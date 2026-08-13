import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Renders the
 * Subject's own profile beside the equal-weight aggregated "others" profile,
 * calls out where the two most align and most diverge, and offers an anonymous
 * per-observer drill-down (Observer 1/2/3).
 *
 * Server component: its inputs are already-computed `TribeScore[]`s (from the
 * `server-only` scoring core), so no scoring logic or word→tribe mapping crosses
 * to the client. It renders no observer identity — the drill-down is numbered,
 * never named (ADR-0003).
 */

type ScoreBySlug = Map<string, number>;

const bySlug = (scores: readonly TribeScore[]): ScoreBySlug =>
  new Map(scores.map((s) => [s.slug, s.score]));

/** The largest score across both profiles, so self and others bars share one
 * scale and are read against each other rather than each against itself. */
const sharedMax = (...profiles: readonly TribeScore[][]): number =>
  Math.max(0, ...profiles.flat().map((s) => s.score));

export function ComparisonReport({
  selfScores,
  otherScores,
  observerProfiles,
}: {
  selfScores: TribeScore[];
  otherScores: TribeScore[];
  observerProfiles: TribeScore[][];
}) {
  const others = bySlug(otherScores);
  const max = sharedMax(selfScores, otherScores);

  // Order by the Subject's own ranking so they read the comparison against the
  // profile they already know, then attach each tribe's self/other gap.
  const rows = [...selfScores]
    .sort((a, b) => b.score - a.score)
    .map((self) => {
      const other = others.get(self.slug) ?? 0;
      return { slug: self.slug, name: self.name, self: self.score, other };
    });

  // Alignment vs divergence: the tribes where self and others agree most, and
  // where they part most (a self-higher gap is a blind spot others don't see; an
  // others-higher gap is a strength the Subject under-claims).
  const ranked = [...rows].sort(
    (a, b) => Math.abs(b.self - b.other) - Math.abs(a.self - a.other),
  );
  const divergences = ranked.filter((r) => r.self > 0 || r.other > 0).slice(0, 3);
  const alignments = [...ranked].reverse().slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own read is set beside the combined read of everyone who answered.
        Each observer counts equally, however many words they picked. The gaps —
        where you and they disagree — are where the most useful insight lives.
      </p>

      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em]">
        <span className="flex items-center gap-2 text-ink">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2 text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Side-by-side bars for all twelve tribes, on one shared scale. */}
      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Self vs others, tribe by tribe
        </p>
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
                    fraction={max > 0 ? row.self / max : 0}
                    color="var(--color-ink, #1a1a1a)"
                  />
                  <CompareBar
                    label="Others"
                    fraction={max > 0 ? row.other / max : 0}
                    color={accent}
                    muted
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads meet and where they part. */}
      <section className="mt-14 grid grid-cols-2 gap-8 border-t border-hair pt-8 max-[520px]:grid-cols-1">
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you agree
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {alignments.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{row.name}</span>
                <span className="ml-2 text-[13px] text-muted">
                  you {pct(row.self)} · others {pct(row.other)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-ink">
                <span className="font-serif text-[17px]">{row.name}</span>
                <span className="ml-2 text-[13px] text-muted">
                  {row.self >= row.other ? "you see it more" : "others see it more"}{" "}
                  · you {pct(row.self)} · others {pct(row.other)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Anonymous per-observer drill-down — numbered, never named. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The spread of opinion behind the &ldquo;others&rdquo; profile. Each
          observer&rsquo;s top tribes, with no names attached.
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {observerProfiles.map((profile, i) => {
            const top = [...profile]
              .sort((a, b) => b.score - a.score)
              .filter((s) => s.score > 0)
              .slice(0, 3);
            return (
              <li key={i} className="rounded-[2px] border border-hair p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {i + 1}
                </div>
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {top.length === 0 && (
                    <li className="text-[13px] text-muted">No clear read.</li>
                  )}
                  {top.map((s) => {
                    const tribe = getTribeBySlug(s.slug);
                    const accent = accentHex(tribe?.color ?? "");
                    return (
                      <li
                        key={s.slug}
                        className="rounded-[2px] border px-3 py-1.5 text-[14px] text-ink"
                        style={{ borderColor: accent }}
                      >
                        {s.name}
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

function CompareBar({
  label,
  fraction,
  color,
  muted = false,
}: {
  label: string;
  fraction: number;
  color: string;
  muted?: boolean;
}) {
  const width = Math.max(fraction * 100, fraction > 0 ? 2 : 0);
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${pct(fraction)} of the top score`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          backgroundColor: color,
          opacity: muted ? 0.55 : 1,
        }}
      />
    </div>
  );
}

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;
