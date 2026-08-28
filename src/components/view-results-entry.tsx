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
  const session = await auth();
  const userId = session?.user?.id;
  const hasResult = userId ? Boolean(await getCurrentResult(userId)) : false;

  if (!shouldShowResultsEntry({ signedIn: Boolean(userId), hasResult })) {
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
