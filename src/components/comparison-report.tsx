import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import type { ComparisonReport } from "@/lib/observer/report";

/**
 * The self-vs-others 360 comparison report (issue #9). Shows the Subject's own
 * normalized profile alongside the equal-weight aggregated "others" profile,
 * highlights where the two align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1/2/3…). Locked until at least
 * `minObservers` Observers have responded (ADR-0003), rendering a clear
 * progress-toward-unlock state before then.
 *
 * A server component: it consumes already-computed scores (no scoring logic or
 * word→tribe mapping reaches the client) and uses only native disclosure
 * (`<details>`) for the drill-down, so it needs no client JavaScript.
 */
export function ComparisonReportView({ report }: { report: ComparisonReport }) {
  const { self, observerCount, minObservers, unlocked, others } = report;
  const primary = getTribeBySlug(self.primarySlug);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your own read is{" "}
        <span className="text-ink">{primary?.name ?? self.primarySlug}</span>.
        This compares it against how the people who answered your link see you —
        each counted equally, no matter how many words they picked.
      </p>

      {unlocked && others ? (
        <UnlockedReport report={report} others={others} />
      ) : (
        <LockedState observerCount={observerCount} minObservers={minObservers} />
      )}
    </div>
  );
}

/** Before the report unlocks: a clear count of how many more Observers are needed. */
function LockedState({
  observerCount,
  minObservers,
}: {
  observerCount: number;
  minObservers: number;
}) {
  const remaining = Math.max(minObservers - observerCount, 0);
  const filled = Math.min(observerCount, minObservers);

  return (
    <section className="mt-12 rounded-[3px] border border-hair bg-white/50 p-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Report locked
      </p>
      <h2 className="mt-2 font-serif text-[24px] font-semibold leading-snug">
        {remaining === 0
          ? "Almost there"
          : `${remaining} more ${remaining === 1 ? "response" : "responses"} to unlock`}
      </h2>
      <p className="mt-3 max-w-[500px] text-[15px] text-muted">
        The comparison opens once at least {minObservers} people have responded,
        so the &ldquo;others&rdquo; view is meaningful and no single response can
        be singled out.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: minObservers }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-10 rounded-full ${i < filled ? "bg-gold" : "bg-hair"}`}
            />
          ))}
        </div>
        <span className="text-[13px] text-muted">
          {observerCount} of {minObservers} in
        </span>
      </div>

      <Link
        href="/assessment/result"
        className="mt-7 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Get your share link →
      </Link>
    </section>
  );
}

/** The unlocked comparison: side-by-side bars, divergence callout, drill-down. */
function UnlockedReport({
  report,
  others,
}: {
  report: ComparisonReport;
  others: NonNullable<ComparisonReport["others"]>;
}) {
  const { self } = report;

  // Merge the two profiles by tribe. `self.scores` and `others.average` are both
  // in canonical order, so index `i` refers to the same tribe in each.
  const rows = self.scores.map((s, i) => {
    const o = others.average[i];
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: o.score,
      diff: o.score - s.score,
    };
  });

  // One scale for both bars so "you" and "others" are visually comparable.
  const globalMax = Math.max(...rows.flatMap((r) => [r.self, r.others]), 0);
  const ranked = [...rows].sort(
    (a, b) => b.self + b.others - (a.self + a.others),
  );

  // Divergence: where others read you higher / lower than you read yourself.
  const byDiff = [...rows].sort((a, b) => b.diff - a.diff);
  const overRead = byDiff[0]; // others see more of this than you claim
  const underRead = byDiff[byDiff.length - 1]; // you claim more of this than others see
  const DIVERGENCE_EPS = 1e-6;

  return (
    <>
      {/* Legend */}
      <div className="mt-10 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-gold" />
          Others ({report.observerCount})
        </span>
      </div>

      {/* Side-by-side bars for all twelve tribes. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
          {ranked.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const selfPct = globalMax > 0 ? (row.self / globalMax) * 100 : 0;
            const othersPct =
              globalMax > 0 ? (row.others / globalMax) * 100 : 0;
            const isSelfPrimary = row.slug === self.primarySlug;
            const isSelfSecondary = row.slug === self.secondarySlug;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex flex-col">
                  <span
                    className="font-serif text-[17px] leading-tight"
                    style={{
                      color: isSelfPrimary || isSelfSecondary ? accent : undefined,
                    }}
                  >
                    {row.name}
                  </span>
                  {(isSelfPrimary || isSelfSecondary) && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      Your {isSelfPrimary ? "primary" : "secondary"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Bar
                    fraction={selfPct}
                    color="var(--color-ink, #1c1b18)"
                    label={`You rate ${row.name} at ${Math.round(selfPct)}% of your top`}
                    solid
                  />
                  <Bar
                    fraction={othersPct}
                    color={accent}
                    label={`Others rate ${row.name} at ${Math.round(othersPct)}% of the top`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where you align and diverge. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you and others diverge
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {overRead && overRead.diff > DIVERGENCE_EPS ? (
            <DivergenceLine
              label="Others see more"
              tribeName={overRead.name}
              slug={overRead.slug}
              detail="They read this in you more strongly than you claimed it."
            />
          ) : null}
          {underRead && underRead.diff < -DIVERGENCE_EPS ? (
            <DivergenceLine
              label="You claim more"
              tribeName={underRead.name}
              slug={underRead.slug}
              detail="You lean on this more than the people around you see."
            />
          ) : null}
          {(!overRead || overRead.diff <= DIVERGENCE_EPS) &&
          (!underRead || underRead.diff >= -DIVERGENCE_EPS) ? (
            <p className="text-[15px] text-muted">
              Your read and your observers&rsquo; read line up closely across the
              board.
            </p>
          ) : null}
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The spread of opinion behind the average. Responses are fully anonymous
          — only their order is shown.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          {others.perObserver.map((scores, i) => (
            <ObserverDrilldown key={i} index={i + 1} scores={scores} />
          ))}
        </div>
      </section>
    </>
  );
}

/** A single proportional bar. `solid` renders the opaque "you" style. */
function Bar({
  fraction,
  color,
  label,
  solid = false,
}: {
  fraction: number;
  color: string;
  label: string;
  solid?: boolean;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction, fraction > 0 ? 3 : 0)}%`,
          backgroundColor: color,
          opacity: solid ? 1 : 0.7,
        }}
      />
    </div>
  );
}

