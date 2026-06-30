import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "./result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full 12-tribe ranking is recomputed from the saved `words` by the pure
 * scoring core here on the server (the word→tribe mapping never reaches the
 * client), then handed to the presentational `ResultView` along with the
 * resolved headline tribes and the selected words. The same view renders whether
 * the Subject just submitted or is revisiting their saved result.
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
  const scores = score(row.words);

  return (
    <ResultView
      primary={primary}
      secondary={secondary}
      scores={scores}
      words={row.words}
    />
  );
}
