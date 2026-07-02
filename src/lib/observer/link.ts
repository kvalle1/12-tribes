import "server-only";
import { headers } from "next/headers";

/**
 * Builds the absolute 360 observer share URL for a Subject's token. Shared by
 * the result page and the comparison report's locked state so the trusted-origin
 * logic can't drift between them.
 *
 * The origin prefers the configured `AUTH_URL` (trusted, set per deployment) so
 * a forwarded `Host` header can't skew the link a Subject copies; it falls back
 * to the request host for local/dev where `AUTH_URL` may be unset, and finally
 * to a relative path.
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

/** The absolute observer link a Subject shares to invite anonymous Observers. */
export async function observerShareUrl(token: string): Promise<string> {
  return `${await observerLinkBase()}/a/${token}`;
}
