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
 * The full Strength Profile (all 12 normalized tribe scores) is recomputed here
 * from the stored words — scoring runs server-side only so the word→tribe
 * mapping never reaches the client (ADR-0009) — and rendered via the shared
 * `ResultView`, so this page looks identical whether reached right after
 * submitting or when revisiting the saved result.
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
