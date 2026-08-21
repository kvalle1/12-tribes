/**
 * The Account's profile — the signed-in user's stable home for their saved
 * tribe result (issue #18, ADR-0004). This module holds the small, pure rules
 * the profile feature depends on so they can be unit-tested and reused by both
 * the home page and the profile page without pulling in server-only data access.
 */

/** Where the profile lives, and the sign-in callback target for it. */
export const PROFILE_PATH = "/profile";

/**
 * Whether the personalized "View your results" entry should appear on the home
 * page. It is shown only to a signed-in user who has a saved result, and hidden
 * for signed-out visitors and for signed-in users who haven't taken the
 * assessment yet (issue #18 acceptance criteria 1–2). The sign-in gate
 * dominates: a result flag can never surface the entry for a signed-out visitor.
 */
export function shouldShowResultsEntry(
  isSignedIn: boolean,
  hasResult: boolean,
): boolean {
  return isSignedIn && hasResult;
}
