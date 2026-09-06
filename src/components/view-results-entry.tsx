import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page entry that lets a signed-in Subject jump straight to their saved
 * result (issue #18, PRD story 16). It renders nothing for signed-out visitors
 * and for signed-in users who haven't taken the assessment yet, so the entry
 * appears only when there is actually a result to view — the profile link never
 * dead-ends.
 *
 * An async server component that reads the session and the Account's current
 * result server-side. Reflecting per-user auth state makes the home page
 * dynamic, so it's rendered behind a `<Suspense>` boundary on the home page —
 * the rest of the hero streams immediately while this auth/DB read resolves.
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
