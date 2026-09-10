"use client";

import { useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The 360 self-vs-others comparison view (issue #9, ADR-0003). Renders the
 * Subject's own profile beside the equal-weight aggregate of how Observers see
 * them, calls out where the two most agree and diverge, and offers an anonymous
 * per-observer drill-down (Observer 1..N — no identity, ever).
 *
 * It is purely presentational: it receives already-scored, client-safe
 * `TribeScore[]` data computed on the server (the word→tribe mapping and scoring
 * core never reach the client, ADR-0009) and does no scoring itself.
 */

const DIVERGENCE_NOTE_THRESHOLD = 0.08;

export function ComparisonReport({
  self,
  others,
  perObserver,
  observerCount,
}: {
  self: TribeScore[];
  others: TribeScore[];
  perObserver: TribeScore[][];
  observerCount: number;
}) {
  const [drillIndex, setDrillIndex] = useState<number | null>(null);

  // One shared scale across both profiles so You and Others bars are directly
  // comparable rather than each normalized to its own max.
  const scaleMax = Math.max(
    ...self.map((s) => s.score),
    ...others.map((s) => s.score),
    // Guard against an all-zero self profile (shouldn't happen — the Subject
    // took the assessment — but keeps the bars from dividing by zero).
    0.0001,
  );

  // Order tribes by their strongest showing in either view, so the tribes that
  // matter to either the Subject or the room rise to the top.
  const othersBySlug = new Map(others.map((o) => [o.slug, o]));
  const ordered = [...self]
    .map((s) => ({ self: s, others: othersBySlug.get(s.slug)! }))
    .sort(
      (a, b) =>
        Math.max(b.self.score, b.others.score) -
        Math.max(a.self.score, a.others.score),
    );

  // Biggest gaps between how the Subject and the room scored each tribe.
  const divergences = ordered
    .map((row) => ({
      slug: row.self.slug,
      name: row.self.name,
      delta: row.others.score - row.self.score,
    }))
    .filter((d) => Math.abs(d.delta) >= DIVERGENCE_NOTE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return (
    <div>
      <section>
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          You vs the room
        </p>
        <h2 className="mt-2 font-serif text-[26px] font-semibold leading-snug">
          How your read compares
        </h2>
        <p className="mt-2 max-w-[540px] text-[15px] text-muted">
          Your own profile beside the equal-weight average of{" "}
          {observerCount} anonymous {observerCount === 1 ? "read" : "reads"}. Each
          observer counts once, however many words they picked.
        </p>

        <ul className="mt-8 flex flex-col gap-5">
          {ordered.map((row) => (
            <ComparisonRow
              key={row.self.slug}
              slug={row.self.slug}
              name={row.self.name}
              selfScore={row.self.score}
              othersScore={row.others.score}
              scaleMax={scaleMax}
            />
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-5 text-[12px] text-muted">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-6 rounded-full bg-ink" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-6 rounded-full bg-ink/30" />
            Others (average)
          </span>
        </div>
      </section>

      {divergences.length > 0 && (
        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Where you and the room differ most
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {divergences.map((d) => (
              <li key={d.slug} className="text-[15px] text-ink">
                <span
                  className="font-serif text-[17px]"
                  style={{
                    color: accentHex(getTribeBySlug(d.slug)?.color ?? ""),
                  }}
                >
                  {d.name}
                </span>{" "}
                <span className="text-muted">
                  {d.delta > 0
                    ? "reads stronger to others than to you"
                    : "reads stronger to you than to others"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Observer by observer
        </p>
        <p className="mt-2 max-w-[540px] text-[15px] text-muted">
          Each response, fully anonymous. There is no way to tell who is who —
          only the spread of how the room reads you.
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {perObserver.map((_, i) => {
            const active = drillIndex === i;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={active}
                onClick={() => setDrillIndex(active ? null : i)}
                className={
                  "rounded-[2px] border px-4 py-2 text-[13px] tracking-[0.06em] transition-colors " +
                  (active
                    ? "border-ink bg-ink text-bone"
                    : "border-hair text-ink hover:border-ink")
                }
              >
                Observer {i + 1}
              </button>
            );
          })}
        </div>

        {drillIndex !== null && (
          <ObserverDrilldown profile={perObserver[drillIndex]} index={drillIndex} />
        )}
      </section>
    </div>
  );
}

/** One tribe row with paired You / Others bars on a shared scale. */
function ComparisonRow({
  slug,
  name,
  selfScore,
  othersScore,
  scaleMax,
}: {
  slug: string;
  name: string;
  selfScore: number;
  othersScore: number;
  scaleMax: number;
}) {
  const accent = accentHex(getTribeBySlug(slug)?.color ?? "");
  const selfPct = (selfScore / scaleMax) * 100;
  const othersPct = (othersScore / scaleMax) * 100;

  return (
    <li className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]">
      <span className="font-serif text-[17px] leading-none" style={{ color: accent }}>
        {name}
      </span>
      <div className="flex flex-col gap-1.5">
        <Bar
          pct={selfPct}
          color={accent}
          opacity={1}
          label={`${name} — you: ${Math.round(selfScore * 100)}%`}
        />
        <Bar
          pct={othersPct}
          color={accent}
          opacity={0.4}
          label={`${name} — others average: ${Math.round(othersScore * 100)}%`}
        />
      </div>
    </li>
  );
}

function Bar({
  pct,
  color,
  opacity,
  label,
}: {
  pct: number;
  color: string;
  opacity: number;
  label: string;
}) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.max(pct, pct > 0 ? 3 : 0)}%`,
          backgroundColor: color,
          opacity,
        }}
      />
    </div>
  );
}

/** A single anonymous observer's profile, top tribes first. */
function ObserverDrilldown({
  profile,
  index,
}: {
  profile: TribeScore[];
  index: number;
}) {
  const ranked = [...profile].sort((a, b) => b.score - a.score);
  const max = ranked.length > 0 ? ranked[0].score : 0;
  const top = ranked.filter((t) => t.score > 0).slice(0, 6);

  return (
    <div className="mt-6 rounded-[2px] border border-hair p-6">
      <p className="text-[12px] uppercase tracking-[0.14em] text-faint">
        Observer {index + 1} · anonymous
      </p>
      {top.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">No tribes scored.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {top.map((row) => {
            const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <span
                  className="font-serif text-[16px] leading-none"
                  style={{ color: accent }}
                >
                  {row.name}
                </span>
                <Bar
                  pct={max > 0 ? (row.score / max) * 100 : 0}
                  color={accent}
                  opacity={0.85}
                  label={`Observer ${index + 1} — ${row.name}: ${Math.round(row.score * 100)}%`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
