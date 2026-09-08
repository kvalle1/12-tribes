import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The signed-in Subject's profile — the stable place to return to their saved
 * result from the home page (ADR-0004, PRD story 17, issue #18).
 *
 * Login-gated like the rest of the assessment flow: an unauthenticated visitor
 * is routed through magic-link sign-in and back here, and a signed-in user who
 * hasn't taken the assessment is sent to start it. The result itself is rendered
 * by the shared `ResultView` (issue #6) — the same view shown right after
 * submitting and on the saved-result page — so the profile stays a thin wrapper
 * with nothing about the result reimplemented here.
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
