import { createHash } from "node:crypto";

/**
 * Anti-abuse helpers for the anonymous 360 Observer flow (issue #193).
 *
 * The ≥3-Observer unlock gate (ADR-0003) only protects anonymity if those three
 * reads come from three different people. Without any guard a Subject can open
 * their own share link a few times and self-seed the gate, after which the
 * "anonymous" per-observer drill-down is trivially de-anonymized (every read is
 * theirs). These helpers raise the bar against that self-seeding while keeping
 * the `observer_response` row identity-free — no IP, no identity is persisted,
 * so observer candor (ADR-0003) is preserved.
 *
 * This module deliberately imports neither `server-only` nor `@/db`: it holds
 * only pure decision logic so it can be unit-tested and reused by both the
 * repository (the Subject block) and the Server Action (the per-browser cookie).
 */

/**
 * Whether a submission is the Subject answering about themselves. A signed-in
 * visitor whose user id is the Subject's must not be allowed to contribute an
 * "observer" read — that is exactly the self-seeding the ≥3 gate assumes away.
 * Anonymous (signed-out) submitters have no id and are never flagged here.
 */
export function isSelfSubmission(
  submitterUserId: string | null | undefined,
  subjectId: string,
): boolean {
  return Boolean(submitterUserId) && submitterUserId === subjectId;
}

/**
 * The name of the per-browser "already responded" cookie for a given share
 * token. Derived from a one-way hash of the token so the cookie name leaks
 * nothing — not the token itself, and so not the Subject it resolves to — and so
 * each token gets its own stable, RFC 6265-safe cookie name (hex only). The
 * cookie is a one-response marker: it carries no identity, it only records that
 * this browser has already submitted for this link.
 */
export function observerCookieName(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `obs_${digest}`;
}
