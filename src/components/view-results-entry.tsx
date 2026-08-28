import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { shouldShowResultsEntry } from "@/lib/assessment/profile";

/**
 * The home-page "View your results" entry (issue #18): a shortcut back to the
 * Subject's saved result via the profile page. Rendered as an async server
 * component so the visibility check runs on the server — it reads the session
 * (`auth()`) and only touches the result store when signed in — and returns
 * nothing for anyone who shouldn't see it (signed-out visitors, or signed-in
 * users who haven't taken the assessment yet).
 */
export async function ViewResultsEntry() {
  // This renders on the otherwise-static landing page, so a transient failure
  // reading the session or the result store must never take the home page down
  // with it — degrade to simply not showing the entry.
  let signedIn = false;
  let hasResult = false;
  try {
    const session = await auth();
    const userId = session?.user?.id;
    signedIn = Boolean(userId);
    hasResult = userId ? Boolean(await getCurrentResult(userId)) : false;
  } catch {
    return null;
  }

  if (!shouldShowResultsEntry({ signedIn, hasResult })) {
    return null;
  }

  return (
    <Link
      href="/profile"
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      View your results
    </Link>
  );
}
