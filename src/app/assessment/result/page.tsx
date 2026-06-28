import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "../result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full 12-tribe ranking is recomputed here from the saved `words` by the
 * pure scoring core, so the bars can never drift from the stored selection. The
 * same `ResultView` is shown straight after a submit (this route) and when the
 * Subject returns to it, and is reused by the profile page (#18).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const headline = resolveHeadline(row.primarySlug, row.secondarySlug);
  const scores = score(row.words);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <ResultView headline={headline} scores={scores} words={row.words} />
    </main>
  );
}
