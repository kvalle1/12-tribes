import "server-only";
import { headers } from "next/headers";

/**
 * The origin a shareable 360 observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment, the same origin Auth.js
 * uses) so a forwarded `Host` header can't skew the copied link; falls back to
 * the request host for local/dev where `AUTH_URL` may be unset, and finally to a
 * relative path. Shared by the result page (issue #8) and the comparison page
 * (issue #9) so the link is composed the same way in both.
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
