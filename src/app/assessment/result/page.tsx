import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { AssessmentResultView } from "@/components/assessment-result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full 12-tribe ranking is recomputed here on the server from the stored
 * `words` (the source of truth), so the ranking can never drift from the saved
 * selection and the word→tribe mapping never reaches the client (ADR-0009). The
 * presentational `AssessmentResultView` is shared with the profile page (#18),
 * so the result renders identically post-submit and on revisit.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const { primary, secondary } = resolveHeadline(
    row.primarySlug,
    row.secondarySlug,
  );

  return (
    <AssessmentResultView
      primary={primary}
      secondary={secondary}
      scores={score(row.words)}
      words={row.words}
    />
  );
}
