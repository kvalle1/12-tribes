"use client";

import { useState } from "react";
import { submitAssessment } from "./actions";

/**
 * The word-selection UI. Receives the words already shuffled by the server (so
 * the order differs each session) and, deliberately, *only* the word strings —
 * the word→tribe mapping stays server-side and is never shown.
 *
 * Selection state lives on the client purely to drive the live counter and the
 * submit gate; the authoritative scoring happens server-side in
 * `submitAssessment`, which re-validates the 8–15 range.
 */
export function WordSelection({
  words,
  min,
  max,
}: {
  words: string[];
  min: number;
  max: number;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const count = selected.size;
  const submittable = count >= min && count <= max;

  function toggle(word: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  let hint: string;
  if (count < min) {
    const remaining = min - count;
    hint = `Pick ${remaining} more word${remaining === 1 ? "" : "s"}`;
  } else if (count > max) {
    const over = count - max;
    hint = `Remove ${over} word${over === 1 ? "" : "s"}`;
  } else {
    hint = "Ready when you are";
  }

  return (
    <form action={submitAssessment}>
      {/* The selected words travel to the server action as repeated fields. */}
      {[...selected].map((word) => (
        <input key={word} type="hidden" name="words" value={word} />
      ))}

      <div className="mt-8 flex flex-wrap gap-2.5">
        {words.map((word) => {
          const isSelected = selected.has(word);
          return (
            <button
              type="button"
              key={word}
              onClick={() => toggle(word)}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "rounded-[2px] border border-gold bg-gold/10 px-3.5 py-2 text-[15px] text-ink transition-colors"
                  : "rounded-[2px] border border-hair bg-white px-3.5 py-2 text-[15px] text-muted transition-colors hover:border-gold/60 hover:text-ink"
              }
            >
              {word}
            </button>
          );
        })}
      </div>

      {/* Sticky counter + submit so the progress is always visible while scrolling. */}
      <div className="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hair bg-bone/95 py-5 backdrop-blur">
        <div className="text-[15px] text-muted">
          <span className="font-serif text-[22px] text-ink tabular-nums">
            {count}
          </span>{" "}
          selected{" "}
          <span className="text-faint">
            (choose {min}–{max})
          </span>
          <span className="ml-3 text-[13px] text-faint">· {hint}</span>
        </div>
        <button
          type="submit"
          disabled={!submittable}
          className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          See your result
        </button>
      </div>
    </form>
  );
}
