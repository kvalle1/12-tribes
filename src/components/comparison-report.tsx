import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). It sets the
 * Subject's own profile beside the equal-weight "others" profile aggregated from
 * anonymous Observer responses, calls out where the two align and diverge, and
 * offers an anonymous per-Observer drill-down (Observer 1/2/3).
 *
 * The report stays **locked until at least three Observers have responded**, so
 * the "others" view is meaningful and no single Observer can be singled out.
 * Below the threshold only the progress toward unlocking is shown.
 *
 * Server component: it imports the `server-only` scoring core and aggregation, so
 * the word→tribe mapping never reaches the client (ADR-0009). Render only from a
 * server component. The per-Observer drill-down uses a native `<details>` so it
 * needs no client JavaScript.
 */
export function ComparisonReport({
  selfWords,
  responses,
}: {
  selfWords: string[];
  responses: { words: string[] }[];
}) {
  const agg = aggregateObservers(responses);

  if (!agg.unlocked) {
    return <LockedState count={agg.observerCount} needed={agg.minObservers} />;
  }

  const self = score(selfWords);
  const othersBySlug = new Map(agg.average.map((s) => [s.slug, s.score]));

  // Common scale so the two bars are directly comparable and divergence reads
  // visually — fill is relative to the strongest single score across either
  // profile. The tiny floor avoids a divide-by-zero if everything is 0.
  const scale = Math.max(
    1e-9,
    ...self.map((s) => s.score),
    ...agg.average.map((s) => s.score),
  );

  // Anchor rows on the Subject's own profile order (their strongest tribes
  // first), so the report reads as "your tribes, and how others see them."
  const rows: ComparisonRow[] = self
    .map((s) => {
      const others = othersBySlug.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self: s.score, others, gap: others - s.score };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  const insight = pickInsight(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h2 className="mt-2 font-serif text-[clamp(28px,5vw,40px)] font-semibold leading-[1.05]">
        How your read compares
      </h2>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your own profile beside the combined read of{" "}
        <strong className="font-semibold text-ink">
          {agg.observerCount}
        </strong>{" "}
        {agg.observerCount === 1 ? "observer" : "observers"}. Each observer counts
        equally, no matter how many words they picked.
      </p>

      {insight && (
        <p className="mt-6 rounded-[2px] border-l-2 border-gold bg-gold/5 py-3 pl-4 pr-3 text-[14px] text-ink">
          {insight}
        </p>
      )}

      <Legend />

      {/* Per-tribe self-vs-others bars. */}
      <section className="mt-8 border-t border-hair pt-8">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-2">
                  <ComparisonBar
                    label="You"
                    value={row.self}
                    fill={row.self / scale}
                    color={accent}
                    variant="self"
                  />
                  <ComparisonBar
                    label="Others"
                    value={row.others}
                    fill={row.others / scale}
                    color={accent}
                    variant="others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink">
            <span className="border-b border-hair pb-1 group-open:border-gold">
              See individual reads (anonymous) ▾
            </span>
          </summary>
          <p className="mt-5 max-w-[540px] text-[14px] text-muted">
            Each observer&rsquo;s response, labelled only by number. No names, no
            relationships — nothing that identifies who said what.
          </p>
          <div className="mt-6 flex flex-col gap-8">
            {agg.perObserver.map((profile, index) => (
              <ObserverBreakdown
                key={index}
                index={index + 1}
                profile={profile}
              />
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  gap: number;
}

/**
 * Choose one plain-language takeaway from the rows: the sharpest divergence
 * between the Subject and the group, or — if everyone broadly agrees — the
 * strongest point of alignment. Returns `null` only in the degenerate all-zero
 * case, where there is nothing to say.
 */
function pickInsight(rows: ComparisonRow[]): string | null {
  if (rows.length === 0) return null;

  const widest = rows.reduce((a, b) =>
    Math.abs(b.gap) > Math.abs(a.gap) ? b : a,
  );

  // A meaningful gap: others clearly see a tribe more or less than you do.
  if (Math.abs(widest.gap) >= 0.15) {
    const direction = widest.gap > 0 ? "more" : "less";
    return `Others read ${widest.name} in you ${direction} strongly than you read it in yourself — the widest gap between your view and theirs.`;
  }

  const topShared = rows.find((r) => r.self > 0 && r.others > 0) ?? rows[0];
  return `You and your observers land in close agreement — ${topShared.name} shows up strongly on both sides.`;
}

function ComparisonBar({
  label,
  value,
  fill,
  color,
  variant,
}: {
  label: string;
  value: number;
  fill: number;
  color: string;
  variant: "self" | "others";
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fill * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            // "You" reads solid; "others" reads as an outlined/lighter fill so
            // the two are distinguishable at a glance even for one accent color.
            opacity: variant === "self" ? 1 : 0.4,
          }}
        />
      </div>
      <span className="w-[34px] shrink-0 text-right text-[11px] tabular-nums text-faint">
        {pct}%
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-5 text-[11px] uppercase tracking-[0.12em] text-faint">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
        You
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-6 rounded-full bg-ink/40" />
        Others (equal-weight average)
      </span>
    </div>
  );
}

/** One anonymous observer's top tribes, rendered as compact bars. */
function ObserverBreakdown({
  index,
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = [...profile]
    .sort((a, b) => b.score - a.score)
    .filter((t) => t.score > 0)
    .slice(0, 4);
  const scale = Math.max(1e-9, ...top.map((t) => t.score));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-muted">
        Observer {index}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {top.length === 0 && (
          <li className="text-[13px] text-faint">No scoring words selected.</li>
        )}
        {top.map((tribe) => {
          const accent = accentHex(getTribeBySlug(tribe.slug)?.color ?? "");
          return (
            <li
              key={tribe.slug}
              className="grid grid-cols-[104px_1fr] items-center gap-3 max-[520px]:grid-cols-[84px_1fr]"
            >
              <span className="font-serif text-[15px]">{tribe.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((tribe.score / scale) * 100, 3)}%`,
                    backgroundColor: accent,
                    opacity: 0.7,
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

function LockedState({ count, needed }: { count: number; needed: number }) {
  const remaining = needed - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h2 className="mt-2 font-serif text-[clamp(28px,5vw,40px)] font-semibold leading-[1.05]">
        Your comparison is still locked
      </h2>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        The others&rsquo; view unlocks once at least{" "}
        <strong className="font-semibold text-ink">{needed}</strong> people have
        responded — enough that the combined read is meaningful and no single
        observer can be singled out.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${needed} observer responses`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.min((count / needed) * 100, 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[13px] tabular-nums text-muted">
          {count} of {needed}
        </span>
      </div>

      <p className="mt-6 text-[14px] text-muted">
        {remaining <= 0
          ? "Enough responses are in — refresh to see your comparison."
          : `${remaining} more ${remaining === 1 ? "response" : "responses"} to go. Share your observer link with a few more people who know you well.`}
      </p>
    </div>
  );
}
