import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import {
  aggregateObservers,
  compareProfiles,
  scoreEachObserver,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregateObservers";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own Self
 * Assessment profile set beside the equal-weight "others" profile aggregated
 * from their anonymous Observers, plus an anonymous per-Observer drill-down.
 *
 * Locked until at least `MIN_OBSERVERS` have responded — below that the "others"
 * view would be too thin to be meaningful and could de-anonymize an individual
 * Observer, so we render a progress-only locked state instead.
 *
 * A server component: it reaches the scoring core, which is `server-only` (the
 * word→tribe mapping never touches the client, ADR-0009). All of the Subject's
 * and Observers' words are scored here on the server; the client only ever
 * receives the rendered bars.
 */
export function ComparisonReport({
  words,
  observerWordLists,
}: {
  words: string[];
  observerWordLists: string[][];
}) {
  const observerCount = observerWordLists.length;

  if (!isReportUnlocked(observerCount)) {
    return <LockedReport observerCount={observerCount} />;
  }

  const self = score(words);
  const others = aggregateObservers(observerWordLists);
  const comparison = compareProfiles(self, others);

  // A single shared scale for both profiles so "you" and "others" bars are
  // directly comparable tribe-to-tribe (both are already normalized 0–1 by the
  // same per-tribe denominator, ADR-0001).
  const maxScore = Math.max(
    ...comparison.map((c) => Math.max(c.self, c.others)),
    0,
  );
  const pct = (v: number) => (maxScore > 0 ? (v / maxScore) * 100 : 0);

  // Ranked highest-first by the Subject's own read, so the report leads with the
  // tribes they most identify with.
  const rows = [...comparison].sort((a, b) => b.self - a.self);

  // The sharpest disagreements, either direction, for the "where you diverge"
  // callout. Only surface gaps that are actually meaningful.
  const divergences = [...comparison]
    .filter((c) => Math.abs(c.divergence) > 0.05)
    .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
    .slice(0, 3);

  const perObserver = scoreEachObserver(observerWordLists);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your own read is set beside the combined read of{" "}
        <strong className="text-ink">{observerCount}</strong>{" "}
        {observerCount === 1 ? "observer" : "observers"}, each weighted equally.
        The gap between them — not either bar alone — is where the most useful
        insight tends to live.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Paired bars — all twelve tribes on a shared scale. */}
      <section className="mt-8">
        <ul className="flex flex-col gap-5">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <Link
                href={`/tribes/${row.slug}`}
                className="font-serif text-[17px] leading-none transition-colors hover:text-gold"
              >
                {row.name}
              </Link>
              <div className="flex flex-col gap-1.5">
                <Bar label="You" pct={pct(row.self)} className="bg-ink" />
                <Bar label="Others" pct={pct(row.others)} className="bg-gold" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Where you diverge. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((c) => {
              const higherSelf = c.divergence > 0;
              return (
                <li key={c.slug} className="text-[15px] text-muted">
                  <span
                    className="font-serif text-[17px] text-ink"
                    style={{ color: accentHex(getTribeBySlug(c.slug)?.color ?? "") }}
                  >
                    {c.name}
                  </span>{" "}
                  — {higherSelf ? "you read this in yourself more" : "others read this in you more"}{" "}
                  than {higherSelf ? "others do" : "you do"}.
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          The spread of opinion, one observer at a time. Responses are anonymous
          — no names, no relationships, and the order carries no meaning.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {perObserver.map((profile, i) => {
            const top = rankScores(profile)
              .filter((t) => t.score > 0)
              .slice(0, 5);
            return (
              <li key={i}>
                <details className="group border-b border-hair pb-3">
                  <summary className="cursor-pointer list-none text-[15px] text-ink transition-colors hover:text-gold">
                    <span className="mr-2 text-faint group-open:text-gold">▸</span>
                    Observer {i + 1}
                  </summary>
                  <ul className="mt-4 flex flex-col gap-2.5 pl-6">
                    {top.map((t) => {
                      const accent = accentHex(getTribeBySlug(t.slug)?.color ?? "");
                      return (
                        <li
                          key={t.slug}
                          className="grid grid-cols-[108px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
                        >
                          <span className="font-serif text-[15px] leading-none">
                            {t.name}
                          </span>
                          <div className="h-2 overflow-hidden rounded-full bg-hair/50">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(t.relative * 100, 3)}%`,
                                backgroundColor: accent,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** A single labelled comparison bar on the shared 0–max scale. */
function Bar({
  label,
  pct,
  className,
}: {
  label: string;
  pct: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[46px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(pct)}% of the top score`}
      >
        <div
          className={`h-full rounded-full transition-[width] ${className}`}
          style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The locked state shown until at least `MIN_OBSERVERS` have responded. Gives a
 * clear "n of 3" progress read without revealing anything about the (too few)
 * responses gathered so far.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
        Your 360 is still gathering
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS} people have
        responded — enough for the &ldquo;others&rdquo; view to be meaningful and
        for every observer to stay anonymous.
      </p>

      <div className="mt-8 max-w-[420px]">
        <div className="flex items-baseline justify-between text-[13px] text-muted">
          <span>
            <strong className="text-ink">{observerCount}</strong> of{" "}
            {MIN_OBSERVERS} responses
          </span>
          <span className="text-faint">
            {remaining} more to unlock
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-hair/50">
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${(observerCount / MIN_OBSERVERS) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-12 border-t border-hair pt-8">
        <p className="text-[15px] text-muted">
          Haven&rsquo;t shared your link yet? You can copy it from your{" "}
          <Link
            href="/assessment/result"
            className="border-b border-gold pb-0.5 text-ink transition-colors hover:text-gold"
          >
            result page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
