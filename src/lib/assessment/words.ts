import { tribes } from "@/lib/tribes";

/**
 * The flat, unlabeled adjective list a Subject (or Observer) selects from, and
 * each Word's mapping to one or more Tribes (referenced by tribe `slug`).
 *
 * Transcribed faithfully from the Tribe Mapping table in `ASSESSMENT_DESIGN.md`.
 * Note: that document's prose says "Total: 73 words", but its own mapping table
 * (and the flat word list above it) both contain 74 consistent entries — the
 * "73" is an off-by-one miscount in the doc. The 74-row mapping table is the
 * authoritative source, so all 74 Words are transcribed here.
 *
 * A Shared word (mapped to more than one Tribe) splits its weight evenly across
 * the Tribes it maps to: 0.5 each for a two-Tribe word (per ADR-0001), and by
 * the same rule 1/3 each for the single three-Tribe word ("Zealous"). See
 * `wordWeight`.
 */
export interface WordMapping {
  /** The adjective as shown to participants. */
  word: string;
  /** Tribe slugs this word maps to (1–3), referencing `tribes`. */
  tribes: string[];
}

/** Selection constraint: a valid selection is between MIN and MAX words inclusive. */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

export const words: WordMapping[] = [
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
 * The weight a single Word contributes to each Tribe it maps to. A Word's total
 * weight is always 1.0, split evenly across its Tribes — so a one-Tribe word
 * gives 1.0, a Shared two-Tribe word gives 0.5 to each (ADR-0001), and a
 * three-Tribe word gives 1/3 to each.
 */
export function wordWeight(entry: WordMapping): number {
  return 1 / entry.tribes.length;
}

/**
 * Asserts every Word maps only to tribe slugs that exist in the `tribes` source
 * of truth, so the word data can never silently drift from the tribe model.
 * Throws with the offending word and slug if any reference is unresolved.
 * Defaults to validating the module's own `words`; an explicit list can be
 * passed (e.g. in tests) to exercise the failure path.
 */
export function validateWordMappings(entries: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  for (const entry of entries) {
    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" maps to no tribes`);
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
