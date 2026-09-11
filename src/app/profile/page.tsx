import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The signed-in user's profile — a stable place that represents their tribe
 * (issue #18, PRD stories 16–17). Login-gated (ADR-0004): an unauthenticated
 * visitor is routed through sign-in with a callback back here, and a signed-in
 * user who hasn't taken the assessment is sent to start it.
 *
 * The saved current result is rendered by the shared `ResultView` (issue #6) —
 * the identical view shown right after submitting and when revisiting the saved
 * result — so a Subject's tribe reads the same everywhere. The 360 observer
 * share lives on the assessment result page (issue #8); the profile is the lean,
 * link-here-from-home view of the result itself.
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
