import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * Loading and scoring happen here on the server: the 12-tribe ranking is
 * recomputed from the stored `words` by the pure scoring core (so the ranking
 * can never drift from the words that produced it), then handed to the
 * presentational `ResultView` (issue #6), which the profile page (#18) reuses so
 * the view is identical post-submit and on a later visit.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <ResultView
      scores={score(row.words)}
      primarySlug={row.primarySlug}
      secondarySlug={row.secondarySlug}
      words={row.words}
    />
  );
}
