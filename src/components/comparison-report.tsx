"use client";

import { useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003).
 *
 * It renders entirely from pre-computed, plain `TribeScore[]` data passed in by
 * the server page — it never imports the scoring core (`server-only`, ADR-0009),
 * so the word→tribe mapping stays off the client. `self` and the equal-weight
 * `others` average are on the same normalized 0–1 scale, so the two bars are
 * directly comparable (that comparability is the whole point of normalizing).
 *
 * `perObserver` carries each Observer's own scores for the anonymous drill-down;
 * it holds scores only — no name, timestamp, or relationship — so Observers stay
 * anonymous (Observer 1/2/3…).
 */

/** A tribe's gap counts as a divergence when it exceeds this share of the scale. */
const DIVERGENCE_THRESHOLD = 0.2;

export function ComparisonReport({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  const othersBySlug = new Map(others.map((t) => [t.slug, t.score]));

  // Order by the Subject's own ranking — their self-view is the reference frame.
  const rows = [...self]
    .sort((a, b) => b.score - a.score)
    .map((selfTribe) => ({
      slug: selfTribe.slug,
      name: selfTribe.name,
      self: selfTribe.score,
      others: othersBySlug.get(selfTribe.slug) ?? 0,
    }));

  // Shared scale across both profiles so self and others bars are comparable.
  const scaleMax = Math.max(
    ...rows.map((r) => Math.max(r.self, r.others)),
    0,
  );

  const diverging = rows.filter(
    (r) => scaleMax > 0 && Math.abs(r.self - r.others) / scaleMax >= DIVERGENCE_THRESHOLD,
  );

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] text-muted">
        Your own read sits beside the equal-weight average of everyone who
        answered — each responder counts the same, however many words they
        picked. The gaps are where the most useful insight lives.
      </p>

      <Legend />

      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs. others, tribe by tribe
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            const gap =
              scaleMax > 0 ? Math.abs(row.self - row.others) / scaleMax : 0;
            const isDivergent = gap >= DIVERGENCE_THRESHOLD;
            return (
              <li key={row.slug}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[17px]">{row.name}</span>
                  {isDivergent && (
                    <span className="text-[10px] uppercase tracking-[0.14em] text-gold">
                      {row.others > row.self
                        ? "Others see more"
                        : "You see more"}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <CompareBar
                    label="You"
                    score={row.self}
                    scaleMax={scaleMax}
                    accent={accent}
                    solid
                  />
                  <CompareBar
                    label="Others"
                    score={row.others}
                    scaleMax={scaleMax}
                    accent={accent}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <DivergenceSummary diverging={diverging} />

      <ObserverDrilldown perObserver={perObserver} />
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-5 text-[12px] text-muted">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-7 rounded-full bg-ink" />
        You
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-7 rounded-full bg-ink/35" />
        Others (average)
      </span>
    </div>
  );
}

function CompareBar({
  label,
  score,
  scaleMax,
  accent,
  solid = false,
}: {
  label: string;
  score: number;
  scaleMax: number;
  accent: string;
  solid?: boolean;
}) {
  const relative = scaleMax > 0 ? score / scaleMax : 0;
  const pct = Math.round(score * 100);
  return (
    <div className="grid grid-cols-[58px_1fr] items-center gap-3 max-[520px]:grid-cols-[48px_1fr]">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}% strength`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(relative * 100, score > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: solid ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function DivergenceSummary({
  diverging,
}: {
  diverging: { slug: string; name: string; self: number; others: number }[];
}) {
  return (
    <section className="mt-12 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Where you and others diverge most
      </p>
      {diverging.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">
          Your self-view and the group&rsquo;s read line up closely across every
          tribe — no standout gaps.
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2.5">
          {diverging.map((row) => (
            <li
              key={row.slug}
              className="rounded-[2px] border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[14px] text-ink"
            >
              {row.name}
              <span className="ml-2 text-[12px] text-muted">
                {row.others > row.self ? "others ↑" : "you ↑"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ObserverDrilldown({ perObserver }: { perObserver: TribeScore[][] }) {
  const [selected, setSelected] = useState(0);
  if (perObserver.length === 0) return null;

  const active = perObserver[selected] ?? perObserver[0];
  const ranked = [...active].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;

  return (
    <section className="mt-12 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Per-observer drill-down
      </p>
      <p className="mt-2 max-w-[520px] text-[15px] text-muted">
        Each responder, counted individually and kept anonymous — no names, no
        labels, just the spread of opinion.
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Observers">
        {perObserver.map((_, i) => {
          const isActive = i === selected;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelected(i)}
              className={`rounded-[2px] border px-3.5 py-1.5 text-[13px] tracking-[0.04em] transition-colors ${
                isActive
                  ? "border-ink bg-ink text-bone"
                  : "border-hair text-muted hover:border-ink hover:text-ink"
              }`}
            >
              Observer {i + 1}
            </button>
          );
        })}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {ranked.map((tribe) => {
          const accent = accentHex(getTribeBySlug(tribe.slug)?.color ?? "");
          const relative = max > 0 ? tribe.score / max : 0;
          return (
            <li
              key={tribe.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-none">
                {tribe.name}
              </span>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`${tribe.name}: ${Math.round(relative * 100)}% of this observer's top score`}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(relative * 100, tribe.score > 0 ? 3 : 0)}%`,
                    backgroundColor: accent,
                    opacity: 0.8,
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
