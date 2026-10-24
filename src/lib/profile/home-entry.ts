/**
 * Whether the home page should surface the "View your results" entry (issue
 * #18). It is shown only to a signed-in Account that already has a saved
 * result; signed-out visitors, and signed-in users who haven't taken the
 * assessment yet, don't see it.
 *
 * Kept as a pure function (no auth/db types) so the gate is unit-testable and
 * the home page just feeds it two booleans it has already resolved server-side.
 */
export function shouldShowResultsEntry(input: {
  signedIn: boolean;
  hasResult: boolean;
}): boolean {
  return input.signedIn && input.hasResult;
}
