import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline, rankTribes } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "../result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The 12-tribe ranking is recomputed from the saved `words` by the pure scoring
 * core (server-side only, so the word→tribe mapping never reaches the client),
 * which keeps the ranking from ever drifting from the stored result. Everything
 * else — headline, selected words, profile links — comes straight off the saved
 * row. The same `ResultView` renders both here (post-submit and on revisit) and,
 * later, the profile page (#18).
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
  const ranking = rankTribes(score(row.words));

  return (
    <ResultView
      primary={primary}
      secondary={secondary}
      ranking={ranking}
      words={row.words}
    />
  );
}
