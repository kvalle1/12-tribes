import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The signed-in user's profile — a stable place that represents their tribe
 * (PRD stories 16–17, ADR-0004). It shows the Account's single current Self
 * Assessment result via the shared `ResultView` (issue #6), so the profile
 * shows exactly the same headline, ranking bars, chosen words, and profile
 * links as the post-submit and saved-result pages.
 *
 * Login-gated, mirroring the assessment result page: an unauthenticated visitor
 * is routed through sign-in and returned here afterwards. A signed-in user who
 * hasn't taken the assessment yet is sent to start it — the home-page entry that
 * links here is hidden for them (see `ViewResultsEntry`), so this only happens
 * on a direct visit.
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
