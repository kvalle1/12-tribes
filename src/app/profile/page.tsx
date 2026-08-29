import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile: the stable place to return to their saved result from
 * the home page (issue #18, PRD stories 16/17, ADR-0004).
 *
 * Login-gated — an unauthenticated visitor is routed through magic-link sign-in
 * back to here, and a signed-in user who hasn't taken the assessment is sent to
 * start it. The saved result is rendered by the shared `ResultView` (issue #6),
 * the same view shown right after submitting and when revisiting the result, so
 * the profile never drifts from the canonical result presentation.
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
