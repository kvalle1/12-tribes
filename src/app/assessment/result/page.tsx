import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "./result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The page is a thin auth + load wrapper; the view itself lives in `ResultView`
 * so the profile page (#18) can render the identical result. The 12-tribe
 * ranking, selected words, and profile links (issue #6) are recomputed by
 * `ResultView` from the saved `words`, so this page just hands over the row.
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
      words={row.words}
      primarySlug={row.primarySlug}
      secondarySlug={row.secondarySlug}
    />
  );
}
