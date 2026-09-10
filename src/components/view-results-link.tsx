import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Home-page "View your results" entry (issue #18). Shown only to a signed-in
 * Account that has a saved result; renders nothing otherwise.
 *
 * This is an async Server Component on purpose: the gate is "signed in AND has a
 * saved result", and whether a result exists is server-only data
 * (`getCurrentResult`, ADR-0009 trust boundary) that a client `useSession`
 * island can't see. Returning `null` on the server also means signed-out
 * visitors never see a flash of the entry before hydration. Render it inside a
 * `<Suspense>` so the static hero shell isn't blocked on the session read.
 */
export async function ViewResultsLink() {
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
