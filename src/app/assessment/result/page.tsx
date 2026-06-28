import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "../result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * Loading + the auth gate live here; the result itself is rendered by the shared
 * `ResultView` so the same view appears whether the Subject just submitted or
 * came back to it later (and so the profile page, issue #18, can reuse it).
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
