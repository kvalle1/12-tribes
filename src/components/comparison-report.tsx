import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, type TribeScore } from "@/lib/assessment/score";
import { MIN_OBSERVERS, type ObserverAggregate } from "@/lib/observer/aggregate";

/**
 * The self-vs-others comparison report that closes the 360 loop (issue #9,
 * ADR-0003). It lines the Subject's own tribe profile up against the equal-weight
 * average of their anonymous Observers, highlights where the two views agree and
 * diverge ("the gap is where growth lives"), and offers an anonymous per-observer
 * drill-down.
 *
 * The report is gated: until at least three Observers have responded it renders a
 * locked state showing only the running count — no observer data is revealed
 * early, which both keeps the average meaningful and protects individual
 * anonymity when only one or two people have answered.
 *
 * Server component: it recomputes the Subject's twelve-tribe profile from their
 * saved `words` via the `server-only` scoring core, so the word→tribe mapping
 * never reaches the client (ADR-0009).
 */
export function ComparisonReport({
  selfWords,
  aggregate,
}: {
  selfWords: string[];
  aggregate: ObserverAggregate;
}) {
  if (!aggregate.unlocked) {
    return <LockedReport observerCount={aggregate.observerCount} />;
  }

  const selfScores = score(selfWords);
  const rows = buildRows(selfScores, aggregate.average);
  const highlights = buildHighlights(rows);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        You, and how {aggregate.observerCount} others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Each column pairs your own read with the equal-weight average of{" "}
        {aggregate.observerCount} anonymous responses — every observer counts the
        same, no matter how many words they chose. The gap between the two is
        where the most is worth noticing.
      </p>

      {highlights.length > 0 && (
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {highlights.map((h) => (
            <Highlight key={h.kind} highlight={h} />
          ))}
        </section>
      )}

      {/* Side-by-side bars: your read vs the others' average, all twelve tribes. */}
      <section className="mt-16 border-t border-hair pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            You vs. others
          </p>
          <p className="flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-ink/35"
                aria-hidden
              />
              Others
            </span>
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => (
            <ComparisonRow key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down — Observer 1/2/3, scores only. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[560px] text-[14px] text-muted">
          Each response on its own, fully anonymous — the strongest tribes each
          observer saw in you.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {aggregate.perObserver.map((observer, i) => (
            <ObserverCard key={i} index={i} scores={observer} />
          ))}
        </div>
      </section>

      <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
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

/** The locked state: shown until at least three observers have responded. */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS} people have
        responded. Until then the responses stay sealed — that keeps the average
        meaningful and keeps every observer anonymous.
      </p>

      <div className="mt-10 rounded-[3px] border border-hair bg-white p-7">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Responses so far
        </p>
        <p className="mt-2 font-serif text-[40px] font-semibold leading-none">
          {observerCount}{" "}
          <span className="text-[22px] font-normal text-muted">
            of {MIN_OBSERVERS}
          </span>
        </p>
        <div
          className="mt-5 flex gap-2"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS} observers have responded`}
        >
          {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < observerCount ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your report opens."
            : `${remaining} more responses and your report opens.`}
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

interface ComparisonRowData {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** Bar-fill fraction for the Subject's own read, relative to the top score. */
  selfRelative: number;
  /** Bar-fill fraction for the others' average, relative to the top score. */
  othersRelative: number;
}

function ComparisonRow({ row }: { row: ComparisonRowData }) {
  const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-tight">{row.name}</span>
      <div className="flex flex-col gap-1.5">
        <Bar
          label={`${row.name}, your read`}
          relative={row.selfRelative}
          score={row.self}
          accent={accent}
          opacity={1}
        />
        <Bar
          label={`${row.name}, others' average`}
          relative={row.othersRelative}
          score={row.others}
          accent={accent}
          opacity={0.4}
        />
      </div>
    </li>
  );
}

function Bar({
  label,
  relative,
  score,
  accent,
  opacity,
}: {
  label: string;
  relative: number;
  score: number;
  accent: string;
  opacity: number;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(relative * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
          backgroundColor: accent,
          opacity,
        }}
      />
    </div>
  );
}

