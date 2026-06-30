import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { AssessmentResultView } from "@/components/assessment-result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result (issue #6): the headline Primary (and Secondary when one
 * qualifies), the 12-tribe ranking bars, the selected words, and prominent links
 * into the tribe profiles. The per-tribe scores are recomputed from the saved
 * words by the server-only scoring core so the word→tribe mapping never reaches
 * the client; only the aggregate scores are handed to the view. The same view
 * renders identically post-submit and on a return visit.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const scores = score(row.words);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10">
          <AssessmentResultView
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
            scores={scores}
            words={row.words}
          />
        </div>
      </div>
    </main>
  );
}
