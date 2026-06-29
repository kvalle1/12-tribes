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
 * The full result view (headline + 12-tribe ranking bars + chosen words +
 * profile links) lives in the reusable `ResultView` component (#6). Scoring runs
 * here on the server — `score`/the word→tribe mapping never reach the client
 * (ADR-0009) — by re-scoring the saved words, so the same render is produced
 * whether the Subject just submitted or is revisiting their saved result.
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
      scores={score(row.words)}
      primarySlug={row.primarySlug}
      secondarySlug={row.secondarySlug}
    />
  );
}
