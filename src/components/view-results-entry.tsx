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
 *
 * The entry is best-effort: it's the only thing on the (previously fully static)
 * home page that touches the session and the database, so a transient auth/DB
 * failure is swallowed and nothing is rendered — the home page degrades to its
 * prior state (no entry) instead of erroring the whole page.
 */
export async function ViewResultsEntry() {
  // Resolve the gate (signed in AND has a saved result) inside the try/catch,
  // but build no JSX here — a swallowed render error would be an anti-pattern
  // (that's what error boundaries are for). A transient auth/DB failure simply
  // leaves the gate closed and renders nothing.
  let hasResult = false;
  try {
    const session = await auth();
    if (session?.user?.id) {
      hasResult = (await getCurrentResult(session.user.id)) !== null;
    }
  } catch {
    return null;
  }

  if (!hasResult) return null;

  return (
    <Link
      href="/profile"
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      View your results
    </Link>
  );
}