function DivergenceLine({
  label,
  tribeName,
  slug,
  detail,
}: {
  label: string;
  tribeName: string;
  slug: string;
  detail: string;
}) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div className="flex items-baseline gap-3">
      <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span
        className="font-serif text-[18px]"
        style={{ color: accent }}
      >
        {tribeName}
      </span>
      <span className="text-[14px] text-muted">— {detail}</span>
    </div>
  );
}

/** One Observer's top tribes, shown anonymously as "Observer N". */
function ObserverDrilldown({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const ranked = rankScores(scores)
    .filter((r) => r.score > 0)
    .slice(0, 4);
  const top = ranked[0];
  const topTribe = top ? getTribeBySlug(top.slug) : undefined;

  return (
    <details className="group rounded-[3px] border border-hair bg-white/40 px-5 py-3.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-[13px] uppercase tracking-[0.14em] text-muted">
          Observer {index}
        </span>
        <span className="flex items-center gap-2 text-[14px]">
          {top ? (
            <>
              <span className="text-faint">reads you as</span>
              <span
                className="font-serif text-[16px]"
                style={{ color: accentHex(topTribe?.color ?? "") }}
              >
                {top.name}
              </span>
            </>
          ) : (
            <span className="text-faint">no clear read</span>
          )}
          <span className="text-faint transition-transform group-open:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <ul className="mt-4 flex flex-col gap-2.5">
        {ranked.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
            >
              <span className="text-[14px]">{row.name}</span>
              <Bar
                fraction={row.relative * 100}
                color={accent}
                label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top read`}
              />
            </li>
          );
        })}
      </ul>
    </details>
  );
}
