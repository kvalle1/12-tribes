import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentResults } from "@/db/schema";
import { deriveResult, score } from "./score";

/**
 * Server-only persistence for the Account's single current Self Assessment
 * result (ADR-0004: one current result, overwritten on retake).
 *
 * The pure scoring core (`score` / `deriveResult`) is reused verbatim — this
 * layer only computes from a sanitized selection, upserts, and reads back.
 */

export type AssessmentResultRow = typeof assessmentResults.$inferSelect;

/**
 * Score a (already sanitized) word selection and persist it as the user's
 * current result, overwriting any previous one. The shareable `token` is minted
 * by the column default on first insert and left untouched on retake so a
 * previously shared link keeps working.
 */
export async function saveCurrentResult(
  userId: string,
  words: string[],
): Promise<AssessmentResultRow> {
  const result = deriveResult(score(words));

  const [row] = await db
    .insert(assessmentResults)
    .values({ userId, words, result })
    .onConflictDoUpdate({
      target: assessmentResults.userId,
      set: { words, result, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/** Load the user's current result, or null if they have not taken the assessment. */
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
