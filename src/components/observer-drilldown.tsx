"use client";

import { useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/ranking";

/**
 * Anonymous per-observer drill-down for the 360 comparison report (issue #9).
 * Lets the Subject page through each Observer's individual read — "Observer 1",
 * "Observer 2", … — without any identifying attribute. Observers are numbered by
 * response order only (ADR-0003): no name, no relationship, nothing that could
 * deanonymize them, which is also why the report as a whole only unlocks at ≥3
 * responses.
 *
 * A client component (it holds the selected-observer state), fed already-ranked,
 * fully-serializable scores computed on the server — the word→tribe mapping and
 * the scoring core never reach the client (ADR-0009).
 */
export function ObserverDrilldown({
  observers,
}: {
  /** One ranked 12-tribe profile per Observer, in stable response order. */
  observers: RankedTribe[][];
}) {
  const [active, setActive] = useState(0);
  const current = observers[active] ?? [];

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Individual observer reads"
      >
        {observers.map((_, i) => {
          const selected = i === active;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={
                "rounded-[2px] border px-3.5 py-1.5 text-[12px] tracking-[0.06em] transition-colors " +
                (selected
                  ? "border-ink bg-ink text-bone"
                  : "border-hair text-muted hover:border-ink hover:text-ink")
              }
            >
              Observer {i + 1}
            </button>
          );
        })}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {current.map((row) => {
          const accent = accentHex(getTribeBySlug(row.slug)?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-none">
                {row.name}
              </span>
              <div
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top score`}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(row.relative * 100, row.score > 0 ? 3 : 0)}%`,
                    backgroundColor: accent,
                    opacity: 0.7,
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
