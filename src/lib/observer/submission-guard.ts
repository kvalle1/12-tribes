/**
 * Pure decision for whether to accept an anonymous 360 Observer submission
 * (issue #193).
 *
 * The 360 model deliberately stores **no** observer identity (ADR-0003), and the
 * comparison report only unlocks once at least three reads are in (#9). That gate
 * is what keeps a thin set of answers from singling anyone out — but with nothing
 * stopping repeat submissions, a Subject could open their own share link and
 * submit three times to self-unlock it, after which the "anonymous" drill-down
 * trivially identifies each self-authored read. These two guards raise that bar
 * without recording who an Observer is:
 *
 *  - `self` — the signed-in viewer *is* the Subject the link belongs to, so the
 *    submission would be the Subject scoring themselves under the "others" view.
 *  - `duplicate` — this browser has already recorded a read for this link
 *    (tracked by a per-link cookie — never a server-side identity).
 *
 * Neither is an absolute guarantee (a Subject can sign out, or clear cookies /
 * use another browser), which is exactly why the report copy now describes
 * anonymity as best-effort rather than promising it. Keeping the decision pure
 * lets the precedence be unit-tested; the cookie and session plumbing live in the
 * request-scoped server action.
 */
export type ObserverSubmissionRejection = "self" | "duplicate";

export function observerSubmissionRejection(opts: {
  /** The signed-in viewer's user id, or null/undefined when not signed in. */
  viewerUserId: string | null | undefined;
  /** The Subject the share link belongs to. */
  subjectId: string;
  /** Whether this browser already recorded a read for this link (per-link cookie). */
  alreadyRespondedFromBrowser: boolean;
}): ObserverSubmissionRejection | null {
  const { viewerUserId, subjectId, alreadyRespondedFromBrowser } = opts;

  // The Subject scoring themselves is the exploit this guards against; it takes
  // precedence so the reason reported is the meaningful one.
  if (viewerUserId && viewerUserId === subjectId) return "self";
  if (alreadyRespondedFromBrowser) return "duplicate";
  return null;
}

/**
 * Cookie name marking that this browser already recorded a read for `token`.
 * Keyed per share token (stable across retakes, ADR-0012) so one read per browser
 * per Subject is tracked while storing nothing server-side. Share tokens are v4
 * UUIDs, so the name stays cookie-safe.
 */
export function observerResponseCookieName(token: string): string {
  return `ti_obs_${token}`;
}
