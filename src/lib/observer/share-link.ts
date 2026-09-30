import "server-only";
import { headers } from "next/headers";

/**
 * Build the absolute 360 observer link for a Subject's share token (issue #8),
 * used by both the result page and the comparison report (#9).
 *
 * The origin prefers the configured `AUTH_URL` (the trusted origin Auth.js
 * uses) so a forwarded `Host` header can't skew the link a Subject copies;
 * it falls back to the request host for local/dev where `AUTH_URL` may be
 * unset, and finally to a relative path.
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

/** The absolute observer link (`<origin>/a/<token>`) for a share token. */
export async function observerShareUrl(token: string): Promise<string> {
  return `${await observerLinkBase()}/a/${token}`;
}
