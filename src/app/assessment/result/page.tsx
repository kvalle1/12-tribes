import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "./result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result view — Primary/Secondary headline, the 12-tribe ranking bars,
 * the words the Subject chose, and the profile links (issue #6) — lives in the
 * reusable `ResultView` so it renders identically here and on the profile page
 * (#18), whether shown right after submitting or when revisiting the saved result.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <ResultView
        words={row.words}
        primarySlug={row.primarySlug}
        secondarySlug={row.secondarySlug}
      />
    </main>
  );
}
