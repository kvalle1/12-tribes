import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  scoreEachObserver,
  isReportUnlocked,
  MIN_OBSERVERS,
  type ProfileComparison,
} from "@/lib/assessment/aggregateObservers";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The self-vs-others comparison report that closes the 360 loop (issue #9,
 * ADR-0003). It shows the Subject's own Strength Profile beside the aggregated
 * "others" profile, calls out where the two most diverge, and offers an
 * anonymous per-observer drill-down.
 *
 * The report is **locked until at least `MIN_OBSERVERS` Observers respond** —
 * below that the "others" view is too thin to be meaningful and an individual
 * Observer's anonymity too easily unpicked. Until then it shows only a progress
 * state (n of 3), never any observer data.
 *
 * A server component: it imports the `server-only` scoring core, so the
 * word→tribe mapping never reaches the client (ADR-0009). Render it only from
 * server components.
 */
export function ComparisonReport({
  selfWords,
  observerWordLists,
}: {
  selfWords: string[];
  observerWordLists: string[][];
}) {
  const observerCount = observerWordLists.length;

  if (!isReportUnlocked(observerCount)) {
    return <LockedReport observerCount={observerCount} />;
  }

  const self = score(selfWords);
  const others = aggregateObservers(observerWordLists);
  const comparison = compareProfiles(self, others);
  const perObserver = scoreEachObserver(observerWordLists);

  // A shared scale for both bars so self and others are directly comparable: the
  // single largest value across either profile fills its bar, everything else in
  // proportion (mirrors the result view's relative bars).
  const sharedMax = Math.max(
    ...comparison.map((c) => Math.max(c.selfScore, c.othersScore)),
    0,
  );

  // Rank by the stronger of the two reads so the tribes that matter sit on top;
  // ties keep canonical (tribe `number`) order like the rest of the app.
  const ranked = [...comparison].sort(
    (a, b) =>
      Math.max(b.selfScore, b.othersScore) - Math.max(a.selfScore, a.othersScore),
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · {observerCount}{" "}
        {observerCount === 1 ? "observer" : "observers"}
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        You vs. how others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Each observer picked words anonymously, and no observer counts for more
        than another no matter how many words they chose. Your own read is in
        gold; the others&rsquo; shared read sits beneath it.
      </p>

      <DivergenceCallout comparison={comparison} />

      {/* Paired self / others bars for all twelve tribes on a shared scale. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Self vs. others, tribe by tribe
        </p>
        <Legend />
        <ul className="mt-6 flex flex-col gap-6">
          {ranked.map((row) => (
            <ComparisonRow key={row.slug} row={row} sharedMax={sharedMax} />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The spread of opinion
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Each observer&rsquo;s own read, in the order they responded. They stay
          anonymous — no names, no attributes, just Observer 1, 2, 3.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((observer, index) => (
            <ObserverDrilldown
              key={index}
              index={index}
              scores={observer}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The locked state shown before enough Observers have responded. */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  const pct = Math.min(observerCount / MIN_OBSERVERS, 1) * 100;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        Your report is almost ready
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS} people have
        responded — enough that the &ldquo;others&rdquo; view is meaningful and
        no single observer can be picked out. Keep your link out with a few more
        people who know you well.
      </p>

      <div className="mt-10 rounded-[3px] border border-hair bg-white/40 px-7 py-8">
        <p className="font-serif text-[22px] font-semibold">
          {observerCount} of {MIN_OBSERVERS} responses in
        </p>
        <div
          className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${Math.max(pct, observerCount > 0 ? 6 : 0)}%` }}
          />
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just 1 more response and your report opens."
            : `${remaining} more responses and your report opens.`}
        </p>
      </div>
    </div>
  );
}

/** Legend distinguishing the self bar from the others bar. */
function Legend() {
  return (
    <div className="mt-4 flex items-center gap-6 text-[12px] text-muted">
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-gold" aria-hidden />
        You
      </span>
      <span className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full bg-ink/45"
          aria-hidden
        />
        Others (average)
      </span>
    </div>
  );
}

/** One tribe row: its name plus paired self and others bars on a shared scale. */
function ComparisonRow({
  row,
  sharedMax,
}: {
  row: ProfileComparison;
  sharedMax: number;
}) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  const selfPct = sharedMax > 0 ? (row.selfScore / sharedMax) * 100 : 0;
  const othersPct = sharedMax > 0 ? (row.othersScore / sharedMax) * 100 : 0;

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-none">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <Bar
          pct={selfPct}
          hasValue={row.selfScore > 0}
          color={accent}
          opacity={1}
          label={`${row.name}, your read: ${Math.round(selfPct)}% of the top score`}
        />
        <Bar
          pct={othersPct}
          hasValue={row.othersScore > 0}
          color="var(--color-ink, #1a1a1a)"
          opacity={0.45}
          label={`${row.name}, others' read: ${Math.round(othersPct)}% of the top score`}
        />
      </div>
    </li>
  );
}

function Bar({
  pct,
  hasValue,
  color,
  opacity,
  label,
}: {
  pct: number;
  hasValue: boolean;
  color: string;
  opacity: number;
  label: string;
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
          width: `${Math.max(pct, hasValue ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

/**
 * The two sharpest divergences: the tribe the Subject reads more strongly than
 * others do, and the one others read more strongly than the Subject. This is
 * where the 360's most useful insight lives (PRD).
 */
function DivergenceCallout({
  comparison,
}: {
  comparison: ProfileComparison[];
}) {
  const selfHigher = [...comparison]
    .filter((c) => c.divergence > 0)
    .sort((a, b) => b.divergence - a.divergence)[0];
  const othersHigher = [...comparison]
    .filter((c) => c.divergence < 0)
    .sort((a, b) => a.divergence - b.divergence)[0];

  if (!selfHigher && !othersHigher) return null;

  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {selfHigher && (
        <div className="rounded-[3px] border border-hair bg-white/40 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            You see more than others
          </p>
          <p className="mt-1.5 font-serif text-[19px] font-semibold">
            {selfHigher.name}
          </p>
          <p className="mt-1 text-[14px] text-muted">
            You read {selfHigher.name} in yourself more strongly than the people
            around you do.
          </p>
        </div>
      )}
      {othersHigher && (
        <div className="rounded-[3px] border border-hair bg-white/40 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Others see more than you
          </p>
          <p className="mt-1.5 font-serif text-[19px] font-semibold">
            {othersHigher.name}
          </p>
          <p className="mt-1 text-[14px] text-muted">
            The people around you read {othersHigher.name} in you more strongly
            than you read it in yourself.
          </p>
        </div>
      )}
    </div>
  );
}

/** One anonymous observer's top tribes, collapsed behind a native disclosure. */
function ObserverDrilldown({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const top = [...scores]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <li>
      <details className="rounded-[3px] border border-hair bg-white/40 px-5 py-3.5">
        <summary className="cursor-pointer list-none font-serif text-[17px] font-semibold marker:content-none">
          Observer {index + 1}
          {top.length > 0 && (
            <span className="ml-2 text-[14px] font-normal text-muted">
              — reads you as {top.map((t) => t.name).join(", ")}
            </span>
          )}
        </summary>
        {top.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {top.map((t) => {
              const tribe = getTribeBySlug(t.slug);
              const accent = accentHex(tribe?.color ?? "");
              return (
                <li
                  key={t.slug}
                  className="rounded-[2px] border px-3 py-1 text-[13px]"
                  style={{ borderColor: accent, color: accent }}
                >
                  {t.name}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-muted">
            No clear tribe from this observer&rsquo;s words.
          </p>
        )}
      </details>
    </li>
  );
}
