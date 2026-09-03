import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page entry that lets a signed-in Subject jump straight to their saved
 * result (issue #18). It renders only when the viewer is signed in AND has a
 * saved result: signed-out visitors and signed-in users who haven't taken the
 * assessment yet see nothing here (they still get the "Take the Assessment"
 * CTA beside it).
 *
 * This is an async server component: it reads the session with `auth()` and the
 * Account's current result through the `server-only` repository, so no per-user
 * data — and none of the word→tribe mapping — ever reaches the client. Rendering
 * it opts the home page into dynamic rendering, which is correct now that the
 * page carries per-user content.
 */
export async function ResultsEntry() {
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
