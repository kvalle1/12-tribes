import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate";
import {
  buildComparison,
  comparisonHighlights,
  type ComparisonRow,
} from "@/lib/assessment/comparison";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Given the
 * Subject's own selected words and the anonymous Observer responses, it scores
 * the Subject with the shared core, aggregates the observers with equal weight,
 * and renders the two profiles side by side with the headline alignment and
 * divergence, plus an anonymous per-observer drill-down.
 *
 * The report unlocks only once at least three Observers have responded; below
 * that it renders a locked state. This is a server component (it imports the
 * `server-only` scoring/aggregation core), so render it only from the server.
 */
export function ComparisonReport({
  selfWords,
  responses,
}: {
  selfWords: string[];
  responses: string[][];
}) {
  const aggregate = aggregateObservers(responses);

  if (!hasEnoughObservers(aggregate.observerCount)) {
    return <LockedState count={aggregate.observerCount} />;
  }

  const self = score(selfWords);
  const rows = buildComparison(self, aggregate.scores);
  const highlights = comparisonHighlights(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own read sits beside the equal-weight average of{" "}
        {aggregate.observerCount} anonymous{" "}
        {aggregate.observerCount === 1 ? "observer" : "observers"}. Each observer
        counts the same, no matter how many words they picked. The gap is where
        growth lives.
      </p>

      <Highlights highlights={highlights} />

      {/* Self vs others bars — all twelve tribes, both reads on one shared scale. */}
      <section className="mt-16 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs others
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink" aria-hidden />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full border border-ink"
                aria-hidden
              />
              Others
            </span>
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <ComparisonBars key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — Observer 1..N, no identity. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each response is fully anonymous. Observers are listed only in the
          order they replied.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {aggregate.perObserver.map((observerScores, i) => (
            <ObserverDetail
              key={i}
              index={i}
              topTribes={topTribes(observerScores)}
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

/** The three headline callouts; each is omitted when its signal is absent. */
function Highlights({
  highlights,
}: {
  highlights: ReturnType<typeof comparisonHighlights>;
}) {
  const cards = [
    {
      row: highlights.biggestBlindSpot,
      label: "Others see more",
      lead: "They read strength here you underplay",
    },
    {
      row: highlights.strongestAgreement,
      label: "You agree most",
      lead: "Both reads land on this together",
    },
    {
      row: highlights.biggestOverestimate,
      label: "You see more",
      lead: "Your read runs ahead of how you come across",
    },
  ].filter((card) => card.row);

  if (cards.length === 0) return null;

  return (
    <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const row = card.row!;
        const tribe = getTribeBySlug(row.slug);
        const accent = accentHex(tribe?.color ?? "");
        return (
          <div
            key={card.label}
            className="rounded-[2px] border border-hair p-5"
            style={{ borderTopColor: accent, borderTopWidth: 3 }}
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
              {card.label}
            </div>
            <div
              className="mt-2 font-serif text-[22px] font-semibold leading-tight"
              style={{ color: accent }}
            >
              {row.name}
            </div>
            <p className="mt-2 text-[13px] leading-snug text-muted">
              {card.lead}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** One tribe's paired bars: a solid "you" bar over an outlined "others" bar. */
function ComparisonBars({ row }: { row: ComparisonRow }) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight" style={{ color: accent }}>
        {row.name}
      </span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label="You"
          relative={row.selfRelative}
          hasScore={row.self > 0}
          accent={accent}
          filled
          tribeName={row.name}
        />
        <Bar
          label="Others"
          relative={row.othersRelative}
          hasScore={row.others > 0}
          accent={accent}
          filled={false}
          tribeName={row.name}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  relative,
  hasScore,
  accent,
  filled,
  tribeName,
}: {
  label: string;
  relative: number;
  hasScore: boolean;
  accent: string;
  filled: boolean;
  tribeName: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[44px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${tribeName}, ${label.toLowerCase()}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, hasScore ? 3 : 0)}%`,
            backgroundColor: filled ? accent : "transparent",
            border: filled ? undefined : `1.5px solid ${accent}`,
            opacity: filled ? 1 : 0.85,
          }}
        />
      </div>
    </div>
  );
}

/** An anonymous observer's top tribes, revealed on demand. */
function ObserverDetail({
  index,
  topTribes,
}: {
  index: number;
  topTribes: { slug: string; name: string }[];
}) {
  return (
    <li className="rounded-[2px] border border-hair">
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-[14px] marker:content-['']">
          <span className="font-serif text-[16px]">Observer {index + 1}</span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-faint transition-colors group-open:text-ink">
            {topTribes.length > 0 ? topTribes[0].name : "No clear read"}
          </span>
        </summary>
        <div className="border-t border-hair px-5 py-4">
          {topTribes.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {topTribes.map((tribe) => {
                const meta = getTribeBySlug(tribe.slug);
                const accent = accentHex(meta?.color ?? "");
                return (
                  <li
                    key={tribe.slug}
                    className="rounded-[2px] border px-3 py-1 text-[13px]"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {tribe.name}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">
              This observer&rsquo;s words didn&rsquo;t point clearly to any tribe.
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

/** The locked state shown until enough observers have responded. */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people
        have responded — enough to make the average meaningful and keep every
        answer anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] font-semibold text-gold">
            {count}
          </span>
          <span className="text-[15px] text-muted">
            of {MIN_OBSERVERS_FOR_REPORT} responses in
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS_FOR_REPORT} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(count / MIN_OBSERVERS_FOR_REPORT, 1) * 100}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "One more response and your comparison opens."
            : `${remaining} more responses and your comparison opens.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result — share your link
        </Link>
      </div>
    </div>
  );
}

/** An observer's top-scoring tribes (up to two), dropping any that scored zero. */
function topTribes(
  observerScores: ReturnType<typeof score>,
): { slug: string; name: string }[] {
  return rankScores(observerScores)
    .filter((row) => row.score > 0)
    .slice(0, 2)
    .map((row) => ({ slug: row.slug, name: row.name }));
}
