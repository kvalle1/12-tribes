import { tribes } from "@/lib/tribes";

/**
 * Selection constraints for the word-selection assessment.
 *
 * The Subject (and, later, each 360 Observer) must pick within this range for a
 * result to be statistically meaningful. The range is enforced by the UI; the
 * scoring core itself is pure and does not gate on it.
 */
export const MIN_SELECTIONS = 8;
export const MAX_SELECTIONS = 15;

/**
 * One adjective in the flat, unlabeled word list, mapped to the tribe(s) it
 * signals. Words are referenced to tribes by `slug` (the source of truth in
 * `tribes.ts`).
 *
 * A word mapped to more than one tribe is a *shared* word: per
 * `ASSESSMENT_DESIGN.md`, a shared word scores 0.5 to each mapped tribe, while a
 * single-tribe word scores the full 1.0. (See `score.ts` and ADR-0001.)
 */
export interface AssessmentWord {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to; length > 1 means it is a shared word. */
  tribes: string[];
}

/**
 * The flat word list and its word→tribe(slug) mapping, transcribed faithfully
 * from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. The list order here
 * is the source order; the UI shuffles per session so it is never shown in this
 * order.
 *
 * Note: the design doc's flat list and mapping table both contain 74 words and
 * agree with each other; the doc's "Total: 73 words" summary line is an
 * off-by-one in the doc, not in this transcription.
 */
export const words: AssessmentWord[] = [
  { word: "Aggressive", tribes: ["benjamin"] },
  { word: "Alert", tribes: ["dan"] },
  { word: "Analytical", tribes: ["issachar"] },
  { word: "Authoritative", tribes: ["judah"] },
  { word: "Battle-tested", tribes: ["gad"] },
  { word: "Bold", tribes: ["judah", "reuben"] },
  { word: "Cautious", tribes: ["dan", "issachar"] },
  { word: "Comforting", tribes: ["asher"] },
  { word: "Consistent", tribes: ["joseph"] },
  { word: "Convicted", tribes: ["simeon"] },
  { word: "Courageous", tribes: ["judah"] },
  { word: "Creative", tribes: ["naphtali"] },
  { word: "Cunning", tribes: ["benjamin", "dan"] },
  { word: "Decisive", tribes: ["simeon", "benjamin"] },
  { word: "Dedicated", tribes: ["levi"] },
  { word: "Deliberate", tribes: ["dan"] },
  { word: "Devoted", tribes: ["levi"] },
  { word: "Discerning", tribes: ["issachar", "dan"] },
  { word: "Driven", tribes: ["benjamin", "reuben"] },
  { word: "Enduring", tribes: ["gad", "joseph"] },
  { word: "Energetic", tribes: ["reuben"] },
  { word: "Enriching", tribes: ["asher"] },
  { word: "Enterprising", tribes: ["zebulun"] },
  { word: "Exacting", tribes: ["levi"] },
  { word: "Expansive", tribes: ["zebulun"] },
  { word: "Expressive", tribes: ["naphtali"] },
  { word: "Faithful", tribes: ["joseph"] },
  { word: "Fervent", tribes: ["simeon", "judah"] },
  { word: "Fierce", tribes: ["benjamin"] },
  { word: "Free-spirited", tribes: ["naphtali"] },
  { word: "Generous", tribes: ["zebulun", "asher"] },
  { word: "Graceful", tribes: ["naphtali"] },
  { word: "Gritty", tribes: ["gad"] },
  { word: "Guarding", tribes: ["levi", "benjamin"] },
  { word: "Healing", tribes: ["naphtali"] },
  { word: "Honorable", tribes: ["judah"] },
  { word: "Hospitable", tribes: ["asher"] },
  { word: "Impulsive", tribes: ["reuben"] },
  { word: "Insightful", tribes: ["issachar"] },
  { word: "Inspiring", tribes: ["naphtali"] },
  { word: "Intense", tribes: ["benjamin", "reuben"] },
  { word: "Just", tribes: ["simeon"] },
  { word: "Learned", tribes: ["issachar"] },
  { word: "Loyal", tribes: ["joseph", "benjamin"] },
  { word: "Measured", tribes: ["issachar"] },
  { word: "Nurturing", tribes: ["asher"] },
  { word: "Observant", tribes: ["dan", "issachar"] },
  { word: "Organized", tribes: ["joseph"] },
  { word: "Passionate", tribes: ["reuben", "simeon"] },
  { word: "Patient", tribes: ["issachar"] },
  { word: "Peaceful", tribes: ["asher"] },
  { word: "Perceptive", tribes: ["issachar", "dan"] },
  { word: "Precise", tribes: ["levi"] },
  { word: "Prosperous", tribes: ["zebulun"] },
  { word: "Protective", tribes: ["benjamin", "judah"] },
  { word: "Reliable", tribes: ["joseph"] },
  { word: "Resilient", tribes: ["joseph", "gad"] },
  { word: "Resourceful", tribes: ["zebulun"] },
  { word: "Reverent", tribes: ["levi"] },
  { word: "Righteous", tribes: ["simeon"] },
  { word: "Sacrificial", tribes: ["judah"] },
  { word: "Skeptical", tribes: ["dan"] },
  { word: "Steady", tribes: ["joseph", "gad"] },
  { word: "Strategic", tribes: ["issachar", "dan"] },
  { word: "Strong", tribes: ["reuben", "judah"] },
  { word: "Supportive", tribes: ["joseph", "asher"] },
  { word: "Territorial", tribes: ["benjamin", "gad"] },
  { word: "Tough", tribes: ["gad"] },
  { word: "Uncompromising", tribes: ["simeon"] },
  { word: "Vigilant", tribes: ["dan"] },
  { word: "Watchful", tribes: ["dan"] },
  { word: "Welcoming", tribes: ["asher"] },
  { word: "Wise", tribes: ["issachar"] },
  { word: "Zealous", tribes: ["judah", "benjamin", "simeon"] },
];

/**
 * Asserts that every tribe slug referenced by the word list resolves against the
 * `tribes` source of truth, so the mapping can never silently drift from the
 * data model. Throws loudly on the first offending word.
 *
 * Accepts an explicit list (defaults to the real `words`) so the failure path is
 * unit-testable.
 */
export function validateWordMappings(list: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const entry of list) {
    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribes`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
