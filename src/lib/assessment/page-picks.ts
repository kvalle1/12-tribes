import { PICKS_PER_PAGE } from "./constants";

/**
 * Pure pick/lock rules for one page of the paged Self Assessment (client-safe).
 * A page allows `PICKS_PER_PAGE` picks; once full, every unpicked word is locked.
 */

/** Whether `word` is locked: the page is full and the word isn't one of the picks. */
export function isLocked(picks: readonly string[], word: string): boolean {
  return picks.length >= PICKS_PER_PAGE && !picks.includes(word);
}

/** Toggle `word`: deselect if picked, select if there's room, otherwise no-op. */
export function togglePick(picks: readonly string[], word: string): string[] {
  if (picks.includes(word)) return picks.filter((w) => w !== word);
  if (isLocked(picks, word)) return [...picks];
  return [...picks, word];
}
