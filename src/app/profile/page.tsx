import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The profile page (issue #18, PRD story 17): a stable place that represents
 * the signed-in user's tribe, reachable from the home "View your results"
 * entry. It renders the Account's current saved result through the shared
 * `ResultView` (issue #6) — the same view used right after submitting and on
 * the assessment result page — so the result looks identical everywhere.
 *
 * Login-gated (ADR-0004): a signed-out visitor is routed through magic-link
 * sign-in and returned here afterwards; a signed-in user who hasn't taken the
 * assessment yet is sent to start it (the home entry stays hidden for them, so
 * this guards a direct visit).
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
