import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page "View your results" entry (issue #18, PRD stories 16–17). Rendered on
 * the server so it can gate on BOTH the session and whether a saved result exists:
 * it links to the profile only for a signed-in Account that has already taken the
 * assessment (ADR-0004). Signed-out visitors — and signed-in users who haven't
 * taken it yet — see nothing.
 *
 * Reading the session via `auth()` (cookies) opts the home route into dynamic
 * rendering; that's the cost of gating on the current Account. It renders as a
 * sibling of the other nav links, inheriting the nav's typography and adding only
 * the hover treatment.
 *
 * This entry is non-critical chrome, so it fails safe: any error reading the
 * session or the saved result renders nothing rather than taking down the home
 * page (which has no error boundary of its own).
 */
export async function ProfileEntry() {
  let hasResult = false;
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    hasResult = (await getCurrentResult(session.user.id)) !== null;
  } catch {
    return null;
  }
  if (!hasResult) return null;

  return (
    <Link href="/profile" className="transition-colors hover:text-ink">
      View your results
    </Link>
  );
}
