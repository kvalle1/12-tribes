import { tribes } from "@/lib/tribes";
import { assessmentWords, type AssessmentWord } from "./words";

/**
 * Pure scoring core for the word-selection assessment (issue #4, ADR-0001).
 *
 * Scoring is *normalized*: a tribe's score is the points it earned from the
 * selected words divided by the total points available to it across the whole
 * word list — a 0–1 value comparable across tribes regardless of how many words
 * map to each (a 6-word tribe and a 10-word tribe compete fairly). A shared word
 * (mapped to more than one tribe) contributes 0.5 to each; a solo word
 * contributes 1.
 *
 * Both functions are pure and take an optional `wordList` (defaulting to the
 * real data) so behavior can be tested against controlled fixtures.
 */

export interface TribeScore {
  /** Tribe slug, matching `tribes[].slug`. */
  slug: string;
  /** Normalized score in [0, 1]. */
  score: number;
}

export interface AssessmentResult {
  primary: TribeScore;
  /** Present only when a tribe genuinely qualifies as Secondary. */
  secondary?: TribeScore;
}

export interface DeriveOptions {
  /**
   * Secondary must be within this fraction of Primary to count as "near"
   * (default 0.2 ⇒ within 20%).
   */
  secondaryProximity?: number;
  /**
   * Secondary must lead the third tribe by more than this fraction to count as
   * "clearly ahead" (default 0.2 ⇒ more than 20% ahead).
   */
  thirdSeparation?: number;
}

const DEFAULT_OPTIONS: Required<DeriveOptions> = {
  secondaryProximity: 0.2,
  thirdSeparation: 0.2,
};

/** A word's per-tribe point weight: solo words score 1, shared words 0.5 each. */
function weightFor(word: AssessmentWord): number {
  return word.tribes.length > 1 ? 0.5 : 1;
}

/** Stable rank order for deterministic ties: tribe `number`, then slug. */
const tribeOrder = new Map(tribes.map((t) => [t.slug, t.number]));
function rankCompare(a: TribeScore, b: TribeScore): number {
  if (b.score !== a.score) return b.score - a.score;
  const oa = tribeOrder.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
  const ob = tribeOrder.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return a.slug.localeCompare(b.slug);
}

/**
 * Total points available to each tribe across the whole word list — the
 * normalization denominator. Solo words add 1; shared words add 0.5.
 */
export function availablePoints(
  wordList: AssessmentWord[] = assessmentWords,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const word of wordList) {
    const weight = weightFor(word);
    for (const slug of word.tribes) {
      totals.set(slug, (totals.get(slug) ?? 0) + weight);
    }
  }
  return totals;
}

/**
 * Scores a set of selected words, returning a normalized [0, 1] score for every
 * tribe present in the word list, ranked highest-first. Unknown words (not in
 * the list) and duplicate selections are ignored.
 */
export function score(
  selectedWords: string[],
  wordList: AssessmentWord[] = assessmentWords,
): TribeScore[] {
  const available = availablePoints(wordList);
  const byWord = new Map(wordList.map((w) => [w.word, w]));

  const earned = new Map<string, number>();
  for (const selected of new Set(selectedWords)) {
    const word = byWord.get(selected);
    if (!word) continue;
    const weight = weightFor(word);
    for (const slug of word.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const scores: TribeScore[] = [];
  for (const [slug, total] of available) {
    const got = earned.get(slug) ?? 0;
    scores.push({ slug, score: total > 0 ? got / total : 0 });
  }
  return scores.sort(rankCompare);
}

/**
 * Derives the headline result from scored tribes. Always returns a Primary (the
 * highest score). Returns a Secondary only when it is *near* the Primary and
 * *clearly ahead* of the third tribe — otherwise only a Primary is named, so the
 * result stays honest rather than forced.
 */
export function deriveResult(
  scores: TribeScore[],
  options: DeriveOptions = {},
): AssessmentResult {
  const { secondaryProximity, thirdSeparation } = { ...DEFAULT_OPTIONS, ...options };

  const ranked = [...scores].sort(rankCompare);
  const primary = ranked[0];
  if (!primary || primary.score <= 0) {
    return { primary: primary ?? { slug: "", score: 0 } };
  }

  const second = ranked[1];
  const third = ranked[2];
  if (!second || second.score <= 0) return { primary };

  const nearPrimary = (primary.score - second.score) / primary.score <= secondaryProximity;
  const aheadOfThird =
    !third || third.score <= 0
      ? true
      : (second.score - third.score) / second.score > thirdSeparation;

  return nearPrimary && aheadOfThird ? { primary, secondary: second } : { primary };
}
