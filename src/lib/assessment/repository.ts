import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { selfAssessmentResults } from "@/db/schema";

/**
 * Server-only persistence for the Account's single current Self-Assessment
 * result (ADR-0004). The `server-only` import makes importing this from a
 * client bundle a build error, so the word→tribe mapping and scoring never
 * leak to the client.
 *
 * Only the selected words are stored; tribe scores and the Primary/Secondary
 * are derived from them by the pure scoring core wherever they're rendered, so
 * `words` stays the single source of truth.
 */

export type SelfAssessmentResultRow = typeof selfAssessmentResults.$inferSelect;

/** Load the Account's current result, or null if they haven't taken it yet. */
export async function getCurrentResult(
  userId: string,
): Promise<SelfAssessmentResultRow | null> {
  const [row] = await db
    .select()
    .from(selfAssessmentResults)
    .where(eq(selfAssessmentResults.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Save the selected words as the Account's current result, overwriting any
 * previous one (ADR-0004: a single current result, no history). The shareable
 * token is minted on first save and preserved on retake (it is only set on
 * insert), so an existing 360 observer link keeps working after a Subject
 * retakes the assessment.
 */
export async function saveCurrentResult(
  userId: string,
  words: string[],
): Promise<SelfAssessmentResultRow> {
  const [row] = await db
    .insert(selfAssessmentResults)
    .values({ userId, words })
    .onConflictDoUpdate({
      target: selfAssessmentResults.userId,
      set: { words, updatedAt: new Date() },
    })
    .returning();
  return row;
}
