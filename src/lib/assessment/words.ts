import { tribes } from "@/lib/tribes";

/**
 * A single adjective from the flat assessment word list, mapped to the
 * tribe(s) it scores for (referenced by `tribes` slug).
 *
 * A word mapped to a single tribe scores a full point to it; a word shared
 * across multiple tribes scores 0.5 to each (see `assessment/score`). Most
 * shared words map to two tribes; "Zealous" maps to three.
 */
export interface AssessmentWord {
  word: string;
  tribes: string[];
}

/**
 * Selection constraint shown to the Subject (and applied to Observers). The
 * range is soft guidance in the UI, hard-gated on submission so self and
 * observer scores stay comparable.
 */
export const SELECTION_MIN = 8;
export const SELECTION_MAX = 15;

/**
 * The flat assessment word list and each word's tribe mapping, transcribed
 * from the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md` (the backend
 * scoring source of truth).
 *
 * Note: that document's prose header says "Total: 73 words", but its mapping
 * table (and flat list) actually enumerate 74 — the header is an off-by-one.
 * The 74 mapped rows below are the authoritative data.
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
 * from the `tribes` source of truth. Throws on the first problem found:
 *  - a word with no tribe mapping,
 *  - a duplicate word,
 *  - a mapped slug that does not exist in `tribes`.
 */
export function validateWords(list: AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((tribe) => tribe.slug));
  const seen = new Set<string>();

  for (const entry of list) {
    if (entry.tribes.length === 0) {
      throw new Error(`Word "${entry.word}" is not mapped to any tribe`);
    }
    if (seen.has(entry.word)) {
      throw new Error(`Duplicate word in list: "${entry.word}"`);
    }
    seen.add(entry.word);

    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        throw new Error(
          `Word "${entry.word}" references unknown tribe slug "${slug}"`,
        );
      }
    }
  }
}
