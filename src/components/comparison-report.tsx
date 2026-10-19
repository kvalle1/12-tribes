import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, deriveResult } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/assessment/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile set beside the equal-weight "others" profile aggregated from their
 * anonymous Observers, with alignment/divergence called out and an anonymous
 * per-Observer drill-down.
 *
 * The report **unlocks only once at least three Observers have responded**
 * (`MIN_OBSERVERS`) — below that it shows a locked state with progress, which
 * both makes the average meaningful and protects individual Observer anonymity.
 *
 * Server component: it imports the scoring core and the equal-weight
 * aggregation, both `server-only`, so the word→tribe mapping never reaches the
 * client (ADR-0009). Render it only from server components.
 */

/** Observers required before the comparison unlocks (ADR-0003). */
export const MIN_OBSERVERS = 3;

/** A divergence must exceed this (in normalized score) to be worth surfacing. */
const DIVERGENCE_THRESHOLD = 0.04;

export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const count = observerResponses.length;

  if (count < MIN_OBSERVERS) {
    return <LockedState count={count} />;
  }

  const self = score(selfWords);
  const others = aggregateObservers(observerResponses);

  // Rank both profiles with the shared helper (sorted desc, ties keep canonical
  // order) so this view can never drift from the Self result view's ordering.
  const selfRanked = rankScores(self);
  const selfPrimary = selfRanked[0];
  const othersPrimary = rankScores(others)[0];
  const primariesAgree = selfPrimary.slug === othersPrimary.slug;

  // One shared scale across both profiles, so a tribe's "you" and "others" bars
  // — and the divergence figures below — are all read against the single
  // longest bar in the chart.
  const max = Math.max(...self.map((t) => t.score), ...others.map((t) => t.score));
  const relative = (value: number) => (max > 0 ? value / max : 0);

  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));

  // Rows follow the Subject's own ranking (their profile is the anchor), each
  // carrying both bars' fill fractions on that shared scale.
  const rows = selfRanked.map((t) => ({
    slug: t.slug,
    name: t.name,
    selfRel: relative(t.score),
    othersRel: relative(othersBySlug.get(t.slug) ?? 0),
  }));

  // Divergence is measured in the same shared-scale units the bars use, so a
  // reported gap always matches the visible gap between a tribe's two bars.
  const divergences = rows
    .map((r) => ({ slug: r.slug, name: r.name, diff: r.othersRel - r.selfRel }))
    .filter((r) => Math.abs(r.diff) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const seeMore = divergences.filter((d) => d.diff > 0).slice(0, 3);
  const seeLess = divergences.filter((d) => d.diff < 0).slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
        Your read, and theirs
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own profile sits beside the combined read of{" "}
        <strong className="font-semibold text-ink">{count}</strong> people who
        answered anonymously. Each Observer counts equally, however many words
        they chose. The gap between the two is where growth lives.
      </p>

      {/* Alignment headline. */}
      <section className="mt-12 border-t border-hair pt-8">
        {primariesAgree ? (
          <p className="text-[15px] leading-relaxed text-ink">
            Others see your Primary the same way you do —{" "}
            <HeadlineTribe slug={selfPrimary.slug} />. Your read and theirs line
            up at the top.
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed text-ink">
            You lead with <HeadlineTribe slug={selfPrimary.slug} />, but others
            see <HeadlineTribe slug={othersPrimary.slug} /> most strongly. That
            gap is worth sitting with.
          </p>
        )}
      </section>

      {/* Paired self-vs-others bars for all twelve tribes. */}
      <section className="mt-12 border-t border-hair pt-8">
        <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40 bg-ink/25" />
            Others
          </span>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[17px] leading-tight"
                  style={{ color: row.slug === selfPrimary.slug ? accent : undefined }}
                >
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <ProfileBar
                    label="You"
                    relative={row.selfRel}
                    accent={accent}
                    filled
                  />
                  <ProfileBar
                    label="Others"
                    relative={row.othersRel}
                    accent={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two reads diverge. */}
      {(seeMore.length > 0 || seeLess.length > 0) && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where their read diverges
          </p>
          <div className="mt-5 grid gap-8 sm:grid-cols-2">
            <DivergenceList
              heading="Others see more than you claim"
              rows={seeMore}
              empty="Nothing they rate markedly higher than you do."
            />
            <DivergenceList
              heading="Others see less than you claim"
              rows={seeLess}
              empty="Nothing they rate markedly lower than you do."
            />
          </div>
        </section>
      )}

      {/* Anonymous per-Observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each Observer&rsquo;s read
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every response is anonymous — no names, no attributes, just the tribe
          each read came out to.
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {observerResponses.map((words, index) => {
            const { primary, secondary } = deriveResult(score(words));
            return (
              <li
                key={index}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[2px] border border-hair bg-white/40 px-4 py-3"
              >
                <span className="text-[12px] uppercase tracking-[0.14em] text-faint">
                  Observer {index + 1}
                </span>
                <span className="font-serif text-[18px] text-ink">
                  {primary.name}
                </span>
                {secondary && (
                  <span className="font-serif text-[15px] italic text-muted">
                    + {secondary.name}
                  </span>
                )}
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
          Back to your result
        </Link>
      </div>
    </div>
  );
}

/** The locked state shown until at least three Observers have responded. */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted">
        Your 360 comparison opens once at least {MIN_OBSERVERS} people have
        responded. That keeps the combined read meaningful and every individual
        Observer anonymous.
      </p>

      <div className="mt-10 rounded-[3px] border border-hair bg-white/40 px-6 py-6">
        <p className="text-[13px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </p>
        <p className="mt-3 font-serif text-[40px] leading-none text-ink">
          {count}{" "}
          <span className="text-[22px] text-muted">of {MIN_OBSERVERS}</span>
        </p>
        <div
          className="mt-5 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS} Observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.min(count / MIN_OBSERVERS, 1) * 100}%` }}
          />
        </div>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 1
            ? "One more response and it opens."
            : `${remaining} more responses and it opens.`}
        </p>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result to share your link
        </Link>
      </div>
    </div>
  );
}

function ProfileBar({
  label,
  relative,
  accent,
  filled = false,
}: {
  label: string;
  relative: number;
  accent: string;
  filled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the strongest score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, relative > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: filled ? 1 : 0.4,
          }}
        />
      </div>
      <span className="w-[48px] shrink-0 text-right text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  );
}

function DivergenceList({
  heading,
  rows,
  empty,
}: {
  heading: string;
  rows: { slug: string; name: string; diff: number }[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-ink">{heading}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[14px] text-faint">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex items-center gap-2.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span className="font-serif text-[16px] text-ink">
                  {row.name}
                </span>
                <span className="text-[13px] text-muted">
                  {row.diff > 0 ? "+" : "−"}
                  {Math.round(Math.abs(row.diff) * 100)} pts
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HeadlineTribe({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <strong className="font-semibold" style={{ color: accent }}>
      {tribe?.name ?? slug}
    </strong>
  );
}
