import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ObserverAggregate } from "@/lib/assessment/aggregate";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregated "others" profile, the tribes where the two
 * reads align or diverge most, and an anonymous per-observer drill-down.
 *
 * A server component — it renders from already-computed scores (the Self score
 * and the `aggregateObservers` result), so the word→tribe mapping and scoring
 * core never reach the client (ADR-0009). It never shows how many words anyone
 * picked or anything identifying an Observer; observers appear only as
 * "Observer 1/2/3…".
 */

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self: positive means others see it more strongly than you do. */
  delta: number;
}

/** How many tribes to surface in each divergence / alignment callout. */
const CALLOUT_COUNT = 3;
/** Deltas smaller than this count as agreement, not divergence. */
const ALIGNMENT_EPSILON = 0.06;

export function ComparisonReport({
  selfScores,
  aggregate,
}: {
  selfScores: TribeScore[];
  aggregate: ObserverAggregate;
}) {
  const othersBySlug = new Map(aggregate.scores.map((s) => [s.slug, s.score]));

  const rows: ComparisonRow[] = selfScores.map((s) => {
    const others = othersBySlug.get(s.slug) ?? 0;
    return { slug: s.slug, name: s.name, self: s.score, others, delta: others - s.score };
  });

  // Shared scale so the two bars are directly comparable across both reads.
  const max = Math.max(1e-9, ...rows.map((r) => Math.max(r.self, r.others)));

  // Rank by the stronger of the two reads so the most prominent tribes lead;
  // ties keep canonical (tribe `number`) order from `selfScores`.
  const ranked = [...rows].sort(
    (a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others),
  );

  const scored = rows.filter((r) => r.self > 0 || r.others > 0);
  const seesMore = [...scored]
    .filter((r) => r.delta > ALIGNMENT_EPSILON)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, CALLOUT_COUNT);
  const seesLess = [...scored]
    .filter((r) => r.delta < -ALIGNMENT_EPSILON)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, CALLOUT_COUNT);
  const aligned = [...scored]
    .filter((r) => Math.abs(r.delta) <= ALIGNMENT_EPSILON)
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others))
    .slice(0, CALLOUT_COUNT);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your own profile beside the combined read from{" "}
        {aggregate.observerCount} people who described you. Each observer counts
        equally, so no single voice — or a longer word list — outweighs the rest.
        The gap is where growth lives.
      </p>

      <Legend />

      {/* Self vs aggregated others, one paired row per tribe. */}
      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs. them, tribe by tribe
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {ranked.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">
                  {row.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <PairedBar
                    label="You"
                    value={row.self}
                    max={max}
                    accent={accent}
                    solid
                  />
                  <PairedBar
                    label="Them"
                    value={row.others}
                    max={max}
                    accent={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Divergence and alignment — where the two reads pull apart or agree. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where your read and theirs meet — and part
        </p>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <Callout
            title="They see more"
            hint="Strengths others read in you more than you claim yourself."
            rows={seesMore}
            direction="others"
          />
          <Callout
            title="You claim more"
            hint="Where your self-read runs ahead of how others see you."
            rows={seesLess}
            direction="self"
          />
          <Callout
            title="You agree"
            hint="Tribes where your read and theirs line up."
            rows={aligned}
            direction="agree"
          />
        </div>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          The top tribes in each individual read. Responses are anonymous — no
          names, no relationships, just the words each person chose.
        </p>
        <ul className="mt-6 flex flex-col gap-4">
          {aggregate.perObserver.map((observer, index) => (
            <ObserverCard key={index} index={index} scores={observer} />
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

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-6 text-[12px] text-muted">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
        Your read
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-6 rounded-full border border-ink/40 bg-ink/20" />
        How others read you
      </span>
    </div>
  );
}

function PairedBar({
  label,
  value,
  max,
  accent,
  solid = false,
}: {
  label: string;
  value: number;
  max: number;
  accent: string;
  solid?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${Math.round(pct)}% of the top score`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(pct, value > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function Callout({
  title,
  hint,
  rows,
  direction,
}: {
  title: string;
  hint: string;
  rows: ComparisonRow[];
  direction: "self" | "others" | "agree";
}) {
  return (
    <div>
      <h3 className="font-serif text-[18px] font-semibold">{title}</h3>
      <p className="mt-1 text-[13px] leading-snug text-muted">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] italic text-faint">Nothing notable.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            const gap = Math.round(Math.abs(row.delta) * 100);
            const note =
              direction === "agree" ? "aligned" : `${gap} pt gap`;
            return (
              <li key={row.slug} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px]">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  {row.name}
                </span>
                <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
                  {note}
                </span>
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
    <li className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </div>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] italic text-faint">No clear read.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {top.map((s) => {
            const accent = accentHex(getTribeBySlug(s.slug)?.color ?? "");
            return (
              <li
                key={s.slug}
                className="flex items-center gap-2 rounded-[2px] border border-hair px-3 py-1.5 text-[14px] text-ink"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                {s.name}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
