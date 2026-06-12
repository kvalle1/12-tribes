import { tribes } from "@/lib/tribes";

/**
 * The flat, unlabeled adjective list and its mapping to tribes — the content
 * source of truth is the "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Each word maps to one or more tribes (referenced by slug). A word mapped to a
 * single tribe contributes a full point to it; a *shared* word (mapped to more
 * than one tribe) contributes {@link SHARED_WORD_WEIGHT} to each, per ADR-0001.
 *
 * Words are stored in the document's order; presentation shuffling is the UI's
 * responsibility, not this module's.
 */
export interface AssessmentWord {
  /** The adjective shown to participants. */
  readonly word: string;
  /** Tribe slugs this word maps to (one or more), matching `tribes.ts`. */
  readonly tribes: readonly string[];
}

/** Soft selection range: a submission must pick at least this many words. */
export const MIN_SELECTIONS = 8;
/** Soft selection range: a submission must pick at most this many words. */
export const MAX_SELECTIONS = 15;

/** The weight a *shared* word contributes to each of its mapped tribes. */
export const SHARED_WORD_WEIGHT = 0.5;

/**
 * The points a single word contributes to *each* of its mapped tribes: a full
 * point when the word belongs to one tribe, {@link SHARED_WORD_WEIGHT} when it
 * is shared across two or more.
 */
export function wordWeight(word: AssessmentWord): number {
  return word.tribes.length === 1 ? 1 : SHARED_WORD_WEIGHT;
}

/**
 * The adjective list with its tribe mapping, transcribed faithfully from the
 * "Tribe Mapping" table in `ASSESSMENT_DESIGN.md`.
 *
 * Note: the document's prose header says "73 words", but the mapping table (and
 * the flat list above it) both enumerate 74 entries that agree with each other;
 * the 74 below match the table exactly. `Zealous` is the one word mapped to
 * three tribes — the 0.5-per-shared-mapping rule is applied to it uniformly.
 */
export const words: readonly AssessmentWord[] = [
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
 * Asserts a word list is internally sound and consistent with `tribes.ts`:
 * every mapped slug resolves to a real tribe, no word is empty, and no word is
 * duplicated. Throws an `Error` describing every problem found so the data can
 * never silently drift from the source of truth. Defaults to validating the
 * shipped {@link words}; accepts an explicit list for testing.
 */
export function validateWordData(wordList: readonly AssessmentWord[] = words): void {
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of wordList) {
    if (!entry.word.trim()) {
      problems.push("Found a word with an empty label.");
    }
    if (seen.has(entry.word)) {
      problems.push(`Duplicate word: "${entry.word}".`);
    }
    seen.add(entry.word);

    if (entry.tribes.length === 0) {
      problems.push(`"${entry.word}" is not mapped to any tribe.`);
    }
    for (const slug of entry.tribes) {
      if (!validSlugs.has(slug)) {
        problems.push(
          `"${entry.word}" references unknown tribe slug "${slug}".`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Assessment word data is invalid:\n- ${problems.join("\n- ")}`,
    );
  }
}

// Fail loudly at module load (build, dev, and test) if the data ever drifts.
validateWordData();
