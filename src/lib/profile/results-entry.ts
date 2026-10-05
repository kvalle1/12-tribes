/**
 * Pure gating decision for the home-page "View your results" entry (issue #18).
 *
 * The entry is a shortcut back to a Subject's saved result, so it is shown only
 * once we know the visitor is signed in *and* has a saved result. It stays
 * hidden for signed-out visitors, for signed-in users who haven't taken the
 * assessment, and while the session status is still resolving — never flashing
 * an entry that would dead-end at the assessment or at sign-in.
 *
 * Kept as a pure function (no React, no session objects) so the single bit of
 * real logic behind acceptance criteria 1 & 2 is unit-testable on its own; the
 * client component just feeds it the Auth.js status and a `hasResult` flag.
 */
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function shouldShowResultsEntry(
  status: SessionStatus,
  hasResult: boolean,
): boolean {
  return status === "authenticated" && hasResult;
}
