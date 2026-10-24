import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Renders the
 * Subject's own normalized profile beside the equal-weight "others" profile,
 * calls out where the two align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1 / 2 / 3…).
 *
 * Presentational and client-safe: it receives already-computed `TribeScore`
 * arrays (plain numbers) and never imports the scoring core or the word→tribe
 * mapping, which stay server-side (ADR-0009). The page computes `self` and the
 * aggregation server-side and passes them down.
 */

/** A tribe whose self/others scores diverge enough to be worth calling out. */
const DIVERGENCE_THRESHOLD = 0.08;

export function ComparisonReport({
  self,
  others,
  perObserver,
  primarySlug,
  secondarySlug,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  const selfBySlug = new Map(self.map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // A shared scale so the two bars are directly comparable: the top score across
  // either profile fills the bar, everything else draws in proportion to it.
  const sharedMax = Math.max(
    0,
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  // Rows sorted by whichever view rates the tribe highest, so the tribes that
  // matter in either profile surface first. `self` already covers all twelve
  // tribes in canonical order, so its slugs are the full, ordered list.
  const rows = self.map(({ slug }) => {
    const selfScore = selfBySlug.get(slug) ?? 0;
    const othersScore = othersBySlug.get(slug) ?? 0;
    return {
      slug,
      selfScore,
      othersScore,
      delta: othersScore - selfScore,
      prominence: Math.max(selfScore, othersScore),
    };
  });
  rows.sort((a, b) => b.prominence - a.prominence);

  const seeYouMore = rows
    .filter((r) => r.delta >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => b.delta - a.delta);
  const youSeeMore = rows
    .filter((r) => -r.delta >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => a.delta - b.delta);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        The lit bar is your own read; the outline bar is the equal-weight average
        of {perObserver.length} anonymous observers. The gap between them is where
        growth lives.
      </p>

      {/* Side-by-side profile for every tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Self vs others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-full bg-ink/70" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-full border border-ink/50" />
              Others
            </span>
          </div>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
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
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: role ? accent : undefined }}
                  >
                    {tribe?.name ?? row.slug}
                  </span>
                  {role && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      {role}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <ComparisonBar
                    label="You"
                    score={row.selfScore}
                    sharedMax={sharedMax}
                    accent={accent}
                    variant="self"
                    tribeName={tribe?.name ?? row.slug}
                  />
                  <ComparisonBar
                    label="Others"
                    score={row.othersScore}
                    sharedMax={sharedMax}
                    accent={accent}
                    variant="others"
                    tribeName={tribe?.name ?? row.slug}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads pull apart. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Alignment &amp; divergence
        </p>
        {seeYouMore.length === 0 && youSeeMore.length === 0 ? (
          <p className="mt-4 max-w-[560px] text-[15px] text-muted">
            Your own read and the observers&rsquo; are closely aligned — no tribe
            pulls sharply one way or the other.
          </p>
        ) : (
          <div className="mt-5 grid gap-8 sm:grid-cols-2">
            <DivergenceList
              heading="Others see more in you"
              rows={seeYouMore}
              emptyNote="Nothing observers rate markedly above your own read."
            />
            <DivergenceList
              heading="You see more than they do"
              rows={youSeeMore}
              emptyNote="Nothing you rate markedly above the observers&rsquo; read."
            />
          </div>
        )}
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[560px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — no names, no order
          beyond when they answered.
        </p>
        <div className="mt-6 flex flex-col gap-8">
          {perObserver.map((observer, i) => (
            <ObserverCard key={i} index={i + 1} scores={observer} />
          ))}
        </div>
      </section>

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </Link>
      </div>
    </div>
  );
}

function ComparisonBar({
  label,
  score,
  sharedMax,
  accent,
  variant,
  tribeName,
}: {
  label: string;
  score: number;
  sharedMax: number;
  accent: string;
  variant: "self" | "others";
  tribeName: string;
}) {
  const fill = sharedMax > 0 ? score / sharedMax : 0;
  const pct = Math.round(fill * 100);
  const width = `${Math.max(fill * 100, score > 0 ? 3 : 0)}%`;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[42px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/40"
        role="img"
        aria-label={`${tribeName}, ${label}: ${pct}% of the top score`}
      >
        {variant === "self" ? (
          <div
            className="h-full rounded-full"
            style={{ width, backgroundColor: accent }}
          />
        ) : (
          <div
            className="h-full rounded-full border"
            style={{ width, borderColor: accent, backgroundColor: `${accent}22` }}
          />
        )}
      </div>
    </div>
  );
}

function DivergenceList({
  heading,
  rows,
  emptyNote,
}: {
  heading: string;
  rows: { slug: string; delta: number }[];
  emptyNote: string;
}) {
  return (
    <div>
      <h3 className="font-serif text-[18px] font-semibold">{heading}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">{emptyNote}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex items-center gap-2.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span className="font-serif text-[16px]">
                  {tribe?.name ?? row.slug}
                </span>
                <span className="text-[13px] text-faint">
                  {tribe?.callSign}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ObserverCard({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  // Show each observer's strongest reads only, ranked like the self view.
  const ranked = rankScores(scores)
    .filter((r) => r.score > 0)
    .slice(0, 5);
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index}
      </p>
      {ranked.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">
          No clear signal in this response.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {ranked.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
              >
                <span className="font-serif text-[15px] leading-none">
                  {tribe?.name ?? row.slug}
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-hair/40"
                  role="img"
                  aria-label={`${tribe?.name ?? row.slug}: ${Math.round(row.relative * 100)}% of this observer's top read`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(row.relative * 100, 3)}%`,
                      backgroundColor: accent,
                      opacity: 0.7,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
