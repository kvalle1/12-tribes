"use client";

import { useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report (issue #9): the Subject's own Self Assessment
 * profile shown alongside the equal-weight aggregated "others" profile, with the
 * tribes where the two views align or diverge called out, plus an anonymous
 * per-observer drill-down (Observer 1/2/3).
 *
 * Purely presentational and client-safe: it receives already-computed
 * `TribeScore` data (plain `{ slug, name, score }`) from the server page, which
 * owns all scoring behind the `server-only` trust boundary (ADR-0009). The
 * `TribeScore` import is type-only, so nothing server-only reaches the client
 * bundle — the same pattern `ranking.ts` uses.
 *
 * The report is only rendered once the unlock threshold is met, so `observers`
 * always holds at least that many anonymous profiles; the drill-down labels them
 * "Observer 1…N" purely by their stable oldest-first order and exposes no
 * attribute that could identify anyone (ADR-0003).
 */

/** A tribe's score gap counts as a divergence worth calling out beyond this. */
const DIVERGENCE_THRESHOLD = 0.15;

const scoreBySlug = (profile: TribeScore[]) =>
  new Map(profile.map((t) => [t.slug, t.score]));

/** The largest value across the given profiles, so bars share one honest scale. */
const sharedMax = (...profiles: TribeScore[][]) =>
  Math.max(0, ...profiles.flatMap((p) => p.map((t) => t.score)));

export function ComparisonReport({
  self,
  others,
  observers,
}: {
  self: TribeScore[];
  others: TribeScore[];
  observers: TribeScore[][];
}) {
  // The Subject's own ranking is the reference order; `self` is already in
  // canonical order, so a stable sort keeps ties canonical (matching rankScores).
  const order = [...self].sort((a, b) => b.score - a.score).map((t) => t.slug);
  const othersBySlug = scoreBySlug(others);
  const compareMax = sharedMax(self, others);

  const divergences = self
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      gap: (othersBySlug.get(t.slug) ?? 0) - t.score,
    }))
    .filter((d) => Math.abs(d.gap) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return (
    <div>
      {/* Legend for the two series compared throughout. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />
          How you see yourself
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
          How {observers.length} others see you
        </span>
      </div>

      {/* Self vs others, tribe by tribe, in the Subject's own ranking order. */}
      <ul className="mt-8 flex flex-col gap-5">
        {order.map((slug) => {
          const selfScore = self.find((t) => t.slug === slug)?.score ?? 0;
          const otherScore = othersBySlug.get(slug) ?? 0;
          const tribe = getTribeBySlug(slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li key={slug} className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
              <span
                className="font-serif text-[17px] leading-none"
                style={{ color: accent }}
              >
                {tribe?.name ?? slug}
              </span>
              <div className="flex flex-col gap-1.5">
                <CompareBar
                  label={`You: ${pct(selfScore, compareMax)}`}
                  fraction={compareMax > 0 ? selfScore / compareMax : 0}
                  color="var(--ink, #1c1917)"
                  ariaLabel={`You rate ${tribe?.name ?? slug} at ${pct(selfScore, compareMax)} of your top score`}
                />
                <CompareBar
                  label={`Others: ${pct(otherScore, compareMax)}`}
                  fraction={compareMax > 0 ? otherScore / compareMax : 0}
                  color={accent}
                  ariaLabel={`Others rate ${tribe?.name ?? slug} at ${pct(otherScore, compareMax)} of the top score`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Where self and others agree vs diverge — the gap is where growth lives. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Where you and others {divergences.length > 0 ? "diverge" : "align"}
        </p>
        {divergences.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-2.5">
            {divergences.map((d) => (
              <li key={d.slug} className="text-[15px] text-muted">
                <span className="font-serif text-ink">{d.name}</span>{" "}
                {d.gap > 0
                  ? "reads stronger to others than to you"
                  : "reads stronger to you than to others"}
                <span className="text-faint">
                  {" "}
                  ({d.gap > 0 ? "+" : "−"}
                  {Math.round(Math.abs(d.gap) * 100)} pts)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 max-w-[520px] text-[15px] text-muted">
            Your read and the others&rsquo; read line up closely — no tribe
            diverges by much. How you see yourself matches how you come across.
          </p>
        )}
      </section>

      <ObserverDrilldown observers={observers} order={order} />
    </div>
  );
}

/** A single horizontal comparison bar with an inline value label. */
function CompareBar({
  label,
  fraction,
  color,
  ariaLabel,
}: {
  label: string;
  fraction: number;
  color: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(fraction * 100, fraction > 0 ? 3 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-[104px] shrink-0 text-right text-[11px] tracking-[0.04em] text-faint">
        {label}
      </span>
    </div>
  );
}

/**
 * Anonymous per-observer drill-down. Each observer is a stable, unlabeled
 * "Observer N" (oldest-first) carrying no attribute that could identify them
 * (ADR-0003); selecting one shows that single observer's normalized profile in
 * the Subject's ranking order, so the spread of opinion is visible without
 * anyone being named.
 */
function ObserverDrilldown({
  observers,
  order,
}: {
  observers: TribeScore[][];
  order: string[];
}) {
  const [selected, setSelected] = useState(0);
  const profile = observers[selected] ?? [];
  const max = sharedMax(profile);
  const bySlug = scoreBySlug(profile);

  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Each read, anonymously
      </p>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        The individual reads behind the aggregate. Each is fully anonymous — no
        name, no relationship, nothing tying it to a person.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {observers.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelected(i)}
            aria-pressed={i === selected}
            className={
              i === selected
                ? "rounded-[2px] bg-ink px-4 py-2 text-[12px] tracking-[0.06em] text-bone"
                : "rounded-[2px] border border-hair px-4 py-2 text-[12px] tracking-[0.06em] text-muted transition-colors hover:border-ink hover:text-ink"
            }
          >
            Observer {i + 1}
          </button>
        ))}
      </div>

      <ul className="mt-6 flex flex-col gap-2.5">
        {order.map((slug) => {
          const s = bySlug.get(slug) ?? 0;
          const tribe = getTribeBySlug(slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li key={slug} className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
              <span className="font-serif text-[15px] leading-none">
                {tribe?.name ?? slug}
              </span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`Observer ${selected + 1} rates ${tribe?.name ?? slug} at ${pct(s, max)} of their top score`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((max > 0 ? s / max : 0) * 100, s > 0 ? 3 : 0)}%`,
                    backgroundColor: accent,
                    opacity: 0.75,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A score as a whole-number percentage of the shared scale max. */
function pct(score: number, max: number): string {
  return `${Math.round((max > 0 ? score / max : 0) * 100)}%`;
}
