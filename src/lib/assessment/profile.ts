/**
 * Whether the home page shows its "View your results" entry — the way a Subject
 * returns to their saved result from the home page (issue #18). The entry is a
 * shortcut into an already-existing result, so it appears only when there is one
 * to return to: the visitor is signed in *and* has a saved Self Assessment
 * result. Signed-out visitors, and signed-in users who haven't taken the
 * assessment yet, never see it.
 *
 * A pure predicate so the visibility rule is unit-testable independently of the
 * server-component wiring (`auth()` + `getCurrentResult`) that feeds it.
 */
export function shouldShowResultsEntry({
  signedIn,
  hasResult,
}: {
  signedIn: boolean;
  hasResult: boolean;
}): boolean {
  return signedIn && hasResult;
}