type HighlightKind = "agreement" | "others-more" | "you-more";

interface HighlightData {
  kind: HighlightKind;
  label: string;
  tribeName: string;
  blurb: string;
}

function Highlight({ highlight }: { highlight: HighlightData }) {
  return (
    <div className="rounded-[3px] border border-hair bg-white p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {highlight.label}
      </p>
      <p className="mt-2 font-serif text-[22px] font-semibold leading-tight">
        {highlight.tribeName}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-muted">
        {highlight.blurb}
      </p>
    </div>
  );
}

/** An anonymous observer's card: their top few tribes, scores only, no identity. */
function ObserverCard({
  index,
  scores,
}: {
  index: number;
  scores: TribeScore[];
}) {
  const top = [...scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 0;

  return (
    <div className="rounded-[3px] border border-hair bg-white p-5">
      <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </p>
      {top.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">No tribes registered.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {top.map((s) => {
            const accent = accentHex(getTribeBySlug(s.slug)?.color ?? "");
            return (
              <li key={s.slug} className="flex items-center gap-3">
                <span className="w-[92px] shrink-0 font-serif text-[15px]">
                  {s.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((max > 0 ? s.score / max : 0) * 100, 4)}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Build the twelve comparison rows, ordered so any tribe prominent in either
 * view floats to the top (by the greater of the two scores, canonical order
 * breaking ties). Bar fractions are relative to the single highest score across
 * both reads, so the two bars in a row — and every row — share one scale.
 */
function buildRows(
  selfScores: TribeScore[],
  othersScores: TribeScore[],
): ComparisonRowData[] {
  const othersBySlug = new Map(othersScores.map((s) => [s.slug, s.score]));

  const merged = selfScores.map((s) => ({
    slug: s.slug,
    name: s.name,
    self: s.score,
    others: othersBySlug.get(s.slug) ?? 0,
  }));

  const max = Math.max(0, ...merged.map((r) => Math.max(r.self, r.others)));

  return merged
    .map((r) => ({
      ...r,
      selfRelative: max > 0 ? r.self / max : 0,
      othersRelative: max > 0 ? r.others / max : 0,
    }))
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
}

/**
 * Distil the rows into up to three plain-language highlights: the strongest
 * shared tribe, the widest "others see more in you than you do" gap, and the
 * widest "you see more than others do" gap. Gaps below a small threshold are
 * dropped so the report never manufactures a divergence out of noise.
 */
const DIVERGENCE_THRESHOLD = 0.08;

function buildHighlights(rows: ComparisonRowData[]): HighlightData[] {
  const highlights: HighlightData[] = [];

  const agreement = [...rows]
    .map((r) => ({ r, strength: Math.min(r.self, r.others) }))
    .sort((a, b) => b.strength - a.strength)[0];
  if (agreement && agreement.strength > 0) {
    highlights.push({
      kind: "agreement",
      label: "Seen by both",
      tribeName: agreement.r.name,
      blurb: "You and the people around you land here alike.",
    });
  }

  const othersMore = [...rows]
    .map((r) => ({ r, gap: r.others - r.self }))
    .sort((a, b) => b.gap - a.gap)[0];
  if (othersMore && othersMore.gap >= DIVERGENCE_THRESHOLD) {
    highlights.push({
      kind: "others-more",
      label: "Others see more",
      tribeName: othersMore.r.name,
      blurb: "Stronger in their read of you than in your own.",
    });
  }

  const youMore = [...rows]
    .map((r) => ({ r, gap: r.self - r.others }))
    .sort((a, b) => b.gap - a.gap)[0];
  if (youMore && youMore.gap >= DIVERGENCE_THRESHOLD) {
    highlights.push({
      kind: "you-more",
      label: "You see more",
      tribeName: youMore.r.name,
      blurb: "You claim this more than the people around you do.",
    });
  }

  return highlights;
}
