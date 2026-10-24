import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import { score } from "@/lib/assessment/score";
import {
  averageProfiles,
  scoreEachObserver,
  hasEnoughObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile aggregated from their anonymous
 * Observers, with an anonymous per-observer drill-down. It closes the 360 loop —
 * self vs. how others see you.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_TO_UNLOCK}
 * Observers have responded; before then it shows a clear locked state with
 * progress, so an early Subject understands what is still needed rather than
 * seeing a partial (and re-identifiable, with too few responses) read.
 *
 * Server component: it imports the scoring core and the aggregator, both
 * `server-only`, so the word→tribe mapping never reaches the client (ADR-0009).
 * Render it only from server components.
 */
export function ComparisonReport({
  selfWords,
  observerWordLists,
}: {
  selfWords: string[];
  observerWordLists: string[][];
}) {
  const observerCount = observerWordLists.length;

  if (!hasEnoughObservers(observerCount)) {
    return <LockedReport observerCount={observerCount} />;
  }

  const selfScores = score(selfWords);
  // Score each observer once, then average those vectors for the "others" read,
  // so no observer is scored twice.
  const perObserver = scoreEachObserver(observerWordLists);
  const otherScores = averageProfiles(perObserver);

  const otherBySlug = new Map(otherScores.map((s) => [s.slug, s.score]));

  // One row per tribe, carrying both reads. Built in canonical order, then
  // stable-sorted by combined prominence so the tribes either side cares about
  // rise to the top while ties keep canonical order.
  const rows = selfScores
    .map((s) => {
      const self = s.score;
      const others = otherBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self,
        others,
        accent: accentHex(getTribeBySlug(s.slug)?.color ?? ""),
        gap: others - self,
      };
    })
    .sort((a, b) => b.self + b.others - (a.self + a.others));

  // Scale every bar against the single largest read on the page so the chart
  // stays readable even when all normalized scores are small.
  const maxValue = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0.0001,
  );

  const selfPrimary = rankScores(selfScores)[0];
  const othersPrimary = rankScores(otherScores)[0];
  const agree = selfPrimary.slug === othersPrimary.slug;

  // The sharpest divergences (where others and you most disagree), either way.
  // Filter on the rounded point magnitude the UI actually shows, so a gap that
  // would display as "0 pts" is never surfaced as a divergence.
  const divergences = [...rows]
    .filter((r) => Math.round(Math.abs(r.gap) * 100) >= 1)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 2);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[520px] text-[15px] text-muted">
        {observerCount} {observerCount === 1 ? "person" : "people"} described you
        anonymously. Each one counts equally, however many words they chose, so
        no single voice can tilt the read.
      </p>

      {/* Headline: does the Subject's own Primary match the observers'? */}
      <section className="mt-10 rounded-[2px] border border-hair p-6">
        {agree ? (
          <>
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              You see eye to eye
            </p>
            <p className="mt-2 font-serif text-[22px] leading-snug">
              You and your observers both lead with{" "}
              <AccentName slug={selfPrimary.slug} />.
            </p>
          </>
        ) : (
          <>
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              A different read
            </p>
            <p className="mt-2 font-serif text-[22px] leading-snug">
              You lead with <AccentName slug={selfPrimary.slug} />, but your
              observers see <AccentName slug={othersPrimary.slug} /> most.
            </p>
          </>
        )}
        {divergences.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-[14px] text-muted">
            {divergences.map((d) => (
              <li key={d.slug}>
                {d.gap > 0 ? "Others see more " : "You see more "}
                <AccentName slug={d.slug} />{" "}
                <span className="text-faint">
                  ({Math.round(Math.abs(d.gap) * 100)} pts
                  {d.gap > 0 ? " stronger from them" : " stronger from you"})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Side-by-side bars: your read vs the aggregated others read, per tribe. */}
      <section className="mt-14 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-ink/40 bg-ink/25" />
              Others
            </span>
          </div>
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
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
                  value={row.self}
                  maxValue={maxValue}
                  accent={row.accent}
                  solid
                />
                <CompareBar
                  label="Others"
                  value={row.others}
                  maxValue={maxValue}
                  accent={row.accent}
                  solid={false}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — Observer 1/2/3, no attributes. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — no names, no
          relationships, just their top tribes.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {perObserver.map((scores, index) => {
            const top = rankScores(scores)
              .filter((t) => t.score > 0)
              .slice(0, 3);
            return (
              <li
                key={index}
                className="rounded-[2px] border border-hair p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  Observer {index + 1}
                </p>
                {top.length === 0 ? (
                  <p className="mt-3 text-[14px] text-muted">
                    No clear read.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {top.map((t) => {
                      const accent = accentHex(
                        getTribeBySlug(t.slug)?.color ?? "",
                      );
                      return (
                        <li
                          key={t.slug}
                          className="grid grid-cols-[88px_1fr] items-center gap-2.5"
                        >
                          <span className="font-serif text-[15px] leading-tight">
                            {t.name}
                          </span>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-hair/50"
                            role="img"
                            aria-label={`${t.name}: ${Math.round(t.relative * 100)}% of this observer's top tribe`}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(t.relative * 100, 4)}%`,
                                backgroundColor: accent,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
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

/** A tribe name rendered in its accent color. */
function AccentName({ slug }: { slug: string }) {
  const tribe = getTribeBySlug(slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <span style={{ color: accent }} className="font-medium">
      {tribe?.name ?? slug}
    </span>
  );
}

/**
 * One read of one tribe. The accent fill carries the tribe identity; a solid
 * fill is the Subject's own read and a lighter, outlined fill is the aggregated
 * others read, so the two are distinguishable without relying on color alone.
 */
function CompareBar({
  label,
  value,
  maxValue,
  accent,
  solid,
}: {
  label: string;
  value: number;
  maxValue: number;
  accent: string;
  solid: boolean;
}) {
  const relative = maxValue > 0 ? value / maxValue : 0;
  const width = value > 0 ? Math.max(relative * 100, 3) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[42px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(relative * 100)}% of the strongest read`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${width}%`,
            backgroundColor: solid ? accent : "transparent",
            border: solid ? undefined : `1.5px solid ${accent}`,
            opacity: solid ? 1 : 0.85,
          }}
        />
      </div>
    </div>
  );
}

/** The locked state shown until enough Observers have responded. */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS_TO_UNLOCK}{" "}
        people have described you. So far{" "}
        <span className="text-ink">
          {observerCount} {observerCount === 1 ? "person has" : "people have"}
        </span>{" "}
        responded — {remaining} more to go. Keeping it locked until then keeps
        each early response from standing out and staying anonymous.
      </p>

      <div className="mt-8 flex items-center gap-2.5" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < observerCount ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">
        {observerCount} of {MIN_OBSERVERS_TO_UNLOCK} responses
      </p>

      <div className="mt-12 border-t border-hair pt-8">
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
