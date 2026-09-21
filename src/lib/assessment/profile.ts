/**
 * Visibility rule for the home-page "View your results" entry (issue #18).
 *
 * The entry links a returning Account back to its saved result. It is shown
 * only to a signed-in user who already has a saved result — hidden for
 * signed-out visitors and for signed-in users who haven't taken the assessment
 * yet. Kept as a pure predicate (no auth/DB access) so the rule is unit-tested
 * in isolation and reused wherever the entry is rendered.
 */
export function shouldShowResultsEntry({
  userId,
  hasResult,
}: {
  userId: string | null | undefined;
  hasResult: boolean;
}): boolean {
  return Boolean(userId) && hasResult;
}
