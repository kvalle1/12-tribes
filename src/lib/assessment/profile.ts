/**
 * Gating rule for the home page's "View your results" entry (issue #18).
 *
 * The entry is a shortcut back to the signed-in Subject's saved profile, so it
 * only makes sense when the visitor is both signed in and actually has a saved
 * result. Signed-out visitors, and signed-in users who haven't taken the
 * assessment yet, don't see it. Kept pure (no auth/DB imports) so the rule is
 * unit-testable and can't drift from the acceptance criteria.
 */
export function shouldShowResultsLink({
  signedIn,
  hasResult,
}: {
  signedIn: boolean;
  hasResult: boolean;
}): boolean {
  return signedIn && hasResult;
}
