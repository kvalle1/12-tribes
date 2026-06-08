import { tribes } from "@/lib/tribes";

/**
 * The Self / 360 assessment word data — the backend scoring logic.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`. Participants see only a flat, unlabeled, shuffled
 * list of these words (the `word` fields); the tribe mappings below are never
 * shown to them.
 *
 * Two transcription notes (the table is the source of truth; its prose summary
 * is stale):
 *  - The doc's header says "Total: 73 words", but both the flat list and the
 *    mapping table enumerate 74 distinct adjectives. We transcribe all 74.
 *  - The doc states a shared word "scores 0.5 to each" of its two tribes, but
 *    one word ("Zealous") maps to three tribes. We generalize the per-word
 *    weight to `1 / tribeSlugs.length` (see `wordWeight`): exactly 0.5 for the
 *    common two-tribe case, and 1/3 for the lone three-tribe word.
 */

/** Selection constraints (soft range; submission is gated to this band). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

export interface AssessmentWord {
  /** The adjective shown to the participant. */
  word: string;
  /** Tribe slugs this word maps to (1–3). Shared words split their weight. */
  tribeSlugs: string[];
}

export const words: AssessmentWord[] = [
  { word: "Aggressive", tribeSlugs: ["benjamin"] },
  { word: "Alert", tribeSlugs: ["dan"] },
  { word: "Analytical", tribeSlugs: ["issachar"] },
  { word: "Authoritative", tribeSlugs: ["judah"] },
  { word: "Battle-tested", tribeSlugs: ["gad"] },
  { word: "Bold", tribeSlugs: ["judah", "reuben"] },
  { word: "Cautious", tribeSlugs: ["dan", "issachar"] },
  { word: "Comforting", tribeSlugs: ["asher"] },
  { word: "Consistent", tribeSlugs: ["joseph"] },
  { word: "Convicted", tribeSlugs: ["simeon"] },
  { word: "Courageous", tribeSlugs: ["judah"] },
  { word: "Creative", tribeSlugs: ["naphtali"] },
  { word: "Cunning", tribeSlugs: ["benjamin", "dan"] },
  { word: "Decisive", tribeSlugs: ["simeon", "benjamin"] },
  { word: "Dedicated", tribeSlugs: ["levi"] },
  { word: "Deliberate", tribeSlugs: ["dan"] },
  { word: "Devoted", tribeSlugs: ["levi"] },
  { word: "Discerning", tribeSlugs: ["issachar", "dan"] },
  { word: "Driven", tribeSlugs: ["benjamin", "reuben"] },
  { word: "Enduring", tribeSlugs: ["gad", "joseph"] },
  { word: "Energetic", tribeSlugs: ["reuben"] },
  { word: "Enriching", tribeSlugs: ["asher"] },
  { word: "Enterprising", tribeSlugs: ["zebulun"] },
  { word: "Exacting", tribeSlugs: ["levi"] },
  { word: "Expansive", tribeSlugs: ["zebulun"] },
  { word: "Expressive", tribeSlugs: ["naphtali"] },
  { word: "Faithful", tribeSlugs: ["joseph"] },
  { word: "Fervent", tribeSlugs: ["simeon", "judah"] },
  { word: "Fierce", tribeSlugs: ["benjamin"] },
  { word: "Free-spirited", tribeSlugs: ["naphtali"] },
  { word: "Generous", tribeSlugs: ["zebulun", "asher"] },
  { word: "Graceful", tribeSlugs: ["naphtali"] },
  { word: "Gritty", tribeSlugs: ["gad"] },
  { word: "Guarding", tribeSlugs: ["levi", "benjamin"] },
  { word: "Healing", tribeSlugs: ["naphtali"] },
  { word: "Honorable", tribeSlugs: ["judah"] },
  { word: "Hospitable", tribeSlugs: ["asher"] },
  { word: "Impulsive", tribeSlugs: ["reuben"] },
  { word: "Insightful", tribeSlugs: ["issachar"] },
  { word: "Inspiring", tribeSlugs: ["naphtali"] },
  { word: "Intense", tribeSlugs: ["benjamin", "reuben"] },
  { word: "Just", tribeSlugs: ["simeon"] },
  { word: "Learned", tribeSlugs: ["issachar"] },
  { word: "Loyal", tribeSlugs: ["joseph", "benjamin"] },
  { word: "Measured", tribeSlugs: ["issachar"] },
  { word: "Nurturing", tribeSlugs: ["asher"] },
  { word: "Observant", tribeSlugs: ["dan", "issachar"] },
  { word: "Organized", tribeSlugs: ["joseph"] },
  { word: "Passionate", tribeSlugs: ["reuben", "simeon"] },
  { word: "Patient", tribeSlugs: ["issachar"] },
  { word: "Peaceful", tribeSlugs: ["asher"] },
  { word: "Perceptive", tribeSlugs: ["issachar", "dan"] },
  { word: "Precise", tribeSlugs: ["levi"] },
  { word: "Prosperous", tribeSlugs: ["zebulun"] },
  { word: "Protective", tribeSlugs: ["benjamin", "judah"] },
  { word: "Reliable", tribeSlugs: ["joseph"] },
  { word: "Resilient", tribeSlugs: ["joseph", "gad"] },
  { word: "Resourceful", tribeSlugs: ["zebulun"] },
  { word: "Reverent", tribeSlugs: ["levi"] },
  { word: "Righteous", tribeSlugs: ["simeon"] },
  { word: "Sacrificial", tribeSlugs: ["judah"] },
  { word: "Skeptical", tribeSlugs: ["dan"] },
  { word: "Steady", tribeSlugs: ["joseph", "gad"] },
  { word: "Strategic", tribeSlugs: ["issachar", "dan"] },
  { word: "Strong", tribeSlugs: ["reuben", "judah"] },
  { word: "Supportive", tribeSlugs: ["joseph", "asher"] },
  { word: "Territorial", tribeSlugs: ["benjamin", "gad"] },
  { word: "Tough", tribeSlugs: ["gad"] },
  { word: "Uncompromising", tribeSlugs: ["simeon"] },
  { word: "Vigilant", tribeSlugs: ["dan"] },
  { word: "Watchful", tribeSlugs: ["dan"] },
  { word: "Welcoming", tribeSlugs: ["asher"] },
  { word: "Wise", tribeSlugs: ["issachar"] },
  { word: "Zealous", tribeSlugs: ["judah", "benjamin", "simeon"] },
];

/**
 * The weight a word contributes, split evenly across the tribes it maps to.
 * A solo word contributes 1; a two-tribe word 0.5 to each; the lone
 * three-tribe word ("Zealous") 1/3 to each.
 */
export function wordWeight(word: AssessmentWord): number {
  return 1 / word.tribeSlugs.length;
}

/**
 * Assert the word data is internally consistent and never silently drifts from
 * the `tribes` source of truth. Throws loudly on any problem. Parameterized on
 * the word list so it can be exercised against bad fixtures in tests; defaults
 * to the real `words`.
 */
export function validateWordData(wordList: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();

  for (const entry of wordList) {
    if (seen.has(entry.word)) {
      throw new Error(`Duplicate assessment word: "${entry.word}"`);
    }
    seen.add(entry.word);

    if (entry.tribeSlugs.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribes`);
    }

    for (const slug of entry.tribeSlugs) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
