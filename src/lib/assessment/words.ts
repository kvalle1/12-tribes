import { tribes } from "@/lib/tribes";

/**
 * The flat, unlabelled adjective list shown to participants, with each word's
 * mapping to one or more tribes (by `slug`). Transcribed faithfully from the
 * "Tribe Mapping" table in `ASSESSMENT_DESIGN.md` — the content source of truth.
 *
 * A word mapped to a single tribe contributes its full weight to that tribe; a
 * word mapped to more than one tribe is a *shared* word and contributes 0.5 to
 * each of its tribes (see `score`). Most shared words map to two tribes; one
 * (`Zealous`) maps to three — the 0.5-per-tribe rule applies uniformly.
 *
 * Participants never see the tribe column: the list renders flat and shuffled.
 */
export interface WordMapping {
  /** The adjective exactly as presented to participants. */
  word: string;
  /** Tribe slugs this word maps to (1+). Shared words have more than one. */
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

/**
 * Selection constraints (ADR-0004 / PRD): a participant must pick within this
 * soft range before they can submit, so the result is statistically meaningful.
 * The same range is applied to 360 Observers so self and observer scores stay
 * comparable.
 */
export const MIN_WORDS = 8;
export const MAX_WORDS = 15;

/**
 * Assert that every tribe slug referenced by the given word list resolves
 * against the `tribes` source of truth, so the mapping can never silently drift
 * away from the data model. Defaults to the canonical `words`. Throws with the
 * offending words/slugs if any do not resolve (or a word maps to no tribe).
 */
export function validateWordMappings(list: WordMapping[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const problems: string[] = [];

  for (const { word, tribes: mappedSlugs } of list) {
    if (mappedSlugs.length === 0) {
      problems.push(`"${word}" maps to no tribe`);
      continue;
    }
    for (const slug of mappedSlugs) {
      if (!validSlugs.has(slug)) {
        problems.push(`"${word}" → unknown tribe slug "${slug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid word→tribe mapping(s):\n  ${problems.join("\n  ")}`,
    );
  }
}
