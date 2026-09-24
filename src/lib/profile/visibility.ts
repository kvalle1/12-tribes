/**
 * Single source of truth for whether the home page shows the "View your
 * results" entry that links to the profile page (issue #18).
 *
 * The entry is a shortcut back to a result the Account has already saved, so it
 * is shown only when a signed-in user actually has one. A signed-out visitor
 * never sees it (they have no Account to key a result to), and a signed-in user
 * who hasn't taken the assessment has nothing to link to yet. Kept as a pure
 * function so the rule can be unit-tested independently of the page's data
 * fetching (auth + `getCurrentResult`).
 */
export function shouldShowResultsEntry(state: {
  signedIn: boolean;
  hasResult: boolean;
}): boolean {
  return state.signedIn && state.hasResult;
}
