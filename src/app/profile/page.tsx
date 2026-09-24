import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The profile page: a signed-in user's way back to their saved result from the
 * home page (issue #18, ADR-0004). It reuses the shared `ResultView` (issue #6),
 * so the result reads identically here, on the post-submit page, and on the
 * saved-result revisit.
 *
 * Login-gated: an unauthenticated visitor is routed through sign-in and returned
 * here afterwards. A signed-in user who hasn't taken the assessment yet has no
 * result to show, so they're sent to start it.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <p className="mb-2 text-[12px] uppercase tracking-[0.2em] text-faint">
          Your profile
        </p>

        <ResultView
          words={row.words}
          primarySlug={row.primarySlug}
          secondarySlug={row.secondarySlug}
        />
      </div>
    </main>
  );
}
