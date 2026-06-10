import { tribes } from "@/lib/tribes";

/**
 * The Self / 360 word-selection assessment word data (issue #4).
 *
 * One flat, unlabeled list of adjectives. Each word maps to one or more tribes
 * (referenced by tribe `slug`). A word mapped to a single tribe is a "solo" word
 * worth 1 point; a word mapped to multiple tribes is a "shared" word worth 0.5
 * to each of its tribes (ASSESSMENT_DESIGN.md: "shared word, scores 0.5 to each
 * mapped tribe"). The scoring math lives in ./score.
 *
 * The list and mapping are transcribed faithfully from the table in
 * ASSESSMENT_DESIGN.md — the content source of truth. Tribe → display data lives
 * in tribes.ts; this module only references tribes by slug.
 *
 * NOTE: ASSESSMENT_DESIGN.md's summary line says "Total: 73 words", but its flat
 * list and its word→tribe mapping table each enumerate 74 distinct words (they
 * agree with each other; only the summary count is off by one). We transcribe
 * the enumerated data — all 74 words.
 */

/** Soft selection constraints — submission is gated to this inclusive range. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

export interface AssessmentWord {
  /** The adjective shown to the participant. */
  word: string;
  /** One or more tribe slugs this word maps to. */
  tribes: string[];
}

export const assessmentWords: AssessmentWord[] = [
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
 * Returns every tribe slug referenced by `wordList` that does not exist in the
 * `tribes` source of truth. An empty array means the mapping is fully resolved.
 *
 * Parameterized (with real-data defaults) so it can be exercised against both
 * the live data and fabricated bad data in tests.
 */
export function findUnknownSlugs(
  wordList: AssessmentWord[] = assessmentWords,
  validSlugs: Set<string> = new Set(tribes.map((t) => t.slug)),
): string[] {
  const unknown = new Set<string>();
  for (const { tribes: slugs } of wordList) {
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) unknown.add(slug);
    }
  }
  return [...unknown];
}

/**
 * Fails loudly if any mapped slug does not resolve against `tribes`, so the word
 * data can never silently drift from the tribe source of truth.
 */
export function validateWords(
  wordList: AssessmentWord[] = assessmentWords,
  validSlugs: Set<string> = new Set(tribes.map((t) => t.slug)),
): void {
  const unknown = findUnknownSlugs(wordList, validSlugs);
  if (unknown.length > 0) {
    throw new Error(
      `Word mapping references unknown tribe slug(s): ${unknown.join(", ")}`,
    );
  }
}
