"use client";

import { useMemo, useState, useTransition } from "react";
import { shuffleWithSeed } from "@/lib/assessment/shuffle";
import { submitAssessment } from "./actions";

/**
 * The interactive word-selection step. Renders the flat, unlabeled list as
 * toggleable chips — no tribe labels are ever shown (PRD stories 4/6) — shuffled
 * by a server-supplied per-visit seed so the order differs each session without
 * biasing the choice (story 5), yet stays identical between the server and
 * client render (no hydration mismatch) and stable while selecting. A live
 * counter tracks progress and submission is gated to the [min, max] range
 * (stories 7/8).
 *
 * Only word strings reach the client; the word→tribe mapping and scoring stay on
 * the server.
 */
export function WordSelection({
  words,
  seed,
  min,
  max,
}: {
  words: readonly string[];
  seed: number;
  min: number;
  max: number;
}) {
  const ordered = useMemo(() => shuffleWithSeed(words, seed), [words, seed]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  const count = selected.size;
  const withinRange = count >= min && count <= max;

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  function handleSubmit() {
    if (!withinRange || isPending) return;
    startTransition(async () => {
      await submitAssessment([...selected]);
    });
  }

  const guidance =
    count < min
      ? `Pick at least ${min}`
      : count > max
        ? `That's too many — keep it to ${max}`
        : "Ready when you are";

  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-2.5">
        {ordered.map((word) => {
          const isSelected = selected.has(word);
          return (
            <button
              key={word}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(word)}
              className={
                isSelected
                  ? "rounded-[2px] border border-ink bg-ink px-3.5 py-2 text-[15px] text-bone transition-colors"
                  : "rounded-[2px] border border-hair bg-white px-3.5 py-2 text-[15px] text-ink transition-colors hover:border-gold"
              }
            >
              {word}
            </button>
          );
        })}
      </div>

      {/* Selection footer: live count + submission gate. */}
      <div className="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hair bg-bone py-5">
        <div className="text-[14px] text-muted">
          <span className="font-serif text-[20px] text-ink tabular-nums">
            {count}
          </span>{" "}
          selected ·{" "}
          <span className={withinRange ? "text-gold" : "text-faint"}>
            {guidance}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!withinRange || isPending}
          className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Revealing…" : "Reveal my tribe"}
        </button>
      </div>
    </div>
  );
}
