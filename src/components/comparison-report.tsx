import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { compareProfiles, type TribeComparison } from "@/lib/observer/compare";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Strength
 * Profile set beside the equal-weight "others" profile aggregated from their
 * anonymous Observer responses, with the tribes they most agree and diverge on
 * called out, and an anonymous per-observer drill-down.
 *
 * Server component: it imports the (server-only) scoring core and aggregation,
 * so the word→tribe mapping never reaches the client (ADR-0009). Render it only
 * from a server component, and only once the ≥3-observer unlock has been checked
 * by the caller — it renders whatever responses it is given.
 */
export function ComparisonReport({
  words,
  observerResponses,
}: {
  /** The Subject's own selected words. */
  words: string[];
  /** Every anonymous Observer's word selection. */
  observerResponses: string[][];
}) {
  const self = score(words);
  const others = aggregateObservers(observerResponses);
  const comparison = compareProfiles(self, others);

  // Shared scale so a "You" bar and an "Others" bar are directly comparable.
  const max = Math.max(
    ...comparison.tribes.flatMap((t) => [t.self, t.others]),
    0,
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {observerResponses.length} observers
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your own profile beside the combined read of everyone who answered. Each
        observer is weighted equally, so no single voice carries more than
        another.
      </p>

      <ComparisonCallouts comparison={comparison} />

      {/* Self vs others bars — all twelve tribes, ordered by your own ranking. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-full bg-ink/30" />
              Others
            </span>
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {comparison.tribes.map((row) => {
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
                    score={row.self}
                    max={max}
                    accent={accent}
                    solid
                  />
                  <CompareBar
                    label="Others"
                    score={row.others}
                    max={max}
                    accent={accent}
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
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Every response is anonymous — labelled only in the order it arrived,
          with nothing tying it to a person.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {observerResponses.map((response, index) => (
            <ObserverCard
              key={index}
              index={index}
              response={response}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/** The alignment / divergence headline pair. */
function ComparisonCallouts({ comparison }: { comparison: ReturnType<typeof compareProfiles> }) {
  const { strongestAgreement, largestDivergence } = comparison;
  if (!strongestAgreement && !largestDivergence) return null;

  return (
    <div className="mt-10 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
      {strongestAgreement && (
        <Callout
          label="Where you agree"
          tribe={strongestAgreement}
          body={`You and your observers both read ${strongestAgreement.name} about the same.`}
        />
      )}
      {largestDivergence && (
        <Callout
          label="Biggest gap"
          tribe={largestDivergence}
          body={
            largestDivergence.delta > 0
              ? `Your observers see ${largestDivergence.name} in you more than you do.`
              : `You see ${largestDivergence.name} in yourself more than your observers do.`
          }
        />
      )}
    </div>
  );
}

function Callout({
  label,
  tribe,
  body,
}: {
  label: string;
  tribe: TribeComparison;
  body: string;
}) {
  const accent = accentHex(getTribeBySlug(tribe.slug)?.color ?? "");
  return (
    <div
      className="rounded-[2px] border border-hair p-5"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div
        className="mt-2 font-serif text-[22px] font-semibold leading-tight"
        style={{ color: accent }}
      >
        {tribe.name}
      </div>
      <p className="mt-2 text-[14px] text-muted">{body}</p>
    </div>
  );
}

/** One horizontal bar for the You/Others comparison. */
function CompareBar({
  label,
  score,
  max,
  accent,
  solid = false,
}: {
  label: string;
  score: number;
  max: number;
  accent: string;
  solid?: boolean;
}) {
  const relative = max > 0 ? score / max : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

/** An anonymous observer's top tribes, for the drill-down. */
function ObserverCard({
  index,
  response,
}: {
  index: number;
  response: string[];
}) {
  const top = rankScores(score(response))
    .filter((t) => t.score > 0)
    .slice(0, 3);

  return (
    <div className="rounded-[2px] border border-hair p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {top.map((row) => {
          const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
          return (
            <li key={row.slug} className="flex items-center gap-2.5">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="font-serif text-[16px]">{row.name}</span>
            </li>
          );
        })}
        {top.length === 0 && (
          <li className="text-[14px] text-muted">No clear read.</li>
        )}
      </ul>
    </div>
  );
}
