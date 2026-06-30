import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The enriched view itself — headline, the 12-tribe ranking bars, the selected
 * words, and the profile links — lives in `ResultView`, which renders from the
 * saved row alone so this page and the profile page (#18) show it identically.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <ResultView
        words={row.words}
        primarySlug={row.primarySlug}
        secondarySlug={row.secondarySlug}
      />
    </main>
  );
}
