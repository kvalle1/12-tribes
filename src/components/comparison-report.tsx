import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  OBSERVER_UNLOCK_THRESHOLD,
  type ObserverResponseInput,
} from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003) — the view that
 * closes the 360 loop. It sits the Subject's own Self Assessment profile beside
 * the equal-weight aggregate of their Observers, calls out where the two agree
 * and where they diverge, and offers an anonymous per-observer drill-down.
 *
 * It stays **locked** until at least {@link OBSERVER_UNLOCK_THRESHOLD} Observers
 * have responded, both because a comparison needs enough voices to mean anything
 * and so a single anonymous Observer can't be reverse-engineered from the
 * aggregate. Below the threshold it renders a clear locked state with progress.
 *
 * Server component: it imports the `server-only` scoring core (the word→tribe
 * mapping never reaches the client, ADR-0009), so render it only from server
 * components. Observers are shown as "Observer 1/2/3" with no attributes — the
 * input carries only their words.
 */

/** A tribe as seen from both sides, with a display-normalized fill for each. */
interface CompareRow {
  slug: string;
  name: string;
  selfScore: number;
  othersScore: number;
  /** Bar fills (0–1) against the max score across both profiles. */
  selfFill: number;
  othersFill: number;
  /** othersScore − selfScore, the signed gap between the two reads. */
  diff: number;
}

/** Only gaps at least this large (as a fraction of the shared max) are surfaced. */
const DIVERGENCE_THRESHOLD = 0.18;

export function ComparisonReport({
  self,
  observerResponses,
}: {
  self: { words: string[]; primarySlug: string; secondarySlug?: string | null };
  observerResponses: ObserverResponseInput[];
}) {
  const { others, perObserver, observerCount, unlocked } =
    aggregateObservers(observerResponses);

  if (!unlocked) {
    return <LockedState observerCount={observerCount} />;
  }

  const selfScores = score(self.words);
  const selfBySlug = new Map(selfScores.map((s) => [s.slug, s.score]));
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));

  const sharedMax = Math.max(
    0,
    ...selfScores.map((s) => s.score),
    ...others.map((s) => s.score),
  );

  const rows: CompareRow[] = selfScores
    .map((s) => {
      const selfScore = selfBySlug.get(s.slug) ?? 0;
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        selfScore,
        othersScore,
        selfFill: sharedMax > 0 ? selfScore / sharedMax : 0,
        othersFill: sharedMax > 0 ? othersScore / sharedMax : 0,
        diff: othersScore - selfScore,
      };
    })
    // Surface whatever either side rates highly first; ties keep canonical order.
    .sort((a, b) => Math.max(b.selfScore, b.othersScore) - Math.max(a.selfScore, a.othersScore));

  const gap = sharedMax * DIVERGENCE_THRESHOLD;
  const othersSeeMore = rows
    .filter((r) => r.diff >= gap)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);
  const othersSeeLess = rows
    .filter((r) => -r.diff >= gap)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);
  const agreement = rows
    .filter((r) => Math.abs(r.diff) < gap && r.selfScore > 0)
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {observerCount}{" "}
        {observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own word selection, beside the equal-weight average of everyone who
        answered about you. Each observer counts once, however many words they
        picked, so no single voice dominates.
      </p>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-6 rounded-full bg-ink" aria-hidden />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-6 rounded-full bg-ink/35"
            aria-hidden
          />
          Others
        </span>
      </div>

      {/* Side-by-side bars, all twelve tribes. */}
      <section className="mt-6">
        <ul className="flex flex-col gap-5">
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
                    label={`${row.name}, your read`}
                    fill={row.selfFill}
                    hasScore={row.selfScore > 0}
                    color={accent}
                    opacity={1}
                  />
                  <CompareBar
                    label={`${row.name}, others' read`}
                    fill={row.othersFill}
                    hasScore={row.othersScore > 0}
                    color={accent}
                    opacity={0.4}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment and divergence callouts. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you align &amp; diverge
        </p>
        <div className="mt-6 flex flex-col gap-6">
          <Callout
            title="Others see more of"
            empty="No tribe stood out notably higher in others' reads than your own."
            tribes={othersSeeMore}
          />
          <Callout
            title="You claim more than others see"
            empty="Nothing you rated highly was notably missing from others' reads."
            tribes={othersSeeLess}
          />
          <Callout
            title="Strong agreement"
            empty="Your read and theirs didn't land closely on any shared strength."
            tribes={agreement}
          />
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response on its own, fully anonymous — no names, no relationships,
          in no particular order beyond when they answered.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {perObserver.map((profile, index) => (
            <ObserverCard
              // Observers are positional and anonymous; index is the only key.
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
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fill * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fill * 100, hasScore ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

function Callout({
  title,
  tribes,
  empty,
}: {
  title: string;
  tribes: CompareRow[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
        {title}
      </p>
      {tribes.length === 0 ? (
        <p className="mt-2 text-[14px] text-faint">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2.5">
          {tribes.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={row.slug}
                className="flex items-center gap-2 rounded-[2px] border border-hair px-3 py-1.5 text-[14px]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                {row.name}
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
  profile,
}: {
  index: number;
  profile: TribeScore[];
}) {
  const top = rankScores(profile)
    .filter((t) => t.score > 0)
    .slice(0, 3);
  return (
    <li className="rounded-[2px] border border-hair p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </p>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-faint">No clear read.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {top.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex items-center gap-2 text-[15px]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span className="font-serif">{row.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.04]">
        A few more voices needed
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have answered about you. That keeps the read meaningful and every
        observer&rsquo;s answers anonymous.
      </p>

      <div className="mt-8 flex items-center gap-3" aria-hidden>
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < observerCount ? "bg-gold" : "border border-hair bg-transparent"
            }`}
          />
        ))}
      </div>
      <p className="mt-4 text-[14px] text-muted">
        {observerCount} of {OBSERVER_UNLOCK_THRESHOLD} responses in
        {remaining > 0 && (
          <>
            {" "}
            — {remaining} more to go.
          </>
        )}
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result &amp; share link
        </Link>
      </div>
    </div>
  );
}
