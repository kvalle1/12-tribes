import "server-only";
import { headers } from "next/headers";

/**
 * Compose the absolute shareable 360 observer link for a Subject's `shareToken`
 * (issue #8). Shared by the result page and the comparison report's locked
 * state so the link a Subject copies is built the same way in both places.
 *
 * Prefers the canonical configured origin (`AUTH_URL`, the same trusted origin
 * Auth.js uses) so a forwarded `Host` header can't skew the copied link; falls
 * back to the request host for local/dev where `AUTH_URL` may be unset, and
 * finally to a relative path.
 */
export async function observerLinkFor(shareToken: string): Promise<string> {
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
