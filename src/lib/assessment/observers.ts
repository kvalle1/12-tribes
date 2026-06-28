import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentResults, observerResponses, users } from "@/db/schema";
import { normalizeSelection } from "./selection";

/**
 * Server-only persistence for the 360 Observer flow (issue #8, ADR-0003). The
 * `server-only` import keeps the word→tribe mapping and these queries off the
 * client (ADR-0009). Observers are fully anonymous — only the Subject they
 * describe and the words they pick are stored, never any Observer identity.
 */

/** The Subject an observer link points at — enough to render the prompt. */
export interface ObserverSubject {
  /** The Subject's user id (the `subjectId` an observer response is tied to). */
  subjectId: string;
  /** A display name for the prompt, falling back to a neutral label. */
  name: string;
}

/**
 * Resolve a shareable token to the Subject it belongs to, or `null` if the token
 * is unknown. The token is the opaque `shareToken` minted with the Subject's
 * current result. The Subject's email is deliberately never returned — only a
 * name for the "describe [Name]" prompt, with a neutral fallback when the
 * account has no name.
 */
export async function getSubjectByShareToken(
  token: string,
): Promise<ObserverSubject | null> {
  if (!token) return null;

  const [row] = await db
    .select({ subjectId: assessmentResults.userId, name: users.name })
    .from(assessmentResults)
    .innerJoin(users, eq(users.id, assessmentResults.userId))
    .where(eq(assessmentResults.shareToken, token))
    .limit(1);

  if (!row) return null;
  return { subjectId: row.subjectId, name: row.name?.trim() || "this person" };
}

/** Outcome of recording an observer response, for the action to branch on. */
export type RecordObserverOutcome = "ok" | "invalid-token" | "out-of-range";

/**
 * Record one anonymous observer response against the Subject identified by
 * `token`. The selection is sanitized and gated to the same 8–15 range as the
 * Subject's own (via `normalizeSelection`), so self and observer scores stay
 * comparable. Returns `invalid-token` for an unknown token and `out-of-range`
 * for a selection outside the range — neither writes a row.
 */
export async function recordObserverResponse(
  token: string,
  selectedWords: readonly string[],
): Promise<RecordObserverOutcome> {
  const subject = await getSubjectByShareToken(token);
  if (!subject) return "invalid-token";

  const words = normalizeSelection(selectedWords);
  if (!words) return "out-of-range";

  await db
    .insert(observerResponses)
    .values({ subjectId: subject.subjectId, words });

  return "ok";
}
