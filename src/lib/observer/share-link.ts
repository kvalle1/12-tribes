import "server-only";
import { headers } from "next/headers";

/**
 * The origin the shareable 360 observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't skew the link a Subject copies; falls back to the request host
 * for local/dev where `AUTH_URL` may be unset, and finally to a relative path.
 *
 * Shared by the Subject's result page (issue #8) and the 360 report (issue #9),
 * both of which surface the same invite link, so the composition lives here once.
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

/** The absolute shareable observer link for a Subject's opaque `token`. */
export async function observerShareUrl(token: string): Promise<string> {
  return `${await observerLinkBase()}/a/${token}`;
}
