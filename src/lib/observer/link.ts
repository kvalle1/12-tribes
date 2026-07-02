import "server-only";
import { headers } from "next/headers";

/**
 * The origin the shareable 360 observer link is built against (issue #8).
 * Prefers the configured `AUTH_URL` (trusted, set per deployment) so a forwarded
 * `Host` header can't skew the link a Subject copies; falls back to the request
 * host for local/dev where `AUTH_URL` may be unset, and finally to a relative
 * path. Shared by the result page and the comparison report so both compose the
 * link the same way.
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

/** Compose the absolute observer link for a result's share token. */
export async function observerLink(shareToken: string): Promise<string> {
  return `${await observerLinkBase()}/a/${shareToken}`;
}
