import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The signed-in Account's profile: a stable place to return to your saved
 * result from the home page (issue #18, ADR-0004). Login-gated — an
 * unauthenticated visitor is routed through sign-in (and back here once signed
 * in), and a signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The result is rendered by the shared `ResultView` (issue #6) — the same view
 * shown right after submitting and on `/assessment/result`, so the presentation
 * is identical everywhere. This page deliberately omits the 360 observer-share
 * section (that lives on `/assessment/result`); it's the calm "here is your
 * result" surface reached from the home-page "View your results" entry.
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
