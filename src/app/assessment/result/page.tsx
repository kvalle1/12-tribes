import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { rankTribes, resolveHeadline } from "@/lib/assessment/result";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full 12-tribe ranking is recomputed from the saved `words` by the pure
 * scoring core here on the server — `words` stays the source of truth and the
 * mapping never reaches the client (ADR-0009). The same `ResultView` renders
 * whether the Subject just submitted (this is where the submit action redirects)
 * or has come back to revisit their saved result.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const headline = resolveHeadline(row.primarySlug, row.secondarySlug);
  const ranked = rankTribes(score(row.words));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <ResultView headline={headline} ranked={ranked} words={row.words} />
    </main>
  );
}
