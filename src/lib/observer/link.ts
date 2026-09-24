import "server-only";
import { headers } from "next/headers";

/**
 * The absolute origin a shareable 360 observer link is built against. Prefers
 * the configured `AUTH_URL` (trusted, set per deployment — the same origin
 * Auth.js uses) so a forwarded `Host` header can't skew the link a Subject
 * copies; falls back to the request host for local/dev where `AUTH_URL` may be
 * unset, and finally to a relative path. Server-only (reads request headers).
 *
 * Shared by the result page (which mints the link) and the comparison report's
 * locked state (which re-offers it to gather more observers), so both build the
 * same URL from one source of truth.
 */
export async function observerLinkBase(): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "";

  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Build the absolute observer link for a Subject's `shareToken`. */
export async function observerShareUrl(shareToken: string): Promise<string> {
  return `${await observerLinkBase()}/a/${shareToken}`;
}
