"use client";

import { useState } from "react";
import {
  MAX_WORDS,
  MIN_WORDS,
  isWithinSelectionRange,
} from "@/lib/assessment/constants";
import { cn } from "@/lib/utils";
import { submitAssessment } from "./actions";

/**
 * The flat word-selection grid. Words arrive pre-shuffled from the server and
 * unlabeled — no tribe mapping ever reaches the client (ADR-0009). The Subject
 * toggles words; a live counter tracks progress and the submit button stays
 * disabled until the selection is within the 8–15 range. The selected words ride
 * to the server as hidden `words` inputs, scored and saved by the action.
 */
export function WordSelector({ words }: { words: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (word: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const count = selected.size;
  const canSubmit = isWithinSelectionRange(count);

  return (
    <form action={submitAssessment} className="mt-10">
      {[...selected].map((word) => (
        <input key={word} type="hidden" name="words" value={word} />
      ))}

      <div className="flex flex-wrap gap-2.5">
        {words.map((word) => {
          const active = selected.has(word);
          return (
            <button
              key={word}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(word)}
              className={cn(
                "rounded-[2px] border px-4 py-2 text-[15px] transition-colors",
                active
                  ? "border-gold bg-gold/10 text-ink"
                  : "border-hair bg-white text-muted hover:border-gold/60 hover:text-ink",
              )}
            >
              {word}
            </button>
          );
        })}
      </div>

      {/* Live counter + submission gate */}
      <div className="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hair bg-bone/95 py-5 backdrop-blur">
        <div className="text-[14px] text-muted" aria-live="polite">
          <span className="font-serif text-[20px] text-ink tabular-nums">
            {count}
          </span>{" "}
          selected — pick between {MIN_WORDS} and {MAX_WORDS}.
          {count > 0 && !canSubmit && (
            <span className="ml-2 text-gold">
              {count < MIN_WORDS
                ? `${MIN_WORDS - count} more to go.`
                : `${count - MAX_WORDS} too many.`}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "rounded-[2px] px-[34px] py-[14px] text-[13px] tracking-[0.08em] transition-colors",
            canSubmit
              ? "bg-ink text-bone hover:bg-black"
              : "cursor-not-allowed bg-hair text-faint",
          )}
        >
          See my result
        </button>
      </div>
    </form>
  );
}
