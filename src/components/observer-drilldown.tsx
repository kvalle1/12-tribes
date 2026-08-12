"use client";

import { useState } from "react";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";
import { cn } from "@/lib/utils";

/**
 * Anonymous per-observer drill-down (issue #9, ADR-0003). Each Observer is a
 * bare number — "Observer 1/2/3" — with no name, relationship, or any other
 * attribute, so the spread of opinion is visible without identifying anyone.
 * The scored profiles are computed server-side and passed in as plain numbers;
 * this component only ranks them for display (`rankScores` is client-safe) and
 * never touches the word→tribe mapping.
 */
export function ObserverDrilldown({
  perObserver,
}: {
  perObserver: TribeScore[][];
}) {
  const [active, setActive] = useState(0);
  if (perObserver.length === 0) return null;

  const ranked = rankScores(perObserver[active] ?? []);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Individual observers">
        {perObserver.map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={cn(
              "rounded-[2px] border px-[18px] py-[9px] text-[13px] tracking-[0.06em] transition-colors",
              index === active
                ? "border-ink bg-ink text-bone"
                : "border-hair text-muted hover:border-ink hover:text-ink",
            )}
          >
            Observer {index + 1}
          </button>
        ))}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {ranked.map((row) => {
          const tribe = getTribeBySlug(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          return (
            <li
              key={row.slug}
              className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
            >
              <span className="font-serif text-[16px] leading-none">{row.name}</span>
              <div
                className="h-2 overflow-hidden rounded-full bg-hair/50"
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
