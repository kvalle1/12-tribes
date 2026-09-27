import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page "View your results" entry (issue #18, PRD story 16). It links a
 * signed-in Subject back to their profile without retaking the assessment.
 *
 * It renders only when the viewer is signed in AND has a saved result: signed-out
 * visitors and signed-in users who haven't taken the assessment yet see nothing.
 * Both facts are read server-side (`auth()` + `getCurrentResult()`), so the entry
 * reflects real account state with no client-side flash of a wrong option.
 *
 * Reading the session makes this subtree dynamic; render it inside a `<Suspense>`
 * so the otherwise-static home shell isn't blocked on the auth/DB round-trip.
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
