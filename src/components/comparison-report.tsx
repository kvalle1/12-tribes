import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import {
  score,
  deriveResult,
  type TribeScore,
  type DerivedResult,
} from "@/lib/assessment/score";
import {
  aggregateObservers,
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";

/**
 * How far self and others must part (on the shared 0–1 axis) before the "widest
 * gap" callout is worth making. Below this the two reads are effectively the
 * same and declaring a "gap" would be noise.
 */
const MEANINGFUL_GAP = 0.05;

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile aggregated from their anonymous
 * Observers, with an anonymous per-observer drill-down.
 *
 * It renders from raw selections — the Subject's `words` and each Observer's
 * words — and does the scoring here via the `server-only` core (same pattern as
 * `ResultView`), so the word→tribe mapping never reaches the client (ADR-0009).
 * Render only from a server component.
 *
 * The report is gated: until at least `MIN_OBSERVERS` Observers have responded
 * it shows a locked state instead of the profiles, which keeps the average
 * meaningful and preserves each Observer's anonymity within the aggregate.
 */
export function ComparisonReport({
  selfWords,
  responses,
}: {
  selfWords: string[];
  responses: string[][];
}) {
  const agg = aggregateObservers(responses);

  if (!agg.unlocked) {
    return <LockedState observerCount={agg.observerCount} />;
  }

  const selfScores = score(selfWords);
  const bySlug = (table: TribeScore[], slug: string) =>
    table.find((s) => s.slug === slug)?.score ?? 0;

  // Both profiles share one axis so the bars are directly comparable. The axis
  // top is the single largest score across self and others, so whichever view
  // has the strongest tribe fills the bar and everything else is drawn relative
  // to it (the result view uses the same relative-to-top idea).
  const axisMax = Math.max(
    ...selfScores.map((s) => s.score),
    ...agg.others.map((s) => s.score),
    0,
  );

  // One comparison row per tribe, carrying the self/others scores and the gap
  // between them. Lead with how *others* see the Subject — that is the new
  // information the 360 adds — then fall back to canonical order on ties.
  const rows = agg.others
    .map((other) => {
      const self = bySlug(selfScores, other.slug);
      return {
        slug: other.slug,
        name: other.name,
        self,
        others: other.score,
        gap: other.score - self,
      };
    })
    .filter((row) => row.self > 0 || row.others > 0)
    .sort((a, b) => b.others - a.others);

  // Alignment lives where self and others agree; growth lives in the gap.
  // Restrict alignment to tribes *both* sides actually read (self and others
  // non-zero), so the card never celebrates agreement on a tribe nobody picked,
  // and only call out a divergence once the gap is more than noise. Ties resolve
  // by canonical order (stable sort over canonically-ordered rows).
  const sharedRows = rows.filter((row) => row.self > 0 && row.others > 0);
  const alignment =
    sharedRows.length > 0
      ? [...sharedRows].sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0]
      : undefined;
  const widest = [...rows].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  )[0];
  const divergence =
    widest && Math.abs(widest.gap) >= MEANINGFUL_GAP ? widest : undefined;

  const contrastCards = [
    alignment && alignment.slug !== divergence?.slug
      ? { tone: "align" as const, label: "Closest agreement", row: alignment }
      : null,
    divergence
      ? { tone: "diverge" as const, label: "Widest gap", row: divergence }
      : null,
  ].filter((card) => card !== null);

  // Order the drill-down by *content* — the tribe each observer saw most — not
  // by when they answered, so the "Observer n" labels carry no timing signal a
  // Subject could trace back to a specific person. Deterministic and stable.
  const observerReads = agg.perObserver
    .map((scores) => deriveResult(scores))
    .sort((a, b) => {
      const an = getTribeBySlug(a.primary.slug)?.number ?? 0;
      const bn = getTribeBySlug(b.primary.slug)?.number ?? 0;
      if (an !== bn) return an - bn;
      return b.primary.score - a.primary.score;
    });

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read · {agg.observerCount}{" "}
        {agg.observerCount === 1 ? "voice" : "voices"}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own read sits beside the equal-weight average of everyone who
        answered — each voice counts the same, no matter how many words they
        chose. Where the two lines agree is shared ground; where they part is
        where growth tends to live.
      </p>

      {/* Legend for the two series. */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ backgroundColor: "var(--ink)" }}
            aria-hidden
          />
          You
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ backgroundColor: "var(--gold)" }}
            aria-hidden
          />
          Others
        </span>
      </div>

      {contrastCards.length > 0 && (
        <div
          className={`mt-8 grid gap-4 ${
            contrastCards.length > 1 ? "sm:grid-cols-2" : ""
          }`}
        >
          {contrastCards.map((card) => (
            <ContrastCard
              key={card.tone}
              label={card.label}
              row={card.row}
              tone={card.tone}
            />
          ))}
        </div>
      )}

      {/* Self vs others, tribe by tribe, on a shared axis. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs. others, tribe by tribe
        </p>
        <ul className="mt-7 flex flex-col gap-6">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <Link
                href={`/tribes/${row.slug}`}
                className="font-serif text-[17px] leading-tight text-ink transition-colors hover:text-gold"
              >
                {row.name}
              </Link>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={`${row.name}, your read`}
                  fraction={axisMax > 0 ? row.self / axisMax : 0}
                  color="var(--ink)"
                  active={row.self > 0}
                />
                <CompareBar
                  label={`${row.name}, how others read you`}
                  fraction={axisMax > 0 ? row.others / axisMax : 0}
                  color="var(--gold)"
                  active={row.others > 0}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each voice, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Every response is fully anonymous — no names, no labels, nothing that
          ties a read back to a person. Here is the tribe each one saw most in
          you.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {observerReads.map((result, i) => (
            <ObserverRow key={i} index={i + 1} result={result} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A single self-or-others bar on the shared axis. */
function CompareBar({
  label,
  fraction,
  color,
  active,
}: {
  label: string;
  fraction: number;
  color: string;
  active: boolean;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fraction * 100)}% of the strongest read`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, active ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/** An alignment / divergence highlight card. */
function ContrastCard({
  label,
  row,
  tone,
}: {
  label: string;
  row: { slug: string; name: string; gap: number };
  tone: "align" | "diverge";
}) {
  const tribe = getTribeBySlug(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  const sentence =
    tone === "align"
      ? "You and your observers read this about the same."
      : row.gap > 0
        ? "Others see more of this in you than you do."
        : "You claim more of this than others see in you.";

  return (
    <div
      className="rounded-[2px] border border-hair p-5"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </div>
      <div
        className="mt-2 font-serif text-[22px] font-semibold"
        style={{ color: accent }}
      >
        {row.name}
      </div>
      <p className="mt-1.5 text-[14px] text-muted">{sentence}</p>
    </div>
  );
}

/** One anonymous observer's headline read (Observer n → their primary tribe). */
function ObserverRow({
  index,
  result,
}: {
  index: number;
  result: DerivedResult;
}) {
  const { primary, secondary } = result;
  const primaryTribe = getTribeBySlug(primary.slug);
  const secondaryTribe = secondary ? getTribeBySlug(secondary.slug) : undefined;

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hair/60 pb-3">
      <span className="text-[12px] uppercase tracking-[0.14em] text-faint">
        Observer {index}
      </span>
      <span className="text-[14px] text-muted">saw you most as</span>
      <span
        className="font-serif text-[18px]"
        style={{ color: accentHex(primaryTribe?.color ?? "") }}
      >
        {primary.name}
      </span>
      {secondaryTribe && (
        <span className="text-[14px] text-muted">
          with a note of{" "}
          <span
            className="font-serif text-[16px]"
            style={{ color: accentHex(secondaryTribe.color) }}
          >
            {secondaryTribe.name}
          </span>
        </span>
      )}
    </li>
  );
}

/** Shown until at least MIN_OBSERVERS observers have responded. */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read · locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        A few more voices
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS} people have
        answered — enough for the average to mean something and for every
        response to stay anonymous.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor:
                  i < observerCount ? "var(--gold)" : "var(--hair)",
              }}
            />
          ))}
        </div>
        <span className="text-[14px] text-muted">
          {observerCount} of {MIN_OBSERVERS} so far
          {remaining > 0 && (
            <>
              {" "}
              · {remaining} more to go
            </>
          )}
        </span>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <p className="max-w-[520px] text-[15px] text-muted">
          Share your observer link with a few more people who know you well.
          Their reads stay private until the report opens.
        </p>
        <Link
          href="/assessment/result"
          className="mt-5 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
