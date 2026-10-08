import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile — a stable place that represents their tribe (issue #18,
 * PRD stories 16–17). It shows the Account's single current result (ADR-0004)
 * rendered by the shared `ResultView` (issue #6), the same view used right after
 * submitting and on the saved-result page, so the presentation is identical
 * everywhere. Unlike the assessment result page it omits the 360 observer
 * share section — the profile is purely "this is my tribe."
 *
 * Login-gated: an unauthenticated visitor is routed through magic-link sign-in
 * and returned here afterwards. A signed-in user who hasn't taken the
 * assessment yet has nothing to show, so they're sent to start it — the home
 * "View your results" entry is hidden for them precisely so they rarely land
 * here in that state.
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

        <p className="mt-14 border-t border-hair pt-8 text-[15px] text-muted">
          This is your current result.{" "}
          <Link
            href="/assessment"
            className="border-b border-gold pb-0.5 text-ink transition-colors hover:text-gold"
          >
            Retake the assessment
          </Link>{" "}
          any time to replace it.
        </p>
      </div>
    </main>
  );
}
