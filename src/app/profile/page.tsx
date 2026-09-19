import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Account's saved current result, reachable from the home page (issue #18,
 * PRD stories 16–17). Login-gated: an unauthenticated visitor is routed through
 * sign-in and returned here afterwards, and a signed-in Account with no saved
 * result is sent to start the assessment.
 *
 * The result is rendered by the shared `ResultView` (issue #6) — the same view
 * shown right after submitting and on the `/assessment/result` revisit — so the
 * profile shows an identical result. Unlike the assessment result page, the
 * profile omits the 360 observer-share CTA; it is purely a way back to your own
 * result.
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
