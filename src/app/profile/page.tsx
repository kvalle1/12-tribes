import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile (issue #18, PRD story 17): a stable place to return to
 * their saved current result from the home page. Login-gated — an unauthenticated
 * visitor is routed through magic-link sign-in (so a copied/bookmarked link still
 * works), and a signed-in user who hasn't taken the assessment is sent to start
 * it.
 *
 * The result is rendered by the shared `ResultView` (issue #6) — the same view
 * shown right after submitting and when revisiting the saved result on
 * `/assessment/result`, so the Subject sees an identical read of their tribe
 * wherever they land.
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
