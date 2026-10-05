import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * Profile — a signed-in Subject's way back to their saved result from the home
 * page (issue #18, ADR-0004).
 *
 * Login-gated: an unauthenticated visitor is routed through sign-in and then
 * back here. A signed-in user who hasn't taken the assessment yet is sent to
 * start it (the home-page entry that links here is hidden for them, but a
 * direct visit still needs a sensible destination).
 *
 * The result is rendered by the shared `ResultView` (issue #6) — identical to
 * the post-submit and saved-result views — so the profile stays in lockstep
 * with the rest of the app and no scoring logic is duplicated here.
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

        <p className="mt-14 border-t border-hair pt-8 text-[14px] text-muted">
          Changed since you last answered?{" "}
          <Link
            href="/assessment"
            className="border-b border-gold pb-0.5 text-ink transition-colors hover:text-gold"
          >
            Retake the assessment
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
