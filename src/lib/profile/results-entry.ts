/**
 * Whether the home-page "View your results" entry should be shown (issue #18).
 *
 * The entry links a returning Subject to their profile, so it only makes sense
 * for a signed-in user who actually has a saved result. It is hidden for
 * signed-out visitors and for signed-in users who haven't taken the assessment
 * yet. Kept as a pure, client-safe helper so the visibility rule is a single
 * tested source of truth and never drifts between the home page and its tests.
 */
export function showResultsEntry({
  signedIn,
  hasResult,
}: {
  signedIn: boolean;
  hasResult: boolean;
}): boolean {
  return signedIn && hasResult;
}
