/**
 * Resolve the name an Observer is shown when describing a Subject. Pure and
 * client-safe so it can be unit-tested without the DB.
 *
 * Magic-link sign-in (ADR-0005) only requires an email, so a Subject's `name`
 * is often null. We fall back to the email's local part, and finally to a
 * neutral phrase, so the observer prompt ("Select the words that best describe
 * …") always reads naturally. This name describes the *Subject*; it never
 * identifies the anonymous Observer.
 */
export function observerDisplayName(
  name?: string | null,
  email?: string | null,
): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const localPart = email?.split("@")[0]?.trim();
  if (localPart) return localPart;

  return "this person";
}
