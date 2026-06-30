import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { AssessmentResult } from "@/components/assessment-result";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The 12-tribe ranking is recomputed here from the stored `words` by the pure
 * scoring core — `words` stays the source of truth, so the ranking can never
 * drift from it — then handed to the shared <AssessmentResult> view (issue #6),
 * which the profile page (#18) reuses so the view is identical wherever it shows.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <AssessmentResult
      scores={score(row.words)}
      primarySlug={row.primarySlug}
      secondarySlug={row.secondarySlug}
      words={row.words}
    />
  );
}
