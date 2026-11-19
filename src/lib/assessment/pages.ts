import "server-only";
import { tribes } from "@/lib/tribes";
import { WORDS } from "./words";
import { shuffle } from "./selection";
import { PAGE_COUNT, PICKS_PER_PAGE } from "./constants";

/**
 * The paged Self Assessment pool: 5 pages × 12 words, each page holding exactly
 * one word per tribe, so every page is a fair 12-way choice. Each tribe's five
 * words are listed here (page N gets the Nth). A word's *page* tribe is only a
 * layout device — scoring still uses its full mapping in `words.ts`, so shared
 * words keep splitting their point across their tribes.
 *
 * 14 words from the 74-word list are intentionally not offered (Cautious,
 * Decisive, Discerning, Enriching, Guarding, Inspiring, Loyal, Measured,
 * Observant, Perceptive, Resilient, Strategic, Supportive, Zealous) — some
 * tribes have 6+ words and others only 2–3 single-tribe words, so a balanced
 * 5-per-tribe pool needs a cut. Reuben/Benjamin/Gad/etc. fill their slots from
 * words they share with other tribes.
 */
const WORDS_BY_TRIBE: Record<string, readonly string[]> = {
  reuben: ["Energetic", "Impulsive", "Intense", "Passionate", "Strong"],
  simeon: ["Convicted", "Just", "Righteous", "Uncompromising", "Fervent"],
  levi: ["Dedicated", "Devoted", "Exacting", "Precise", "Reverent"],
  judah: ["Authoritative", "Courageous", "Honorable", "Sacrificial", "Bold"],
  dan: ["Alert", "Deliberate", "Skeptical", "Vigilant", "Watchful"],
  naphtali: ["Creative", "Expressive", "Free-spirited", "Graceful", "Healing"],
  gad: ["Battle-tested", "Gritty", "Tough", "Enduring", "Territorial"],
  asher: ["Comforting", "Hospitable", "Nurturing", "Peaceful", "Welcoming"],
  issachar: ["Analytical", "Insightful", "Learned", "Patient", "Wise"],
  zebulun: ["Enterprising", "Expansive", "Prosperous", "Resourceful", "Generous"],
  joseph: ["Consistent", "Faithful", "Organized", "Reliable", "Steady"],
  benjamin: ["Aggressive", "Fierce", "Cunning", "Driven", "Protective"],
};

/** The five pages, each an unordered list of 12 words (one per tribe). */
export const ASSESSMENT_PAGES: readonly (readonly string[])[] = Array.from(
  { length: PAGE_COUNT },
  (_, i) => tribes.map((t) => WORDS_BY_TRIBE[t.slug][i]),
);

const PAGE_OF_WORD = new Map<string, number>(
  ASSESSMENT_PAGES.flatMap((page, i) => page.map((w) => [w, i] as const)),
);

/** Fail fast if the pool drifts from the word list or loses its balance. */
function validatePages(): void {
  const known = new Set(WORDS.map((w) => w.word));
  const seen = new Set<string>();
  for (const page of ASSESSMENT_PAGES) {
    if (page.length !== tribes.length) {
      throw new Error("Each assessment page must hold one word per tribe");
    }
    for (const w of page) {
      if (!known.has(w)) throw new Error(`Unknown assessment word "${w}"`);
      if (seen.has(w)) throw new Error(`"${w}" appears on more than one page`);
      seen.add(w);
    }
  }
}
validatePages();

/** The pages in a fresh shuffled order within each page (page order is fixed). */
export function shuffledPages(random: () => number = Math.random): string[][] {
  return ASSESSMENT_PAGES.map((page) => shuffle(page, random));
}

/**
 * Whether a submitted selection is a complete, well-formed paged answer:
 * exactly `PICKS_PER_PAGE` distinct words from every page and nothing else.
 */
export function isCompletePagedSelection(words: readonly string[]): boolean {
  const unique = new Set(words);
  if (unique.size !== words.length) return false;
  if (unique.size !== PAGE_COUNT * PICKS_PER_PAGE) return false;
  const perPage = new Array<number>(PAGE_COUNT).fill(0);
  for (const w of unique) {
    const page = PAGE_OF_WORD.get(w);
    if (page === undefined) return false;
    perPage[page]++;
  }
  return perPage.every((n) => n === PICKS_PER_PAGE);
}
