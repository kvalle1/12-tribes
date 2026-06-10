import { tribes } from "../tribes";

/**
 * The assessment word data: the flat 73-word adjective list and each word's
 * mapping to one or more tribes (by slug). Transcribed faithfully from the
 * "Tribe Mapping" table in ASSESSMENT_DESIGN.md, the content source of truth.
 *
 * A word mapped to a single tribe contributes its full weight (1.0) to that
 * tribe; a *shared* word (mapped to more than one tribe) contributes 0.5 to
 * each mapped tribe — per the design doc legend, "scores 0.5 to each mapped
 * tribe" (ADR-0001). Most shared words map to two tribes; "Zealous" maps to
 * three, and the same 0.5-per-mapping rule applies.
 */
export interface AssessmentWord {
  /** The adjective shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (one or more). */
  tribes: string[];
}

/** Soft selection range: a participant must pick between 8 and 15 words. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

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
 * The weight a single word contributes to *each* tribe it maps to. A solo word
 * contributes its whole point; a shared word splits 0.5 to each mapped tribe.
 */
export function wordWeight(word: AssessmentWord): number {
  return word.tribes.length > 1 ? 0.5 : 1;
}

/**
 * Asserts the word data is internally consistent and never silently drifts
 * from the `tribes` source of truth. Throws loudly on any problem:
 *  - a mapped slug that does not resolve against `tribes`
 *  - a duplicated word
 *  - a word with no tribe mapping
 *
 * Returns the validated word list so callers can use it as a guard.
 */
export function validateWords(list: AssessmentWord[] = words): AssessmentWord[] {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();
  const problems: string[] = [];

  for (const { word, tribes: mapped } of list) {
    if (seen.has(word)) {
      problems.push(`duplicate word: "${word}"`);
    }
    seen.add(word);

    if (mapped.length === 0) {
      problems.push(`word "${word}" has no tribe mapping`);
    }

    for (const slug of mapped) {
      if (!validSlugs.has(slug)) {
        problems.push(`word "${word}" maps to unknown tribe slug "${slug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid assessment word data:\n - ${problems.join("\n - ")}`);
  }

  return list;
}
