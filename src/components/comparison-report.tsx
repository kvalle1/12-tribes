import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  scoreEachObserver,
} from "@/lib/observer/aggregate";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). It lines the
 * Subject's own normalized profile up against the equal-weight-averaged "others"
 * profile tribe-for-tribe, calls out where the two reads align and where they
 * diverge, and offers a fully anonymous per-observer drill-down (Observer 1 /
 * 2 / 3 …, no names, no attributes).
 *
 * A server component: it imports the `server-only` scoring core and aggregation,
 * so the word→tribe mapping never reaches the client (ADR-0009). Render it only
 * from server components. The caller is responsible for the unlock gate (≥3
 * observers) — this component assumes it is being shown an unlocked report and
 * renders whatever responses it is handed.
 */

/** How many tribes of divergence to surface in each alignment/divergence list. */
const HIGHLIGHT_COUNT = 2;
/** Gaps smaller than this (in normalized score) count as "in agreement". */
const ALIGNMENT_EPSILON = 0.04;

interface CompareRow {
  slug: string;
  name: string;
  /** The Subject's own normalized score for this tribe. */
  self: number;
  /** The equal-weight "others" normalized score for this tribe. */
  others: number;
  /** others − self: positive means others see more of this tribe than you do. */
  gap: number;
}

export function ComparisonReport({
  selfWords,
  observerResponses,
}: {
  selfWords: string[];
  observerResponses: { words: string[] }[];
}) {
  const selfScores = score(selfWords);
  const othersScores = aggregateObservers(observerResponses);
  const perObserver = scoreEachObserver(observerResponses);

  const othersBySlug = new Map(othersScores.map((s) => [s.slug, s.score]));
  const rows: CompareRow[] = selfScores.map((s) => {
    const others = othersBySlug.get(s.slug) ?? 0;
    return { slug: s.slug, name: s.name, self: s.score, others, gap: others - s.score };
  });

  // Scale every bar against the single largest score across both profiles so
  // "you" and "others" bars are directly comparable to the eye.
  const maxScore = Math.max(
    0,
    ...rows.map((r) => Math.max(r.self, r.others)),
  );

  // Order the full table by the stronger of the two reads, so the tribes that
  // matter in either view rise to the top; ties keep canonical order.
  const ordered = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  // Divergence: the tribes where the two reads differ most, split by direction.
  const othersSeeMore = [...rows]
    .filter((r) => r.gap > ALIGNMENT_EPSILON)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, HIGHLIGHT_COUNT);
  const youSeeMore = [...rows]
    .filter((r) => r.gap < -ALIGNMENT_EPSILON)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, HIGHLIGHT_COUNT);

  // Alignment: tribes with real signal (either read non-trivial) where the two
  // reads nearly agree — the "we see you the same way" tribes.
  const alignment = [...rows]
    .filter(
      (r) =>
        Math.abs(r.gap) <= ALIGNMENT_EPSILON &&
        Math.max(r.self, r.others) > 0,
    )
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others))
    .slice(0, HIGHLIGHT_COUNT);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Based on {observerResponses.length} anonymous{" "}
        {observerResponses.length === 1 ? "response" : "responses"}. The
        &ldquo;others&rdquo; read gives every observer an equal voice — picking
        more words never buys more influence.
      </p>

      {/* Alignment / divergence callouts — the gap is where growth lives. */}
      <section className="mt-12 grid gap-5 sm:grid-cols-2">
        <Callout
          label="Where you align"
          empty="No clear agreement yet."
          items={alignment.map((r) => ({
            slug: r.slug,
            name: r.name,
            note: "seen the same way",
          }))}
        />
        <Callout
          label="Where you diverge"
          empty="You and your observers largely agree."
          items={[
            ...othersSeeMore.map((r) => ({
              slug: r.slug,
              name: r.name,
              note: "others see more",
            })),
            ...youSeeMore.map((r) => ({
              slug: r.slug,
              name: r.name,
              note: "you see more",
            })),
          ]}
        />
      </section>

      {/* The full tribe-for-tribe comparison. */}
      <section className="mt-16 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Tribe by tribe
          </p>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.12em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              Others
            </span>
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {ordered.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li key={row.slug} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px]">{row.name}</span>
                  <GapTag gap={row.gap} />
                </div>
                <CompareBar
                  label="You"
                  score={row.self}
                  max={maxScore}
                  color="var(--ink, #1a1a1a)"
                  emphasize
                />
                <CompareBar
                  label="Others"
                  score={row.others}
                  max={maxScore}
                  color={accent}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each observer&rsquo;s own read, fully anonymous — no names, no order
          that maps to anyone.
        </p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {perObserver.map((observerScores, i) => {
            const top = [...observerScores]
              .sort((a, b) => b.score - a.score)
              .filter((s) => s.score > 0)
              .slice(0, 3);
            return (
              <li
                key={i}
                className="rounded-[2px] border border-hair bg-white/40 px-4 py-3"
              >
                <details>
                  <summary className="flex cursor-pointer items-center justify-between text-[14px] text-ink">
                    <span className="font-serif text-[16px]">
                      Observer {i + 1}
                    </span>
                    <span className="text-[13px] text-muted">
                      {top[0] ? `reads you as ${top[0].name}` : "no clear read"}
                    </span>
                  </summary>
                  {top.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {top.map((s) => {
                        const accent = accentHex(
                          getTribeBySlug(s.slug)?.color ?? "",
                        );
                        return (
                          <li
                            key={s.slug}
                            className="rounded-[2px] border px-3 py-1 text-[13px]"
                            style={{
                              borderColor: `${accent}66`,
                              color: "var(--ink, #1a1a1a)",
                            }}
                          >
                            {s.name}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** A single comparison bar, scaled against the shared max across both reads. */
function CompareBar({
  label,
  score,
  max,
  color,
  emphasize = false,
}: {
  label: string;
  score: number;
  max: number;
  color: string;
  emphasize?: boolean;
}) {
  const fraction = max > 0 ? score / max : 0;
  const pct = Math.round(score * 100);
  return (
    <div className="grid grid-cols-[56px_1fr] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}% strength for this tribe`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(fraction * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: color,
            opacity: emphasize ? 1 : 0.7,
          }}
        />
      </div>
    </div>
  );
}

/** A small tag describing the direction and size of the self↔others gap. */
function GapTag({ gap }: { gap: number }) {
  if (Math.abs(gap) <= ALIGNMENT_EPSILON) {
    return (
      <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
        in agreement
      </span>
    );
  }
  const othersMore = gap > 0;
  return (
    <span
      className="text-[10px] uppercase tracking-[0.14em]"
      style={{ color: othersMore ? "var(--gold, #a67c00)" : "var(--muted, #6b6b6b)" }}
    >
      {othersMore ? "others see more" : "you see more"}
    </span>
  );
}

/** A labelled list of highlighted tribes for the alignment/divergence callouts. */
function Callout({
  label,
  items,
  empty,
}: {
  label: string;
  items: { slug: string; name: string; note: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-[2px] border border-hair p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((item) => {
            const accent = accentHex(getTribeBySlug(item.slug)?.color ?? "");
            return (
              <li key={`${item.slug}-${item.note}`} className="flex items-center gap-2.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span className="font-serif text-[16px] text-ink">
                  {item.name}
                </span>
                <span className="text-[12px] text-muted">— {item.note}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
