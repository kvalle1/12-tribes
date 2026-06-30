import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { rankTribes } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full view — headline, the 12-tribe ranking bars, the chosen words, and the
 * profile links — lives in the shared `ResultView` (#6), so it renders
 * identically here (post-submit and on revisit) and on the profile page (#18).
 * The ranking is recomputed from the stored `words` with the pure scoring core,
 * server-side, so the word→tribe mapping never reaches the client (ADR-0009).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const ranked = rankTribes(
    score(row.words),
    row.primarySlug,
    row.secondarySlug,
  );

  return <ResultView ranked={ranked} words={row.words} />;
}
