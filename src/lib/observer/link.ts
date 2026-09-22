import "server-only";
import { headers } from "next/headers";

/**
 * The origin a shareable 360 observer link is built against (issue #8). Prefers
 * the configured `AUTH_URL` — the same trusted origin Auth.js uses — so a
 * forwarded `Host` header can't skew the link a Subject copies; falls back to
 * the request host for local/dev where `AUTH_URL` may be unset, and finally to a
 * relative path. Shared by the result page and the 360 comparison report so both
 * mint the identical link.
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

/** The absolute observer link for a Subject's `shareToken`. */
export async function observerShareUrl(shareToken: string): Promise<string> {
  return `${await observerLinkBase()}/a/${shareToken}`;
}
