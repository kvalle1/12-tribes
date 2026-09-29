import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile aggregated from their Observers, with
 * an anonymous per-observer drill-down.
 *
 * Like `ResultView` (#6) this is a **server component**: it imports the
 * `server-only` scoring core and aggregation, so the word→tribe mapping never
 * reaches the client (ADR-0009). Render it only from a server component, and
 * only once the report has unlocked (≥ `MIN_OBSERVERS`); the unlock gate lives on
 * the page so the locked state can stand on its own.
 *
 * Both series are scaled to one shared maximum so a "You" bar and an "Others" bar
 * of the same length mean the same strength — that shared scale is what makes
 * alignment (matching bars) and divergence (a labelled gap) legible at a glance.
 */

/**
 * How far apart the You/Others bars must be — as a fraction of the shared top
 * score — before a row is called out as a divergence. Below this the two reads
 * are treated as broadly aligned and left unlabelled.
 */
const DIVERGENCE_THRESHOLD = 0.2;

export function ComparisonReport({
  selfWords,
  primarySlug,
  observerWordLists,
}: {
  selfWords: string[];
  primarySlug: string;
  observerWordLists: string[][];
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregateObservers(observerWordLists);

  const othersBySlug = new Map(othersScores.map((s) => [s.slug, s.score]));

  // One shared scale across both series, so bar length is comparable.
  const overallMax = Math.max(
    0,
    ...selfScores.map((s) => s.score),
    ...othersScores.map((s) => s.score),
  );

  // Rows ordered by the Subject's own ranking so the report reads like their result.
  const rows = [...selfScores]
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const self = s.score;
      const others = othersBySlug.get(s.slug) ?? 0;
      const selfRel = overallMax > 0 ? self / overallMax : 0;
      const othersRel = overallMax > 0 ? others / overallMax : 0;
      return {
        slug: s.slug,
        name: s.name,
        self,
        others,
        selfRel,
        othersRel,
        divergence: othersRel - selfRel,
      };
    });

  const selfPrimary = getTribeBySlug(primarySlug);
  // The tribe the Observers rank first (their equal-weight top), for the headline.
  const othersTop = [...othersScores].sort((a, b) => b.score - a.score)[0];
  const othersPrimary =
    othersTop && othersTop.score > 0 ? getTribeBySlug(othersTop.slug) : undefined;
  const aligned = othersPrimary?.slug === primarySlug;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>

      {/* Headline read: do the Subject and their Observers lead with the same tribe? */}
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        {selfPrimary && othersPrimary ? (
          aligned ? (
            <>
              Your Observers agree with your own read — they also see{" "}
              <TribeName tribe={selfPrimary} /> in you first.
            </>
          ) : (
            <>
              You lead with <TribeName tribe={selfPrimary} />, while your
              Observers lead with <TribeName tribe={othersPrimary} />. The gap is
              where growth lives.
            </>
          )
        ) : (
          <>Here is how your Observers&rsquo; read compares with your own.</>
        )}
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full border border-ink/40 bg-ink/25" />
          Others
        </span>
      </div>

      {/* Paired You / Others bars for all twelve tribes, on one shared scale. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const divergent =
              Math.abs(row.divergence) >= DIVERGENCE_THRESHOLD;
            const divergenceLabel = !divergent
              ? null
              : row.divergence > 0
                ? "Others see more"
                : "You see more";
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{
                      color: row.slug === primarySlug ? accent : undefined,
                    }}
                  >
                    {row.name}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Bar
                    relative={row.selfRel}
                    hasScore={row.self > 0}
                    color={accent}
                    variant="self"
                    ariaLabel={`You rank ${row.name} at ${Math.round(
                      row.selfRel * 100,
                    )}% of the top score`}
                  />
                  <Bar
                    relative={row.othersRel}
                    hasScore={row.others > 0}
                    color={accent}
                    variant="others"
                    ariaLabel={`Others rank ${row.name} at ${Math.round(
                      row.othersRel * 100,
                    )}% of the top score`}
                  />
                  {divergenceLabel && (
                    <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-gold">
                      {divergenceLabel}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down: Observer 1 / 2 / 3, no attributes. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The individual reads behind the average. They carry no names or labels
          — only the tribes each anonymous Observer surfaced most.
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {observerWordLists.map((words, i) => {
            const ranked = rankScores(score(words)).filter((r) => r.score > 0);
            const top = ranked.slice(0, 3);
            return (
              <li
                key={i}
                className="rounded-[2px] border border-hair p-5"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {i + 1}
                </div>
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {top.length > 0 ? (
                    top.map((r) => {
                      const tribe = getTribeBySlug(r.slug);
                      const accent = accentHex(tribe?.color ?? "");
                      return (
                        <li
                          key={r.slug}
                          className="rounded-[2px] border px-3.5 py-1.5 text-[14px] text-ink"
                          style={{
                            borderColor: `${accent}66`,
                            backgroundColor: `${accent}14`,
                          }}
                        >
                          {r.name}
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-[14px] text-faint">No clear read</li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </Link>
        {selfPrimary && (
          <Link
            href={`/tribes/${selfPrimary.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full {selfPrimary.name} profile
          </Link>
        )}
      </div>
    </div>
  );
}

function Bar({
  relative,
  hasScore,
  color,
  variant,
  ariaLabel,
}: {
  relative: number;
  hasScore: boolean;
  color: string;
  variant: "self" | "others";
  ariaLabel: string;
}) {
  const width = `${Math.max(relative * 100, hasScore ? 3 : 0)}%`;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={
          variant === "self"
            ? { width, backgroundColor: color }
            : {
                width,
                backgroundColor: `${color}40`,
                border: `1px solid ${color}80`,
              }
        }
      />
    </div>
  );
}

function TribeName({ tribe }: { tribe: { name: string; color: string } }) {
  return (
    <span className="font-semibold" style={{ color: accentHex(tribe.color) }}>
      {tribe.name}
    </span>
  );
}
