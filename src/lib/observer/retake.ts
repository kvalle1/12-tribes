/**
 * Scope a Subject's Observer responses to their *current* result (issue #194,
 * ADR-0012).
 *
 * A retake overwrites the single `assessment_result` row in place and keeps the
 * `shareToken`, so links already handed out keep working (#8). But the
 * comparison report sets the Subject's *current* self words beside the "others"
 * profile, so a read gathered before the retake would be compared against
 * answers it never saw. We therefore count only responses recorded at or after
 * the moment the current result was taken; earlier ones are kept in the
 * database (nothing is destroyed) but left out of the comparison, and their
 * count is surfaced so the Subject knows why the report may have re-locked.
 */
export function partitionByRetake<T extends { readonly createdAt: Date }>(
  responses: readonly T[],
  resultTakenAt: Date,
): { current: T[]; staleCount: number } {
  const takenAt = resultTakenAt.getTime();
  const current = responses.filter((r) => r.createdAt.getTime() >= takenAt);
  return { current, staleCount: responses.length - current.length };
}
