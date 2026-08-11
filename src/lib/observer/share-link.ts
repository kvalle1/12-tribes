import "server-only";
import { headers } from "next/headers";

/**
 * Build the Subject's absolute 360 observer link (`/a/<shareToken>`), shared by
 * the result page (issue #8) and the comparison page (issue #9) so both surfaces
 * resolve the origin identically.
 *
 * Prefers the configured `AUTH_URL` (trusted, set per deployment) so a forwarded
 * `Host` header can't skew the link a Subject copies; falls back to the request
 * host for local/dev where `AUTH_URL` may be unset, and finally to a relative
 * path. `server-only` because it reads request headers.
 */
export async function observerShareUrl(shareToken: string): Promise<string> {
  return `${await observerLinkBase()}/a/${shareToken}`;
}

/** The origin the shareable observer link is built against (see `observerShareUrl`). */
async function observerLinkBase(): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "";

  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
