import { tribes } from "../tribes";

/**
 * A single adjective on the flat selection list, mapped to the tribe(s) it
 * signals. Most words map to one tribe; a {@link isShared shared} word maps to
 * two (and "Zealous" to three). Mappings reference tribes by `slug` — the
 * `tribes` array in `tribes.ts` is the source of truth.
 */
export interface Word {
  /** The adjective as shown to the participant. */
  word: string;
  /** Tribe slugs this word signals. Length 1 = solo, >1 = shared. */
  tribes: string[];
}

/** Soft selection range — submission is gated to this many words (PRD). */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * The flat word list and its word→tribe mapping, transcribed from the
 * "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Note: that document's prose says "Total: 73 words", but its mapping table
 * (and the visible word list above it) actually contain 74 distinct words —
 * the summary line miscounts. The mapping table is the authoritative artifact,
 * so all 74 rows are transcribed here verbatim.
 */
export const words: Word[] = [
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

/** A word is "shared" when it maps to more than one tribe. */
export function isShared(word: Word): boolean {
  return word.tribes.length > 1;
}

/**
 * Assert the word data is internally consistent against the `tribes` source of
 * truth. Throws (fails loudly) if any word references a tribe slug that does
 * not exist, so the data can never silently drift from `tribes.ts`. Defaults to
 * the module's {@link words} list; accepts an explicit list for testing.
 */
export function validateWords(list: Word[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const { word, tribes: slugs } of list) {
    if (slugs.length === 0) {
      throw new Error(`Word "${word}" maps to no tribes`);
    }
    for (const slug of slugs) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
