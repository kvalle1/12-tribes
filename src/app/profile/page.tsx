import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The signed-in user's Profile: their current saved Self Assessment result
 * (ADR-0004), reached from the home page's "View your results" entry (issue
 * #18) so a returning user can pick their result back up.
 *
 * Login-gated — an unauthenticated visitor is routed through sign-in and
 * brought back here afterwards; a signed-in user who hasn't taken the
 * assessment yet is sent to start it. The result is rendered by the shared
 * `ResultView` (issue #6) — the same view shown right after submitting and on
 * the saved-result page — so the profile reads identically everywhere.
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
