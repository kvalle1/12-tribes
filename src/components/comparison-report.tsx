"use client";

import { useState } from "react";
import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Renders the
 * Subject's own Strength Profile beside the equal-weight aggregated "others"
 * profile, calls out where the two most align and diverge, and offers an
 * anonymous per-observer drill-down (Observer 1 / 2 / 3…).
 *
 * This is a client component so the drill-down can toggle without a round-trip,
 * but it only ever receives plain numbers: the scoring core and the word→tribe
 * mapping stay on the server (ADR-0009). The Observer breakdown carries nothing
 * but an anonymous label and per-tribe scores — never who responded.
 */

interface ScoredTribe {
  slug: string;
  name: string;
  /** Normalized 0–1 score. */
  score: number;
}

interface ObserverBreakdown {
  label: string;
  scores: ScoredTribe[];
}

interface Row {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self: positive = others read you higher on this tribe. */
  delta: number;
}

/** Sort tribes by the Subject's own score, high first; ties keep canonical order. */
function buildRows(self: ScoredTribe[], others: ScoredTribe[]): Row[] {
  const othersBySlug = new Map(others.map((s) => [s.slug, s.score]));
  return self
    .map((s) => {
      const o = othersBySlug.get(s.slug) ?? 0;
      return { slug: s.slug, name: s.name, self: s.score, others: o, delta: o - s.score };
    })
    .sort((a, b) => b.self - a.self);
}

function accentFor(slug: string): string {
  return accentHex(getTribeBySlug(slug)?.color ?? "");
}

export function ComparisonReport({
  self,
  others,
  observers,
}: {
  self: ScoredTribe[];
  others: ScoredTribe[];
  observers: ObserverBreakdown[];
}) {
  const [showObservers, setShowObservers] = useState(false);

  const rows = buildRows(self, others);
  // Scale both bars against the single largest value across either profile, so
  // "you" and "others" bars are directly comparable and the top bar fills.
  const max = Math.max(0, ...rows.map((r) => Math.max(r.self, r.others)));

  // Biggest divergences in each direction — where others read you higher / lower.
  const ranked = [...rows].sort((a, b) => b.delta - a.delta);
  const higher = ranked[0];
  const lower = ranked[ranked.length - 1];
  const showHigher = higher && higher.delta > 0.02;
  const showLower = lower && lower.delta < -0.02;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 reflection
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-3 max-w-[560px] text-[16px] text-muted">
        {observers.length} {observers.length === 1 ? "person" : "people"} shared an
        anonymous read. Below, your own profile sits beside the equal-weight
        average of theirs — each observer counts once, no matter how many words
        they picked. The gaps are where the most useful insight lives.
      </p>

      {/* Legend */}
      <div className="mt-8 flex items-center gap-6 text-[12px] uppercase tracking-[0.14em] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
          You
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded-full bg-gold" />
          Others
        </span>
      </div>

      {/* Divergence callouts */}
      {(showHigher || showLower) && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {showHigher && (
            <div className="rounded-[2px] border border-hair bg-white/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Others see more
              </div>
              <div className="mt-1 font-serif text-[20px]">{higher.name}</div>
              <p className="mt-1 text-[14px] text-muted">
                Others read this in you more strongly than you do — a blind spot
                worth a look.
              </p>
            </div>
          )}
          {showLower && (
            <div className="rounded-[2px] border border-hair bg-white/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                Others see less
              </div>
              <div className="mt-1 font-serif text-[20px]">{lower.name}</div>
              <p className="mt-1 text-[14px] text-muted">
                You claim this more than others perceive it — where your self-image
                runs ahead of your reputation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Side-by-side bars for all twelve tribes, ranked by your own profile. */}
      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs others, tribe by tribe
        </p>
        <ul className="mt-6 flex flex-col gap-5">
          {rows.map((row) => {
            const accent = accentFor(row.slug);
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span className="font-serif text-[17px] leading-tight">{row.name}</span>
                <div className="flex flex-col gap-1.5">
                  <PairBar
                    value={row.self}
                    max={max}
                    color="var(--color-ink, #1a1a1a)"
                    label={`You on ${row.name}`}
                  />
                  <PairBar
                    value={row.others}
                    max={max}
                    color={accent}
                    label={`Others on ${row.name}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Anonymous per-observer drill-down. */}
      <section className="mt-12 border-t border-hair pt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The individual reads
          </p>
          <button
            type="button"
            onClick={() => setShowObservers((v) => !v)}
            className="border-b border-gold pb-0.5 text-[13px] tracking-[0.06em] text-ink transition-colors hover:text-gold"
            aria-expanded={showObservers}
          >
            {showObservers ? "Hide" : "Show"} individual reads
          </button>
        </div>
        <p className="mt-2 max-w-[520px] text-[14px] text-muted">
          Each read is fully anonymous — numbered only, with no name or
          relationship — so you can see the spread of opinion without identifying
          anyone.
        </p>

        {showObservers && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {observers.map((observer) => (
              <ObserverCard key={observer.label} observer={observer} />
            ))}
          </div>
        )}
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

/** A single thin proportional bar, scaled against the shared maximum. */
function PairBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const fraction = max > 0 ? value / max : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={`${label}: ${Math.round(fraction * 100)}% of the top score`}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(fraction * 100, value > 0 ? 3 : 0)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/** One anonymous observer's top tribes, for the drill-down. */
function ObserverCard({ observer }: { observer: ObserverBreakdown }) {
  const top = [...observer.scores]
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0)
    .slice(0, 3);
  const max = top.length > 0 ? top[0].score : 0;

  return (
    <div className="rounded-[2px] border border-hair p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {observer.label}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {top.map((s) => {
          const accent = accentFor(s.slug);
          const fraction = max > 0 ? s.score / max : 0;
          return (
            <li key={s.slug} className="grid grid-cols-[88px_1fr] items-center gap-3">
              <span className="font-serif text-[15px] leading-tight">{s.name}</span>
              <div className="h-2 w-full overflow-hidden rounded-full bg-hair/50">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(fraction * 100, 4)}%`,
                    backgroundColor: accent,
                  }}
                />
              </div>
            </li>
          );
        })}
        {top.length === 0 && (
          <li className="text-[14px] text-muted">No words selected.</li>
        )}
      </ul>
    </div>
  );
}
