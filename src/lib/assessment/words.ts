import { tribes } from "@/lib/tribes";

/**
 * Word data for the Tribe Index Self / 360 assessment.
 *
 * Source of truth: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. Each
 * word maps to one or more tribes (referenced by `slug`). A word mapped to a
 * single tribe contributes its full weight to that tribe; a word shared across
 * more than one tribe contributes 0.5 to each (see `wordWeight` in `score.ts`).
 *
 * Note: `ASSESSMENT_DESIGN.md` heads the list "Total: 73 words", but the
 * mapping table and the flat word list both contain 74 entries — the header is
 * off by one. The data below is transcribed faithfully from the table, so the
 * count is 74. "Zealous" is the lone word mapped to three tribes; every other
 * shared word maps to two.
 */

/** Soft selection floor: a Subject (or Observer) must pick at least this many words. */
export const MIN_WORDS = 8;

/** Soft selection ceiling: a Subject (or Observer) may pick at most this many words. */
export const MAX_WORDS = 15;

export interface AssessmentWord {
  /** The adjective shown to participants, exactly as it appears in the list. */
  word: string;
  /** The tribe slug(s) this word maps to. One slug = full weight; more = shared (0.5 each). */
  tribes: string[];
}

/**
 * The full, flat adjective list and its word→tribe(slug) mapping, transcribed
 * verbatim from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
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
 * Asserts that every word maps to at least one tribe and that every referenced
 * slug resolves against the `tribes` source of truth. Throws loudly on drift so
 * a mistyped or renamed slug can never silently score nothing.
 *
 * Accepts a list so callers (and tests) can validate alternative data; defaults
 * to the canonical {@link words}.
 */
export function validateAssessmentWords(list: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const entry of list) {
    if (entry.tribes.length === 0) {
      throw new Error(`Assessment word "${entry.word}" maps to no tribes`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Assessment word "${entry.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}

// Fail loudly at import/build/test time if the data ever drifts from `tribes`.
validateAssessmentWords();
