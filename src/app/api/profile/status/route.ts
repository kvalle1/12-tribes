import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Whether the signed-in viewer has a saved Self Assessment result.
 *
 * Backs the home-page "View your results" entry (issue #18): the entry is a
 * Client Component so the home page can stay static (mirroring `AuthNav`), and
 * it needs one server-truth bit — does this account have a result — to decide
 * whether to show. Scoring/word data never crosses to the client; only the
 * boolean does. An unauthenticated caller simply gets `false` (no leak, no 401
 * noise) — the client only calls this once the session is authenticated.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ hasResult: false });
  }

  const row = await getCurrentResult(session.user.id);
  return Response.json({ hasResult: Boolean(row) });
}
