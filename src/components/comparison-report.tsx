import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  scoreEachObserver,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, with the alignments and divergences
 * called out, and an anonymous per-observer drill-down ("Observer 1/2/3").
 *
 * A server component — it imports the `server-only` scoring core and the
 * equal-weight aggregation, so the word→tribe mapping and every raw observer
 * selection stay on the server (ADR-0009). Only the computed numbers reach the
 * client. Render it only from server components, and only once the report has
 * unlocked (≥3 observers); the locked state is handled by the page.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const self = score(selfWords);
  const others = aggregateObservers(observerResponses);
  const perObserver = scoreEachObserver(observerResponses);

  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  // One row per tribe carrying both views and the gap between them. Ordered by
  // whichever view ranks the tribe highest, so the tribes that matter in either
  // read — not just the Subject's own — surface first.
  const rows = self
    .map((s) => {
      const selfScore = s.score;
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore,
        othersScore,
        gap: othersScore - selfScore,
        prominence: Math.max(selfScore, othersScore),
      };
    })
    .sort((a, b) => b.prominence - a.prominence);

  // Shared scale so the two bars are directly comparable across the whole chart.
  const max = rows.reduce((m, r) => Math.max(m, r.prominence), 0);

  const selfLead = rankScores(self)[0];
  const othersLead = rankScores(others)[0];
  const sharedPrimary =
    selfLead && othersLead && selfLead.slug === othersLead.slug
      ? selfLead
      : null;

  // Biggest divergence in each direction, among tribes prominent in either view
  // (ignore the long tail of near-zero tribes where a tiny gap means little).
  const prominent = rows.filter((r) => r.prominence >= max * 0.25);
  const othersSeeMore = [...prominent]
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap)[0];
  const youSeeMore = [...prominent]
    .filter((r) => r.gap < 0)
    .sort((a, b) => a.gap - b.gap)[0];

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own selection sits beside the combined read from{" "}
        {observerResponses.length} people. Each person counts equally, however
        many words they picked. The gap is where the most useful insight lives.
      </p>

      {/* Alignment / divergence callouts. */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Callout label="Where you align">
          {sharedPrimary ? (
            <>
              You and your observers both lead with{" "}
              <TribeName slug={sharedPrimary.slug} />.
            </>
          ) : (
            <>
              You lead with <TribeName slug={selfLead?.slug} />; your observers
              lead with <TribeName slug={othersLead?.slug} />.
            </>
          )}
        </Callout>
        <Callout label="Where you diverge">
          {othersSeeMore || youSeeMore ? (
            <>
              {othersSeeMore && (
                <>
                  Others see more <TribeName slug={othersSeeMore.slug} /> in you
                  than you do.
                </>
              )}
              {othersSeeMore && youSeeMore && " "}
              {youSeeMore && (
                <>
                  You claim more <TribeName slug={youSeeMore.slug} /> than they
                  read.
                </>
              )}
            </>
          ) : (
            <>Your self-read and their read line up closely.</>
          )}
        </Callout>
      </section>

      {/* Self vs others bars, all twelve tribes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink/35" />
              Others
            </span>
          </div>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug}>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px] leading-none">
                    {row.name}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
                    {Math.round(row.selfScore * 100)}
                    <span className="mx-1 text-hair">/</span>
                    {Math.round(row.othersScore * 100)}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <Bar
                    value={row.selfScore}
                    max={max}
                    color={accent}
                    opacity={1}
                    label={`You see ${row.name} at ${Math.round(
                      row.selfScore * 100,
                    )} of the top score`}
                  />
                  <Bar
                    value={row.othersScore}
                    max={max}
                    color={accent}
                    opacity={0.4}
                    label={`Others see ${row.name} at ${Math.round(
                      row.othersScore * 100,
                    )} of the top score`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s read on its own — fully anonymous, in no
          particular order, with their three strongest tribes.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((table, i) => {
            const top = rankScores(table)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={i}
                className="rounded-[2px] border border-hair bg-white/40"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-[14px] [&::-webkit-details-marker]:hidden">
                    <span className="font-serif text-[16px]">
                      Observer {i + 1}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-faint transition-colors group-open:text-ink">
                      {top[0] ? getTribeBySlug(top[0].slug)?.name : "—"}
                      <span className="ml-2 text-hair group-open:hidden">
                        show
                      </span>
                      <span className="ml-2 hidden text-hair group-open:inline">
                        hide
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-hair px-5 py-4">
                    <ul className="flex flex-col gap-2.5">
                      {top.map((t) => {
                        const tribe = getTribeBySlug(t.slug);
                        const accent = accentHex(tribe?.color ?? "");
                        return (
                          <li
                            key={t.slug}
                            className="grid grid-cols-[110px_1fr] items-center gap-3"
                          >
                            <span className="text-[14px]">{t.name}</span>
                            <Bar
                              value={t.relative}
                              max={1}
                              color={accent}
                              opacity={0.85}
                              label={`Observer ${i + 1}: ${t.name}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Bar({
  value,
  max,
  color,
  opacity,
  label,
}: {
  value: number;
  max: number;
  color: string;
  opacity: number;
  label: string;
}) {
  const fill = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(fill * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

function Callout({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">{children}</p>
    </div>
  );
}

function TribeName({ slug }: { slug?: string }) {
  const tribe = slug ? getTribeBySlug(slug) : undefined;
  if (!tribe) return <span className="text-ink">a tribe</span>;
  return (
    <span className="font-medium" style={{ color: accentHex(tribe.color) }}>
      {tribe.name}
    </span>
  );
}
