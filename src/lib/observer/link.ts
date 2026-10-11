import "server-only";
import { headers } from "next/headers";

/**
 * The absolute origin a shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment, the same origin Auth.js
 * uses) so a forwarded `Host` header can't skew the link a Subject copies;
 * falls back to the request host for local/dev where `AUTH_URL` may be unset,
 * and finally to a relative path.
 *
 * Shared by the result page (#8) and the 360 comparison report's locked state
 * (#9), both of which surface the same `/a/[token]` observer link.
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

/** The absolute `/a/[token]` observer link for a Subject's share token. */
export async function observerShareUrl(token: string): Promise<string> {
  return `${await observerLinkBase()}/a/${token}`;
}
