import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { score, deriveResult, type TribeScore } from "@/lib/assessment/score";
import type { ObserversProfile } from "@/lib/assessment/aggregateObservers";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Shows the
 * Subject's own normalized profile alongside the equal-weight aggregated
 * "others" profile, surfaces where the two most diverge, and offers an
 * anonymous per-observer drill-down.
 *
 * A server component: it imports the `server-only` scoring core to recompute the
 * Subject's scores from their saved `words`, so the word→tribe mapping never
 * reaches the client (ADR-0009). The caller is responsible for the ≥3-observer
 * unlock gate; this view assumes the report is unlocked.
 *
 * Both profiles are drawn on the same 0–1 normalized scale so the bars are
 * directly comparable — alignment and divergence read off the chart honestly.
 */

/**
 * Minimum gap between the self and others scores for a tribe to count as a
 * meaningful divergence — below this the two views are treated as agreeing, so
 * the chart doesn't flag noise.
 */
const DIVERGENCE_THRESHOLD = 0.08;

const bySlug = (scores: readonly TribeScore[]) =>
  new Map(scores.map((s) => [s.slug, s.score]));

interface Row {
  slug: string;
  name: string;
  self: number;
  others: number;
  gap: number;
}

export function ComparisonReport({
  words,
  profile,
}: {
  words: string[];
  profile: ObserversProfile;
}) {
  const selfScores = score(words);
  const selfResult = deriveResult(selfScores);
  const othersResult = deriveResult(profile.scores);

  const selfBy = bySlug(selfScores);
  const othersBy = bySlug(profile.scores);

  const rows: Row[] = selfScores
    .map((s) => {
      const self = selfBy.get(s.slug) ?? 0;
      const others = othersBy.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self, others, gap: Math.abs(self - others) };
    })
    // Strongest signal (either view) first, so the tribes that matter rise to
    // the top; ties keep canonical order.
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));

  // The tribes where the two views diverge most — the useful insight lives here.
  const divergences = [...rows]
    .filter((r) => r.gap > DIVERGENCE_THRESHOLD)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        You &amp; the people who know you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Based on{" "}
        <strong className="font-semibold text-ink">
          {profile.observerCount}
        </strong>{" "}
        anonymous {profile.observerCount === 1 ? "response" : "responses"}. Each
        observer counts equally, no matter how many words they picked.
      </p>

      {/* Headline: your primary vs the aggregated others' primary. */}
      <section className="mt-12 grid grid-cols-2 gap-5 max-[480px]:grid-cols-1">
        <HeadlineCard label="You see yourself as" result={selfResult} />
        <HeadlineCard label="Others see you as" result={othersResult} />
      </section>

      {/* Side-by-side ranking across all twelve tribes. */}
      <section className="mt-16 border-t border-hair pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve compare
          </p>
          <Legend />
        </div>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li key={row.slug} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[17px] leading-none">
                    {row.name}
                  </span>
                  {row.gap > DIVERGENCE_THRESHOLD && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      {row.self > row.others ? "You rate higher" : "Others rate higher"}
                    </span>
                  )}
                </div>
                <CompareBar label="You" value={row.self} accent={accent} solid />
                <CompareBar label="Others" value={row.others} accent={accent} />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Where the two views diverge most. */}
      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you &amp; others diverge
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((row) => (
              <li key={row.slug} className="text-[15px] text-muted">
                <strong className="font-semibold text-ink">{row.name}</strong>{" "}
                —{" "}
                {row.self > row.others
                  ? "you lean into this more than others see in you"
                  : "others see this in you more than you claim it"}{" "}
                <span className="text-faint">
                  ({Math.round(row.self * 100)}% vs {Math.round(row.others * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Each observer, anonymously
        </p>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          How each person read you, in the order they responded. No names, no
          relationships — just the spread of opinion.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
          {profile.perObserver.map((observer, index) => (
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

function HeadlineCard({
  label,
  result,
}: {
  label: string;
  result: ReturnType<typeof deriveResult>;
}) {
  const tribe = getTribeBySlug(result.primary.slug);
  const accent = accentHex(tribe?.color ?? "");
  return (
    <div className="rounded-[3px] border border-hair bg-white/40 px-6 py-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </p>
      <p
        className="mt-2 font-serif text-[30px] font-semibold leading-none"
        style={{ color: accent }}
      >
        {result.primary.name}
      </p>
      {tribe && (
        <p className="mt-2 text-[12px] uppercase tracking-[0.12em] text-faint">
          {tribe.essence}
        </p>
      )}
    </div>
  );
}

function CompareBar({
  label,
  value,
  accent,
  solid = false,
}: {
  label: string;
  value: number;
  accent: string;
  solid?: boolean;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[52px_1fr_38px] items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(value * 100, value > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.45,
          }}
        />
      </div>
      <span className="text-right text-[11px] tabular-nums text-muted">
        {pct}%
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.12em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink" /> You
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink/40" /> Others
      </span>
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
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);

  return (
    <li className="rounded-[3px] border border-hair bg-white/40 px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-faint">
        Observer {index + 1}
      </p>
      {top.length === 0 ? (
        <p className="mt-2 text-[14px] text-faint">No clear read</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {top.map((s) => {
            const tribe = getTribeBySlug(s.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={s.slug}
                className="flex items-baseline justify-between text-[14px]"
              >
                <span style={{ color: accent }}>{s.name}</span>
                <span className="text-[11px] tabular-nums text-faint">
                  {Math.round(s.score * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
