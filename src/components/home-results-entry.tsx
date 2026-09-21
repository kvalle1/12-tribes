import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { shouldShowResultsEntry } from "@/lib/assessment/profile";

/**
 * The home-page "View your results" entry (issue #18).
 *
 * An async server component so the visibility decision stays on the server: it
 * reads the session (`auth()`) and checks for a saved result, and renders the
 * link into `/profile` only for a signed-in Account that has one. It returns
 * `null` for signed-out visitors and for signed-in users who haven't taken the
 * assessment, so nothing about the word→tribe mapping or another user's state
 * reaches the client. Rendering it opts the home route into dynamic rendering
 * (it depends on the request's session), which is expected for auth-aware UI.
 */
export async function HomeResultsEntry() {
  const session = await auth();
  const userId = session?.user?.id;
  const hasResult = userId ? (await getCurrentResult(userId)) !== null : false;

  if (!shouldShowResultsEntry({ userId, hasResult })) return null;

  return (
    <Link
      href="/profile"
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      View your results
    </Link>
  );
}
