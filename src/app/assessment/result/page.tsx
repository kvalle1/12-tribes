import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { buildResultView } from "@/lib/assessment/result-view";
import { ResultView } from "./result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result view — the headline, the 12-tribe ranking bars, the selected
 * words, and the profile links — renders identically here whether shown right
 * after submitting or when the Subject returns to their saved result, because
 * both paths land on this page. The profile page (#18) reuses the same view.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const view = buildResultView({
    words: row.words,
    primarySlug: row.primarySlug,
    secondarySlug: row.secondarySlug,
  });

  return <ResultView view={view} />;
}
