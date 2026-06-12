import { tribes } from "@/lib/tribes";
import { words, type WordMapping } from "@/lib/assessment/words";

export interface TribeScore {
  /** The tribe's slug, matching `tribes` in `src/lib/tribes.ts`. */
  slug: string;
  /**
   * Normalized 0–1 score: points earned for this tribe divided by the total
   * points available for it across the whole word list (ADR-0001). Comparable
   * across tribes regardless of how many words map to each.
   */
  score: number;
}

export interface AssessmentResult {
  /** Always present — the highest-scoring tribe. */
  primary: TribeScore;
  /** Present only when a second tribe genuinely qualifies (see below). */
  secondary?: TribeScore;
}

/**
 * Tunable thresholds for deriving a Secondary tribe. A Secondary is named only
 * when it is *near* the Primary and *clearly ahead* of the third tribe — so the
 * result stays honest rather than forced.
 */
export const SECONDARY_NEAR_PRIMARY_RATIO = 0.8; // within 20% of the Primary
export const SECONDARY_AHEAD_OF_THIRD_RATIO = 0.8; // third <= 80% of the Secondary

/** Canonical 1-based ordering, used as a deterministic tie-break. */
function tribeOrder(slug: string): number {
  return tribes.find((t) => t.slug === slug)?.number ?? Number.MAX_SAFE_INTEGER;
}

/** A word contributes a total of one point, split equally across its tribes. */
function weightPerTribe(mapping: WordMapping): number {
  return 1 / mapping.tribes.length;
}

/** Maximum points each tribe could earn if every one of its words were picked. */
function availablePoints(): Map<string, number> {
  const available = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const mapping of words) {
    const weight = weightPerTribe(mapping);
    for (const slug of mapping.tribes) {
      available.set(slug, (available.get(slug) ?? 0) + weight);
    }
  }
  return available;
}

function byScoreDescending(a: TribeScore, b: TribeScore): number {
  return b.score - a.score || tribeOrder(a.slug) - tribeOrder(b.slug);
}

/**
 * Scores a set of selected words into a normalized 0–1 value for all 12 tribes,
 * sorted highest-first. Unknown words are ignored. A shared word splits its
 * single point equally across its tribes (0.5 each for two tribes).
 */
export function score(selectedWords: string[]): TribeScore[] {
  const byWord = new Map(words.map((m) => [m.word, m]));
  const earned = new Map<string, number>(tribes.map((t) => [t.slug, 0]));

  for (const word of selectedWords) {
    const mapping = byWord.get(word);
    if (!mapping) continue; // ignore unknown words
    const weight = weightPerTribe(mapping);
    for (const slug of mapping.tribes) {
      earned.set(slug, (earned.get(slug) ?? 0) + weight);
    }
  }

  const available = availablePoints();
  const scores: TribeScore[] = tribes.map((t) => {
    const avail = available.get(t.slug) ?? 0;
    const got = earned.get(t.slug) ?? 0;
    return { slug: t.slug, score: avail === 0 ? 0 : got / avail };
  });

  return scores.sort(byScoreDescending);
}

/**
 * Derives the headline result from a set of tribe scores. The Primary is always
 * the highest-scoring tribe. A Secondary is returned only when it scores near
 * the Primary (within 20%) *and* is clearly ahead of the third tribe; otherwise
 * only a Primary is named.
 */
export function deriveResult(scores: TribeScore[]): AssessmentResult {
  const ranked = [...scores].sort(byScoreDescending);
  const [primary, second, third] = ranked;

  const secondaryQualifies =
    primary !== undefined &&
    second !== undefined &&
    second.score > 0 &&
    second.score >= primary.score * SECONDARY_NEAR_PRIMARY_RATIO &&
    (third === undefined ||
      third.score <= second.score * SECONDARY_AHEAD_OF_THIRD_RATIO);

  return secondaryQualifies
    ? { primary, secondary: second }
    : { primary };
}
