import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page "View your results" entry (issue #18). Shown only to a signed-in
 * user who has a saved current result, linking them back to their profile
 * (`/profile`) without retaking the assessment. Signed-out visitors — and
 * signed-in users who haven't taken the assessment yet — see nothing.
 *
 * This is an async server component: it reads the session with `auth()` and the
 * Account's current result via the `server-only` repository, so the presence
 * check (and the word→tribe mapping behind it) never reaches the client
 * (ADR-0009 trust boundary). Rendering it from the home page personalizes that
 * route (it becomes dynamic), which is the intended behavior for a per-user
 * entry.
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
