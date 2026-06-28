import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "./result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The view itself is the shared `ResultView` (issue #6): the same component
 * renders right after submitting (the assessment action redirects here) and when
 * a Subject revisits this saved result, so the two are identical by construction.
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
      primarySlug={row.primarySlug}
      secondarySlug={row.secondarySlug}
    />
  );
}
