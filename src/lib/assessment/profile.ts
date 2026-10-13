/**
 * Whether a visitor has a viewable saved result.
 *
 * Returns `true` only when the visitor is signed in (`userId` present) AND has
 * a saved current result (ADR-0004: one Account, one current result).
 *
 * This is the rule behind the home-page "View your results" entry, which is
 * shown only when this is `true` (issue #18). The profile page enforces the
 * same rule but inline, because it needs two different redirects for the two
 * negative cases — a signed-out visitor goes through sign-in, a resultless
 * signed-in user is sent to the assessment — rather than a single boolean.
 *
 * Pure and dependency-free (no `server-only` / DB imports) so it can be unit
 * tested and called from a server component. The result is accepted
 * structurally — any non-null value counts as "has a result".
 */
export function canViewSavedResult(
  userId: string | null | undefined,
  result: unknown,
): boolean {
  return Boolean(userId) && result !== null && result !== undefined;
}
