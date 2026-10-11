import "server-only";
import { headers } from "next/headers";

/**
 * Build the absolute shareable 360 Observer link for a result's `shareToken`
 * (issue #8). Shared by the result page and the comparison report's locked state
 * so both compose the link the same way.
 *
 * Prefers the configured `AUTH_URL` (the trusted origin Auth.js uses) so a
 * forwarded `Host` header can't skew the link a Subject copies; falls back to the
 * request host for local/dev where `AUTH_URL` may be unset, and finally to a
 * relative path.
 */
export async function observerShareUrl(shareToken: string): Promise<string> {
  return `${await observerLinkBase()}/a/${shareToken}`;
}

async function observerLinkBase(): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "";

  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
