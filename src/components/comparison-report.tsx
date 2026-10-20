import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile aggregated from their Observers, with
 * the tribes where the two reads align or diverge called out, plus an anonymous
 * per-observer drill-down.
 *
 * It recomputes everything from raw word selections via the pure scoring core
 * (`score` / `aggregateObservers`), so the report can never drift from what was
 * saved. Like `ResultView` it is a **server component** — the scoring core is
 * `server-only` (the word→tribe mapping never reaches the client, ADR-0009), so
 * render these only from server components.
 *
 * The report is gated: until at least `MIN_OBSERVERS` have responded the
 * `ComparisonReport` renders a locked state and never computes or reveals the
 * aggregate, so a thin (and potentially de-anonymizing) early read stays hidden.
 */
export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: string[][];
}) {
  const count = observerResponses.length;

  if (!hasEnoughObservers(count)) {
    return <ComparisonLocked count={count} />;
  }

  const self = score(selfWords);
  const others = aggregateObservers(observerResponses);

  // One row per tribe, in canonical order, carrying both reads and their gap.
  // `top` scales every bar against the single largest value across both
  // profiles, so the two columns share a visual scale and are comparable.
  const rows = self.map((selfScore) => {
    const otherScore =
      others.find((o) => o.slug === selfScore.slug)?.score ?? 0;
    return {
      slug: selfScore.slug,
      name: selfScore.name,
      self: selfScore.score,
      others: otherScore,
      gap: selfScore.score - otherScore,
    };
  });
  const top = Math.max(...rows.flatMap((r) => [r.self, r.others]), 0);

  // Alignment: where self and others land closest. Divergence: the largest gaps,
  // split by direction (you rate a tribe higher than others do, or lower). Only
  // tribes with real signal on at least one side are worth calling out.
  const withSignal = rows.filter((r) => r.self > 0 || r.others > 0);
  const byGap = [...withSignal].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  );
  const seesHigher = byGap.filter((r) => r.gap < 0).slice(0, 3); // others > self
  const seesLower = byGap.filter((r) => r.gap > 0).slice(0, 3); // self > others
  const aligned = [...withSignal]
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs the {count} who answered
      </p>
      <h2 className="mt-2 font-serif text-[28px] font-semibold leading-snug">
        How your read compares
      </h2>
      <p className="mt-2 max-w-[560px] text-[15px] text-muted">
        Your own selection on the left of each tribe, the equal-weight average of
        your {count} observers on the right. Every observer counts the same, no
        matter how many words they picked.
      </p>

      {/* Side-by-side bars, all twelve tribes, canonical order. */}
      <section className="mt-10 border-t border-hair pt-8">
        <div className="mb-5 flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-faint">
          <LegendSwatch className="bg-ink" label="You" />
          <LegendSwatch className="bg-gold" label="Others" />
        </div>
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-none">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <CompareBar
                    label={`${row.name}, your read`}
                    value={row.self}
                    top={top}
                    tone="self"
                  />
                  <CompareBar
                    label={`${row.name}, others' read`}
                    value={row.others}
                    top={top}
                    tone="others"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Alignment & divergence callouts, derived from the same gaps. */}
      <section className="mt-12 grid grid-cols-1 gap-8 border-t border-hair pt-8 sm:grid-cols-3">
        <Callout
          title="Where you agree"
          empty="No clear agreement yet."
          tribes={aligned.map((r) => r.name)}
        />
        <Callout
          title="Others see more"
          empty="Nothing others rate notably higher."
          tribes={seesHigher.map((r) => r.name)}
        />
        <Callout
          title="You see more"
          empty="Nothing you rate notably higher."
          tribes={seesLower.map((r) => r.name)}
        />
      </section>

      <ObserverDrilldown observerResponses={observerResponses} />

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </Link>
      </div>
    </div>
  );
}

/**
 * The anonymous per-observer drill-down: each Observer's own top tribes, labelled
 * only "Observer 1/2/3…" in the stable order they responded. No name, no
 * relationship, no attributes — nothing that could identify who answered.
 */
function ObserverDrilldown({
  observerResponses,
}: {
  observerResponses: string[][];
}) {
  return (
    <section className="mt-12 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Observer by observer
      </p>
      <p className="mt-2 max-w-[560px] text-[15px] text-muted">
        Each respondent&rsquo;s own top tribes. Fully anonymous — shown only in
        the order they answered.
      </p>
      <ol className="mt-6 flex flex-col gap-4">
        {observerResponses.map((words, index) => {
          const ranked = score(words)
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          return (
            <li
              key={index}
              className="rounded-[2px] border border-hair p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Observer {index + 1}
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {ranked.length === 0 ? (
                  <li className="text-[14px] text-muted">
                    No tribe signal in this response.
                  </li>
                ) : (
                  ranked.map((tribe) => {
                    const accent = accentHex(
                      getTribeBySlug(tribe.slug)?.color ?? "",
                    );
                    return (
                      <li
                        key={tribe.slug}
                        className="rounded-[2px] border px-3 py-1 text-[14px]"
                        style={{
                          borderColor: `${accent}66`,
                          color: accent,
                        }}
                      >
                        {tribe.name}
                      </li>
                    );
                  })
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The locked state shown before `MIN_OBSERVERS` have responded. It shows the
 * running count toward the threshold and deliberately reveals nothing about the
 * responses collected so far.
 */
export function ComparisonLocked({ count }: { count: number }) {
  const remaining = Math.max(MIN_OBSERVERS - count, 0);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison
      </p>
      <h2 className="mt-2 font-serif text-[28px] font-semibold leading-snug">
        Locked until {MIN_OBSERVERS} people respond
      </h2>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        {count === 0
          ? "No one has answered yet."
          : `${count} of ${MIN_OBSERVERS} ${count === 1 ? "person has" : "people have"} answered.`}{" "}
        {remaining > 0 &&
          `Share your link with ${remaining} more ${remaining === 1 ? "person" : "people"} to unlock how others see you.`}
      </p>

      <div
        className="mt-6 flex gap-2"
        role="img"
        aria-label={`${count} of ${MIN_OBSERVERS} responses collected`}
      >
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-16 rounded-full ${i < count ? "bg-gold" : "bg-hair/60"}`}
          />
        ))}
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result &amp; share link
        </Link>
      </div>
    </div>
  );
}

function CompareBar({
  label,
  value,
  top,
  tone,
}: {
  label: string;
  value: number;
  top: number;
  tone: "self" | "others";
}) {
  // Scale against the largest value across both profiles so the two series
  // share one visual scale. Fixed hues (ink = you, gold = others) keep the two
  // reads instantly distinguishable and match the legend.
  const fill = top > 0 ? value / top : 0;
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)}%`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${tone === "self" ? "bg-ink" : "bg-gold"}`}
        style={{ width: `${Math.max(fill * 100, value > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-2.5 w-5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function Callout({
  title,
  tribes,
  empty,
}: {
  title: string;
  tribes: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {title}
      </p>
      {tribes.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {tribes.map((name) => (
            <li key={name} className="font-serif text-[17px] text-ink">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
