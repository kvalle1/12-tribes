import "server-only";
import { headers } from "next/headers";

/**
 * Build the absolute 360 observer link for a Subject's share token (issue #8),
 * shared by the result page and the 360 report page so both compose it the same
 * way. Prefers the configured `AUTH_URL` (the trusted per-deployment origin
 * Auth.js already uses) so a forwarded `Host` header can't skew the copied link;
 * falls back to the request host for local/dev where `AUTH_URL` may be unset,
 * and finally to a relative path.
 */
export async function observerShareUrl(token: string): Promise<string> {
  return `${await observerLinkBase()}/a/${token}`;
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
