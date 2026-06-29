import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankTribes } from "@/lib/assessment/ranking";
import { score } from "@/lib/assessment/score";
import { AssessmentResultView } from "@/components/assessment-result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The 12-tribe ranking is recomputed here on the server from the stored `words`
 * by the pure scoring core (ADR-0009 keeps the word→tribe mapping off the
 * client), then handed — with the resolved tribes and the words — to the shared
 * result view, so the same view renders post-submit and on revisit, and the
 * profile page (#18) can reuse it.
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
  const ranked = rankTribes(score(row.words), row.primarySlug, row.secondarySlug);

  return (
    <AssessmentResultView
      primary={primary}
      secondary={secondary}
      ranked={ranked}
      words={row.words}
    />
  );
}
