import { tribes, type Tribe } from "@/lib/tribes";

/**
 * The assessment word data — the single source of truth for the flat adjective
 * list shown to a Subject and the mapping from each Word to the Tribe(s) it
 * signals.
 *
 * Transcribed faithfully from the "Tribe Mapping" table in
 * `ASSESSMENT_DESIGN.md`. Tribes are referenced by `slug` so the data is
 * checked against the `tribes` source of truth by {@link validateWordMappings}.
 *
 * Note on count: `ASSESSMENT_DESIGN.md` titles the list "Total: 73 words", but
 * the flat list and the mapping table it derives from both contain 74 entries
 * (the header is off by one). We transcribe the actual 74 mappings; see
 * {@link WORD_COUNT}.
 *
 * A Word mapped to more than one Tribe is a "Shared word" and contributes half
 * weight (0.5) to each (ADR-0001). Most shared words map to two Tribes; "Zealous"
 * maps to three, and the same 0.5-per-Tribe rule applies (per the table legend).
 */
export interface WordMapping {
  /** The adjective exactly as presented on the flat list. */
  word: string;
  /** The slug(s) of the Tribe(s) this Word signals. One or more. */
  tribes: string[];
}

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

/** The number of Words on the flat list (74; the doc header's "73" is off by one). */
export const WORD_COUNT = words.length;

/**
 * Selection constraint (ADR/PRD): a Subject (or Observer) must select between
 * {@link MIN_SELECTIONS} and {@link MAX_SELECTIONS} words for a result to be
 * statistically meaningful. Submission is gated to this range.
 */
export const MIN_SELECTIONS = 8;
export const MAX_SELECTIONS = 15;

/** The flat list of adjectives, in canonical (unshuffled) order. */
export function wordList(): string[] {
  return words.map((m) => m.word);
}

/**
 * Asserts that every Tribe slug referenced by the word mappings resolves to a
 * real Tribe in the `tribes` source of truth, so the data can never silently
 * drift. Throws loudly (listing the offenders) on any unknown slug.
 */
export function validateWordMappings(
  mappings: WordMapping[] = words,
  tribeList: Tribe[] = tribes,
): void {
  const known = new Set(tribeList.map((t) => t.slug));
  const offenders: string[] = [];

  for (const { word, tribes: slugs } of mappings) {
    if (slugs.length === 0) {
      offenders.push(`"${word}" maps to no tribe`);
      continue;
    }
    for (const slug of slugs) {
      if (!known.has(slug)) {
        offenders.push(`"${word}" → unknown tribe slug "${slug}"`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `Invalid word→tribe mappings:\n  ${offenders.join("\n  ")}`,
    );
  }
}
