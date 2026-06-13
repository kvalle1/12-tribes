import { tribes } from "@/lib/tribes";

/**
 * Word data for the Self / 360 word-selection assessment.
 *
 * Source of truth: the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`. Each
 * word maps to one or two tribes (one word — `Zealous` — maps to three),
 * referenced by tribe `slug` so the data can be validated against `tribes.ts`.
 *
 * Scoring weight per word (ADR-0001): a word mapped to a single tribe is worth
 * `1.0` to that tribe; a *shared* word (mapped to more than one tribe) is worth
 * `0.5` to each of its tribes, per the design doc's "scores 0.5 to each mapped
 * tribe" rule. This weight feeds both the numerator (points earned) and the
 * denominator (points available) of the normalized tribe score.
 */
export interface AssessmentWord {
  /** The adjective shown to the participant. */
  word: string;
  /** Tribe slugs this word maps to (1–3). */
  tribes: string[];
}

/** Selection constants — the soft range a participant must pick within. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The flat, unlabeled adjective list and each word's tribe mapping,
 * transcribed verbatim from the `ASSESSMENT_DESIGN.md` mapping table.
 *
 * Note: the doc's caption reads "Total: 73 words", but the mapping table (and
 * the prose list) both contain 74 entries; all 74 are transcribed here.
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
 * The scoring weight a single word contributes to *each* tribe it maps to:
 * `1.0` for a word owned by one tribe, `0.5` for a shared word.
 */
export function wordWeight(word: AssessmentWord): number {
  return word.tribes.length > 1 ? 0.5 : 1;
}

/**
 * Asserts the word data is internally consistent and every referenced tribe
 * slug resolves against the `tribes` source of truth. Throws loudly on the
 * first problem so the data can never silently drift from `tribes.ts`.
 */
export function validateWordData(list: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const seen = new Set<string>();

  for (const entry of list) {
    if (seen.has(entry.word)) {
      throw new Error(`Duplicate word in assessment list: "${entry.word}"`);
    }
    seen.add(entry.word);

    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribe`);
    }

    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" maps to unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
