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
 * rendering, matching the rest of the authenticated surface (`/account`,
 * `/assessment/result`). It renders as a sibling of the other nav links, so it
 * inherits the nav's typography and only adds the hover treatment.
 */
export async function ProfileEntry() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const row = await getCurrentResult(session.user.id);
  if (!row) return null;

  return (
    <Link href="/profile" className="transition-colors hover:text-ink">
      View your results
    </Link>
  );
}
