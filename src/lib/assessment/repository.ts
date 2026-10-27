import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentResults } from "@/db/schema";
import { WORDS } from "./words";
import { isWithinSelectionRange } from "./selection";
import { deriveResult, score } from "./score";

/**
 * Server-only persistence for the Account's single current Self Assessment
 * result (ADR-0004). The `server-only` import makes importing this from a client
 * bundle a build error, so scoring never runs on — and the word→tribe mapping
 * never reaches — the client (ADR-0009 trust boundary).
 */

export type AssessmentResultRow = typeof assessmentResults.$inferSelect;

const KNOWN_WORDS = new Set(WORDS.map((w) => w.word));

/**
 * Compute the result for a Subject's selected words and save it as the Account's
 * current result, overwriting any previous one. Unknown words are dropped and
 * duplicates collapsed before the count is gated to the 8–15 range (the same
 * gate the UI enforces, re-checked here so an out-of-range submission can't slip
 * past). Returns the saved row, or `null` if the selection is out of range.
 *
 * On retake the existing row is updated in place — the `shareToken` is left
 * untouched so any observer link already handed out keeps resolving (issue #8).
 */
export async function saveCurrentResult(
  userId: string,
  selectedWords: readonly string[],
): Promise<AssessmentResultRow | null> {
  const words = [...new Set(selectedWords)].filter((w) => KNOWN_WORDS.has(w));
  if (!isWithinSelectionRange(words.length)) return null;

  const { primary, secondary } = deriveResult(score(words));

  const [row] = await db
    .insert(assessmentResults)
    .values({
      userId,
      words,
      primarySlug: primary.slug,
      secondarySlug: secondary?.slug ?? null,
    })
    .onConflictDoUpdate({
      target: assessmentResults.userId,
      set: {
        words,
        primarySlug: primary.slug,
        secondarySlug: secondary?.slug ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

/** Load the Account's current result, or `null` if they haven't taken it yet. */
export async function getCurrentResult(
  userId: string,
): Promise<AssessmentResultRow | null> {
  const [row] = await db
    .select()
    .from(assessmentResults)
    .where(eq(assessmentResults.userId, userId))
    .limit(1);
  return row ?? null;
}
