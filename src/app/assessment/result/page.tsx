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
 * Scoring runs here on the server (the word→tribe mapping never reaches the
 * client) and the already-computed scores are handed to the presentational
 * `ResultView`, which renders the same whether shown right after submitting or
 * when revisiting the saved result.
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
    <main className="min-h-screen bg-bone text-ink">
      <ResultView
        scores={scores}
        words={row.words}
        primary={primary}
        secondary={secondary}
      />
    </main>
  );
}
