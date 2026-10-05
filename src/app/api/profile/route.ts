import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Whether the signed-in Account has a saved Self Assessment result (issue #18).
 *
 * The home-page "View your results" entry is a client component (so the home
 * page can stay static), and it needs one server-side fact to decide whether to
 * render: does the current user have a result? This endpoint answers exactly
 * that and nothing more — only a boolean crosses the trust boundary, never the
 * words, slugs, or any scoring detail. A signed-out request is simply `false`
 * rather than a 401: the caller only wants to know whether to show a shortcut.
 *
 * Reading the session makes this handler dynamic (never cached on the server),
 * so the answer always reflects the current account. The response is also
 * marked `no-store` so a per-user answer can't be held by the browser or any
 * intermediary and shown to a different account.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;

  const hasResult = userId ? (await getCurrentResult(userId)) !== null : false;

  return Response.json({ hasResult }, { headers: { "Cache-Control": "no-store" } });
}
