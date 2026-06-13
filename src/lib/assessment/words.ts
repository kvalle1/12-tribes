import { tribes } from "@/lib/tribes";

/**
 * The flat, unlabeled adjective list and its word→tribe mapping, transcribed
 * faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md` (the
 * content source of truth). Tribes are referenced by `slug` so they resolve
 * against the `tribes` source of truth in `src/lib/tribes.ts`.
 *
 * Transcription notes (both surfaced rather than silently "corrected"):
 *  - The design doc's header says "Total: 73 words", but the list and mapping
 *    table both actually contain 74 adjectives — an off-by-one miscount in the
 *    doc. We transcribe all 74 as written.
 *  - "Zealous" maps to three tribes (Judah · Benjamin · Simeon). The doc's prose
 *    only describes one- or two-tribe words ("0.5 each"), so the scoring weight
 *    generalizes that rule as `1 / tribeCount` (see `wordWeight`): 1.0 for a solo
 *    word, exactly 0.5 for a shared pair, and 1/3 for this three-way word.
 */

/** Minimum number of words a respondent must select to submit. */
export const MIN_WORDS = 8;

/** Maximum number of words a respondent may select. */
export const MAX_WORDS = 15;

export interface AssessmentWord {
  /** The adjective exactly as shown to the respondent. */
  word: string;
  /** The tribe slug(s) this word maps to (one or more). */
  tribes: string[];
}

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
 * The points a single word contributes, split evenly across the tribe(s) it maps
 * to. A solo word contributes 1.0; a shared pair contributes 0.5 to each (the
 * "0.5 each" rule from ADR-0001); a three-way word contributes 1/3 to each. The
 * total mass a selected word adds is always exactly 1.0.
 */
export function wordWeight(word: AssessmentWord): number {
  return 1 / word.tribes.length;
}

/**
 * Assert every tribe slug referenced by the word mapping resolves against the
 * `tribes` source of truth, and that the list itself is well-formed (no empty
 * mappings, no duplicate words). Throws loudly on the first batch of problems so
 * the data can never silently drift from `tribes.ts`.
 *
 * Accepts an explicit list for testing; defaults to the real `words` mapping.
 */
export function validateWordMappings(wordList: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of wordList) {
    if (seen.has(entry.word)) {
      problems.push(`Duplicate word "${entry.word}"`);
    }
    seen.add(entry.word);

    if (entry.tribes.length === 0) {
      problems.push(`"${entry.word}" maps to no tribe`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        problems.push(`"${entry.word}" → unknown tribe slug "${slug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid word→tribe mappings:\n${problems.join("\n")}`);
  }
}
