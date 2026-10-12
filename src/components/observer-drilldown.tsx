"use client";

import { useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";

/**
 * Anonymous per-observer drill-down for the 360 comparison report (issue #9).
 * Each Observer is labelled only "Observer 1 / 2 / 3 …" in response order — no
 * name, no relationship, nothing identifying (ADR-0003). It receives only
 * already-computed, client-safe scores (no word→tribe mapping crosses the
 * trust boundary), and lets the Subject flip between observers to see each
 * individual read behind the equal-weight average.
 */

export interface DrilldownObserver {
  /** Anonymous label, e.g. "Observer 1". */
  label: string;
  /** This observer's tribes, highest-first, with a 0–1 bar-fill fraction. */
  ranked: { slug: string; name: string; relative: number }[];
}

export function ObserverDrilldown({
  observers,
}: {
  observers: DrilldownObserver[];
}) {
  const [active, setActive] = useState(0);
  const current = observers[active];
  if (!current) return null;

  return (
    <div>
      <div
        role="group"
        aria-label="Individual observers"
        className="flex flex-wrap gap-2"
      >
        {observers.map((observer, i) => {
          const selected = i === active;
          return (
            <button
              key={observer.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(i)}
              className={
                "rounded-[2px] border px-3.5 py-1.5 text-[12px] tracking-[0.06em] transition-colors " +
                (selected
                  ? "border-ink bg-ink text-bone"
                  : "border-hair text-muted hover:border-ink hover:text-ink")
              }
            >
              {observer.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-6 flex flex-col gap-3" aria-live="polite">
        {current.ranked.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-none">
                {row.name}
              </span>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top read`}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(row.relative * 100, row.relative > 0 ? 3 : 0)}%`,
                    backgroundColor: accent,
                    opacity: 0.8,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
