import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * The home-page "View your results" entry (issue #18, PRD story 16). Shown only
 * to a signed-in user who already has a saved result, and links to their profile
 * so they can return to it without retaking the assessment. Signed-out visitors,
 * and signed-in users who haven't taken the assessment yet, see nothing.
 *
 * This is an async server component: deciding whether to show the entry needs the
 * session (`auth()`) and the Account's current result (`getCurrentResult`, which
 * is `server-only`), neither of which the client can read directly. Rendering it
 * opts the home page into dynamic rendering so the entry reflects the viewer.
 */
export async function ViewResultsEntry() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const row = await getCurrentResult(session.user.id);
  if (!row) return null;

  return (
    <Link
      href="/profile"
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      View your results
    </Link>
  );
}
