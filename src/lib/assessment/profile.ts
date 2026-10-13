/**
 * Whether a visitor has a viewable saved result.
 *
 * Returns `true` only when the visitor is signed in (`userId` present) AND has
 * a saved current result (ADR-0004: one Account, one current result). This is
 * the single rule behind two bits of UI in issue #18:
 *
 * - the home-page "View your results" entry, shown only when this is `true`, and
 * - the profile page, which otherwise routes a signed-out visitor through
 *   sign-in and a resultless signed-in user to the assessment.
 *
 * Pure and dependency-free (no `server-only` / DB imports) so it can be unit
 * tested and reused from either a server component or the home page. The result
 * is accepted structurally — any non-null value counts as "has a result".
 */
export function canViewSavedResult(
  userId: string | null | undefined,
  result: unknown,
): boolean {
  return Boolean(userId) && result !== null && result !== undefined;
}
