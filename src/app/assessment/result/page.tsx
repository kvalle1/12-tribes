import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { buildResultView } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { ResultView } from "../result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * Scoring runs here on the server from the stored words (the word→tribe mapping
 * never reaches the client), and the shared `ResultView` renders the enriched
 * view — so the page looks identical whether reached right after submitting or
 * on a later revisit.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const view = buildResultView(
    score(row.words),
    row.primarySlug,
    row.secondarySlug,
    row.words,
  );

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
          <ResultView view={view} />
        </div>
      </div>
    </main>
  );
}
