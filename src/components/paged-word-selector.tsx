"use client";

import { useState } from "react";
import { PAGE_COUNT, PICKS_PER_PAGE } from "@/lib/assessment/constants";
import { isLocked, togglePick } from "@/lib/assessment/page-picks";
import { cn } from "@/lib/utils";

/**
 * The paged Self Assessment: one page of 12 words at a time, pick your top
 * three. Once three are chosen the rest dim and lock (deselect one to change
 * your mind). Back/Next walk the pages; Next is enabled only when the page has
 * its three, and the last page offers "Complete assessment", which posts every
 * pick to the server action. Pages arrive pre-shuffled and unlabeled — no tribe
 * mapping reaches the client (ADR-0009).
 */
export function PagedWordSelector({
  pages,
  action,
}: {
  pages: string[][];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [picks, setPicks] = useState<string[][]>(() => pages.map(() => []));

  const words = pages[pageIndex];
  const pagePicks = picks[pageIndex];
  const full = pagePicks.length >= PICKS_PER_PAGE;
  const isLast = pageIndex === pages.length - 1;
  const allDone = picks.every((p) => p.length === PICKS_PER_PAGE);

  const toggle = (word: string) => {
    setPicks((prev) =>
      prev.map((p, i) => (i === pageIndex ? togglePick(p, word) : p)),
    );
  };

  return (
    <form action={action} className="mt-10">
      {picks.flat().map((word) => (
        <input key={word} type="hidden" name="words" value={word} />
      ))}

      <div className="flex items-baseline justify-between text-[12px] uppercase tracking-[0.18em] text-faint">
        <span>
          Page {pageIndex + 1} of {PAGE_COUNT}
        </span>
        <span aria-live="polite">
          {pagePicks.length} of {PICKS_PER_PAGE} chosen
        </span>
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {pages.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-[3px] flex-1 rounded-full",
              i < pageIndex || picks[i].length === PICKS_PER_PAGE
                ? "bg-gold"
                : i === pageIndex
                  ? "bg-gold/50"
                  : "bg-hair",
            )}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2.5">
        {words.map((word) => {
          const active = pagePicks.includes(word);
          const locked = isLocked(pagePicks, word);
          return (
            <button
              key={word}
              type="button"
              aria-pressed={active}
              aria-disabled={locked}
              tabIndex={locked ? -1 : 0}
              onClick={() => {
                if (!locked) toggle(word);
              }}
              className={cn(
                "rounded-[2px] border px-4 py-2 text-[15px] transition-colors",
                active && "border-gold bg-gold/10 text-ink",
                locked &&
                  "pointer-events-none cursor-not-allowed border-hair bg-white text-faint opacity-40",
                !active &&
                  !locked &&
                  "border-hair bg-white text-muted hover:border-gold/60 hover:text-ink",
              )}
            >
              {word}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hair bg-bone/95 py-5 backdrop-blur">
        <button
          type="button"
          onClick={() => setPageIndex((i) => i - 1)}
          disabled={pageIndex === 0}
          className={cn(
            "rounded-[2px] px-2 py-[14px] text-[13px] tracking-[0.08em] transition-colors",
            pageIndex === 0
              ? "invisible"
              : "text-muted hover:text-ink",
          )}
        >
          ← Back
        </button>

        {isLast ? (
          <button
            type="submit"
            disabled={!allDone}
            className={cn(
              "rounded-[2px] px-[34px] py-[14px] text-[13px] tracking-[0.08em] transition-colors",
              allDone
                ? "bg-ink text-bone hover:bg-black"
                : "cursor-not-allowed bg-hair text-faint",
            )}
          >
            Complete assessment
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPageIndex((i) => i + 1)}
            disabled={!full}
            className={cn(
              "rounded-[2px] px-[34px] py-[14px] text-[13px] tracking-[0.08em] transition-colors",
              full
                ? "bg-ink text-bone hover:bg-black"
                : "cursor-not-allowed bg-hair text-faint",
            )}
          >
            Next →
          </button>
        )}
      </div>
    </form>
  );
}
