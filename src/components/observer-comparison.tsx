"use client";

import { useState } from "react";
import Link from "next/link";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 comparison report view (issue #9): the Subject's own Strength Profile
 * alongside the equal-weight "others" profile, with an anonymous per-observer
 * drill-down.
 *
 * Both series arrive already scored on the server as plain slug/name/score rows
 * (the word→tribe mapping never crosses to the client, ADR-0009). They share the
 * one normalized 0–1 scale from the scoring core, so a bar's width is directly
 * the tribe's percentage and self/others are read on the same axis. Tribes are
 * ordered by how salient they are across the two profiles, so the strongest
 * signal — and the sharpest divergence — surfaces first.
 *
 * The drill-down switches the "others" series between the equal-weight average
 * and a single Observer, who is only ever "Observer 1/2/3" — no name, no
 * relationship, nothing that could identify them (ADR-0003).
 */

/** Divergence at or above this (in score points, 0–1) reads as "diverge". */
const DIVERGENCE_THRESHOLD = 0.08;

export function ObserverComparison({
  self,
  others,
  perObserver,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
}) {
  // null = the equal-weight average across all Observers; a number selects one
  // Observer's own profile for the "others" column.
  const [selected, setSelected] = useState<number | null>(null);

  const othersSeries = selected === null ? others : perObserver[selected];
  const othersLabel =
    selected === null ? "Others" : `Observer ${selected + 1}`;

  const rows = buildRows(self, othersSeries);
  const divergences = rows
    .filter((r) => Math.abs(r.delta) >= DIVERGENCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        You, and how others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your own profile sits beside the equal-weight average of{" "}
        {perObserver.length} anonymous {noun(perObserver.length, "read", "reads")}
        . Each read counts the same, however many words that person picked. The
        gap between the two is where the most useful insight lives.
      </p>

      {/* Anonymous per-observer drill-down. */}
      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Whose read to show">
        <DrillChip
          active={selected === null}
          onClick={() => setSelected(null)}
        >
          All observers
        </DrillChip>
        {perObserver.map((_, i) => (
          <DrillChip
            key={i}
            active={selected === i}
            onClick={() => setSelected(i)}
          >
            Observer {i + 1}
          </DrillChip>
        ))}
      </div>

      {/* Alignment / divergence summary. */}
      <section className="mt-8 rounded-[2px] border border-hair bg-white/60 p-5">
        {divergences.length === 0 ? (
          <p className="text-[15px] text-muted">
            {othersLabel === "Others" ? "Your observers" : othersLabel} and you
            are closely aligned — no tribe diverges by much.
          </p>
        ) : (
          <>
            <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
              Where you and {othersLabel === "Others" ? "others" : othersLabel}{" "}
              diverge most
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {divergences.slice(0, 3).map((r) => (
                <li key={r.slug} className="text-[15px] text-ink">
                  <span className="font-serif" style={{ color: accentFor(r.slug) }}>
                    {r.name}
                  </span>{" "}
                  <span className="text-muted">
                    {r.delta > 0
                      ? `— seen more by ${lower(othersLabel)} (+${points(r.delta)})`
                      : `— seen more by you (+${points(-r.delta)})`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Side-by-side bars, ranked by salience across both profiles. */}
      <ul className="mt-10 flex flex-col gap-5">
        {rows.map((row) => {
          const accent = accentFor(row.slug);
          const diverges = Math.abs(row.delta) >= DIVERGENCE_THRESHOLD;
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[128px_1fr] items-center gap-4 max-[520px]:grid-cols-[96px_1fr]"
            >
              <span
                className="font-serif text-[17px] leading-tight"
                style={{ color: accent }}
              >
                {row.name}
              </span>
              <div className="flex flex-col gap-2">
                <ProfileBar
                  label="You"
                  score={row.self}
                  accent={accent}
                  emphatic
                />
                <ProfileBar
                  label={othersLabel}
                  score={row.others}
                  accent={accent}
                  emphatic={false}
                />
                {diverges && (
                  <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
                    {row.delta > 0
                      ? `${lower(othersLabel)} +${points(row.delta)}`
                      : `you +${points(-row.delta)}`}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

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

interface ComparisonRow {
  slug: string;
  name: string;
  self: number;
  others: number;
  /** others − self, in normalized score points (0–1). */
  delta: number;
}

/**
 * Pair each tribe's self score with its others score (matched by slug so the
 * two series need not be in the same order) and rank by the stronger of the two,
 * so the most salient tribes — and the widest gaps — read first.
 */
function buildRows(
  self: TribeScore[],
  others: TribeScore[],
): ComparisonRow[] {
  const othersBySlug = new Map(others.map((o) => [o.slug, o.score]));
  return self
    .map((s) => {
      const othersScore = othersBySlug.get(s.slug) ?? 0;
      return {
        slug: s.slug,
        name: s.name,
        self: s.score,
        others: othersScore,
        delta: othersScore - s.score,
      };
    })
    .sort((a, b) => Math.max(b.self, b.others) - Math.max(a.self, a.others));
}

function ProfileBar({
  label,
  score,
  accent,
  emphatic,
}: {
  label: string;
  score: number;
  accent: string;
  emphatic: boolean;
}) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-[74px] shrink-0 text-[10px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(pct, score > 0 ? 3 : 0)}%`,
            backgroundColor: accent,
            opacity: emphatic ? 1 : 0.5,
          }}
        />
      </div>
      <span className="w-[38px] shrink-0 text-right text-[11px] tabular-nums text-muted">
        {pct}%
      </span>
    </div>
  );
}

function DrillChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 text-[12px] tracking-[0.06em] transition-colors ${
        active
          ? "border-ink bg-ink text-bone"
          : "border-hair bg-white text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function accentFor(slug: string): string {
  return accentHex(getTribeBySlug(slug)?.color ?? "");
}

/** Render a normalized score delta as whole percentage points. */
function points(delta: number): number {
  return Math.round(delta * 100);
}

function lower(label: string): string {
  return label.toLowerCase();
}

function noun(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
