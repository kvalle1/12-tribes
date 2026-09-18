"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The self-vs-others comparison report (issue #9, ADR-0003). It renders the
 * Subject's own profile alongside the equal-weight aggregated "others" profile,
 * calls out where the two align and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1 / 2 / 3 …).
 *
 * It is a client component so the drill-down can toggle without a round-trip,
 * but it receives only already-computed, normalized per-tribe scores — never the
 * word→tribe mapping or any observer identity. All scoring stays on the server
 * (ADR-0009); this view just draws numbers.
 */

export interface ComparisonTribe {
  slug: string;
  name: string;
  /** Per-tribe accent hex, resolved server-side. */
  accent: string;
  /** The Subject's own normalized 0–1 score. */
  self: number;
  /** The equal-weight aggregated "others" normalized 0–1 score. */
  others: number;
}

export interface ObserverBreakdown {
  /** Anonymous label, e.g. "Observer 2". Carries no identity. */
  label: string;
  /** This observer's normalized 0–1 score per tribe, canonical order. */
  scores: { slug: string; score: number }[];
}

/** How far self and others must diverge (normalized) to be worth calling out. */
const DIVERGENCE_THRESHOLD = 0.12;

export function ObserverComparisonReport({
  tribes,
  perObserver,
}: {
  tribes: ComparisonTribe[];
  perObserver: ObserverBreakdown[];
}) {
  const [showObservers, setShowObservers] = useState(false);

  // A shared bar scale across self, others, and every individual observer, so
  // all bars anywhere in the report are directly comparable.
  const scaleMax = useMemo(() => {
    const values = tribes.flatMap((t) => [t.self, t.others]);
    for (const observer of perObserver) {
      for (const s of observer.scores) values.push(s.score);
    }
    const max = Math.max(0, ...values);
    return max > 0 ? max : 1;
  }, [tribes, perObserver]);

  // Rank the report by how strongly *others* see each tribe — the 360 is about
  // their read of you. Canonical order breaks ties (input is already canonical).
  const ranked = useMemo(
    () => [...tribes].sort((a, b) => b.others - a.others),
    [tribes],
  );

  const othersSeeMore = useMemo(
    () =>
      [...tribes]
        .filter((t) => t.others - t.self >= DIVERGENCE_THRESHOLD)
        .sort((a, b) => b.others - b.self - (a.others - a.self)),
    [tribes],
  );
  const youSeeMore = useMemo(
    () =>
      [...tribes]
        .filter((t) => t.self - t.others >= DIVERGENCE_THRESHOLD)
        .sort((a, b) => b.self - b.others - (a.self - a.others)),
    [tribes],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.14em] text-faint">
        <LegendSwatch className="bg-ink" label="You" />
        <LegendSwatch className="bg-gold" label="Others" />
      </div>

      <ul className="mt-6 flex flex-col gap-4">
        {ranked.map((tribe) => (
          <li
            key={tribe.slug}
            className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
          >
            <span className="font-serif text-[17px] leading-tight">
              {tribe.name}
            </span>
            <div className="flex flex-col gap-1.5">
              <CompareBar
                value={tribe.self}
                scaleMax={scaleMax}
                color="var(--ink, #1c1b18)"
                label={`You see ${tribe.name}`}
              />
              <CompareBar
                value={tribe.others}
                scaleMax={scaleMax}
                color={tribe.accent}
                label={`Others see ${tribe.name}`}
              />
            </div>
          </li>
        ))}
      </ul>

      {(othersSeeMore.length > 0 || youSeeMore.length > 0) && (
        <section className="mt-12 grid gap-8 border-t border-hair pt-8 sm:grid-cols-2">
          <DivergenceColumn
            heading="Others see more than you claim"
            hint="Where the room reads a strength you underrate."
            tribes={othersSeeMore}
          />
          <DivergenceColumn
            heading="You see more than others do"
            hint="Where your self-read runs ahead of the room."
            tribes={youSeeMore}
          />
        </section>
      )}

      <section className="mt-12 border-t border-hair pt-8">
        <button
          type="button"
          onClick={() => setShowObservers((v) => !v)}
          aria-expanded={showObservers}
          className="text-[12px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-ink"
        >
          {showObservers ? "Hide" : "Show"} per-observer breakdown (
          {perObserver.length})
        </button>

        {showObservers && (
          <div className="mt-6 flex flex-col gap-8">
            <p className="max-w-[520px] text-[13px] text-muted">
              Each observer is fully anonymous — no name, no relationship. Their
              top reads are shown below in the order they responded.
            </p>
            {perObserver.map((observer) => (
              <ObserverColumn
                key={observer.label}
                observer={observer}
                tribes={tribes}
                scaleMax={scaleMax}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("inline-block h-2.5 w-6 rounded-full", className)} />
      {label}
    </span>
  );
}

function CompareBar({
  value,
  scaleMax,
  color,
  label,
}: {
  value: number;
  scaleMax: number;
  color: string;
  label: string;
}) {
  const relative = value / scaleMax;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)}%`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(relative * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function DivergenceColumn({
  heading,
  hint,
  tribes,
}: {
  heading: string;
  hint: string;
  tribes: ComparisonTribe[];
}) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
        {heading}
      </p>
      <p className="mt-1 text-[13px] text-muted">{hint}</p>
      {tribes.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">
          Nothing stands out here — your reads mostly agree.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {tribes.map((tribe) => (
            <li key={tribe.slug} className="flex items-center gap-2.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tribe.accent }}
                aria-hidden
              />
              <span className="font-serif text-[16px]">{tribe.name}</span>
              <span className="text-[13px] text-faint">
                {Math.round(tribe.others * 100)}% vs {Math.round(tribe.self * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ObserverColumn({
  observer,
  tribes,
  scaleMax,
}: {
  observer: ObserverBreakdown;
  tribes: ComparisonTribe[];
  scaleMax: number;
}) {
  const accentBySlug = new Map(tribes.map((t) => [t.slug, t.accent]));
  const nameBySlug = new Map(tribes.map((t) => [t.slug, t.name]));
  const top = [...observer.scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
        {observer.label}
      </p>
      {top.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">No clear signal.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {top.map((s) => (
            <li
              key={s.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[15px]">
                {nameBySlug.get(s.slug) ?? s.slug}
              </span>
              <CompareBar
                value={s.score}
                scaleMax={scaleMax}
                color={accentBySlug.get(s.slug) ?? "var(--gold, #a9842f)"}
                label={`${observer.label} sees ${nameBySlug.get(s.slug) ?? s.slug}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
