import { MAX_WORDS, MIN_WORDS, WORDS } from "./words";

/**
 * Server-side guards for a submitted word selection (defense-in-depth).
 *
 * The selection UI already gates the count and only offers real words, but the
 * server must never trust the client: a request can arrive with unknown words,
 * duplicates, or an out-of-range count. These pure helpers sanitize and
 * validate a selection before it is scored and persisted, and are reused by the
 * scoring path so self and (later) observer submissions are held to the same
 * 8–15 constraint.
 */

const KNOWN_WORDS = new Set(WORDS.map((word) => word.word));

/**
 * Drop any word not in the official list and remove duplicates, preserving the
 * order each word was first seen. The result is a clean set of selected words
 * safe to hand to `score()`.
 */
export function sanitizeSelection(words: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    if (KNOWN_WORDS.has(word) && !seen.has(word)) {
      seen.add(word);
      out.push(word);
    }
  }
  return out;
}

/** Whether a count of selected words falls within the submittable range (inclusive). */
export function isSubmittable(count: number): boolean {
  return count >= MIN_WORDS && count <= MAX_WORDS;
}
