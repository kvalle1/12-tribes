import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline, resolveRanked } from "@/lib/assessment/result";
import { rankScores, score } from "@/lib/assessment/score";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full 12-tribe ranking is recomputed from the stored `words` by the pure
 * scoring core (server-side only), so the ranking can never drift from the saved
 * selection. The same `ResultView` renders whether this is the post-submit
 * landing or a later revisit, and the profile page (issue #18) reuses it.
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
  const ranked = resolveRanked(rankScores(score(row.words)));

  return (
    <ResultView
      primary={primary}
      secondary={secondary}
      ranked={ranked}
      words={row.words}
    />
  );
}
