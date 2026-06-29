import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankTribes } from "@/lib/assessment/ranking";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full reading — Primary/Secondary headline with profile links, the ranked
 * normalized scores for all 12 tribes as bars, and the words the Subject chose —
 * is rendered by the shared `ResultView` (issue #6). Scoring runs here on the
 * server from the saved words; the view receives only the computed scores, so it
 * renders identically post-submit and on a later revisit.
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
  const ranked = rankTribes(row.words);

  return (
    <ResultView
      primary={primary}
      secondary={secondary}
      ranked={ranked}
      words={row.words}
    />
  );
}
