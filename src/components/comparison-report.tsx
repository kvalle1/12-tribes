import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { OBSERVER_UNLOCK_THRESHOLD, type ObserverAggregate } from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003): the Subject's
 * own profile alongside the equal-weight aggregated "others" profile, the tribes
 * where the two most agree and most diverge, and an anonymous per-observer
 * drill-down. It unlocks only once at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * Observers have responded; before then it renders a clear locked state showing
 * progress toward the threshold.
 *
 * Server component: it imports the `server-only` scoring core to recompute the
 * Subject's own normalized profile from their saved words, so the word→tribe
 * mapping never reaches the client (ADR-0009). The per-observer drill-down uses
 * native `<details>` so it stays interactive without shipping any client JS.
 */
export function ComparisonReport({
  selfWords,
  aggregate,
}: {
  selfWords: string[];
  aggregate: ObserverAggregate;
}) {
  const { observerCount, unlocked } = aggregate;

  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>

      {unlocked ? (
        <UnlockedReport selfWords={selfWords} aggregate={aggregate} />
      ) : (
        <LockedReport observerCount={observerCount} />
      )}
    </section>
  );
}

/**
 * Shown until the threshold is met: no scores, no averages — just honest
 * progress, so an incomplete 360 never masquerades as a meaningful "others"
 * read.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  const noun = observerCount === 1 ? "response" : "responses";

  return (
    <div className="mt-2">
      <h2 className="font-serif text-[22px] font-semibold leading-snug">
        Your 360 unlocks at {OBSERVER_UNLOCK_THRESHOLD} responses
      </h2>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        {observerCount === 0
          ? "No one has responded yet. "
          : `${observerCount} ${noun} in so far — ${remaining} more to go. `}
        Once at least {OBSERVER_UNLOCK_THRESHOLD} people respond, you&rsquo;ll
        see how their read compares with your own. We wait for three so the
        average is meaningful and no single response can be singled out.
      </p>

      <div className="mt-5 flex items-center gap-2" aria-hidden>
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < observerCount ? "bg-gold" : "bg-hair/60"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">
        {observerCount} of {OBSERVER_UNLOCK_THRESHOLD} responses
      </p>
    </div>
  );
}

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** Signed gap, others − self: positive means others rate this tribe higher. */
  gap: number;
}

/** The unlocked report: self vs aggregated others, agreements/gaps, drill-down. */
function UnlockedReport({
  selfWords,
  aggregate,
}: {
  selfWords: string[];
  aggregate: ObserverAggregate;
}) {
  const selfScores = score(selfWords);
  const rows = buildRows(selfScores, aggregate.average);

  // A single scale shared across self and others bars so the two are visually
  // comparable (the top value across both fills the bar).
  const max = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  // Sort by the Subject's own ranking so their Primary leads and they can read
  // down their order seeing how others rate each tribe.
  const bySelf = [...rows].sort((a, b) => b.self - a.self);

  const scored = rows.filter((r) => r.self > 0 || r.others > 0);
  const alignment = scored.reduce<ComparisonRow | null>(
    (best, r) =>
      best === null || Math.abs(r.gap) < Math.abs(best.gap) ? r : best,
    null,
  );
  const divergence = scored.reduce<ComparisonRow | null>(
    (worst, r) =>
      worst === null || Math.abs(r.gap) > Math.abs(worst.gap) ? r : worst,
    null,
  );

  return (
    <div className="mt-2">
      <h2 className="font-serif text-[22px] font-semibold leading-snug">
        You vs. {aggregate.observerCount} who know you
      </h2>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Your own profile sits beside the equal-weight average of everyone who
        responded — each voice counts the same, however many words they picked.
      </p>

      {(alignment || divergence) && (
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {alignment && (
            <Callout
              label="Where you align"
              tribeName={alignment.name}
              detail="You and your observers see this one the same way."
            />
          )}
          {divergence && divergence.slug !== alignment?.slug && (
            <Callout
              label="Biggest gap"
              tribeName={divergence.name}
              detail={
                divergence.gap > 0
                  ? "Others see this in you more strongly than you do."
                  : "You lean on this more than others see in you."
              }
            />
          )}
        </dl>
      )}

      <div className="mt-8 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-full bg-ink" /> You
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-full bg-gold" /> Others
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-5">
        {bySelf.map((row) => (
          <ComparisonBars key={row.slug} row={row} max={max} />
        ))}
      </ul>

      <ObserverDrilldown aggregate={aggregate} />
    </div>
  );
}

function Callout({
  label,
  tribeName,
  detail,
}: {
  label: string;
  tribeName: string;
  detail: string;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-4">
      <dt className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </dt>
      <dd className="mt-1.5 font-serif text-[18px] text-ink">{tribeName}</dd>
      <dd className="mt-1 text-[13px] text-muted">{detail}</dd>
    </div>
  );
}

/** One tribe's paired self/others bars, scaled to the report's shared max. */
function ComparisonBars({ row, max }: { row: ComparisonRow; max: number }) {
  const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
  const selfPct = max > 0 ? (row.self / max) * 100 : 0;
  const othersPct = max > 0 ? (row.others / max) * 100 : 0;

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <Bar
          pct={selfPct}
          color="var(--color-ink)"
          label={`You rate ${row.name} ${Math.round(selfPct)}% of the top score`}
          hasValue={row.self > 0}
        />
        <Bar
          pct={othersPct}
          color={accent}
          label={`Others rate ${row.name} ${Math.round(othersPct)}% of the top score`}
          hasValue={row.others > 0}
        />
      </div>
    </li>
  );
}

function Bar({
  pct,
  color,
  label,
  hasValue,
}: {
  pct: number;
  color: string;
  label: string;
  hasValue: boolean;
}) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(pct, hasValue ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/**
 * Anonymous per-observer drill-down. Each response is labelled only "Observer
 * N" with its top tribes — no name, no relationship, nothing that could
 * de-anonymize a respondent (ADR-0003). Native `<details>` keeps it collapsible
 * server-side.
 */
function ObserverDrilldown({ aggregate }: { aggregate: ObserverAggregate }) {
  return (
    <details className="mt-10 border-t border-hair pt-6">
      <summary className="cursor-pointer text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink">
        See each response (anonymous)
      </summary>
      <ul className="mt-5 flex flex-col gap-4">
        {aggregate.perObserver.map((scores, i) => {
          const top = [...scores]
            .sort((a, b) => b.score - a.score)
            .filter((s) => s.score > 0)
            .slice(0, 3);
          return (
            <li key={i} className="rounded-[2px] border border-hair p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {i + 1}
              </p>
              <p className="mt-1.5 text-[15px] text-ink">
                {top.length > 0
                  ? top.map((t) => t.name).join(" · ")
                  : "No clear lean"}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Pair self and aggregated-others scores per tribe in canonical order. */
function buildRows(
  self: TribeScore[],
  others: TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  return self.map((s) => {
    const othersScore = othersBySlug.get(s.slug) ?? 0;
    return {
      slug: s.slug,
      name: s.name,
      self: s.score,
      others: othersScore,
      gap: othersScore - s.score,
    };
  });
}
