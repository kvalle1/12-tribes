import { getTribeBySlug } from "../tribes";

/**
 * Word-selection constants for the Self / 360 assessment.
 * A participant must select between MIN_WORDS and MAX_WORDS words.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The number of words in the canonical list. ASSESSMENT_DESIGN.md's header
 * reads "Total: 73 words", but its prose list and mapping table each actually
 * enumerate 74 distinct words (they agree with each other) — the "73" is an
 * off-by-one in the summary label, so the faithful count is 74.
 */
export const WORD_COUNT = 74;

/**
 * One adjective from the assessment word list and the tribe(s) it maps to.
 * `tribes` holds tribe slugs (the source of truth is `tribes` in ../tribes).
 *
 * A word mapped to a single tribe contributes its full weight to that tribe;
 * a *shared* word (mapped to more than one tribe) contributes 0.5 to each
 * mapped tribe (ASSESSMENT_DESIGN.md, "scores 0.5 to each mapped tribe").
 */
export interface AssessmentWord {
  word: string;
  tribes: string[];
}

/**
 * The flat word list and its word -> tribe(slug) mapping, transcribed
 * faithfully from the table in ASSESSMENT_DESIGN.md. Word→tribe mappings are
 * never shown to participants; the list is presented flat and shuffled.
 *
 * Note: "Zealous" maps to three tribes in the design doc. Per the doc's legend
 * ("* = shared word, scores 0.5 to each mapped tribe"), every shared word —
 * including a three-way one — contributes 0.5 to each of its tribes.
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
 * Asserts the word data is internally consistent and never silently drifts
 * from the `tribes` source of truth. Throws loudly on the first problem found:
 *  - an unexpected word count,
 *  - a duplicated word,
 *  - a word with no tribe mapping,
 *  - a mapped slug that does not resolve against `tribes`.
 *
 * Accepts an explicit dataset for testing; defaults to the canonical list.
 */
export function validateWordData(data: AssessmentWord[] = words): void {
  if (data === words && data.length !== WORD_COUNT) {
    throw new Error(
      `Word list has ${data.length} words, expected ${WORD_COUNT}.`,
    );
  }

  const seen = new Set<string>();
  for (const entry of data) {
    if (seen.has(entry.word)) {
      throw new Error(`Duplicate word in list: "${entry.word}".`);
    }
    seen.add(entry.word);

    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribe.`);
    }

    for (const slug of entry.tribes) {
      if (!getTribeBySlug(slug)) {
        throw new Error(
          `Word "${entry.word}" maps to unknown tribe slug "${slug}".`,
        );
      }
    }
  }
}
