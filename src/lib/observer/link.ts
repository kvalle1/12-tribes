import "server-only";
import { headers } from "next/headers";

/**
 * Builds the Subject's shareable 360 Observer link (issue #8). Shared by the
 * result page (which hands the Subject their link) and the comparison report's
 * locked state (which nudges them to gather more Observers), so the URL is
 * composed the same way in both places.
 */

/**
 * The origin the shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't change the link a Subject copies; falls back to the request host
 * for local/dev where `AUTH_URL` may be unset, and finally to a relative path.
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

/** The absolute observer link for a Subject's share token. */
export async function observerShareUrl(token: string): Promise<string> {
  return `${await observerLinkBase()}/a/${token}`;
}
