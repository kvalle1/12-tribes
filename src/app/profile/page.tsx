import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile: their saved current result, reachable from the home
 * page when signed in (ADR-0004, issue #18). It reuses the shared `ResultView`
 * (issue #6) so the result reads identically here, on the post-submit page, and
 * when revisiting the saved result.
 *
 * Login-gated: an unauthenticated visitor is routed through sign-in and returned
 * here afterwards. A signed-in user who hasn't taken the assessment yet has
 * nothing to show, so they're sent to start it (the home entry that links here
 * is hidden for them, so this only happens on a direct visit).
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

        <ResultView
          words={row.words}
          primarySlug={row.primarySlug}
          secondarySlug={row.secondarySlug}
        />
      </div>
    </main>
  );
}
