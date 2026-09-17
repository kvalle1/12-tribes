import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page entry that links a signed-in user to their saved result (PRD story
 * 16). It renders nothing for signed-out visitors, and nothing for signed-in
 * users who haven't taken the assessment yet — so the "View your results" link
 * appears only when there is actually a result at /profile to view.
 *
 * This is an async server component: it reads the session and looks up the saved
 * result server-side (the lookup is `server-only`), so the gating can't be
 * spoofed from the client. Because it awaits `auth()` (which reads cookies), the
 * home route renders dynamically per request rather than being fully static.
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
