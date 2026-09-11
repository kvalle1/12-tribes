import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * Profile page (issue #18): a signed-in user's stable home for their current
 * saved result, reachable from the home page's "View your results" entry
 * without retaking the assessment (ADR-0004).
 *
 * Login-gated: an unauthenticated visitor is routed through magic-link sign-in
 * and returned here. A signed-in user who hasn't taken the assessment yet is
 * sent to start it. The result itself is rendered by the shared `ResultView`
 * (issue #6) — the same view shown right after submitting and on the saved
 * result page — so the profile is identical to the result everywhere it appears.
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
