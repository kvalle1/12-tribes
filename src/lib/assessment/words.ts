import { tribes } from "@/lib/tribes";

/**
 * A single selectable adjective and the tribe(s) it signals, by tribe slug.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`
 * (the authoritative backend scoring source). A word mapped to more than one tribe
 * is a "shared" word and contributes half a point to each (see `scoring.ts`).
 */
export interface WordMapping {
  word: string;
  tribes: string[];
}

/** Minimum number of words a participant must select. */
export const MIN_SELECTIONS = 8;

/** Maximum number of words a participant may select. */
export const MAX_SELECTIONS = 15;

/**
 * The flat word list, each mapped to one or more tribe slugs. Order mirrors the
 * source table; the assessment UI is responsible for presenting words in a
 * randomized order each session (per `ASSESSMENT_DESIGN.md`).
 *
 * NOTE: `ASSESSMENT_DESIGN.md` labels this "73 words", but its flat list and its
 * mapping table both contain 74 distinct words and agree with each other
 * exactly (no duplicates). The label is stale; the data is the source of truth,
 * so all 74 are transcribed here. If a 74th word was meant to be cut, the source
 * document should be corrected to indicate which one.
 */
export const WORDS: WordMapping[] = [
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
 * Asserts the word data's integrity so it can never silently drift from the
 * `tribes` source of truth. Throws (loudly, listing every offender) when:
 *  - a mapped slug does not resolve to a real tribe, or
 *  - a word is missing its tribe mapping, or
 *  - a word appears more than once.
 *
 * Accepts an explicit list for testing; defaults to the real `WORDS`.
 */
export function validateWordData(words: WordMapping[] = WORDS): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const { word, tribes: mapped } of words) {
    if (seen.has(word)) errors.push(`duplicate word "${word}"`);
    seen.add(word);

    if (mapped.length === 0) {
      errors.push(`word "${word}" maps to no tribe`);
    }
    for (const slug of mapped) {
      if (!validSlugs.has(slug)) {
        errors.push(`word "${word}" maps to unknown tribe slug "${slug}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid assessment word data:\n  ${errors.join("\n  ")}`);
  }
}
